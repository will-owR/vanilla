// Quick smoke script to test genieService persist-on-miss behavior locally.
// This is not a unit test runner; it's a small executable script to manually
// validate that the persistence step runs and does not block the returned
// generation result. Run with: node server/scripts/smoke_genie_persist_test.js

// Ensure persistence flag is set before requiring the module so the
// module-level ENABLE_PERSISTENCE constant is initialized correctly.
process.env.GENIE_PERSISTENCE_ENABLED = "1";

// Clear cached module if present so the env flag is re-evaluated on require
try {
  const p = require.resolve("../genieService");
  if (require.cache[p]) delete require.cache[p];
} catch (e) {
  // ignore
}

const genie = require("../genieService");

(async () => {
  // Inject a sampleService that returns deterministic content
  genie._setSampleService({
    async generateFromPrompt(prompt) {
      return { content: { title: `T: ${prompt}`, body: prompt }, copies: [] };
    },
  });

  // Inject a fake dbUtils that simulates async create operations
  genie._setDbUtils({
    async createPrompt(promptText) {
      console.log("dbUtils.createPrompt called with:", promptText);
      return { id: 123 };
    },
    async createAIResult(promptId, resultObj) {
      console.log(
        "dbUtils.createAIResult called with:",
        promptId,
        resultObj && resultObj.content && resultObj.content.title
      );
      return { id: 456 };
    },
    async getPrompts() {
      return [];
    },
    async getAIResultById() {
      return null;
    },
  });

  process.env.GENIE_PERSISTENCE_ENABLED = "1";

  try {
    const r = await genie.generate("Hello persistence test");
    console.log("generate returned:", r);
    // allow background persistence a moment to run
    await new Promise((res) => setTimeout(res, 1200));
  } catch (e) {
    console.error("generate threw", e && e.message);
  } finally {
    genie._resetDbUtils();
    genie._resetSampleService();
  }
})();
