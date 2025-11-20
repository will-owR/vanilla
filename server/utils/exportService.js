/**
 * exportService.js — Envelope to PDF conversion service
 *
 * Pure service that converts out_envelope (pages + metadata + actions)
 * to a PDF buffer. Receives data as parameter, no database access.
 *
 * Coordinates with existing pdfGenerator module for rendering.
 */

/**
 * Generate PDF buffer from out_envelope
 * @param {Object} outEnvelope - Canonical { pages, metadata, actions }
 * @param {Object} options - Generation options
 * @param {boolean} options.validate - Whether to validate PDF after generation
 * @returns {Promise<{buffer: Buffer, validation?: Object}>}
 */
async function generate(outEnvelope, options = {}) {
  if (!outEnvelope) {
    throw new Error("outEnvelope is required");
  }

  const { validate = false } = options;

  try {
    // Lazily require pdfGenerator to avoid circular deps
    const pdfGenerator = require("./pdfGenerator");

    // Build HTML from envelope
    const html = buildHtmlFromEnvelope(outEnvelope);

    // Generate PDF buffer
    const buffer = await pdfGenerator.generatePdfBuffer({
      html,
      validate,
    });

    const result = { buffer };

    // Optional validation report
    if (validate) {
      try {
        const validation = await pdfGenerator.validatePdfBuffer(buffer);
        result.validation = validation;
      } catch (err) {
        console.warn("PDF validation failed:", err.message);
        // Don't throw; continue with buffer even if validation fails
      }
    }

    return result;
  } catch (err) {
    throw new Error(`PDF generation failed: ${err.message}`);
  }
}

/**
 * Build HTML from out_envelope structure
 * Converts canonical { pages, metadata, actions } to renderable HTML
 *
 * @param {Object} outEnvelope - The envelope
 * @returns {string} HTML string
 */
function buildHtmlFromEnvelope(outEnvelope) {
  const { pages = [], metadata = {} } = outEnvelope;

  // Build page HTML
  const pagesHtml = pages
    .map((page, idx) => {
      const title = page.title || "";
      const body = page.body || "";
      const blocks = page.blocks || [];

      let pageContent = `<h1>${escapeHtml(title)}</h1>`;

      if (body) {
        pageContent += `<div class="body">${body}</div>`;
      }

      if (blocks && Array.isArray(blocks)) {
        blocks.forEach((block) => {
          if (block.type === "text") {
            pageContent += `<p>${escapeHtml(block.content || "")}</p>`;
          } else if (block.type === "image") {
            pageContent += `<img src="${escapeHtml(
              block.src || ""
            )}" alt="${escapeHtml(block.alt || "")}" />`;
          } else if (block.type === "heading") {
            pageContent += `<h2>${escapeHtml(block.content || "")}</h2>`;
          }
        });
      }

      return `
        <div class="page" data-page="${idx + 1}">
          ${pageContent}
        </div>
      `;
    })
    .join("\n");

  // Build metadata HTML
  const metadataHtml = Object.entries(metadata)
    .map(
      ([key, value]) =>
        `<meta name="${escapeHtml(key)}" content="${escapeHtml(
          String(value)
        )}" />`
    )
    .join("\n");

  // Complete HTML document
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      ${metadataHtml}
      <title>${escapeHtml(metadata.title || "Export")}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .page { page-break-after: always; padding: 2rem; min-height: 100vh; background: white; }
        .page:last-child { page-break-after: avoid; }
        h1 { font-size: 2.5rem; margin-bottom: 1rem; color: #2c3e50; }
        h2 { font-size: 1.5rem; margin: 1.5rem 0 0.5rem 0; color: #34495e; }
        p { margin-bottom: 1rem; text-align: justify; }
        img { max-width: 100%; height: auto; margin: 1rem 0; }
        .body { margin: 1rem 0; }
        @media print { body { margin: 0; padding: 0; } }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return "";
  const div = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(text).replace(/[&<>"']/g, (s) => div[s]);
}

module.exports = {
  generate,
  buildHtmlFromEnvelope,
};
