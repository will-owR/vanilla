// Small helper to generate PDF buffer using Puppeteer.
// It uses the existing browserInstance if available, otherwise launches a temporary browser.
let puppeteer;
try {
  puppeteer = require("puppeteer-core");
} catch (e) {
  try {
    puppeteer = require("puppeteer");
  } catch (er) {
    // leave undefined; generatePdfBuffer will throw if not available
    puppeteer = null;
  }
}
const serviceState = require("./index").serviceState || {};
const fs = require("fs");
const path = require("path");

// Allow tests to use a mock PDF generator when a browser is unavailable.
let mockPdf = null;
try {
  const useMock =
    process.env.PDF_GENERATOR_IMPL === "mock" ||
    (process.env.NODE_ENV === "test" && process.env.SKIP_PUPPETEER === "true");
  if (useMock) {
    // relative to server/ directory
    mockPdf = require("./test-utils/pdfMock");
  }
} catch (e) {
  mockPdf = null;
}

// PDF validation utilities use pdfjs-dist if available (devDependency).
let pdfjs;
try {
  pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
} catch (e) {
  pdfjs = null;
}

async function generatePdfBuffer({
  title,
  body,
  browser: providedBrowser,
  validate = false,
  envelope,
} = {}) {
  if (mockPdf && typeof mockPdf.generatePdfBuffer === "function") {
    // Delegate to mock implementation in test-mode to avoid launching a browser.
    // Pass `envelope` through so the mock can render multi-page envelopes.
    return mockPdf.generatePdfBuffer({
      title,
      body,
      browser: providedBrowser,
      validate,
      envelope,
    });
  }
  let browser;
  let page;
  let launched = false;
  try {
    if (!providedBrowser) {
      // Prefer an explicit Chrome/Chromium path when using puppeteer-core or CI.
      const execPath =
        process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
      const baseArgs = ["--no-sandbox", "--disable-dev-shm-usage"];

      const launchOptions = {
        args: baseArgs,
        // let caller override default timeout via env (ms)
        timeout: Number(process.env.PUPPETEER_LAUNCH_TIMEOUT_MS) || 30000,
      };
      if (execPath) launchOptions.executablePath = execPath;

      // Retry a couple times for flaky CI/launcher issues
      const maxAttempts = 2;
      let lastErr;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          browser = await puppeteer.launch(launchOptions);
          launched = true;
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          // small backoff
          await new Promise((r) => setTimeout(r, attempt * 250));
        }
      }
      if (!browser && lastErr) {
        throw new Error(
          `Puppeteer launch failed after ${maxAttempts} attempts: ${lastErr.message}`
        );
      }
    } else {
      browser = providedBrowser;
    }

    page = await browser.newPage();
    // Rendering strategy (in priority order):
    // 1. Full HTML body (composed eBook with styling) if available
    // 2. Stack-based rendering from envelope.pages (legacy/fallback)
    // 3. Simple wrapping of body
    let contentHtml;
    if (body && String(body).trim().toLowerCase().startsWith("<!doctype")) {
      // If body already contains a full HTML document (e.g., composed eBook from genieService),
      // use it as-is without wrapping - this preserves all styling and formatting
      console.log(
        "[pdfGenerator] Routing: body is full HTML (<!doctype detected - PRIORITY 1)"
      );
      contentHtml = body;
    } else if (envelope && Array.isArray(envelope.pages)) {
      console.log(
        "[pdfGenerator] Routing: envelope provided (stack-based rendering - Variant B - PRIORITY 2)"
      );

      // Build stack-based pages with semi-transparent backgrounds
      const pagesHtml = envelope.pages
        .map((p, pageIndex) => {
          const blocks = (p.blocks || [])
            .map((b) => {
              if (b.type === "html") return String(b.content || "");
              if (b.type === "text")
                return `<div>${String(b.content || "")}</div>`;
              return `<pre>${String(b.content || "")}</pre>`;
            })
            .join("\n");

          // Stack-based HTML with 3 z-index layers
          return `
            <div class="page">
              <!-- Stack 0: Background image (20% opacity) -->
              <div class="page-bg"></div>
              
              <!-- Stack 1: Semi-transparent content (85% opacity - Variant B) -->
              <div class="content">
                <h1>${String(p.title || "")}</h1>
                ${blocks}
              </div>
              
              <!-- Stack 2: Framing and page details -->
              <div class="page-number">Page ${pageIndex + 1}</div>
            </div>
          `;
        })
        .join("\n");

      // Build complete HTML with stack-based CSS
      contentHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Georgia', serif;
              background: white;
            }
            
            /* Container for all pages */
            .page {
              position: relative;
              width: 210mm;
              height: 297mm;
              page-break-after: always;
              background: white;
              overflow: hidden;
            }
            
            /* Stack 0: Background image (20% opacity) */
            .page-bg {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-size: cover;
              background-position: center;
              opacity: 0.2;
              z-index: 0;
              pointer-events: none;
            }
            
            /* Stack 1: Content with semi-transparent background (Variant B) */
            .content {
              position: relative;
              z-index: 1;
              padding: 40px;
              height: 100%;
              background-color: rgba(255, 255, 255, 0.85);
              color: #000000;
              line-height: 1.6;
              overflow: hidden;
            }
            
            .content h1 {
              color: #333333;
              margin-bottom: 20px;
              font-size: 1.8em;
              margin-top: 0;
            }
            
            .content h2 {
              color: #333333;
              margin: 20px 0 10px 0;
              font-size: 1.4em;
            }
            
            .content h3 {
              color: #444444;
              margin: 15px 0 8px 0;
              font-size: 1.1em;
            }
            
            .content p {
              color: #000000;
              margin: 12px 0;
              text-align: justify;
            }
            
            .content section {
              margin-bottom: 20px;
            }
            
            .content div {
              color: #000000;
            }
            
            .content pre {
              background-color: rgba(240, 240, 240, 0.5);
              padding: 10px;
              border-radius: 4px;
              overflow-x: auto;
              color: #333333;
            }
            
            /* Stack 2: Page framing and numbering */
            .page-number {
              position: absolute;
              bottom: 20px;
              right: 20px;
              z-index: 2;
              font-size: 10px;
              color: #666666;
              font-family: sans-serif;
            }
            
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              .page {
                margin: 0;
                page-break-after: always;
              }
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
        </body>
        </html>
      `;
    } else {
      console.log("[pdfGenerator] Routing: wrapping body (PRIORITY 3)");
      contentHtml = `<!doctype html><html><body><h1>${title}</h1><div>${body}</div></body></html>`;
    }

    // FIX 4.2: Verify CSS rendering in headless Chrome
    await page.setContent(contentHtml, { waitUntil: "networkidle0" });

    console.log("[PDF] Waiting for fonts and images to load...");
    try {
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(resolve);
          } else {
            setTimeout(resolve, 1000);
          }
        });
      });
    } catch (err) {
      console.warn("[PDF] Font loading check failed (non-fatal):", err.message);
    }

    // Verify computed styles on content layer (Stack 1)
    try {
      const styles = await page.evaluate(() => {
        const content = document.querySelector(".content");
        if (content) {
          const computed = window.getComputedStyle(content);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            zIndex: computed.zIndex,
            visibility: computed.visibility,
            display: computed.display,
          };
        }
        return null;
      });

      console.log("[PDF] Stack 1 (content) computed styles:", styles);

      if (styles) {
        if (styles.color === styles.backgroundColor) {
          console.warn(
            "[PDF] ⚠️ VISIBILITY ISSUE: text color matches background!"
          );
          console.warn(
            "[PDF] Text color:",
            styles.color,
            "Background:",
            styles.backgroundColor
          );
        }
        if (styles.visibility === "hidden" || styles.display === "none") {
          console.warn(
            "[PDF] ⚠️ VISIBILITY ISSUE: content layer is hidden or not displayed!"
          );
        }
      }
    } catch (err) {
      console.warn("[PDF] CSS verification failed (non-fatal):", err.message);
    }

    // Verify images are loaded
    try {
      const imageLoaded = await page.evaluate(() => {
        const images = document.querySelectorAll("img");
        return Array.from(images).every(
          (img) => img.complete && img.naturalHeight > 0
        );
      });
      console.log("[PDF] Images loaded:", imageLoaded);
    } catch (err) {
      console.warn("[PDF] Image verification failed (non-fatal):", err.message);
    }

    // FIX 4.3: Generate PDF with stack-aware options
    const pdfOptions = {
      format: "A4",
      printBackground: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
      scale: 1.0,
      preferCSSPageSize: true,
      timeout: 60000,
    };

    console.log(
      "[PDF] Generating PDF with stack-based options (Variant B):",
      pdfOptions
    );
    let buffer = await page.pdf(pdfOptions);

    console.log(
      "[pdfGenerator] PDF generated, buffer size:",
      buffer.length || "unknown"
    );
    console.log("[PDF] Generated successfully, size:", buffer.length, "bytes");
    console.log("[PDF] Expected: > 100KB (indicates multi-page, all content)");
    if (buffer.length < 100000) {
      console.warn(
        "[PDF] ⚠️ WARNING: PDF smaller than expected, may be incomplete"
      );
    }

    if (page && launched) await page.close();
    if (launched && browser) await browser.close();

    // Ensure buffer is a Node.js Buffer (convert from ArrayBuffer if needed)
    if (buffer && !Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(buffer);
    }
    console.log("[pdfGenerator] Final buffer size:", buffer.length);

    if (validate) {
      // Run non-fatal validation and return both buffer and validation summary.
      try {
        const validation = await validatePdfBuffer(buffer);
        // Do not throw on warnings — return an object with both buffer and validation.
        return { buffer, validation };
      } catch (valErr) {
        // If validation fails catastrophically, surface a warning but still return buffer.
        return {
          buffer,
          validation: {
            ok: false,
            errors: ["validation-failed", valErr.message],
            warnings: [],
          },
        };
      }
    }

    return buffer;
  } catch (e) {
    if (page && launched)
      try {
        await page.close();
      } catch (er) {}
    if (launched && browser)
      try {
        await browser.close();
      } catch (er) {}
    throw e;
  }
}

module.exports = { generatePdfBuffer };

async function validatePdfBuffer(buffer) {
  if (mockPdf && typeof mockPdf.validatePdfBuffer === "function") {
    return mockPdf.validatePdfBuffer(buffer);
  }
  const result = { ok: true, errors: [], warnings: [], pageCount: 0 };
  if (!pdfjs) {
    result.warnings.push(
      "pdfjs-dist not available; skipping detailed validation"
    );
    return result;
  }

  try {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({ data });
    const doc = await loadingTask.promise;
    result.pageCount = doc.numPages;
    if (doc.numPages < 1) {
      result.ok = false;
      result.errors.push("PDF has no pages");
    }

    // Check first page viewport for A4 (in points)
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const width = viewport.width;
    const height = viewport.height;
    const A4_WIDTH_PT = 595.28;
    const A4_HEIGHT_PT = 841.89;
    const TOLERANCE = 12;
    if (
      Math.abs(width - A4_WIDTH_PT) > TOLERANCE ||
      Math.abs(height - A4_HEIGHT_PT) > TOLERANCE
    ) {
      result.warnings.push(
        `Page size differs from A4: w=${Math.round(width)}h=${Math.round(
          height
        )}`
      );
    }

    // Basic font presence check: search for '/Font' in raw buffer string as a heuristic
    const raw = Buffer.from(buffer).toString("latin1");
    if (!raw.includes("/Font")) {
      result.warnings.push("No font resource markers found in PDF (heuristic)");
    }

    await page.cleanup?.();
    await doc.destroy?.();
    return result;
  } catch (err) {
    result.ok = false;
    result.errors.push(`Validation error: ${err.message}`);
    return result;
  }
}

module.exports.validatePdfBuffer = validatePdfBuffer;
