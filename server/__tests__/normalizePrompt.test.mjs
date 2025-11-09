import { describe, it, expect } from "vitest";
import normalizePrompt from "../utils/normalizePrompt.js";

describe("normalizePrompt", () => {
  it("null/undefined -> empty string", () => {
    expect(normalizePrompt(null)).toBe("");
    expect(normalizePrompt(undefined)).toBe("");
  });

  it("collapses whitespace and trims", () => {
    const input = "  Hello   world\n\nthis\tis  a   test  ";
    const expected = "Hello world this is a test";
    expect(normalizePrompt(input)).toBe(expected);
  });

  it("preserves case", () => {
    const input = "  Mixed CASE Prompt\n";
    expect(normalizePrompt(input)).toBe("Mixed CASE Prompt");
  });
});
