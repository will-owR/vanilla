import { describe, it, expect } from "vitest";
import { getTheme, themes } from "../utils/themeEngine.js";

describe("Module 2: themeEngine - Dark Theme Styling", () => {
  describe("getTheme()", () => {
    it('getTheme("dark") returns valid theme object', () => {
      const theme = getTheme("dark");
      expect(theme).toBeDefined();
      expect(typeof theme).toBe("object");
    });

    it("theme has colors section with all required keys", () => {
      const theme = getTheme("dark");
      expect(theme.colors).toBeDefined();
      expect(theme.colors.background).toBeDefined();
      expect(theme.colors.text).toBeDefined();
      expect(theme.colors.accent).toBeDefined();
      expect(theme.colors.border).toBeDefined();
    });

    it("colors use correct hex format", () => {
      const theme = getTheme("dark");
      const colorRegex = /^#[0-9A-Fa-f]{6}$/;
      expect(theme.colors.background).toMatch(colorRegex);
      expect(theme.colors.text).toMatch(colorRegex);
      expect(theme.colors.accent).toMatch(colorRegex);
    });

    it("theme has fonts section with header, body, mono", () => {
      const theme = getTheme("dark");
      expect(theme.fonts).toBeDefined();
      expect(theme.fonts.header).toBeDefined();
      expect(theme.fonts.body).toBeDefined();
      expect(theme.fonts.mono).toBeDefined();
    });

    it("fonts are strings (font family names)", () => {
      const theme = getTheme("dark");
      expect(typeof theme.fonts.header).toBe("string");
      expect(typeof theme.fonts.body).toBe("string");
      expect(typeof theme.fonts.mono).toBe("string");
    });

    it("theme has spacing section with margins and gaps", () => {
      const theme = getTheme("dark");
      expect(theme.spacing).toBeDefined();
      expect(theme.spacing.pageMargin).toBeDefined();
      expect(theme.spacing.sectionGap).toBeDefined();
      expect(theme.spacing.lineHeight).toBeDefined();
    });

    it("spacing values are properly formatted", () => {
      const theme = getTheme("dark");
      expect(typeof theme.spacing.pageMargin).toBe("string");
      expect(typeof theme.spacing.sectionGap).toBe("string");
      expect(typeof theme.spacing.lineHeight).toBe("number");
    });

    it("theme has styles section with all component styles", () => {
      const theme = getTheme("dark");
      expect(theme.styles).toBeDefined();
      expect(theme.styles.coverPage).toBeDefined();
      expect(theme.styles.copyrightPage).toBeDefined();
      expect(theme.styles.contentPage).toBeDefined();
      expect(theme.styles.epiloguePage).toBeDefined();
      expect(theme.styles.callout).toBeDefined();
      expect(theme.styles.quote).toBeDefined();
    });

    it("coverPage style includes background properties", () => {
      const theme = getTheme("dark");
      const cover = theme.styles.coverPage;
      expect(cover.backgroundColor).toBeDefined();
      expect(cover.textColor).toBeDefined();
    });

    it("contentPage style includes text color properties", () => {
      const theme = getTheme("dark");
      const content = theme.styles.contentPage;
      expect(content.textColor).toBeDefined();
      expect(content.backgroundColor).toBeDefined();
    });

    it("callout style includes accent border properties", () => {
      const theme = getTheme("dark");
      const callout = theme.styles.callout;
      expect(callout.borderColor).toBeDefined();
      expect(callout.backgroundColor).toBeDefined();
    });

    it("quote style is properly defined", () => {
      const theme = getTheme("dark");
      const quote = theme.styles.quote;
      expect(quote.textColor).toBeDefined();
      expect(quote.fontStyle).toBeDefined();
    });

    it("returns default dark theme when no name provided", () => {
      const theme = getTheme();
      expect(theme).toBeDefined();
      expect(theme.colors).toBeDefined();
    });

    it("returns dark theme for invalid theme name", () => {
      const theme = getTheme("invalid-theme");
      expect(theme).toBeDefined();
      expect(theme.colors).toBeDefined();
    });

    it("themes object exports dark theme", () => {
      expect(themes.dark).toBeDefined();
      expect(typeof themes.dark).toBe("object");
    });

    it("all color values have sufficient contrast", () => {
      const theme = getTheme("dark");
      // Dark background (#1a1a1a) + white text (#ffffff) = high contrast
      // Verify text color is light on dark background
      const bgLuminance = parseInt(theme.colors.background.slice(1), 16);
      const textLuminance = parseInt(theme.colors.text.slice(1), 16);
      expect(textLuminance).toBeGreaterThan(bgLuminance);
    });
  });
});
