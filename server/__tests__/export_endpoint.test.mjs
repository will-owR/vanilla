import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";

// Import the server module (CommonJS) via dynamic import; Node will expose
// module.exports as the default export when required from ESM.
const appModule = await import("../index.js");
const app = appModule.default || appModule;

beforeAll(async () => {
  // Ensure server started without listening (test mode)
  if (typeof appModule.startServer === "function") {
    await appModule.startServer({ listen: false });
  }
  // Force mock PDF generator for reliable CI tests
  process.env.PDF_GENERATOR_IMPL = process.env.PDF_GENERATOR_IMPL || "mock";
  process.env.SKIP_PUPPETEER = "true";
});

afterAll(async () => {
  try {
    const browser = appModule.browser;
    if (browser && typeof browser.close === "function") await browser.close();
  } catch (e) {
    // ignore
  }
});

describe("POST /export", () => {
  it("returns a PDF buffer for a prompt", async () => {
    const prompt =
      "Smoke test prompt: Export a one-page sample book about summer activities.";

    const res = await request(app)
      .post("/export")
      .set("Accept", "application/pdf")
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .send({ prompt });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    const buffer = res.body;
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.slice(0, 5).toString()).toBe("%PDF-");
  }, 20000);
});
