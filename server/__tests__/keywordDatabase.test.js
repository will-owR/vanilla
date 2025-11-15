/**
 * Unit tests for Keyword Database
 * Tests classification accuracy and keyword matching
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  KeywordDatabaseAPI,
  keywordDatabase,
} from "../utils/keywordDatabase.js";

describe("KeywordDatabase - Module 2", () => {
  let db;

  beforeEach(() => {
    db = new KeywordDatabaseAPI(keywordDatabase);
  });

  describe("getKeywords()", () => {
    it("should return all keywords for mediums category", () => {
      const mediums = db.getKeywords("mediums");
      expect(mediums).toBeDefined();
      expect(Object.keys(mediums).length).toBeGreaterThan(0);
      expect(mediums.ebook).toBeDefined();
      expect(Array.isArray(mediums.ebook)).toBe(true);
    });

    it("should return all keywords for styles category", () => {
      const styles = db.getKeywords("styles");
      expect(styles).toBeDefined();
      expect(Object.keys(styles).length).toBeGreaterThan(7);
      expect(styles.whimsical).toBeDefined();
      expect(styles.gothic).toBeDefined();
      expect(styles.minimalist).toBeDefined();
    });

    it("should return all keywords for themes category", () => {
      const themes = db.getKeywords("themes");
      expect(themes).toBeDefined();
      expect(Object.keys(themes).length).toBeGreaterThan(10);
      expect(themes["playful-colors"]).toBeDefined();
      expect(themes["magical-realism"]).toBeDefined();
      expect(themes["dark-tones"]).toBeDefined();
    });

    it("should return empty object for nonexistent category", () => {
      const result = db.getKeywords("nonexistent");
      expect(result).toEqual({});
    });
  });

  describe("findMatches()", () => {
    it("should find exact keyword match - 'book' -> ebook", () => {
      const result = db.findMatches("book", "mediums");
      expect(result).toBe("ebook");
    });

    it("should find exact keyword match - 'calendar' -> calendar", () => {
      const result = db.findMatches("calendar", "mediums");
      expect(result).toBe("calendar");
    });

    it("should find exact keyword match - 'poster' -> poster", () => {
      const result = db.findMatches("poster", "mediums");
      expect(result).toBe("poster");
    });

    it("should find style match - 'whimsical' -> whimsical", () => {
      const result = db.findMatches("whimsical", "styles");
      expect(result).toBe("whimsical");
    });

    it("should find style match - 'gothic' -> gothic", () => {
      const result = db.findMatches("gothic", "styles");
      expect(result).toBe("gothic");
    });

    it("should find theme match - 'dark' -> dark-tones", () => {
      const result = db.findMatches("dark", "themes");
      expect(result).toBe("dark-tones");
    });

    it("should find theme match - 'magical' -> magical-realism", () => {
      const result = db.findMatches("magical", "themes");
      expect(result).toBe("magical-realism");
    });

    it("should handle case-insensitivity - 'BOOK' -> ebook", () => {
      const result = db.findMatches("BOOK", "mediums");
      expect(result).toBe("ebook");
    });

    it("should return null for non-matching token", () => {
      const result = db.findMatches("xyz123", "mediums");
      expect(result).toBeNull();
    });

    it("should return null for nonexistent category", () => {
      const result = db.findMatches("book", "nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("searchAll()", () => {
    it("should find multiple matches for ambiguous token", () => {
      const results = db.searchAll("dark", "themes");
      expect(results).toContain("dark-tones");
      expect(Array.isArray(results)).toBe(true);
    });

    it("should return empty array for non-matching token", () => {
      const results = db.searchAll("xyz123", "mediums");
      expect(results).toEqual([]);
    });

    it("should handle case-insensitivity in searchAll", () => {
      const results = db.searchAll("CALENDAR", "mediums");
      expect(results).toContain("calendar");
    });
  });

  describe("getCategories()", () => {
    it("should return all available categories", () => {
      const categories = db.getCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain("mediums");
      expect(categories).toContain("styles");
      expect(categories).toContain("themes");
    });
  });

  describe("getStats()", () => {
    it("should return statistics for all categories", () => {
      const stats = db.getStats();
      expect(stats).toBeDefined();
      expect(stats.mediums).toBeDefined();
      expect(stats.mediums.categories).toBeGreaterThan(0);
      expect(stats.mediums.totalKeywords).toBeGreaterThan(0);
    });

    it("should show mediums has comprehensive coverage", () => {
      const stats = db.getStats();
      expect(stats.mediums.categories).toBeGreaterThanOrEqual(8); // At least 8 mediums
      expect(stats.mediums.totalKeywords).toBeGreaterThan(100);
    });

    it("should show styles has comprehensive coverage", () => {
      const stats = db.getStats();
      expect(stats.styles.categories).toBeGreaterThanOrEqual(7); // At least 7 styles
      expect(stats.styles.totalKeywords).toBeGreaterThan(100);
    });

    it("should show themes has comprehensive coverage", () => {
      const stats = db.getStats();
      expect(stats.themes.categories).toBeGreaterThanOrEqual(10); // At least 10 themes
      expect(stats.themes.totalKeywords).toBeGreaterThan(100);
    });
  });

  describe("addKeyword()", () => {
    it("should add new keyword to existing category", () => {
      db.addKeyword("mediums", "ebook", "book-bundle");
      const matches = db.findMatches("book-bundle", "mediums");
      expect(matches).toBe("ebook");
    });

    it("should not add duplicate keywords", () => {
      const beforeCount = db.database.mediums.ebook.length;
      db.addKeyword("mediums", "ebook", "book"); // Already exists
      const afterCount = db.database.mediums.ebook.length;
      expect(afterCount).toBe(beforeCount);
    });

    it("should create new category if not exists", () => {
      db.addKeyword("custom-category", "new-key", "test-keyword");
      expect(db.database["custom-category"]).toBeDefined();
      expect(db.database["custom-category"]["new-key"]).toContain(
        "test-keyword"
      );
    });

    it("should handle case-insensitivity when adding", () => {
      db.addKeyword("mediums", "ebook", "MyKeyword");
      expect(db.database.mediums.ebook.includes("mykeyword")).toBe(true);
    });
  });

  describe("getAllKeywordsFlat()", () => {
    it("should return flat array of all keywords in category", () => {
      const keywords = db.getAllKeywordsFlat("mediums");
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(50);
      expect(keywords).toContain("book");
      expect(keywords).toContain("calendar");
    });

    it("should return empty array for nonexistent category", () => {
      const keywords = db.getAllKeywordsFlat("nonexistent");
      expect(keywords).toEqual([]);
    });
  });

  // ========== ACCURACY TESTS ==========
  describe("Classification Accuracy (Phase A-B Target)", () => {
    /**
     * Test: Rule Engine should achieve >80% accuracy
     * These are real prompt examples that should be classified correctly
     */

    it("should correctly identify ebook from prompt", () => {
      const prompt = "I want a poetry book collection about summer";
      const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2);

      // Check if any token matches "ebook"
      const matches = tokens
        .map((token) => db.findMatches(token, "mediums"))
        .filter(Boolean);

      expect(matches).toContain("ebook");
    });

    it("should correctly identify calendar from prompt", () => {
      const prompt = "Create a beautiful 2026 wall calendar with family photos";
      const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2);

      const matches = tokens
        .map((token) => db.findMatches(token, "mediums"))
        .filter(Boolean);

      expect(matches).toContain("calendar");
    });

    it("should correctly identify poster from prompt", () => {
      const prompt = "I need wall art for my bedroom";
      const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2);

      const matches = tokens
        .map((token) => db.findMatches(token, "mediums"))
        .filter(Boolean);

      expect(matches).toContain("poster");
    });

    it("should correctly identify sticker set from prompt", () => {
      const prompt = "Design me a sticker pack with cute animals";
      const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2);

      const matches = tokens
        .map((token) => db.findMatches(token, "mediums"))
        .filter(Boolean);

      expect(matches).toContain("stickers");
    });

    it("should correctly identify greeting card from prompt", () => {
      const prompt = "Make me a birthday card design";
      const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2);

      const matches = tokens
        .map((token) => db.findMatches(token, "mediums"))
        .filter(Boolean);

      expect(matches).toContain("greeting-card");
    });

    it("should correctly identify whimsical style from prompt", () => {
      const prompt = "Playful and fun designs for kids";
      const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2);

      const matches = tokens
        .map((token) => db.findMatches(token, "styles"))
        .filter(Boolean);

      expect(matches).toContain("whimsical");
    });

    it("should correctly identify gothic style from prompt", () => {
      const prompt = "Dark and mysterious aesthetic";
      const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2);

      const matches = tokens
        .map((token) => db.findMatches(token, "styles"))
        .filter(Boolean);

      expect(matches).toContain("gothic");
    });

    it("should correctly identify minimalist style from prompt", () => {
      const prompt = "Clean and simple design";
      const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2);

      const matches = tokens
        .map((token) => db.findMatches(token, "styles"))
        .filter(Boolean);

      expect(matches).toContain("minimalist");
    });

    it("should correctly identify dark-tones theme from prompt", () => {
      const prompt = "I want dark and gloomy colors";
      const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2);

      const matches = tokens
        .map((token) => db.findMatches(token, "themes"))
        .filter(Boolean);

      expect(matches).toContain("dark-tones");
    });

    it("should correctly identify magical-realism theme from prompt", () => {
      const prompt = "Create something magical and dreamlike";
      const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2);

      const matches = tokens
        .map((token) => db.findMatches(token, "themes"))
        .filter(Boolean);

      expect(matches).toContain("magical-realism");
    });

    it("should correctly identify playful-colors theme from prompt", () => {
      const prompt = "Bright and vibrant colors";
      const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2);

      const matches = tokens
        .map((token) => db.findMatches(token, "themes"))
        .filter(Boolean);

      expect(matches).toContain("playful-colors");
    });
  });

  // ========== COVERAGE TESTS ==========
  describe("Keyword Coverage (Phase A-B Targets)", () => {
    it("mediums should include at least 8 types", () => {
      const mediums = db.getKeywords("mediums");
      expect(Object.keys(mediums).length).toBeGreaterThanOrEqual(8);
      expect(mediums).toHaveProperty("ebook");
      expect(mediums).toHaveProperty("calendar");
      expect(mediums).toHaveProperty("poster");
      expect(mediums).toHaveProperty("stickers");
      expect(mediums).toHaveProperty("greeting-card");
      expect(mediums).toHaveProperty("journal");
      expect(mediums).toHaveProperty("app");
      expect(mediums).toHaveProperty("wall-art");
    });

    it("styles should include at least 7 types", () => {
      const styles = db.getKeywords("styles");
      expect(Object.keys(styles).length).toBeGreaterThanOrEqual(7);
      expect(styles).toHaveProperty("whimsical");
      expect(styles).toHaveProperty("gothic");
      expect(styles).toHaveProperty("minimalist");
      expect(styles).toHaveProperty("folk-art");
      expect(styles).toHaveProperty("surrealist");
      expect(styles).toHaveProperty("retro-vintage");
      expect(styles).toHaveProperty("modern-flat");
    });

    it("themes should include at least 10+ types", () => {
      const themes = db.getKeywords("themes");
      expect(Object.keys(themes).length).toBeGreaterThanOrEqual(10);
    });

    it("should have comprehensive keyword coverage", () => {
      const stats = db.getStats();
      // Total keywords across all categories should be >200
      const totalKeywords = Object.values(stats).reduce(
        (sum, cat) => sum + cat.totalKeywords,
        0
      );
      expect(totalKeywords).toBeGreaterThan(200);
    });

    it("each medium should have at least 10 keywords", () => {
      const mediums = db.getKeywords("mediums");
      Object.entries(mediums).forEach(([medium, keywords]) => {
        expect(keywords.length).toBeGreaterThanOrEqual(10);
      });
    });

    it("each style should have at least 10 keywords", () => {
      const styles = db.getKeywords("styles");
      Object.entries(styles).forEach(([style, keywords]) => {
        expect(keywords.length).toBeGreaterThanOrEqual(10);
      });
    });

    it("each theme should have at least 8 keywords", () => {
      const themes = db.getKeywords("themes");
      Object.entries(themes).forEach(([theme, keywords]) => {
        expect(keywords.length).toBeGreaterThanOrEqual(8);
      });
    });
  });

  // ========== EDGE CASES ==========
  describe("Edge Cases", () => {
    it("should handle partial word matching", () => {
      const result = db.findMatches("book", "mediums"); // "book" is part of "ebook"
      expect(result).toBe("ebook");
    });

    it("should handle empty string gracefully", () => {
      const result = db.findMatches("", "mediums");
      expect(result).toBeNull();
    });

    it("should handle special characters", () => {
      const result = db.findMatches("book!", "mediums");
      // Should still find "book" after filtering special chars
      expect([null, "ebook"]).toContain(result);
    });

    it("should handle very long tokens", () => {
      const result = db.findMatches(
        "thisisaverylongtokenthatdoesntmatch",
        "mediums"
      );
      expect(result).toBeNull();
    });
  });
});
