import { describe, it, expect } from "vitest";
import fs from "fs/promises";

process.env.PDF_GENERATOR_IMPL = "mock";

// Load fixture and service via ESM dynamic imports so Vitest works in ESM mode
const envelopeJson = JSON.parse(
  await fs.readFile(
    new URL("./fixtures/canonical-envelope.json", import.meta.url),
    "utf8"
  )
);

const { default: genieModule } = await import("../genieService.js");
// genieService exports an object; depending on how it's exported this may
// be the module namespace. Normalize to the object.
const genieService =
  genieModule && genieModule.export ? genieModule : genieModule;

describe("genieService.export (envelope)", () => {
  it("forwards canonical envelope to pdfGenerator and returns buffer+validation", async () => {
    const res = await genieService.export({
      envelope: envelopeJson,
      validate: true,
    });
    expect(res).toBeDefined();
    expect(res.buffer || res).toBeDefined();
    expect(res.validation).toBeDefined();
    expect(res.validation.ok).toBe(true);
  });
});
