import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  buildMockAiResponse,
  MAX_PAGES,
} = require("../utils/aiMockResponse.js");

describe("buildMockAiResponse", () => {
  it("returns a default single-page response when no pages specified", () => {
    const res = buildMockAiResponse("hello world");
    expect(res).toBeTruthy();
    expect(res.aiResponse).toBeTruthy();
    expect(res.aiResponse.pageCount).toBe(1);
    expect(res.content).toBeTruthy();
    expect(res.metadata).toBeTruthy();
  });

  it("clamps page count to MAX_PAGES when requested pages exceed limit", () => {
    const res = buildMockAiResponse("x", { pages: MAX_PAGES + 100 });
    expect(res.aiResponse.pageCount).toBe(MAX_PAGES);
  });
});
