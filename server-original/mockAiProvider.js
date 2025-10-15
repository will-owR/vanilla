const fs = require("fs");
const path = require("path");

function loadStub(filename) {
  const p = path.resolve(__dirname, "test-fixtures", "ai-stubs", filename);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

module.exports = {
  getTextStub(prompt) {
    // naive selection: return text-stub-1 for now
    return loadStub("text-stub-1.json");
  },
  getImageStub(prompt) {
    return loadStub("image-stub-1.json");
  },
};
