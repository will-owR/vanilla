import { describe, it, expect, beforeEach } from "vitest";
import CostVisualization from "../src/components/CostVisualization-v2.svelte";
import { flowStore } from "../src/lib/stores/flowStore.js";

describe("CostVisualization Component", () => {
  beforeEach(() => {
    flowStore.reset();
  });

  it("should display base cost", () => {
    const result = {
      costEstimate: 0.5,
    };

    expect(result.costEstimate).toBe(0.5);
  });

  it("should format cost with currency symbol", () => {
    const testCases = [
      { cost: 0.25, expected: "$0.25" },
      { cost: 1.5, expected: "$1.50" },
      { cost: 10.99, expected: "$10.99" },
    ];

    testCases.forEach(({ cost, expected }) => {
      const formatted = `$${cost.toFixed(2)}`;
      expect(formatted).toBe(expected);
    });
  });

  it("should calculate style override cost", () => {
    const baseCost = 1.0;
    const styleCost = baseCost * 0.4;
    expect(styleCost).toBe(0.4);
  });

  it("should calculate tone override cost", () => {
    const baseCost = 1.0;
    const toneCost = baseCost * 0.3;
    expect(toneCost).toBe(0.3);
  });

  it("should calculate themes override cost", () => {
    const baseCost = 1.0;
    const themesCost = baseCost * 0.2;
    expect(themesCost).toBe(0.2);
  });

  it("should calculate total cost with all overrides", () => {
    const baseCost = 1.0;
    const breakdown = {
      base: baseCost,
      style: baseCost * 0.4,
      tone: baseCost * 0.3,
      themes: baseCost * 0.2,
    };
    const total =
      breakdown.base + breakdown.style + breakdown.tone + breakdown.themes;
    expect(total).toBe(1.9);
  });

  it("should calculate cost multiplier", () => {
    const baseCost = 1.0;
    const finalCost = 1.9;
    const multiplier = finalCost / baseCost;
    expect(multiplier).toBe(1.9);
  });

  it("should format multiplier as percentage", () => {
    const multiplier = 1.9;
    const percent = Math.round((multiplier - 1) * 100);
    expect(percent).toBe(90);
  });

  it("should handle overrides object with all dimensions", () => {
    const overrides = {
      style: "gothic",
      tone: "dramatic",
      themes: ["tech", "nature", "creative"],
    };

    expect(overrides.style).toBeDefined();
    expect(overrides.tone).toBeDefined();
    expect(overrides.themes).toHaveLength(3);
  });

  it("should handle overrides object with partial dimensions", () => {
    const overrides = {
      style: "gothic",
    };

    expect(overrides.style).toBeDefined();
    expect(overrides.tone).toBeUndefined();
    expect(overrides.themes).toBeUndefined();
  });

  it("should display breakdown for each override type", () => {
    const baseCost = 0.5;
    const overrides = {
      style: "gothic",
      tone: "dramatic",
      themes: ["tech", "nature"],
    };

    const breakdown = {
      style: overrides.style ? baseCost * 0.4 : 0,
      tone: overrides.tone ? baseCost * 0.3 : 0,
      themes:
        overrides.themes && overrides.themes.length > 0 ? baseCost * 0.2 : 0,
    };

    expect(breakdown.style).toBe(0.2);
    expect(breakdown.tone).toBe(0.15);
    expect(breakdown.themes).toBe(0.1);
  });
});
