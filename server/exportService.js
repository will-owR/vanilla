/**
 * exportService - PDF generation orchestration
 *
 * Separated from genieService to handle a single responsibility:
 * convert canonical envelopes to PDF buffers.
 *
 * Data flow:
 * 1. generate(envelope, options)
 *    - Accepts { pages, metadata, actions } canonical format
 *    - Delegates to pdfGenerator for rendering
 *    - Returns { buffer, validation? }
 */

const pdfGenerator = require("./pdfGenerator");

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
      const generated = await pdfGenerator.generatePdfBuffer({
        envelope,
        validate: options.validate,
        browser: options.browser,
      });

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
