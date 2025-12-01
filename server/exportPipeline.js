/**
 * exportPipeline - Unified export abstraction
 *
 * Single entry point for all export operations.
 * Both /export and /api/export endpoints route through this pipeline.
 *
 * Responsibilities:
 * 1. Generate ebook content via ebookService
 * 2. Validate contract compliance via contracts module
 * 3. Transform data to PDF-ready format via dataTransforms
 * 4. Generate PDF via pdfGenerator
 *
 * This replaces dual export paths in genieService (export() and exportContent())
 */

const ebookService = require("./ebookService");
const { EbookContract, PDFEnvelopeContract } = require("./contracts");
const { transformPages } = require("./dataTransforms");
const pdfGenerator = require("./pdfGenerator");
const exportService = require("./exportService");
const { v4: uuidv4 } = require("uuid");
let METRICS = null;
try {
  METRICS = require("./metrics/GenerationMetrics");
} catch (e) {
  // metrics optional — don't block exports if metrics module unavailable
  METRICS = null;
}

/**
 * Unified export pipeline
 *
 * Takes a prompt and generates a PDF through a single orchestrated path.
 * This is the ONLY way to export content - no alternative paths.
 *
 * @param {string} prompt - User's content request
 * @param {Object} options - Optional configuration
 *   - theme: 'dark' | 'light' | 'corporate' | 'bold'
 *   - pageCount: number (3-20)
 *   - quality: 'low' | 'medium' | 'high'
 *   - validate: boolean (whether to validate PDF content)
 *   - browser: Puppeteer browser instance (optional)
 *
 * @returns {Promise<Buffer>} PDF file content
 * @throws {Error} If any step fails
 *
 * @example
 * const pdf = await exportPipeline.exportEbook(
 *   "Write a mystery novel",
 *   { theme: 'dark', pageCount: 50 }
 * );
 * res.set('Content-Type', 'application/pdf');
 * res.send(pdf);
 */
async function exportEbook(prompt, options = {}) {
  try {
    // Start a metrics session for this export so downstream services
    // can record events against the same sessionId.
    const sessionId = uuidv4();
    const pageCount = options.pageCount || 8;
    try {
      if (METRICS && typeof METRICS.startSession === "function") {
        METRICS.startSession(sessionId, {
          pageCount,
          title: String(prompt).slice(0, 100),
        });
      }
    } catch (e) {
      console.warn("Metrics.startSession failed:", e && e.message);
    }
    // Expose the last session id for diagnostics and testability
    module.exports._lastSessionId = sessionId;
    // Step 1: Generate ebook content
    console.log("[exportPipeline] Step 1: Generating ebook content");
    const payload = {
      mode: "ebook",
      prompt,
      metadata: {
        theme: options.theme || "dark",
        pageCount: options.pageCount || 8,
      },
    };

    // Propagate sessionId so ebookService and other pipeline modules can
    // attach metrics to this session.
    payload.metadata = payload.metadata || {};
    payload.metadata.sessionId = sessionId;

    const ebook = await ebookService.handle(payload);
    console.log("[exportPipeline] Step 1: ✓ Ebook generated");

    // Step 2: Validate contract (throws if invalid)
    console.log("[exportPipeline] Step 2: Validating contract");
    EbookContract.validate(ebook);
    console.log("[exportPipeline] Step 2: ✓ Contract valid");

    // Step 3: Transform pages to PDF-ready format
    console.log("[exportPipeline] Step 3: Transforming pages");
    const envelope = {
      title: ebook.title,
      chapters: ebook.chapters,
      pages: transformPages(ebook.pages),
      html: ebook.html || null,
      metadata: ebook.metadata,
    };
    console.log("[exportPipeline] Step 3: ✓ Pages transformed");

    // Step 4: Generate PDF via exportService
    console.log("[exportPipeline] Step 4: Generating PDF");
    const result = await exportService.generate(envelope, {
      validate: options.validate,
      browser: options.browser,
    });
    console.log("[exportPipeline] Step 4: ✓ PDF generated");

    // Return buffer
    const buffer = result && result.buffer ? result.buffer : result;
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("PDF generation did not return a Buffer");
    }

    console.log(`[exportPipeline] ✓ Export complete: ${buffer.length} bytes`);

    // Finalize metrics session now that export completed
    try {
      if (METRICS && typeof METRICS.finalizeSession === "function") {
        METRICS.finalizeSession(sessionId);
        console.log("Metrics: finalized session", sessionId);
      }
    } catch (e) {
      console.warn("Metrics.finalizeSession failed:", e && e.message);
    }
    // Keep lastSessionId available after finalization
    module.exports._lastSessionId = sessionId;

    return buffer;
  } catch (error) {
    console.error("[exportPipeline] Export failed:", error.message);
    throw error;
  }
}

/**
 * Export as HTML instead of PDF
 *
 * Same pipeline but returns HTML instead of PDF.
 * Used for preview functionality.
 *
 * @param {string} prompt - User's content request
 * @param {Object} options - Optional configuration
 * @returns {Promise<string>} HTML content
 */
async function exportEbookHTML(prompt, options = {}) {
  try {
    console.log("[exportPipeline] Generating HTML export");
    const payload = {
      mode: "ebook",
      prompt,
      metadata: {
        theme: options.theme || "dark",
        pageCount: options.pageCount || 8,
      },
    };

    const ebook = await ebookService.handle(payload);
    EbookContract.validate(ebook);

    // Return HTML directly (no PDF generation)
    if (ebook.html) {
      console.log("[exportPipeline] ✓ HTML export complete");
      return ebook.html;
    }

    throw new Error("No HTML generated from ebook service");
  } catch (error) {
    console.error("[exportPipeline] HTML export failed:", error.message);
    throw error;
  }
}

module.exports = {
  exportEbook,
  exportEbookHTML,
};
