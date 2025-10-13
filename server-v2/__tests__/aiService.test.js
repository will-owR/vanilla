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

    // Accept either 200 (cached) or 201 (created)
    expect([200, 201]).toContain(res.status);
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
        // promptId/resultId may be absent in the immediate response because
        // persistence is performed asynchronously. Tests will locate them via
        // DB lookup by requestId when necessary.
      },
    });

    // Additional content validation
    expect(res.body.data.content.body.length).toBeGreaterThan(0);

    // Metadata validation
    expect(res.body.data.metadata).toMatchObject({
      model: "mock-1",
      tokens: expect.any(Number),
    });

    // Store IDs for cleanup when present. Persistence happens asynchronously
    // so promptId/resultId may be missing in the initial response. If so,
    // locate the created ai_result by requestId in the DB and derive ids.
    if (res.body.data && res.body.data.promptId && res.body.data.resultId) {
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
      // Poll sqlite for the ai_result with this requestId
      const sqlite3 = require("sqlite3").verbose();
      const dbPath = require("path").join(
        __dirname,
        "..",
        "..",
        "data",
        "your-database-name.db"
      );
      const dbConn = new sqlite3.Database(dbPath);
      let found = null;
      // Increase attempts and wait a bit longer to allow async persistence
      // to complete in CI/dev environments. Total wait ~6.25s (25 * 250ms).
      for (let i = 0; i < 25; i++) {
        // eslint-disable-next-line no-await-in-loop
        found = await new Promise((resolve) => {
          // Try multiple places where the plumbing might have attached the requestId:
          // - top-level response body requestId
          // - X-Request-Id header set by middleware
          // - metadata.requestId inside the data envelope
          const lookupRequestId =
            res.body && res.body.requestId
              ? res.body.requestId
              : res.headers && res.headers["x-request-id"]
              ? res.headers["x-request-id"]
              : res.body &&
                res.body.data &&
                res.body.data.metadata &&
                res.body.data.metadata.requestId
              ? res.body.data.metadata.requestId
              : null;

          if (!lookupRequestId) return resolve(null);

          dbConn.get(
            "SELECT * FROM ai_results WHERE request_id = ? ORDER BY id DESC LIMIT 1",
            [lookupRequestId],
            (err, row) => {
              if (err || !row) return resolve(null);
              resolve(row);
            }
          );
        });
        if (found) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 250));
      }
      dbConn.close();
      if (!found)
        throw new Error(
          "Could not find ai_result by requestId for cleanup/assertions"
        );

      const aiResultId = found.id;
      createdResultIds.push(aiResultId);

      // Parse result JSON and assert content matches
      const resultObj =
        typeof found.result === "string"
          ? JSON.parse(found.result)
          : found.result;
      // The DB stores the `content` portion for ai_results (legacy/intentional).
      // Normalize to a `content` object whether the row contains an envelope
      // ({ content: { ... } }) or just the content itself.
      const contentObj =
        resultObj && resultObj.content ? resultObj.content : resultObj;
      expect(contentObj).toHaveProperty("body");
      expect(contentObj.body.length).toBeGreaterThan(0);

      // If prompt_id exists in ai_results, add it for cleanup and verify prompt row
      if (found.prompt_id) {
        createdPromptIds.push(found.prompt_id);
        const storedPrompt = await request(app).get(
          `/api/prompts/${found.prompt_id}`
        );
        expect(storedPrompt.status).toBe(200);
        expect(storedPrompt.body.data).toHaveProperty("prompt", testPrompt);
      }
    }
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
