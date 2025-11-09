import { describe, it, expect, beforeEach, afterEach } from "vitest";

// This test runs in ESM test runner but imports the CJS module via require
import { createRequire } from "module";
const require = createRequire(import.meta.url);

describe("genieService persistence await (deterministic)", () => {
  let genie;
  beforeEach(() => {
    // Ensure env flags are set before loading the module
    process.env.GENIE_PERSISTENCE_ENABLED = "1";
    process.env.GENIE_PERSISTENCE_AWAIT = "1";
    // Clear require cache
    try {
      delete require.cache[require.resolve("../genieService")];
    } catch (e) {}
    genie = require("../genieService");
  });

  afterEach(() => {
    delete process.env.GENIE_PERSISTENCE_ENABLED;
    delete process.env.GENIE_PERSISTENCE_AWAIT;
    if (genie && genie._resetDbUtils) genie._resetDbUtils();
    if (genie && genie._resetSampleService) genie._resetSampleService();
  });

  it("awaits persistence and returns promptId/resultId", async () => {
    // Inject sync sample service
    genie._setSampleService({
      async generateFromPrompt(prompt) {
        return { content: { title: `T: ${prompt}`, body: prompt }, copies: [] };
      },
    });

    // Inject a dbUtils that performs sync-like resolved Promises
    genie._setDbUtils({
      async createPrompt(promptText) {
        return { id: 555 };
      },
      async createAIResult(promptId, resultObj) {
        return { id: 666 };
      },
      async getPrompts() {
        return [];
      },
      async getAIResultById() {
        return null;
      },
    });

    const res = await genie.generate("Deterministic test prompt");
    expect(res).toBeTruthy();
    expect(res.success).toBe(true);
    expect(res.data).toBeTruthy();
    expect(res.data.promptId).toBe(555);
    expect(res.data.resultId).toBe(666);
  });
});
