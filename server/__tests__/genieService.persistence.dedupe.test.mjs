import { describe, it, expect, beforeEach, afterEach } from "vitest";

// This test injects a dbUtils that throws on createPrompt (simulating a
// unique constraint failure), but returns an existing prompt when
// getPrompts() is called. The generator should recover and return the
// existing promptId without throwing.

describe("genieService persist dedupe-on-create", () => {
  let genie;
  beforeEach(() => {
    // Ensure env flags are set before requiring the module so module-level
    // constants are evaluated correctly.
    process.env.GENIE_PERSISTENCE_ENABLED = "1";
    process.env.GENIE_PERSISTENCE_AWAIT = "1";
    // Clear module cache and re-require to ensure fresh state
    delete require.cache[require.resolve("../genieService")];
    genie = require("../genieService");
  });

  afterEach(() => {
    genie._resetDbUtils();
    genie._resetSampleService();
    delete process.env.GENIE_PERSISTENCE_ENABLED;
    delete process.env.GENIE_PERSISTENCE_AWAIT;
  });

  it("recovers from createPrompt uniqueness error by reusing existing prompt", async () => {
    // Inject sample service that returns deterministic content
    genie._setSampleService({
      async generateFromPrompt(prompt) {
        return { content: { title: `T: ${prompt}`, body: prompt }, copies: [] };
      },
    });

    // Mock dbUtils: createPrompt throws; getPrompts returns existing match; createAIResult succeeds
    genie._setDbUtils({
      async createPrompt(promptText) {
        const e = new Error(
          "SQLITE_CONSTRAINT: UNIQUE constraint failed: prompt"
        );
        e.code = "SQLITE_CONSTRAINT";
        throw e;
      },
      async getPrompts(limit) {
        return [{ id: 77, prompt: "Hello dedupe test" }];
      },
      async createAIResult(promptId, resultObj) {
        return { id: 88 };
      },
      async getAIResultById() {
        return null;
      },
    });

    process.env.GENIE_PERSISTENCE_ENABLED = "1";
    process.env.GENIE_PERSISTENCE_AWAIT = "1";

    const r = await genie.generate("Hello dedupe test");
    expect(r).toBeDefined();
    expect(r.success).toBe(true);
    expect(r.data.promptId).toBe(77);
    expect(r.data.resultId).toBe(88);
  });
});
