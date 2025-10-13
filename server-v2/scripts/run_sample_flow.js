#!/usr/bin/env node
// run_sample_flow.js
// Manual verification script: call genieService.generate() with a sample prompt
// and execute persistence.execute() to write files to data/exports.

const path = require("path");
const genie = require("../genieService");
const persistence = require("../persistence");

async function run() {
  try {
    const payload = { prompt: "Autumn leaves falling softly." };
    console.log("Calling genieService.generate() with payload:", payload);
    const res = await genie.generate(payload);
    console.log("genieService.generate() result:");
    console.log(JSON.stringify(res, null, 2));

    if (!res || !res.success) {
      console.error("Generation failed, aborting.");
      process.exit(1);
    }

    const instructions = res.data && res.data.persistInstructions;
    if (
      !instructions ||
      !Array.isArray(instructions) ||
      instructions.length === 0
    ) {
      console.log("No persistInstructions returned; nothing to persist.");
      process.exit(0);
    }

    console.log("Executing persistence.execute() for instructions:");
    console.log(JSON.stringify(instructions, null, 2));

    const results = await persistence.execute(instructions);
    console.log("Persistence results:");
    console.log(JSON.stringify(results, null, 2));

    console.log("\nWrote files:");
    results.forEach((r) => console.log("-", r.path));
  } catch (err) {
    console.error("run_sample_flow error", err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

if (require.main === module) run();
