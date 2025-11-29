/**
 * pdfGenerator - PDF generation orchestrator (REFACTORED)
 *
 * BEFORE: 400+ lines, 7 mixed concerns
 * AFTER: ~100 lines, thin orchestrator
 *
 * Coordinates:
 * 1. Route input via inputRouter
 * 2. Configure via pdfConfigurator
 * 3. Delegate rendering to renderStrategies via puppeteerBridge
 * 4. Return PDF buffer
 *
 * All the actual work is delegated to focused modules.
 * This file is pure orchestration.
 */

const inputRouter = require("./inputRouter");
const renderStrategies = require("./renderStrategies");
const pdfConfigurator = require("./pdfConfigurator");
const puppeteerBridge = require("./puppeteerBridge");

// For backwards compatibility with mocks in tests
let mockPdf = null;
try {
  const useMock =
    process.env.PDF_GENERATOR_IMPL === "mock" ||
    (process.env.NODE_ENV === "test" && process.env.SKIP_PUPPETEER === "true");
  if (useMock) {
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

/**
 * Generate PDF buffer from input data
 *
 * Main entry point for PDF generation.
 * Orchestrates: routing → configuration → rendering → validation
 *
 * @param {Object} config - Configuration
 *   - title: string (for wrapped rendering)
 *   - body: string (full HTML or plain text)
 *   - browser: Puppeteer browser instance (optional)
 *   - validate: boolean (whether to validate PDF)
 *   - envelope: { pages: [...] } (for stack-based rendering)
 *   - quality: 'low' | 'medium' | 'high'
 *   - theme: 'dark' | 'light' | 'corporate' | 'bold'
 *
 * @returns {Promise<Buffer|Object>} PDF buffer or { buffer, validation }
 * @throws {Error} If generation fails
 */
async function generatePdfBuffer({
  title,
  body,
  browser: providedBrowser,
  validate = false,
  envelope,
  quality = "medium",
  theme = "light",
} = {}) {
  // Use mock in test mode if available
  if (mockPdf && typeof mockPdf.generatePdfBuffer === "function") {
    return mockPdf.generatePdfBuffer({
      title,
      body,
      browser: providedBrowser,
      validate,
      envelope,
      quality,
      theme,
    });
  }

  try {
    console.log("[pdfGenerator] Orchestrating PDF generation");

    // Step 1: Route input to correct rendering strategy
    console.log("[pdfGenerator] Step 1: Routing input");
    const route = inputRouter.routeInput({ body, envelope });
    console.log(`[pdfGenerator] ✓ Routing decision: ${route.strategy}`);

    // Step 2: Build configuration
    console.log("[pdfGenerator] Step 2: Building configuration");
    let options = pdfConfigurator.getDefaultOptions();
    options = pdfConfigurator.applyTheme(options, theme);
    const qualityOpts = pdfConfigurator.getQualityOptions(quality);
    options = pdfConfigurator.mergeOptions(options, qualityOpts);
    pdfConfigurator.validateOptions(options);
    console.log("[pdfGenerator] ✓ Configuration ready");

    // Step 3: Render via appropriate strategy
    console.log("[pdfGenerator] Step 3: Rendering");
    let pdf;

    switch (route.strategy) {
      case "full-html":
        pdf = await renderStrategies.renderFullHTML(route.input, options);
        break;

      case "stack-based":
        pdf = await renderStrategies.renderStackBased(route.input, options);
        break;

      case "wrapped":
        pdf = await renderStrategies.renderWrapped(route.input, title, options);
        break;

      default:
        throw new Error(`Unknown rendering strategy: ${route.strategy}`);
    }

    console.log(`[pdfGenerator] ✓ PDF generated: ${pdf.length} bytes`);

    // Step 4: Validate if requested
    if (validate) {
      console.log("[pdfGenerator] Step 4: Validating PDF");
      try {
        const validation = await validatePdfBuffer(pdf);
        console.log("[pdfGenerator] ✓ Validation complete");
        return { buffer: pdf, validation };
      } catch (valErr) {
        console.warn(
          "[pdfGenerator] Validation failed (non-fatal):",
          valErr.message
        );
        return {
          buffer: pdf,
          validation: {
            ok: false,
            errors: ["validation-failed", valErr.message],
            warnings: [],
          },
        };
      }
    }

    console.log("[pdfGenerator] ✓ PDF generation complete");
    return pdf;
  } catch (error) {
    console.error("[pdfGenerator] Generation failed:", error.message);
    throw error;
  }
}

/**
 * Validate PDF buffer content and structure
 *
 * Performs non-fatal validation checks on generated PDF.
 * Warnings don't throw; errors indicate problems.
 *
 * @param {Buffer} buffer - PDF buffer to validate
 * @returns {Promise<Object>} Validation result { ok, errors, warnings, pageCount }
 */
async function validatePdfBuffer(buffer) {
  // Use mock validation in test mode if available
  if (mockPdf && typeof mockPdf.validatePdfBuffer === "function") {
    return mockPdf.validatePdfBuffer(buffer);
  }

  const result = {
    ok: true,
    errors: [],
    warnings: [],
    pageCount: 0,
  };

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

    // Check first page dimensions
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

    // Check for font resources
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

/**
 * Get current PDF generator status
 *
 * Returns diagnostic information about the PDF generator.
 *
 * @returns {Object} Status information
 */
function getStatus() {
  return {
    routing: inputRouter.getRoutingInfo(),
    browser: puppeteerBridge.getMetrics(),
  };
}

module.exports = {
  generatePdfBuffer,
  validatePdfBuffer,
  getStatus,
};
