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
 * Handle enhanced payload for demo mode
 * Validates required metadata and generates demo content
 * @param {Object} payload - { mode, prompt, metadata, options }
 * @returns {Promise<Object>} Handler result { pages, metadata, actions }
 */
async function handle(payload) {
  const { prompt, metadata = {} } = payload;
  // Note: options from payload is intentionally not used in demo mode
  const content = buildContent(prompt);
  const numPages = parseInt(metadata.pages) || 3;
  const pages = makePages(content, numPages);

  // Convert page objects to standardized format with blocks
  const standardizedPages = pages.map((page, idx) => ({
    id: `p${idx + 1}`,
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
      model: "demo-1",
      pages_count: standardizedPages.length,
      source: "demo",
    },
    actions: {
      // Persist prompt for audit trail
      persist_prompt: true,
      // Support PDF export
      generate_pdf: true,
      can_export: true,
      can_preview: true,
    },
  };
}

module.exports = { generateFromPrompt, buildContent, makePages, handle };
