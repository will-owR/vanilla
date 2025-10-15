// Simple script to run genieService.generate() and persistence.execute()
// Usage: node server/scripts/run_genie_test.js "Your prompt here"

const path = require("path");
const fs = require("fs");

const genie = require("../genieService");
const persistence = require("../persistence");

async function run() {
  const prompt = process.argv.slice(2).join(" ") || "Test prompt for generator";
  console.log("Running genie test with prompt:", prompt);

  const res = await genie.generate(prompt);
  if (!res || !res.success) {
    console.error("genie.generate failed", res);
    process.exit(2);
  }

  console.log("Genie produced content:", res.data.content);
  console.log("Persist instructions:", res.data.persistInstructions);

  if (res.data.persistInstructions && res.data.persistInstructions.length) {
    const results = await persistence.execute(res.data.persistInstructions);
    console.log("Persistence results:");
    results.forEach((r) => console.log(" -", r.purpose, r.path));
    console.log("\nFiles written under:", persistence.BASE_EXPORT_DIR);
  } else {
    console.log("No persistInstructions to execute");
  }
}

run().catch((err) => {
  console.error("Test script failed", err);
  process.exit(1);
});
