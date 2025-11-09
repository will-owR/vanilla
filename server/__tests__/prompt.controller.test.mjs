import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createRequire } from "module";

describe("POST /prompt controller (unit)", () => {
  let app;
  let require;
  let genieMock;
  let crudMock;

  beforeAll(async () => {
    require = createRequire(import.meta.url);
    // Reset modules to ensure we can inject mocks
    vi.resetModules();
    // Create a mock genieService with deterministic result
    genieMock = {
      generate: vi.fn(async (prompt) => ({
        success: true,
        data: {
          content: { title: "T", body: "B", layout: "poem-single-column" },
          copies: [],
          metadata: { model: "mock-1", tokens: 42 },
        },
      })),
    };
    // Replace genieService in the module cache by mocking require
    // We'll also mock crud to ensure controller doesn't call it
    crudMock = {
      createPrompt: vi.fn(async () => ({ id: 999 })),
      createAIResult: vi.fn(async () => ({ id: 1000 })),
    };

    // Use a simple require to load app after stubbing
    // Place mocks into require.cache by temporarily creating a module alias
    const Module = require("module");
    const originalLoad = Module._load;
    // Monkeypatch Module._load to return mocks for specific paths
    Module._load = function (request, parent, isMain) {
      if (request === "./genieService") return genieMock;
      if (request === "./crud") return crudMock;
      return originalLoad.apply(this, arguments);
    };

    // Now require the app (this will pick up our mocked modules)
    app = require("../index");

    // Restore original loader
    Module._load = originalLoad;
  });

  afterAll(async () => {
    // Nothing to clean up; ensure mocks cleared
    vi.restoreAllMocks();
  });

  it("returns genieService result and does not call crud", async () => {
    const res = await request(app).post("/prompt").send({ prompt: "Hello" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body.data).toHaveProperty("content");
    expect(genieMock.generate).toHaveBeenCalled();
    expect(crudMock.createPrompt).not.toHaveBeenCalled();
    expect(crudMock.createAIResult).not.toHaveBeenCalled();
  });
});
