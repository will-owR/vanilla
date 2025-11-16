/**
 * Rule Engine Tests - Module 3
 * Tests tokenization, scoring, rule application, and confidence calculation
 */

import { describe, it, expect, beforeAll } from "vitest";
import { RuleEngine } from "../utils/ruleEngine.js";

let ruleEngine = null;

describe("RuleEngine - Module 3", () => {
  beforeAll(() => {
    ruleEngine = new RuleEngine();
  });

  describe("tokenizePrompt() - Text parsing", () => {
    it("should tokenize simple prompt", () => {
      const tokens = ruleEngine.tokenizePrompt("Create summer poem ebook");
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length > 0).toBe(true);
    });

    it("should lowercase tokens", () => {
      const tokens = ruleEngine.tokenizePrompt("CREATE SUMMER POEM");
      expect(tokens.every((t) => t === t.toLowerCase())).toBe(true);
    });

    it("should filter short tokens", () => {
      const tokens = ruleEngine.tokenizePrompt("a b c create beautiful summer");
      expect(tokens.some((t) => t.length <= 2)).toBe(false);
    });

    it("should remove punctuation", () => {
      const tokens = ruleEngine.tokenizePrompt(
        "Create! A @#$% summer poem, please?"
      );
      expect(tokens.every((t) => !t.match(/[^a-z0-9]/i))).toBe(true);
    });

    it("should handle empty string", () => {
      const tokens = ruleEngine.tokenizePrompt("");
      expect(Array.isArray(tokens)).toBe(true);
    });
  });

  describe("extract() - Full classification", () => {
    it("should classify ebook prompt", () => {
      const result = ruleEngine.extract("Create a summer poem ebook");
      expect(result.source).toBe("rules");
      expect(result.medium).toBeDefined();
      expect(result.confidence >= 0 && result.confidence <= 1).toBe(true);
    });

    it("should classify calendar prompt", () => {
      const result = ruleEngine.extract("Design a monthly calendar for 2025");
      expect(result.medium).toBeDefined();
      expect(typeof result.confidence === "number").toBe(true);
    });

    it("should classify poster prompt", () => {
      const result = ruleEngine.extract(
        "Create wall art poster with bold colors"
      );
      expect(result.medium).toBeDefined();
      expect(result.style).toBeDefined();
    });

    it("should handle empty prompt", () => {
      const result = ruleEngine.extract("");
      expect(result.source).toBe("rules");
      expect(result.confidence).toBe(0);
    });

    it("should return classification with all fields", () => {
      const result = ruleEngine.extract("whimsical children ebook");
      expect(result.medium).toBeDefined();
      expect(result.style).toBeDefined();
      expect(result.theme).toBeDefined();
      expect(result.colorPalette).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.source).toBe("rules");
    });

    it("should achieve high confidence on clear prompts", () => {
      const result = ruleEngine.extract("Dark gothic mysterious horror ebook");
      expect(result.confidence >= 0.5).toBe(true);
    });

    it("should have lower confidence on ambiguous prompts", () => {
      const result = ruleEngine.extract("xyz abc qwerty");
      expect(result.confidence < 0.5).toBe(true);
    });
  });

  describe("matchToken() - Token matching", () => {
    it("should match exact token", () => {
      const match = ruleEngine.matchToken("ebook", "ebook");
      expect(match).toBe(true);
    });

    it("should match case-insensitive", () => {
      const match = ruleEngine.matchToken("ebook", "EBOOK");
      expect(match).toBe(true);
    });

    it("should match substring", () => {
      const match = ruleEngine.matchToken("book", "ebook");
      expect(match).toBe(true);
    });

    it("should match keyword start", () => {
      const match = ruleEngine.matchToken("ebook", "ebook-digital");
      expect(match).toBe(true);
    });

    it("should not match unrelated tokens", () => {
      const match = ruleEngine.matchToken("pizza", "ebook");
      expect(match).toBe(false);
    });
  });

  describe("calculateConfidence() - Scoring", () => {
    it("should return confidence between 0-1", () => {
      const conf = ruleEngine.calculateConfidence(
        {
          mediums: { ebook: 3, calendar: 1 },
          styles: { whimsical: 2 },
          themes: {},
        },
        { medium: "ebook", style: "whimsical" }
      );
      expect(conf >= 0 && conf <= 1).toBe(true);
    });

    it("should return low confidence for no matches", () => {
      const conf = ruleEngine.calculateConfidence(
        { mediums: {}, styles: {}, themes: {} },
        {}
      );
      expect(conf).toBe(0.3);
    });

    it("should penalize ambiguity", () => {
      // Multiple strong contenders = lower confidence
      const conf1 = ruleEngine.calculateConfidence(
        { mediums: { ebook: 5 }, styles: { whimsical: 5 }, themes: {} },
        {}
      );
      const conf2 = ruleEngine.calculateConfidence(
        {
          mediums: { ebook: 5, calendar: 4, poster: 4 },
          styles: { whimsical: 5, gothic: 4 },
          themes: {},
        },
        {}
      );
      expect(conf2 <= conf1).toBe(true);
    });
  });

  describe("inferColorPalette() - Color inference", () => {
    it("should infer vibrant for bright keywords", () => {
      const palette = ruleEngine.inferColorPalette({}, [
        "bright",
        "colorful",
        "vivid",
      ]);
      expect(["vibrant", "pastel"]).toContain(palette);
    });

    it("should infer dark for dark keywords", () => {
      const palette = ruleEngine.inferColorPalette({}, [
        "dark",
        "black",
        "shadow",
      ]);
      expect(["dark", "muted"]).toContain(palette);
    });

    it("should use style hints", () => {
      const palette = ruleEngine.inferColorPalette({ gothic: 5 }, []);
      expect(palette).toBe("dark");
    });

    it("should prefer color hints over style hints", () => {
      const palette = ruleEngine.inferColorPalette({ gothic: 5 }, [
        "bright",
        "vibrant",
      ]);
      expect(palette).toBe("vibrant");
    });
  });

  describe("Semantic Rules", () => {
    it("should apply children + playful rule", () => {
      const result = ruleEngine.extract(
        "playful children's colorful ebook with fun stories"
      );
      expect(result.colorPalette).toBe("vibrant");
    });

    it("should apply dark + mysterious rule", () => {
      const result = ruleEngine.extract("dark mysterious gothic horror ebook");
      expect(result.style).toBe("gothic");
    });

    it("should apply minimalist rule", () => {
      const result = ruleEngine.extract(
        "Create a clean simple minimal zen calendar"
      );
      expect(result.style).toBe("minimalist");
    });

    it("should apply magical theme rule", () => {
      const result = ruleEngine.extract("fantasy magical wizard spellbook");
      expect(result.theme).toContain("magical-realism");
    });

    it("should apply professional rule", () => {
      const result = ruleEngine.extract(
        "professional corporate business formal calendar"
      );
      expect(result.style).toBe("modern-flat");
    });

    it("should apply retro rule", () => {
      const result = ruleEngine.extract("vintage retro 70s nostalgic poster");
      expect(result.style).toBe("retro-vintage");
    });

    it("should apply tech rule", () => {
      const result = ruleEngine.extract(
        "futuristic tech digital cyber AI robot ebook"
      );
      expect(result.style).toBe("modern-flat");
      expect(result.theme).toContain("tech-futuristic");
    });
  });

  describe("Performance", () => {
    it("should classify in <100ms", () => {
      const start = Date.now();
      ruleEngine.extract("Create summer poem ebook with whimsical style");
      const elapsed = Date.now() - start;
      expect(elapsed < 100).toBe(true);
    });

    it("should handle very long prompts", () => {
      const longPrompt = "word ".repeat(1000);
      const result = ruleEngine.extract(longPrompt);
      expect(result.confidence).toBeDefined();
    });

    it("should handle special characters", () => {
      const specialPrompt = "Create 🎨 whimsical éBook with spëciål chars!";
      const result = ruleEngine.extract(specialPrompt);
      expect(result.medium).toBeDefined();
    });
  });
});
