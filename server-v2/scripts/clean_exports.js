const fs = require("fs");
const path = require("path");

const exportsDir = path.resolve(__dirname, "..", "..", "data", "exports");
try {
  if (fs.existsSync(exportsDir)) {
    console.log("[clean_exports] removing contents of", exportsDir);
    fs.rmSync(exportsDir, { recursive: true, force: true });
  }
  // Recreate empty directory
  fs.mkdirSync(exportsDir, { recursive: true });
  console.log("[clean_exports] ready");
} catch (e) {
  console.error("[clean_exports] failed", e && e.message ? e.message : e);
  process.exit(1);
}
