// Smoke runner for genieService.export using mock PDF generator
// Run: PDF_GENERATOR_IMPL=mock node server/scripts/run_smoke_export.js
const path = require("path");

(async () => {
  try {
    // Ensure mock generator is used when running this smoke script
    process.env.PDF_GENERATOR_IMPL = process.env.PDF_GENERATOR_IMPL || "mock";
    // Allow tests/dev to avoid launching puppeteer
    process.env.SKIP_PUPPETEER = "true";

    const genieService = require(path.resolve(__dirname, "..", "genieService"));
    const prompt = process.argv[2] || "Test smoke export prompt";
    console.log("Running smoke export for prompt:", prompt);
    const res = await genieService.export({ prompt, validate: true });
    const buffer = res && res.buffer ? res.buffer : res;
    const validation = res && res.validation ? res.validation : null;
    console.log("PDF buffer length:", buffer ? buffer.length : null);
    if (validation) console.log("Validation:", validation);
    if (buffer && buffer.length > 0) process.exit(0);
    else process.exit(2);
  } catch (e) {
    console.error("Smoke export failed:", e && e.message);
    process.exit(3);
  }
})();
