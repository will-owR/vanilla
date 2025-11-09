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

module.exports = { generateFromPrompt, buildContent, makePages };
