// sampleService.js
// A deterministic example application service (intent producer).
// It should NOT perform IO. Instead it returns domain content and persistIntents
// describing what should be persisted or generated.

/**
 * Example intent schema (returned in persistIntents):
 * {
 *   purpose: 'promptFile' | 'previewHtml' | 'asset',
 *   filenameHint?: string,
 *   folderHint?: string,
 *   content?: string, // optional raw content to be persisted
 *   encoding?: 'utf8' | 'base64',
 *   generatorIntent?: { id, type: 'text'|'image', prompt, options }
 * }
 */

async function generateFromPrompt(payload = {}) {
  const prompt = (payload.prompt || "").trim() || "A short poem about autumn.";
  const title = payload.title || "Sample: Autumn Poem";

  // As an example this service requests two persisting actions:
  // 1) Save a raw prompt file
  // 2) Save a preview HTML built from generated text (we include the text here
  //    for simplicity; in a more-declarative flow this could be a generatorIntent).

  const generatedText = `Poem: ${prompt}`; // placeholder deterministic text

  const content = {
    title,
    body: generatedText,
  };

  const persistIntents = [
    {
      purpose: "promptFile",
      filenameHint: "latest_prompt.txt",
      content: prompt,
      encoding: "utf8",
    },
    {
      purpose: "previewHtml",
      filenameHint: "preview.html",
      // In this simple scaffold we return ready-to-write HTML fragment;
      // the orchestrator may re-sanitize or transform as required.
      content: `<h1>${escapeHtml(title)}</h1>\n<div>${escapeHtml(
        generatedText
      )}</div>`,
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

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = { generateFromPrompt };
const fs = require("fs");
const path = require("path");

// Default to the repository-level samples/ directory so the file is located at
// <repo-root>/samples/latest_prompt.txt regardless of the server working dir.
const DEFAULT_SAMPLES_PATH = path.resolve(
  __dirname,
  "..",
  "samples",
  "latest_prompt.txt"
);

// Atomically write to disk: write to a temp file then rename.
function safeWriteFileSync(filePath, contents) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, String(contents), { encoding: "utf8" });
  fs.renameSync(tmp, filePath);
}

function buildContent(prompt, opts = {}) {
  const maxWords = opts.titleWords || 6;
  const words = String(prompt || "")
    .split(/\s+/)
    .filter(Boolean);
  const title = `Prompt: ${words.slice(0, maxWords).join(" ")}`;
  const body = String(prompt || "");
  return { title, body };
}

function savePrompt(prompt, options = {}) {
  const filename = options.filename || DEFAULT_SAMPLES_PATH;
  safeWriteFileSync(filename, String(prompt));
  return filename;
}

function makeCopies(content, n = 3) {
  // Return n copies of the content object for the demo
  return Array.from({ length: n }, () => content);
}

function generateFromPrompt(prompt) {
  const filename = savePrompt(prompt);
  const content = buildContent(prompt);
  const copies = makeCopies(content, 3);
  return { filename, content, copies };
}

function readLatest(options = {}) {
  const filename = options.filename || DEFAULT_SAMPLES_PATH;
  if (!fs.existsSync(filename)) return null;
  return fs.readFileSync(filename, { encoding: "utf8" });
}

module.exports = {
  savePrompt,
  buildContent,
  makeCopies,
  generateFromPrompt,
  readLatest,
};
