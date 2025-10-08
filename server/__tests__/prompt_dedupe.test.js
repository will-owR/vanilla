import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../index";

describe("Prompt dedupe/cache behavior", () => {
  beforeAll(async () => {
    if (typeof app.startServer === "function") await app.startServer();
  });

  it("returns cached result for exact prompt hash on second submission", async () => {
    const prompt = "A unique prompt for dedupe test";

    // Spy on aiService factory so we can assert whether AI was called
    // aiService factory will be stubbed below to intercept AI calls

    // Replace factory with a stub that returns object having generateContent
    let callCount = 0;
    const aiService = require("../aiService");
    const origFactory = aiService.createAIService;
    aiService.createAIService = () => ({
      generateContent: async (p) => {
        callCount++;
        return {
          content: {
            title: "T",
            body: `<p>${p}</p>`,
            layout: "poem-single-column",
          },
          metadata: { model: "mock-test", tokens: 10 },
        };
      },
    });

    try {
      const res1 = await request(app).post("/prompt").send({ prompt });
      expect(res1.status).toBe(201);
      expect(res1.body).toHaveProperty("requestId");
      expect(res1.body.success).toBe(true);

      // Second submission should hit cache and not call AI provider
      const res2 = await request(app).post("/prompt").send({ prompt });
      expect(res2.status === 200 || res2.status === 201).toBeTruthy();
      expect(res2.body).toHaveProperty("requestId");
      expect(res2.body.success).toBe(true);

      // AI should have been called exactly once (first request)
      expect(callCount).toBe(1);
    } finally {
      // Restore factory
      aiService.createAIService = origFactory;
    }
  });
});
