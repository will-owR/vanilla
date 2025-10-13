// sampleService.js
// Minimal, intent-only service. Produces content and persistIntents.
// No filesystem IO here; persistence is executed by server/persistence.js.

const { generateEbookHTML } = require("./ebook");

async function generateFromPrompt(payload = {}) {
  const prompt =
    payload && payload.prompt
      ? String(payload.prompt).trim()
      : "A short poem about autumn.";
  const title =
    payload && payload.title
      ? String(payload.title)
      : `Sample: ${prompt.split(/\s+/).slice(0, 6).join(" ")}`;

  const generatedText = `Poem:\n\n${prompt}`;

  // Build a single-page ebook HTML using the shared ebook helper.
  const ebookHtml = generateEbookHTML([
    {
      title,
      author: payload && payload.author ? payload.author : "",
      content: generatedText,
      background: null,
    },
  ]);

  const content = { title, body: generatedText, html: ebookHtml };

  const persistIntents = [
    {
      purpose: "promptFile",
      filenameHint: "latest_prompt.txt",
      folderHint: "prompts",
      content: prompt,
      encoding: "utf8",
    },
    {
      purpose: "previewHtml",
      filenameHint: "ebook.html",
      folderHint: "previews",
      content: ebookHtml,
      encoding: "utf8",
    },
  ];

  return {
    success: true,
    data: {
      content,
      metadata: { source: "sampleService", version: 1 },
      persistIntents,
    },
  };
}

module.exports = { generateFromPrompt };
// sampleService.js
