/**
 * renderStrategies - PDF rendering strategy implementations
 *
 * Three distinct rendering strategies:
 * 1. renderFullHTML - Use complete HTML document as-is
 * 2. renderStackBased - Build HTML from page stack
 * 3. renderWrapped - Simple HTML wrapper around content
 *
 * Each strategy delegates browser rendering to puppeteerBridge.
 */

const puppeteerBridge = require("./puppeteerBridge");
const pdfConfigurator = require("./pdfConfigurator");

/**
 * Strategy 1: Render full HTML document
 *
 * Uses complete HTML document as-is (e.g., from genieService.compose()).
 * Preserves all styling, layout, and formatting.
 *
 * @param {string} html - Complete HTML document
 * @param {Object} options - PDF rendering options
 * @returns {Promise<Buffer>} PDF buffer
 * @throws {Error} If rendering fails
 */
async function renderFullHTML(html, options = {}) {
  try {
    console.log("[renderStrategies] Strategy 1: renderFullHTML");

    // Validate HTML
    if (!html || typeof html !== "string") {
      throw new Error("renderFullHTML: html must be non-empty string");
    }

    if (!html.includes("<html") && !html.includes("<body")) {
      throw new Error(
        "renderFullHTML: html must include <html> or <body> tags"
      );
    }

    // Merge with defaults
    const config = {
      ...pdfConfigurator.getDefaultOptions(),
      ...options,
    };

    // Render via Puppeteer
    const pdf = await puppeteerBridge.renderToPDF(html, config);
    console.log(`[renderStrategies] ✓ Full HTML rendered: ${pdf.length} bytes`);
    return pdf;
  } catch (error) {
    throw new Error(`renderFullHTML failed: ${error.message}`);
  }
}

/**
 * Strategy 2: Render from page stack
 *
 * Reconstructs HTML from structured pages array.
 * Uses stack-based CSS with layers for backgrounds, content, and framing.
 *
 * @param {Object} envelope - Envelope with { pages: [...] }
 * @param {Object} options - PDF rendering options
 * @returns {Promise<Buffer>} PDF buffer
 * @throws {Error} If rendering fails
 */
async function renderStackBased(envelope, options = {}) {
  try {
    console.log("[renderStrategies] Strategy 2: renderStackBased");

    // Validate envelope
    if (!envelope || !Array.isArray(envelope.pages)) {
      throw new Error("renderStackBased: envelope must have pages array");
    }

    if (envelope.pages.length === 0) {
      throw new Error("renderStackBased: pages array cannot be empty");
    }

    // Build HTML from page stack
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
            
            <!-- Stack 1: Semi-transparent content (85% opacity) -->
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
    const html = `
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
          
          /* Stack 1: Content (85% opacity background) */
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
            margin-top: 15px;
            margin-bottom: 10px;
            font-size: 1.3em;
          }
          
          .content div,
          .content pre {
            margin-bottom: 10px;
          }
          
          /* Stack 2: Page number */
          .page-number {
            position: absolute;
            bottom: 10px;
            right: 20px;
            font-size: 0.8em;
            color: #666;
            z-index: 2;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `;

    // Merge with defaults
    const config = {
      ...pdfConfigurator.getDefaultOptions(),
      ...options,
    };

    // Render via Puppeteer
    const pdf = await puppeteerBridge.renderToPDF(html, config);
    console.log(
      `[renderStrategies] ✓ Stack-based rendered: ${pdf.length} bytes`
    );
    return pdf;
  } catch (error) {
    throw new Error(`renderStackBased failed: ${error.message}`);
  }
}

/**
 * Strategy 3: Wrap body content in HTML
 *
 * Simple legacy fallback: wraps plain content in basic HTML structure.
 * Minimal processing, suitable for simple text content.
 *
 * @param {string} body - Plain text or simple HTML content
 * @param {string} title - Page title
 * @param {Object} options - PDF rendering options
 * @returns {Promise<Buffer>} PDF buffer
 * @throws {Error} If rendering fails
 */
async function renderWrapped(body, title, options = {}) {
  try {
    console.log("[renderStrategies] Strategy 3: renderWrapped");

    // Validate body
    if (!body || typeof body !== "string") {
      throw new Error("renderWrapped: body must be non-empty string");
    }

    // Wrap in basic HTML structure
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            line-height: 1.6;
          }
          h1 {
            color: #333;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        ${title ? `<h1>${title}</h1>` : ""}
        ${body}
      </body>
      </html>
    `;

    // Merge with defaults
    const config = {
      ...pdfConfigurator.getDefaultOptions(),
      ...options,
    };

    // Render via Puppeteer
    const pdf = await puppeteerBridge.renderToPDF(html, config);
    console.log(`[renderStrategies] ✓ Wrapped rendered: ${pdf.length} bytes`);
    return pdf;
  } catch (error) {
    throw new Error(`renderWrapped failed: ${error.message}`);
  }
}

module.exports = {
  renderFullHTML,
  renderStackBased,
  renderWrapped,
};
