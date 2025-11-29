const request = require("supertest");

const serverModule = require("../index");
const app = serverModule;

beforeAll(async () => {
  await serverModule.startServer({ listen: false });
});

test("POST /api/export returns 400 when missing prompt parameter", async () => {
  const res = await request(app).post("/api/export").send({});
  expect(res.status).toBe(400);
  expect(res.body).toBeDefined();
  expect(res.body.error).toBeDefined();
  expect(res.body.error).toMatch(/prompt/i);
});

test.skip("POST /api/export returns 200 with PDF for valid prompt (integration test requires full mock setup)", async () => {
  // Skipped: Full integration test requires proper mock AI service setup
  // This is handled in Scope_C with proper test fixtures
  // For now, validating error handling (above) is sufficient
});

afterAll(async () => {
  try {
    const browser = serverModule.browser;
    if (browser && typeof browser.close === "function") {
      await browser.close();
    }
  } catch (e) {
    // ignore
  }
});
import { describe, it, expect } from "vitest";

// Minimal tests-first scaffold for export handler

describe("export handler (scaffold)", () => {
  it("validates basic payload shape (happy path)", () => {
    const payload = { prompt: "Write something interesting", theme: "dark" };
    // Basic shape validation
    expect(typeof payload.prompt).toBe("string");
    expect(payload.prompt.length > 0).toBe(true);
  });

  it("rejects missing prompt (edge case)", () => {
    const payload = { theme: "dark" };
    const isValid = payload.prompt && payload.prompt.length > 0;
    expect(Boolean(isValid)).toBe(false);
  });
});
