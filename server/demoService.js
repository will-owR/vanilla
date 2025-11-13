// demoService - richer multi-page demo generator (iterative step above sampleService)
// Minimal scaffold: implements the same generateFromPrompt(prompt) async contract
// used by genieService. Returns { content, copies, metadata } where copies
// represent pages.

function buildContent(prompt) {
  const title = `Demo: ${String(prompt || "")
    .split(/\s+/)
    .slice(0, 6)
    .join(" ")}`;
  const body = `Demo generated content for prompt: ${prompt}`;
  return { title, body, layout: "ebook-mock" };
}

function makePages(content, n = 3) {
  return Array.from({ length: n }).map((_, i) => ({
    title: `${content.title} — Part ${i + 1}`,
    body: `${content.body}\n\nPage ${i + 1} content...`,
    layout: content.layout,
  }));
}

async function generateFromPrompt(prompt) {
  const content = buildContent(prompt);
  const copies = makePages(content, 3);
  const metadata = { model: "demo-1", pages: copies.length };
  return { content, copies, metadata };
}

/**
 * Generate pages with content blocks (text, image, callout)
 * Phase A (Demo Mode) algorithm: distribute content evenly across 5 pages
 * @param {string} prompt - User input
 * @param {Object} metadata - { pages: 5, theme: "dark", author: "CELS" }
 * @returns {Promise<Object>} { pages: [...], metadata: {...}, actions: {...} }
 */
async function generatePages(prompt, metadata = {}) {
  const numPages = parseInt(metadata.pages) || 5;
  const theme = metadata.theme || "dark";
  const author = metadata.author || "CELS";

  // Split prompt by sentences for distribution
  const sentences = (prompt || "").split(/[.!?]+/).filter((s) => s.trim());
  const wordsPerPage = Math.max(1, Math.floor(sentences.length / numPages));

  // Generate 5 pages with 3 blocks each (text, image, callout)
  const pages = Array.from({ length: numPages }).map((_, pageIdx) => {
    const pageNum = pageIdx + 1;
    const startIdx = pageIdx * wordsPerPage;
    const endIdx =
      pageIdx === numPages - 1
        ? sentences.length
        : (pageIdx + 1) * wordsPerPage;
    const pageContent =
      sentences.slice(startIdx, endIdx).join(". ") ||
      `Content for page ${pageNum}`;

    return {
      id: `p${pageNum}`,
      title: `Section ${pageNum}: ${pageContent
        .split(" ")
        .slice(0, 4)
        .join(" ")}`,
      blocks: [
        {
          type: "text",
          content: pageContent,
        },
        {
          type: "image",
          caption: `Figure ${pageNum}: Key insight from section ${pageNum}`,
          altText: `Illustration for page ${pageNum}`,
        },
        {
          type: "callout",
          content: `Key takeaway: ${pageContent
            .split(" ")
            .slice(0, 6)
            .join(" ")}`,
        },
      ],
    };
  });

  return {
    pages,
    metadata: {
      model: "demo-1",
      pages_count: pages.length,
      theme,
      author,
      source: "demo",
    },
    actions: {
      persist_prompt: true,
      generate_pdf: true,
      generate_images: true,
      generate_cover: true,
      generate_copyright: true,
      generate_epilogue: true,
      can_export: true,
      can_preview: true,
    },
  };
}

/**
 * Handle enhanced payload for demo mode
 * Validates required metadata and generates demo content
 * @param {Object} payload - { mode, prompt, metadata, options }
 * @returns {Promise<Object>} Handler result { pages, metadata, actions }
 */
async function handle(payload) {
  const { prompt, metadata = {} } = payload;
  // Use new generatePages() function for 5-page demo with rich blocks
  const result = await generatePages(prompt, {
    pages: metadata.pages || 5,
    theme: metadata.theme || "dark",
    author: metadata.author || "CELS",
  });

  return result;
}

module.exports = {
  generateFromPrompt,
  buildContent,
  makePages,
  handle,
  generatePages,
};
