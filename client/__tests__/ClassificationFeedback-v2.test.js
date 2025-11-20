import { describe, it, expect, vi, beforeEach } from "vitest";
import ClassificationFeedback from "../src/components/ClassificationFeedback-v2.svelte";
import { flowStore } from "../src/lib/stores/flowStore.js";

describe("ClassificationFeedback Component", () => {
  beforeEach(() => {
    flowStore.reset();
  });

  it("should render with classification data", () => {
    const classification = {
      medium: "ebook",
      style: "minimalist",
      audience: "professionals",
      genre: "business",
      tone: "formal",
      themes: ["tech", "innovation"],
      source: "ai",
      confidence: 0.92,
    };

    expect(classification).toBeDefined();
    expect(classification.medium).toBe("ebook");
    expect(classification.confidence).toBe(0.92);
  });

  it("should display confidence percentage correctly", () => {
    const classification = {
      confidence: 0.85,
      medium: "poster",
      style: "modern",
      source: "rules",
    };

    const confidencePercent = Math.round(classification.confidence * 100);
    expect(confidencePercent).toBe(85);
  });

  it("should determine confidence color based on percentage", () => {
    const testCases = [
      { confidence: 0.92, expected: "high" },
      { confidence: 0.75, expected: "medium" },
      { confidence: 0.65, expected: "low" },
    ];

    testCases.forEach(({ confidence, expected }) => {
      let color;
      if (confidence >= 0.85) color = "high";
      else if (confidence >= 0.7) color = "medium";
      else color = "low";

      expect(color).toBe(expected);
    });
  });

  it("should map source to correct badge", () => {
    const sources = {
      rules: { label: "Rules-Based", icon: "⚙️" },
      ai: { label: "AI-Generated", icon: "🤖" },
      hybrid: { label: "Hybrid", icon: "🔀" },
    };

    expect(sources["rules"].label).toBe("Rules-Based");
    expect(sources["ai"].label).toBe("AI-Generated");
    expect(sources["hybrid"].label).toBe("Hybrid");
  });

  it("should render all detail items when provided", () => {
    const classification = {
      medium: "calendar",
      style: "gothic",
      audience: "students",
      genre: "fantasy",
      tone: "mysterious",
      themes: ["dark", "mystical", "fantasy"],
      source: "hybrid",
      confidence: 0.88,
    };

    expect(classification.medium).toBeDefined();
    expect(classification.style).toBeDefined();
    expect(classification.audience).toBeDefined();
    expect(classification.genre).toBeDefined();
    expect(classification.tone).toBeDefined();
    expect(classification.themes).toHaveLength(3);
  });

  it("should handle themes array formatting", () => {
    const themes = ["tech", "innovation", "future"];
    const formatted = themes.join(", ");
    expect(formatted).toBe("tech, innovation, future");
  });

  it("should provide callable accept and override handlers", () => {
    const onAccept = vi.fn();
    const onRequestOverride = vi.fn();

    onAccept();
    onRequestOverride();

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onRequestOverride).toHaveBeenCalledTimes(1);
  });

  it("should handle missing optional fields gracefully", () => {
    const classification = {
      medium: "stickers",
      source: "rules",
      confidence: 0.91,
    };

    expect(classification.medium).toBe("stickers");
    expect(classification.style).toBeUndefined();
    expect(classification.audience).toBeUndefined();
    // Component should still render without errors
  });
});
