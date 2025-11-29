/**
 * dataTransforms - Consolidated data transformation functions
 *
 * Single source of truth for data transformations between service layers.
 * Previously scattered across genieService.js and exportService.js.
 *
 * Purpose: Eliminate duplication and ensure consistent transformations
 */

/**
 * Transform page array to stack-based format for PDF rendering
 *
 * Converts from ebookService output format:
 *   { title: "Page 1", content: "..." }
 *
 * To PDF-ready format:
 *   { title: "Page 1", blocks: [{ type: "content", content: "..." }] }
 *
 * This is the SINGLE SOURCE OF TRUTH for this transformation.
 * All call sites must import and use this function.
 *
 * @param {Array} pages - Array of page objects with { title, content }
 * @returns {Array} Transformed pages with { title, blocks }
 */
function transformPages(pages) {
  return pages.map((page) => ({
    title: page.title || "",
    blocks: [
      {
        type: "content",
        content: page.content || "",
      },
    ],
  }));
}

/**
 * Transform chapters to pages array
 *
 * Extracts chapter data into page format for rendering.
 * Used when chapters need to be converted to pages.
 *
 * @param {Array} chapters - Array of chapter objects
 * @returns {Array} Array of page objects
 */
function transformChapters(chapters) {
  return chapters.map((ch) => ({
    title: ch.title,
    content: ch.content,
  }));
}

/**
 * Build complete PDF envelope from ebook data
 *
 * Takes ebookService output and builds complete envelope ready for PDF generation.
 * Consolidates all transformation logic in one place.
 *
 * @param {Object} ebook - Ebook data from ebookService.generate()
 * @returns {Object} Complete envelope ready for PDF generation
 */
function transformEnvelope(ebook) {
  return {
    title: ebook.title,
    chapters: ebook.chapters,
    pages: transformPages(ebook.pages),
    metadata: ebook.metadata,
  };
}

module.exports = {
  transformPages,
  transformChapters,
  transformEnvelope,
};
