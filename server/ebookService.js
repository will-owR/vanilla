/**
 * ebookService - ebook generation service
 *
 * Provides enhanced ebook generation with support for structured metadata
 * Implements the same handler contract as demoService for consistency
 */

function buildContent(prompt) {
  const title = `Ebook: ${String(prompt || "")
    .split(/\s+/)
    .slice(0, 6)
    .join(" ")}`;
  const body = `Ebook generated content for prompt: ${prompt}`;
  return { title, body, layout: "ebook-structured" };
}

function makePages(content, n = 3) {
  return Array.from({ length: n }).map((_, i) => ({
    title: `${content.title} — Chapter ${i + 1}`,
    body: `${content.body}\n\nChapter ${i + 1} content...`,
    layout: content.layout,
  }));
}

async function generateFromPrompt(prompt) {
  const content = buildContent(prompt);
  const copies = makePages(content, 3);
  const metadata = { model: "ebook-v1", pages: copies.length };
  return { content, copies, metadata };
}

/**
 * Handle enhanced payload for ebook mode
 * Validates required metadata and generates ebook content
 * @param {Object} payload - { mode, prompt, metadata, options }
 * @returns {Promise<Object>} Handler result { pages, metadata, actions }
 */
async function handle(payload) {
  const { prompt, metadata = {}, options = {} } = payload;

  // Generate ebook content using existing logic
  const content = buildContent(prompt);
  const numPages = parseInt(metadata.pages) || 3;
  const pages = makePages(content, numPages);

  // Convert page objects to standardized format with blocks
  const standardizedPages = pages.map((page, idx) => ({
    id: `chapter${idx + 1}`,
    title: page.title,
    blocks: [
      {
        type: "text",
        content: page.body,
      },
    ],
  }));

  return {
    pages: standardizedPages,
    metadata: {
      ...metadata,
      model: "ebook-v1",
    },
    actions: {
      can_export: true,
      can_preview: true,
    },
  };
}

module.exports = { generateFromPrompt, buildContent, makePages, handle };
