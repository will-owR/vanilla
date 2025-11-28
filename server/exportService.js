/**
 * exportService - PDF generation orchestration
 *
 * Separated from genieService to handle a single responsibility:
 * convert canonical envelopes to PDF buffers.
 *
 * Data flow:
 * 1. generate(envelope, options)
 *    - Accepts { pages, metadata, actions } canonical format
 *    - Routes to mode-specific PDF builder:
 *      * "demo" → pdfStructureBuilder (10-page styled book)
 *      * others → pdfGenerator (simple multi-page layout)
 *    - Returns { buffer, validation? }
 */

const pdfGenerator = require("./pdfGenerator");
const pdfStructureBuilder = require("./utils/pdfStructureBuilder");
const themeEngine = require("./utils/themeEngine");

const exportService = {
  /**
   * Generate PDF from canonical envelope
   * @param {Object} envelope - { pages: Array, metadata?: Object, actions?: Object }
   * @param {Object} [options] - { validate?: boolean, browser?: any, ... }
   * @returns {Promise<{buffer: Buffer, validation?: any}>}
   */
  async generate(envelope, options = {}) {
    if (!envelope || !Array.isArray(envelope.pages)) {
      const error = new Error("Envelope must contain pages array");
      error.status = 400;
      throw error;
    }

    if (envelope.pages.length === 0) {
      const error = new Error("Envelope must contain at least one page");
      error.status = 400;
      throw error;
    }

    try {
      // Route to mode-specific PDF builder
      const mode = envelope.metadata?.mode;
      console.log("[exportService] Generating PDF for mode:", mode);
      let generated;

      if (mode === "demo") {
        // Use demo-specific PDF structure builder for polished book format
        console.log("[exportService] Using pdfStructureBuilder for demo mode");
        try {
          const theme = themeEngine.getTheme(
            envelope.metadata?.theme || "dark"
          );
          generated = await pdfStructureBuilder.generatePDF(envelope, theme, {
            validate: options.validate,
            browser: options.browser,
          });
        } catch (err) {
          throw new Error(`Demo PDF generation failed: ${err.message}`);
        }
      } else {
        // Use generic PDF generator for other modes (basic, sample, etc.)
        console.log(
          "[exportService] Using pdfGenerator for mode:",
          mode || "unspecified"
        );

        // Extract title and body from envelope for pdfGenerator
        const title = envelope.metadata?.title || envelope.title || "Export";
        const body = envelope.html || null;

        console.log("[exportService] Extracted for pdfGenerator:");
        console.log("  - title:", title);
        console.log("  - html length:", body?.length || 0);

        // SOLUTION PATH A: Transform pages to have .blocks structure for stack-based rendering
        // Pages from ebookService have {title, content}, need to convert to {title, blocks: [{type, content}]}
        let processedEnvelope = envelope;
        if (envelope.pages && envelope.pages.length > 0) {
          const firstPage = envelope.pages[0];
          // Check if pages need transformation (have .content but not .blocks)
          if (firstPage.content && !firstPage.blocks) {
            console.log(
              "[exportService] Transforming pages to stack-based format"
            );
            const transformedPages = envelope.pages.map((page) => ({
              title: page.title || "",
              blocks:
                page.content || page.blocks
                  ? [
                      {
                        type: "text",
                        content: page.content || "",
                      },
                    ]
                  : [],
            }));
            processedEnvelope = {
              ...envelope,
              pages: transformedPages,
            };
          }
        }

        generated = await pdfGenerator.generatePdfBuffer({
          title,
          body,
          envelope: processedEnvelope, // Pass transformed envelope for stack-based routing
          validate: options.validate,
          browser: options.browser,
        });
      }

      if (options.validate) {
        if (generated && generated.buffer) {
          return {
            buffer: generated.buffer,
            validation: generated.validation,
          };
        }
        if (generated && generated.validation) {
          return generated;
        }
      }

      return {
        buffer: Buffer.isBuffer(generated) ? generated : generated.buffer,
      };
    } catch (error) {
      const err = new Error(`PDF generation failed: ${error.message}`);
      err.status = 500;
      throw err;
    }
  },
};

module.exports = exportService;
