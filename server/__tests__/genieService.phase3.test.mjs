import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";

describe("genieService Phase-3 persistence (miss -> generate -> persist)", () => {
  let genieService;

  beforeEach(() => {
    vi.resetModules();
    process.env.GENIE_PERSISTENCE_ENABLED = "1";
    // AWAIT persistence should be true in test env by default
  });

  afterEach(() => {
    process.env.GENIE_PERSISTENCE_ENABLED = undefined;
    if (genieService && typeof genieService._resetDbUtils === "function")
      genieService._resetDbUtils();
    if (genieService && typeof genieService._resetSampleService === "function")
      genieService._resetSampleService();
  });

  it("persists prompt and result on miss and attaches ids", async () => {
    const require = createRequire(import.meta.url);
    genieService = require("../genieService.js");

    // Mock dbUtils with createPrompt and createAIResult
    const mockDbUtils = {
      getPrompts: vi.fn(async () => []),
      createPrompt: vi.fn(async (prompt) => ({ id: 321 })),
      createAIResult: vi.fn(async (promptId, payload) => ({ id: 654 })),
    };

    const mockSample = {
      generateFromPrompt: vi.fn(async () => ({
        content: { title: "New", body: "Body" },
        copies: [],
      })),
    };

    genieService._setDbUtils(mockDbUtils);
    genieService._setSampleService(mockSample);

    const res = await genieService.generate("Unique prompt for test");
    expect(res.success).toBe(true);
    // Because test env awaits persistence, promptId/resultId should be attached
    expect(res.data.promptId || res.data.resultId).toBeTruthy();
    expect(mockDbUtils.createPrompt).toHaveBeenCalled();
    expect(mockDbUtils.createAIResult).toHaveBeenCalled();
  });
});
