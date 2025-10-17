const fs = require("fs");
const path = require("path");

const contentDir = path.join(__dirname, "..", "data", "content");

function chooseFile() {
  try {
    const files = fs.readdirSync(contentDir).filter((f) => f !== "");
    if (!files.length) return null;
    return files[Math.floor(Math.random() * files.length)];
  } catch (e) {
    return null;
  }
}

/**
 * Pure-ish generate function: given { prompt, sessionId } returns payload
 * { sessionId, version, html, meta }
 */
function generate({ prompt, sessionId } = {}) {
  const fname = chooseFile();
  if (!fname) throw new Error("no content available");
  const raw = fs.readFileSync(path.join(contentDir, fname), "utf8");

  const html = `<article><h3>Generated (src: ${fname})</h3><p>${raw.replace(
    /\n/g,
    "<br/>"
  )}</p><footer><small>prompt: ${String(
    prompt || ""
  )}</small></footer></article>`;

  return {
    sessionId: sessionId || "demo",
    version: Date.now(),
    html,
    meta: { sourceFile: fname, generatedAt: new Date().toISOString() },
  };
}

module.exports = { generate };
