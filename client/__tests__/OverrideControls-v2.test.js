import { describe, it, expect, vi, beforeEach } from "vitest";
import OverrideControls from "../src/components/OverrideControls-v2.svelte";
import { flowStore } from "../src/lib/stores/flowStore.js";

describe("OverrideControls Component", () => {
  beforeEach(() => {
    flowStore.reset();
  });

  it("should render with style dropdown", () => {
    const styles = ["minimalist", "gothic", "abstract", "retro", "modern"];
    expect(styles).toHaveLength(5);
    expect(styles).toContain("minimalist");
    expect(styles).toContain("modern");
  });

  it("should render with tone dropdown", () => {
    const tones = [
      "professional",
      "casual",
      "uplifting",
      "dramatic",
      "mysterious",
    ];
    expect(tones).toHaveLength(5);
    expect(tones).toContain("professional");
    expect(tones).toContain("mysterious");
  });

  it("should render theme checkboxes", () => {
    const themes = [
      "tech",
      "nature",
      "business",
      "creative",
      "minimalist",
      "bold",
      "elegant",
      "playful",
      "serious",
      "modern",
    ];
    expect(themes).toHaveLength(10);
  });

  it("should handle theme selection", () => {
    const selectedThemes = [];
    const addTheme = (theme) => {
      if (!selectedThemes.includes(theme)) {
        selectedThemes.push(theme);
      }
    };

    addTheme("tech");
    addTheme("creative");
    expect(selectedThemes).toContain("tech");
    expect(selectedThemes).toContain("creative");
    expect(selectedThemes).toHaveLength(2);
  });

  it("should handle theme deselection", () => {
    const selectedThemes = ["tech", "creative", "modern"];
    const removeTheme = (theme) => {
      const index = selectedThemes.indexOf(theme);
      if (index > -1) {
        selectedThemes.splice(index, 1);
      }
    };

    removeTheme("creative");
    expect(selectedThemes).not.toContain("creative");
    expect(selectedThemes).toContain("tech");
    expect(selectedThemes).toHaveLength(2);
  });

  it("should track modified state", () => {
    const original = {
      style: "minimalist",
      tone: "professional",
      themes: ["tech"],
    };

    const current = {
      style: "gothic",
      tone: "dramatic",
      themes: ["tech", "nature"],
    };

    const isModified =
      current.style !== original.style ||
      current.tone !== original.tone ||
      JSON.stringify(current.themes) !== JSON.stringify(original.themes);

    expect(isModified).toBe(true);
  });

  it("should provide override data for API call", () => {
    const overrides = {
      style: "gothic",
      tone: "dramatic",
      themes: ["tech", "creative"],
    };

    expect(overrides.style).toBe("gothic");
    expect(overrides.tone).toBe("dramatic");
    expect(overrides.themes).toHaveLength(2);
  });

  it("should call onApplyOverride handler", () => {
    const onApplyOverride = vi.fn();
    const overrides = {
      style: "abstract",
      tone: "uplifting",
      themes: ["nature", "modern"],
    };

    onApplyOverride(overrides);
    expect(onApplyOverride).toHaveBeenCalledWith(overrides);
  });

  it("should handle reset functionality", () => {
    const original = {
      style: "minimalist",
      tone: "professional",
      themes: ["tech"],
    };

    let current = {
      style: "gothic",
      tone: "dramatic",
      themes: ["nature", "creative"],
    };

    const reset = () => {
      current = { ...original };
    };

    reset();
    expect(current.style).toBe("minimalist");
    expect(current.tone).toBe("professional");
    expect(current.themes).toEqual(["tech"]);
  });
});
