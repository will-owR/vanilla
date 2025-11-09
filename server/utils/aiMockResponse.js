// Helper to build a mock AI response envelope (multi-page)
const DEFAULT_PAGES = parseInt(process.env.GENIE_MOCK_PAGES || "1", 10) || 1;
const MAX_PAGES = 50;

function clampPages(n) {
  const v = parseInt(n || 0, 10) || 0;
  if (v < 1) return 1;
  if (v > MAX_PAGES) return MAX_PAGES;
  return v;
}

function buildMockAiResponse(prompt, opts = {}) {
  const pageCount = clampPages(opts.pages || opts.pageCount || DEFAULT_PAGES);
  const body = String(prompt || "");
  const titlePrefix =
    typeof opts.titlePrefix === "string" ? opts.titlePrefix : "Prompt:";
  const content = {
    title: `${titlePrefix} ${body.slice(0, 50)}`.trim(),
    body,
    layout: opts.layout || "poem-single-column",
  };

  const pages = Array.from({ length: pageCount }, () => ({ ...content }));

  const metadata = {
    model: opts.model || "mock-1",
    tokens:
      typeof opts.tokens === "number"
        ? opts.tokens
        : Math.max(10, Math.min(200, String(body).length)),
  };

  return {
    content,
    aiResponse: {
      pages,
      metadata,
      pageCount: pages.length,
      summary: opts.summary || `Mock ${pages.length}-page LLM result`,
    },
    metadata,
  };
}

module.exports = { buildMockAiResponse, MAX_PAGES };
