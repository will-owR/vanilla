// sampleService.clean.js
// Minimal clean sampleService implementation (intent-only).

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function generateFromPrompt(payload = {}) {
  const prompt = payload && payload.prompt ? String(payload.prompt).trim() : "A short poem about autumn.";
  const title = payload && payload.title ? String(payload.title) : `Sample: ${prompt.split(/\s+/).slice(0,6).join(" ")}`;

  const generatedText = `Poem: ${prompt}`;

  const content = { title, body: generatedText };

  const persistIntents = [
    { purpose: "promptFile", filenameHint: "latest_prompt.txt", folderHint: "prompts", content: prompt, encoding: "utf8" },
    { purpose: "previewHtml", filenameHint: "preview.html", folderHint: "previews", content: `<h1>${escapeHtml(title)}</h1>\n<div>${escapeHtml(generatedText)}</div>`, encoding: "utf8" }
  ];

  return { success: true, data: { content, metadata: { source: "sampleService", version: 1 }, persistIntents } };
}

module.exports = { generateFromPrompt };
