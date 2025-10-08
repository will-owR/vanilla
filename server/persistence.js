// persistence.js
// Simple persistence executor that validates paths and writes files
// atomically (tmp + rename). This is a scaffold for development and testing.

const fs = require("fs");
const path = require("path");

let BASE_EXPORT_DIR = path.resolve(__dirname, "..", "data", "exports");

function setBaseExportDir(dir) {
  BASE_EXPORT_DIR = path.resolve(dir);
}

function ensureBaseDir() {
  if (!fs.existsSync(BASE_EXPORT_DIR)) {
    fs.mkdirSync(BASE_EXPORT_DIR, { recursive: true });
  }
}

function safeJoin(base, ...parts) {
  const p = path.resolve(base, ...parts);
  if (!p.startsWith(base))
    throw new Error("Attempt to write outside base directory");
  return p;
}

async function writeAtomic(targetPath, content, encoding = "utf8") {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${targetPath}.tmp-${Date.now()}`;
  await fs.promises.writeFile(tmpPath, content, { encoding });
  await fs.promises.rename(tmpPath, targetPath);
}

/**
 * Execute persistInstructions.
 * Each instruction: { purpose, folderHint, filenameHint, content, encoding }
 * Returns array of { purpose, path }
 */
async function execute(instructions = [], _opts = {}) {
  ensureBaseDir();
  // Debug: emit base dir used for persistence (useful in test logs)
  try {
    console.log("[persistence] BASE_EXPORT_DIR=", BASE_EXPORT_DIR);
  } catch (e) {}
  const results = [];
  for (const inst of instructions) {
    const folder = inst.folderHint || INST_DEFAULT_FOLDER(inst.purpose);
    const safeFolder = safeJoin(BASE_EXPORT_DIR, folder);
    const filename = sanitizeFilename(
      inst.filenameHint || `file-${Date.now()}`
    );
    const finalPath = path.join(safeFolder, filename);
    await writeAtomic(finalPath, inst.content || "", inst.encoding || "utf8");
    results.push({ purpose: inst.purpose, path: finalPath });
  }
  return results;
}

function INST_DEFAULT_FOLDER(purpose) {
  switch (purpose) {
    case "promptFile":
      return "prompts";
    case "previewHtml":
      return "previews";
    case "asset":
      return "assets";
    default:
      return "misc";
  }
}

function sanitizeFilename(name) {
  // Simple sanitizer: remove path separators
  return name.replace(/[\\/]+/g, "_");
}

module.exports = { execute, BASE_EXPORT_DIR, setBaseExportDir };
