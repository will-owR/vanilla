#!/usr/bin/env node
/*
 * server/scripts/seed-dev.js
 * Lightweight, idempotent seeder for local development.
 * - Dry-run by default (prints planned actions)
 * - Use --apply or set SEED_DEV=true to actually write to DB
 * - Uses existing dbUtils.createPrompt to preserve normalizedHash behavior
 * - Marks created AIResult objects with a small `__seed: true` flag inside `result` JSON
 */

const crypto = require("crypto");
const dbUtils = require("../utils/dbUtils");
const normalizePrompt = require("../utils/normalizePrompt");

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply") || process.env.SEED_DEV === "true";
const VERBOSE = argv.includes("--verbose");

function log(...args) {
  console.log(...args);
}

async function run() {
  // Small, intentionally tiny dataset used for local dev.
  const seeds = [
    {
      prompt: "Seed: Summarize the following text in one paragraph.",
      result: { summary: "This is a seeded summary.", __seed: true },
    },
    {
      prompt:
        "Seed: Produce a short title and description for an article about climate.",
      result: {
        title: "Seeded Climate Title",
        description: "A brief seeded description.",
        __seed: true,
      },
    },
  ];

  const report = { prompts: [] };

  // Only initialize Prisma client if we're actually applying changes.
  const prisma = APPLY ? dbUtils._getPrisma() : null;

  for (const s of seeds) {
    const norm = normalizePrompt(s.prompt);
    const hash = crypto.createHash("sha256").update(norm).digest("hex");

    log("Planned prompt:", s.prompt);
    log("  normalized:", JSON.stringify(norm));
    log("  normalizedHash:", hash);

    // In dry-run mode we do not touch the DB; just print what we'd do.
    if (!APPLY) {
      log("  [dry-run] Would upsert Prompt with normalizedHash", hash);
      log(
        "  [dry-run] Would create AIResult with result",
        JSON.stringify(s.result)
      );
      report.prompts.push({
        normalizedHash: hash,
        promptId: null,
        aiResultCreated: false,
      });
      continue;
    }

    // APPLY path: upsert prompt and conditionally create AIResult if not already seeded
    log("  Upserting Prompt...");
    let promptRec;
    try {
      // dbUtils.createPrompt runs an upsert and returns {id}
      const created = await dbUtils.createPrompt(s.prompt);
      promptRec = { id: created.id, normalizedHash: hash };
      log("  Prompt id:", created.id);
    } catch (e) {
      log("  Failed to create/upsert prompt:", e && e.message ? e.message : e);
      throw e;
    }

    // Check for an existing seeded AIResult (we mark results with __seed: true)
    const existingResults = await prisma.aIResult.findMany({
      where: { promptId: promptRec.id },
    });
    const hasSeeded = existingResults.some(
      (r) => r && r.result && r.result.__seed === true
    );

    if (hasSeeded) {
      log(
        "  Found existing seeded AIResult for prompt id",
        promptRec.id,
        "- skipping create"
      );
      report.prompts.push({
        normalizedHash: hash,
        promptId: promptRec.id,
        aiResultCreated: false,
      });
      continue;
    }

    // Create AIResult inside a transaction with the prompt id to ensure it is linked
    try {
      const created = await dbUtils.createAIResult(promptRec.id, s.result);
      log("  Created AIResult id:", created.id);
      report.prompts.push({
        normalizedHash: hash,
        promptId: promptRec.id,
        aiResultCreated: true,
        aiResultId: created.id,
      });
    } catch (e) {
      log("  Failed to create AIResult:", e && e.message ? e.message : e);
      throw e;
    }
  }

  // Write a tiny report so removals are easy to perform later
  try {
    const fs = require("fs");
    const path = require("path");
    // Keep repo root clean: place transient reports under shared/tmp
    const out = path.resolve(
      process.cwd(),
      "shared",
      "tmp",
      "seed-report.json"
    );
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ applied: APPLY, report }, null, 2), {
      encoding: "utf8",
    });
    log("Wrote seed report to", out);
  } catch (e) {
    if (VERBOSE) console.error("Failed to write seed report:", e);
  }

  if (!APPLY) {
    log(
      "\nDry-run complete. To apply changes run with --apply or set SEED_DEV=true"
    );
  } else {
    log("\nApply complete. Seeded", report.prompts.length, "prompts.");
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeder failed:", err && err.message ? err.message : err);
    process.exit(1);
  });
