/**
 * contracts - Service contract validation
 *
 * Defines and validates contracts at service boundaries.
 * Prevents silent failures by explicitly checking that services return
 * data in the expected format.
 *
 * Pattern: Validate at every service boundary
 */

/**
 * EbookContract - Validates ebook data structure
 *
 * Every ebookService.generate() call must return data matching this contract.
 * Contract violations throw clear errors showing expected shape.
 *
 * Required fields:
 * - title: string (non-empty)
 * - chapters: array of { title, content }
 * - pages: array of { title, content }
 *
 * @example
 * const ebook = await ebookService.generate(prompt);
 * EbookContract.validate(ebook); // Throws if invalid
 */
const EbookContract = {
  required: ["title", "chapters", "pages"],

  /**
   * Validate ebook data matches contract
   * @param {Object} data - Data to validate
   * @returns {Object} The data (if valid)
   * @throws {Error} If validation fails
   */
  validate: (data) => {
    if (!data || typeof data !== "object") {
      throw new Error(`Expected ebook object, got ${typeof data}`);
    }

    // Check required fields present
    for (const field of EbookContract.required) {
      if (!(field in data)) {
        throw new Error(
          `Invalid ebook data: missing required field "${field}". ` +
            `Expected shape: { title, chapters, pages, metadata?, ... }`
        );
      }
    }

    // Validate field types
    if (typeof data.title !== "string" || !data.title.trim()) {
      throw new Error("ebook.title must be a non-empty string");
    }

    if (!Array.isArray(data.chapters)) {
      throw new Error("ebook.chapters must be an array");
    }

    if (!Array.isArray(data.pages)) {
      throw new Error("ebook.pages must be an array");
    }

    // Validate each chapter has required fields
    for (let i = 0; i < data.chapters.length; i++) {
      const ch = data.chapters[i];
      if (typeof ch.title !== "string" || !ch.title.trim()) {
        throw new Error(`ebook.chapters[${i}].title must be non-empty string`);
      }
      if (typeof ch.content !== "string" || !ch.content.trim()) {
        throw new Error(
          `ebook.chapters[${i}].content must be non-empty string`
        );
      }
    }

    // Validate each page has required fields
    for (let i = 0; i < data.pages.length; i++) {
      const p = data.pages[i];
      if (typeof p.title !== "string") {
        throw new Error(`ebook.pages[${i}].title must be string`);
      }
      if (typeof p.content !== "string") {
        throw new Error(`ebook.pages[${i}].content must be string`);
      }
    }

    return data; // Return data if valid
  },

  /**
   * Validate page array specifically
   * @param {Array} pages - Pages to validate
   * @returns {Array} The pages (if valid)
   * @throws {Error} If validation fails
   */
  validatePages: (pages) => {
    if (!Array.isArray(pages)) {
      throw new Error("pages must be an array");
    }
    for (let i = 0; i < pages.length; i++) {
      if (typeof pages[i] !== "object") {
        throw new Error(`pages[${i}] must be object`);
      }
    }
    return pages;
  },
};

/**
 * PDFEnvelopeContract - Validates PDF-ready data format
 *
 * Used to validate data before passing to pdfGenerator.
 * Ensures all required fields for PDF rendering are present.
 */
const PDFEnvelopeContract = {
  required: ["title", "pages"],

  /**
   * Validate PDF envelope matches contract
   * @param {Object} data - Data to validate
   * @returns {Object} The data (if valid)
   * @throws {Error} If validation fails
   */
  validate: (data) => {
    if (!data || typeof data !== "object") {
      throw new Error(`Expected envelope object, got ${typeof data}`);
    }

    for (const field of PDFEnvelopeContract.required) {
      if (!(field in data)) {
        throw new Error(
          `Invalid PDF envelope: missing required field "${field}". ` +
            `Expected: { title, pages, chapters?, html? }`
        );
      }
    }

    if (typeof data.title !== "string") {
      throw new Error("envelope.title must be string");
    }

    if (!Array.isArray(data.pages)) {
      throw new Error("envelope.pages must be array");
    }

    return data;
  },
};

module.exports = {
  EbookContract,
  PDFEnvelopeContract,
};
