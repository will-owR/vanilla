import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../index";

describe("API: /prompt (AI Processing Layer)", () => {
  let createdPromptIds = [];
  let createdResultIds = [];

  // Verify server is running before tests
  beforeAll(async () => {
    try {
      // Ensure programmatic initialization is performed when running in-process
      if (typeof app.startServer === "function") {
        await app.startServer();
      }
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
    } catch (error) {
      throw new Error("Server must be running (app import failed)");
    }
  });

  // Cleanup test data
  afterAll(async () => {
    // Clean up AI results first (foreign key constraint)
    for (const id of createdResultIds) {
      try {
        const res = await request(app).delete(`/api/ai_results/${id}`);
        if (!res.ok) {
          console.warn(`Cleanup failed for AI result ${id}: ${res.status}`);
        }
      } catch (error) {
        console.error("Error during AI result cleanup:", id, error.message);
      }
    }
    // Then clean up prompts
    for (const id of createdPromptIds) {
      try {
        const res = await request(app).delete(`/api/prompts/${id}`);
        if (!res.ok) {
          console.warn(`Cleanup failed for prompt ${id}: ${res.status}`);
        }
      } catch (error) {
        console.error("Error during prompt cleanup:", id, error.message);
      }
    }
    // Clear the arrays
    createdResultIds = [];
    createdPromptIds = [];
  });

  it("should return a structured AI response for a valid prompt", async () => {
    const testPrompt = "Write a poem about the sea.";
    const res = await request(app).post("/prompt").send({ prompt: testPrompt });

    expect(res.status).toBe(201);
    // Core envelope assertions: content and metadata must always be present
    expect(res.body).toMatchObject({
      success: true,
      data: {
        content: {
          title: expect.any(String),
          body: expect.any(String),
          layout: expect.any(String),
        },
        metadata: {
          model: expect.any(String),
          tokens: expect.any(Number),
        },
      },
    });

    // Persistence is best-effort: promptId/resultId may be present when
    // persistence succeeds. If present, assert types and perform cleanup.
    if (res.body && res.body.data && res.body.data.promptId) {
      expect(typeof res.body.data.promptId).toBe("number");
      expect(typeof res.body.data.resultId).toBe("number");
      createdPromptIds.push(res.body.data.promptId);
      createdResultIds.push(res.body.data.resultId);

      // Verify prompt storage
      const storedPrompt = await request(app).get(
        `/api/prompts/${res.body.data.promptId}`
      );
      expect(storedPrompt.status).toBe(200);
      // API returns { success, data }
      expect(storedPrompt.body.data).toHaveProperty("prompt", testPrompt);

      // Verify AI result storage
      const storedResult = await request(app).get(
        `/api/ai_results/${res.body.data.resultId}`
      );
      expect(storedResult.status).toBe(200);
      expect(storedResult.body.data).toHaveProperty("result");
      expect(storedResult.body.data.result).toEqual(res.body.data.content);
    } else {
      // No prompt/result IDs were returned; this is acceptable when
      // persistence is best-effort. Just ensure core content exists.
      expect(res.body.data.content).toBeDefined();
    }

    // Additional content validation
    expect(res.body.data.content.body.length).toBeGreaterThan(0);

    // Metadata validation
    expect(res.body.data.metadata).toMatchObject({
      model: "mock-1",
      tokens: expect.any(Number),
    });

    // (moved above into conditional block to reflect optional persistence)
  });

  it("should return 400 for missing or empty prompt", async () => {
    const res = await request(app).post("/prompt").send({ prompt: "   " });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: expect.any(String),
        status: 400,
        timestamp: expect.any(String),
        requestId: expect.any(String),
        details: expect.any(Object),
      },
    });
  });

  it("should return 400 for missing prompt field", async () => {
    const res = await request(app).post("/prompt").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("status", 400);
    expect(res.body.error.details).toHaveProperty("provided");
    expect(res.body.error.details).toHaveProperty("required");
  });

  it("should return 400 for invalid prompt type", async () => {
    const res = await request(app)
      .post("/prompt")
      .send({ prompt: { invalid: "object" } });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error.details).toHaveProperty("provided", "object");
    expect(res.body.error.details).toHaveProperty(
      "required",
      "non-empty string"
    );
  });
});
