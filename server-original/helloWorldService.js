// helloWorldService.js
// Minimal intent-only service that returns a Hello, world! prompt and preview

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function generateFromPrompt(payload = {}) {
  void payload;
  // reference payload so linters don't flag unused param
  //  const _received = payload || null;
  const text = "Hello, world!";

  const content = {
    title: "Hello",
    body: text,
    html: `<pre>${escapeHtml(text)}</pre>`,
  };

  const persistIntents = [
    {
      purpose: "promptFile",
      filenameHint: "latest_prompt.txt",
      folderHint: "samples",
      content: text,
      encoding: "utf8",
    },
    {
      purpose: "previewHtml",
      filenameHint: "preview.html",
      folderHint: "previews",
      content: `<pre>${escapeHtml(text)}</pre>`,
      encoding: "utf8",
    },
  ];

  return {
    success: true,
    data: {
      content,
      metadata: { source: "helloWorldService", version: 1 },
      persistIntents,
    },
  };
}

module.exports = { generateFromPrompt };
