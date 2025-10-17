const express = require("express");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");

const app = express();
app.use(morgan("dev"));
app.use(express.json());

// serve client static files
app.use("/", express.static(path.join(__dirname, "..", "client")));

// helper: list files in data/content (simple).
const contentDir = path.join(__dirname, "..", "data", "content");
function chooseFile() {
  try {
    const files = fs.readdirSync(contentDir).filter((f) => f !== "");
    if (!files.length) return null;
    // ad-hoc: pick random
    return files[Math.floor(Math.random() * files.length)];
  } catch (e) {
    return null;
  }
}

app.post("/api/generate", (req, res) => {
  const { prompt } = req.body || {};
  const fname = chooseFile();
  if (!fname) return res.status(500).json({ error: "no content available" });
  const raw = fs.readFileSync(path.join(contentDir, fname), "utf8");

  const html = `<article><h3>Generated (src: ${fname})</h3><p>${raw.replace(
    /\n/g,
    "<br/>"
  )}</p><footer><small>prompt: ${String(
    prompt || ""
  )}</small></footer></article>`;
  const payload = {
    sessionId: "demo",
    version: Date.now(),
    html,
    meta: { sourceFile: fname, generatedAt: new Date().toISOString() },
  };
  res.json(payload);
});

const port = process.env.PORT || 3001;
app.listen(port, () =>
  console.log("server-v2 listening on http://localhost:" + port)
);
