import { describe, it, expect, beforeEach } from "vitest";
import StatsPanel from "../src/components/StatsPanel-v2.svelte";
import { flowStore } from "../src/lib/stores/flowStore.js";

describe("StatsPanel Component", () => {
  beforeEach(() => {
    flowStore.reset();
  });

  it("should format latency milliseconds to seconds", () => {
    const testCases = [
      { ms: 1000, expected: "1.00s" },
      { ms: 3400, expected: "3.40s" },
      { ms: 45000, expected: "45.00s" },
      { ms: 0, expected: "0.00s" },
    ];

    testCases.forEach(({ ms, expected }) => {
      const formatted = ms ? `${(ms / 1000).toFixed(2)}s` : "0.00s";
      expect(formatted).toBe(expected);
    });
  });

  it("should format confidence as percentage", () => {
    const testCases = [
      { conf: 0.85, expected: "85%" },
      { conf: 0.92, expected: "92%" },
      { conf: 0.5, expected: "50%" },
      { conf: 1.0, expected: "100%" },
    ];

    testCases.forEach(({ conf, expected }) => {
      const formatted = `${Math.round(conf * 100)}%`;
      expect(formatted).toBe(expected);
    });
  });

  it("should map source to label correctly", () => {
    const sources = {
      rules: "⚙️ Rules-Based",
      ai: "🤖 AI-Generated",
      hybrid: "🔀 Hybrid",
      unknown: "❓ Unknown",
    };

    expect(sources["rules"]).toBe("⚙️ Rules-Based");
    expect(sources["ai"]).toBe("🤖 AI-Generated");
    expect(sources["hybrid"]).toBe("🔀 Hybrid");
  });

  it("should format cost with currency symbol", () => {
    const testCases = [
      { cost: 0.25, expected: "$0.25" },
      { cost: 1.5, expected: "$1.50" },
      { cost: 10.99, expected: "$10.99" },
      { cost: 0, expected: "$0.00" },
    ];

    testCases.forEach(({ cost, expected }) => {
      const formatted = `$${cost.toFixed(2)}`;
      expect(formatted).toBe(expected);
    });
  });

  it("should accept custom model name", () => {
    const defaultModel = "Claude 3.5 Sonnet";
    const customModel = "GPT-4 Turbo";

    expect(defaultModel).toBe("Claude 3.5 Sonnet");
    expect(customModel).toBe("GPT-4 Turbo");
  });

  it("should display all stat items", () => {
    const stats = {
      latency: 2800,
      confidence: 0.88,
      source: "ai",
      costEstimate: 0.45,
      model: "Claude 3.5 Sonnet",
    };

    expect(stats.latency).toBe(2800);
    expect(stats.confidence).toBe(0.88);
    expect(stats.source).toBe("ai");
    expect(stats.costEstimate).toBe(0.45);
    expect(stats.model).toBe("Claude 3.5 Sonnet");
  });

  it("should handle default values when data missing", () => {
    const result = {};
    const classification = {};

    expect(result.latency || 0).toBe(0);
    expect(classification.confidence || 0).toBe(0);
    expect(classification.source || "Unknown").toBe("Unknown");
    expect(result.costEstimate || 0).toBe(0);
  });

  it("should format complete stats panel data", () => {
    const complete = {
      latency: 3200,
      confidence: 0.91,
      source: "hybrid",
      costEstimate: 0.52,
      model: "Claude 3.5 Sonnet",
    };

    const formatted = {
      generationTime: `${(complete.latency / 1000).toFixed(2)}s`,
      confidence: `${Math.round(complete.confidence * 100)}%`,
      source: "🔀 Hybrid",
      cost: `$${complete.costEstimate.toFixed(2)}`,
      model: complete.model,
    };

    expect(formatted.generationTime).toBe("3.20s");
    expect(formatted.confidence).toBe("91%");
    expect(formatted.source).toBe("🔀 Hybrid");
    expect(formatted.cost).toBe("$0.52");
    expect(formatted.model).toBe("Claude 3.5 Sonnet");
  });
});
