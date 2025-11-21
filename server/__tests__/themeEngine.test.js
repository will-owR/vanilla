/**
 * ThemeEngine Tests - Phase B
 * Test suite covering all 10+ test cases from PHASE_B_MODULE_SPECS.md
 */

import { describe, it, expect } from "vitest";
import ThemeEngine from "../utils/themeEngine.js";

describe("ThemeEngine", () => {
  // TE-001: Get dark theme
  it("TE-001: getTheme returns dark theme config", () => {
    const theme = ThemeEngine.getTheme("dark");

    expect(theme).toBeDefined();
    expect(theme.name).toBe("dark");
    expect(theme.colors).toBeDefined();
    expect(theme.colors.background).toBe("#1a1a1a");
    expect(theme.colors.text).toBe("#e0e0e0");
    expect(theme.fonts).toBeDefined();
    expect(theme.spacing).toBeDefined();
  });

  // TE-002: Get light theme
  it("TE-002: getTheme returns light theme config", () => {
    const theme = ThemeEngine.getTheme("light");

    expect(theme.name).toBe("light");
    expect(theme.colors.background).toBe("#ffffff");
    expect(theme.colors.text).toBe("#333333");
  });

  // TE-003: Get corporate theme
  it("TE-003: getTheme returns corporate theme config", () => {
    const theme = ThemeEngine.getTheme("corporate");

    expect(theme.name).toBe("corporate");
    expect(theme.colors.background).toBe("#f5f5f5");
  });

  // TE-004: Get bold theme
  it("TE-004: getTheme returns bold theme config", () => {
    const theme = ThemeEngine.getTheme("bold");

    expect(theme.name).toBe("bold");
    expect(theme.colors.accent).toBe("#d84000");
    expect(theme.colors.headings).toBe("#cc0000");
  });

  // TE-005: Invalid theme throws error
  it("TE-005: getTheme throws error for invalid theme", () => {
    expect(() => ThemeEngine.getTheme("invalid")).toThrow(/Theme not found/);
  });

  // TE-006: List themes
  it("TE-006: listThemes returns all 4 themes", () => {
    const themes = ThemeEngine.listThemes();

    expect(themes).toHaveLength(4);
    expect(themes).toContain("dark");
    expect(themes).toContain("light");
    expect(themes).toContain("corporate");
    expect(themes).toContain("bold");
  });

  // TE-007: Generate CSS for dark theme
  it("TE-007: generateCSS produces valid CSS string for dark", () => {
    const css = ThemeEngine.generateCSS("dark");

    expect(css).toBeDefined();
    expect(css).toContain(":root");
    expect(css).toContain("--color-bg");
    expect(css).toContain("--color-text");
    expect(css).toContain("--font-body");
    expect(css).toContain("#1a1a1a"); // dark background
  });

  // TE-008: Generate CSS for light theme
  it("TE-008: generateCSS produces valid CSS string for light", () => {
    const css = ThemeEngine.generateCSS("light");

    expect(css).toContain("#ffffff"); // light background
    expect(css).toContain("--color-bg: #ffffff");
  });

  // TE-009: Accessibility validation - dark theme
  it("TE-009: validateAccessibility (dark) meets WCAG AA", () => {
    const result = ThemeEngine.validateAccessibility("dark");

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.contrastRatios.text).toBeGreaterThanOrEqual(4.5);
    expect(result.contrastRatios.headings).toBeGreaterThanOrEqual(4.5);
  });

  // TE-010: Accessibility validation - light theme
  it("TE-010: validateAccessibility (light) meets WCAG AA", () => {
    const result = ThemeEngine.validateAccessibility("light");

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.contrastRatios.text).toBeGreaterThanOrEqual(4.5);
  });

  // TE-011: Accessibility validation - corporate theme
  it("TE-011: validateAccessibility (corporate) meets WCAG AA", () => {
    const result = ThemeEngine.validateAccessibility("corporate");

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  // TE-012: Accessibility validation - bold theme
  it("TE-012: validateAccessibility (bold) meets WCAG AA", () => {
    const result = ThemeEngine.validateAccessibility("bold");

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  // TE-013: All themes have required properties
  it("TE-013: all themes have complete required properties", () => {
    const themes = ThemeEngine.listThemes();

    themes.forEach((themeName) => {
      const theme = ThemeEngine.getTheme(themeName);

      expect(theme.name).toBe(themeName);
      expect(theme.colors).toBeDefined();
      expect(theme.colors.background).toBeDefined();
      expect(theme.colors.text).toBeDefined();
      expect(theme.colors.accent).toBeDefined();
      expect(theme.fonts).toBeDefined();
      expect(theme.fonts.body).toBeDefined();
      expect(theme.fonts.headings).toBeDefined();
      expect(theme.spacing).toBeDefined();
    });
  });

  // TE-014: CSS variable consistency
  it("TE-014: CSS variables are unique and well-formed", () => {
    const css = ThemeEngine.generateCSS("dark");

    // Extract all variable names
    const varMatches = css.match(/--[\w-]+/g) || [];
    const uniqueVars = new Set(varMatches);

    // Should have expected variables
    expect(uniqueVars.size).toBeGreaterThan(10);
    expect(css).toContain("--color-");
    expect(css).toContain("--font-");
    expect(css).toContain("--spacing-");
  });

  // TE-015: Theme color diversity
  it("TE-015: each theme has visually distinct colors", () => {
    const darkTheme = ThemeEngine.getTheme("dark");
    const lightTheme = ThemeEngine.getTheme("light");
    const corporateTheme = ThemeEngine.getTheme("corporate");
    const boldTheme = ThemeEngine.getTheme("bold");

    // Dark and light should be opposite
    expect(darkTheme.colors.background).not.toBe(lightTheme.colors.background);
    expect(darkTheme.colors.text).not.toBe(lightTheme.colors.text);

    // Each theme should have unique primary accent
    const accents = [
      darkTheme.colors.accent,
      lightTheme.colors.accent,
      corporateTheme.colors.accent,
      boldTheme.colors.accent,
    ];
    const uniqueAccents = new Set(accents);
    expect(uniqueAccents.size).toBeGreaterThanOrEqual(3); // At least 3 unique accents
  });

  // TE-016: Accessibility issues structure
  it("TE-016: validateAccessibility returns proper structure", () => {
    const result = ThemeEngine.validateAccessibility("dark");

    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("issues");
    expect(result).toHaveProperty("contrastRatios");
    expect(Array.isArray(result.issues)).toBe(true);
    expect(typeof result.contrastRatios).toBe("object");
  });

  // TE-017: Contrast ratios are numeric
  it("TE-017: contrast ratios are valid numeric values", () => {
    const themes = ThemeEngine.listThemes();

    themes.forEach((themeName) => {
      const result = ThemeEngine.validateAccessibility(themeName);

      Object.values(result.contrastRatios).forEach((ratio) => {
        expect(typeof ratio).toBe("number");
        expect(ratio).toBeGreaterThan(0);
        expect(ratio).toBeLessThan(50); // Max possible contrast
      });
    });
  });

  // TE-018: CSS generation includes body styles
  it("TE-018: generateCSS includes body element styling", () => {
    const css = ThemeEngine.generateCSS("dark");

    expect(css).toContain("body {");
    expect(css).toContain("background-color");
    expect(css).toContain("color:");
    expect(css).toContain("font-family");
  });

  // TE-019: CSS generation includes heading styles
  it("TE-019: generateCSS includes heading element styling", () => {
    const css = ThemeEngine.generateCSS("light");

    expect(css).toContain("h1, h2, h3");
    expect(css).toContain("font-family");
  });

  // TE-020: All themes use valid hex colors
  it("TE-020: all colors are valid hex format", () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    const themes = ThemeEngine.listThemes();

    themes.forEach((themeName) => {
      const theme = ThemeEngine.getTheme(themeName);

      Object.values(theme.colors).forEach((color) => {
        expect(color).toMatch(hexRegex);
      });
    });
  });
});
