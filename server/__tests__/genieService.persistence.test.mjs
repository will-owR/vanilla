import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";

describe("genieService persistence read-only lookup", () => {
  let genieService;

  beforeEach(() => {
    vi.resetModules();
    genieService = null;
  });

  it("returns cached DB result when a match exists", async () => {
    const mockDbUtils = {
      getPrompts: vi.fn(async () => [{ id: 42, prompt: "Hello world" }]),
      getAIResultById: vi.fn(async () => ({
        id: 101,
        result: JSON.stringify({
          content: { title: "T", body: "B" },
          copies: [],
        }),
      })),
    };

    process.env.GENIE_PERSISTENCE_ENABLED = "1";
    const mockSample = {
      generateFromPrompt: vi.fn(async () => ({
        content: { title: "X", body: "Y" },
        copies: [],
      })),
    };

    const require = createRequire(import.meta.url);
    genieService = require("../genieService.js");
    genieService._setDbUtils(mockDbUtils);
    genieService._setSampleService(mockSample);

    const res = await genieService.generate("Hello world");
    expect(res.success).toBe(true);
    expect(res.data.promptId).toBe(42);
    expect(res.data.resultId).toBe(101);
    expect(mockSample.generateFromPrompt).not.toHaveBeenCalled();
  });

  it("calls the generator and returns generated content when no DB match", async () => {
    const mockDbUtils = {
      getPrompts: vi.fn(async () => []),
      getAIResultById: vi.fn(async () => null),
    };
    process.env.GENIE_PERSISTENCE_ENABLED = "1";
    const mockSample = {
      generateFromPrompt: vi.fn(async () => ({
        content: { title: "G", body: "gen" },
        copies: ["a"],
      })),
    };

    const require = createRequire(import.meta.url);
    genieService = require("../genieService.js");
    genieService._setDbUtils(mockDbUtils);
    genieService._setSampleService(mockSample);

    const res = await genieService.generate("No match");
    expect(res.success).toBe(true);
    expect(res.data.content).toBeTruthy();
    expect(res.data.content.title).toBe("G");
    expect(mockSample.generateFromPrompt).toHaveBeenCalled();
  });

  afterEach(() => {
    process.env.GENIE_PERSISTENCE_ENABLED = undefined;
    if (genieService && typeof genieService._resetDbUtils === "function")
      genieService._resetDbUtils();
    if (genieService && typeof genieService._resetSampleService === "function")
      genieService._resetSampleService();
    vi.clearAllMocks();
  });
});
