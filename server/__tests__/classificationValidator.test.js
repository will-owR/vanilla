/**
 * Classification Validator Tests - Module 5
 * Tests validation, merging, and sanitization
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ClassificationValidator } from "../utils/classificationValidator.js";

let validator = null;

const validClassification = {
  medium: "ebook",
  style: "whimsical",
  theme: ["playful-colors"],
  colorPalette: "vibrant",
  confidence: 0.85,
  source: "rules",
};

describe("ClassificationValidator - Module 5", () => {
  beforeAll(() => {
    validator = new ClassificationValidator();
  });

  describe("validate() - Classification validation", () => {
    it("should accept valid classification", () => {
      expect(validator.validate(validClassification)).toBe(true);
    });

    it("should reject null", () => {
      expect(validator.validate(null)).toBe(false);
    });

    it("should reject undefined", () => {
      expect(validator.validate(undefined)).toBe(false);
    });

    it("should require medium", () => {
      const invalid = { ...validClassification, medium: undefined };
      expect(validator.validate(invalid)).toBe(false);
    });

    it("should require style", () => {
      const invalid = { ...validClassification, style: undefined };
      expect(validator.validate(invalid)).toBe(false);
    });

    it("should require colorPalette", () => {
      const invalid = { ...validClassification, colorPalette: undefined };
      expect(validator.validate(invalid)).toBe(false);
    });

    it("should validate medium value", () => {
      const invalid = { ...validClassification, medium: "invalid-medium" };
      expect(validator.validate(invalid)).toBe(false);
    });

    it("should validate style value", () => {
      const invalid = { ...validClassification, style: "invalid-style" };
      expect(validator.validate(invalid)).toBe(false);
    });

    it("should validate colorPalette value", () => {
      const invalid = {
        ...validClassification,
        colorPalette: "invalid-palette",
      };
      expect(validator.validate(invalid)).toBe(false);
    });

    it("should validate confidence range", () => {
      const tooHigh = { ...validClassification, confidence: 1.5 };
      const tooLow = { ...validClassification, confidence: -0.5 };
      expect(validator.validate(tooHigh)).toBe(false);
      expect(validator.validate(tooLow)).toBe(false);
    });

    it("should require theme as array", () => {
      const invalid = { ...validClassification, theme: "playful-colors" };
      expect(validator.validate(invalid)).toBe(false);
    });

    it("should validate optional audience", () => {
      const valid = { ...validClassification, audience: "children" };
      const invalid = { ...validClassification, audience: "invalid-audience" };
      expect(validator.validate(valid)).toBe(true);
      expect(validator.validate(invalid)).toBe(false);
    });

    it("should allow missing optional fields", () => {
      const minimal = {
        medium: "ebook",
        style: "minimalist",
        theme: [],
        colorPalette: "muted",
        confidence: 0.5,
        source: "rules",
      };
      expect(validator.validate(minimal)).toBe(true);
    });
  });

  describe("merge() - Classification merging", () => {
    it("should merge when rule and AI agree", () => {
      const rule = validClassification;
      const ai = {
        ...validClassification,
        source: "ai",
        confidence: 0.9,
      };

      const merged = validator.merge(rule, ai);
      expect(merged.source).toBe("hybrid");
      expect(merged.medium).toBe("ebook");
      expect(
        merged.confidence >= Math.max(rule.confidence, ai.confidence) * 0.85
      ).toBe(true);
    });

    it("should return AI result when rule invalid", () => {
      const rule = { invalid: true };
      const ai = { ...validClassification, source: "ai" };

      const merged = validator.merge(rule, ai);
      expect(merged.medium).toBe(ai.medium);
    });

    it("should return rule when AI invalid", () => {
      const rule = validClassification;
      const ai = { invalid: true };

      const merged = validator.merge(rule, ai);
      expect(merged.medium).toBe(rule.medium);
    });

    it("should prefer AI when AI confidence high and medium disagrees", () => {
      const rule = {
        ...validClassification,
        medium: "calendar",
        confidence: 0.6,
      };
      const ai = {
        ...validClassification,
        medium: "ebook",
        confidence: 0.9,
        source: "ai",
      };

      const merged = validator.merge(rule, ai);
      expect(merged.medium).toBe("ebook");
      expect(merged.sources.resolved_to).toBe("ai");
    });

    it("should prefer rule when AI confidence low", () => {
      const rule = {
        ...validClassification,
        medium: "ebook",
        confidence: 0.8,
      };
      const ai = {
        ...validClassification,
        medium: "calendar",
        confidence: 0.4,
        source: "ai",
      };

      const merged = validator.merge(rule, ai);
      expect(merged.medium).toBe("ebook");
    });

    it("should merge themes from both", () => {
      const rule = {
        ...validClassification,
        theme: ["playful-colors"],
      };
      const ai = {
        ...validClassification,
        theme: ["magical-realism"],
        source: "ai",
      };

      const merged = validator.merge(rule, ai);
      expect(merged.theme.length >= 1).toBe(true);
    });

    it("should track conflict in sources", () => {
      const rule = {
        ...validClassification,
        medium: "ebook",
        confidence: 0.7,
      };
      const ai = {
        ...validClassification,
        medium: "calendar",
        confidence: 0.4,
        source: "ai",
      };

      const merged = validator.merge(rule, ai);
      expect(merged.sources).toBeDefined();
      expect(
        "conflict" in merged.sources || "agreement" in merged.sources
      ).toBe(true);
    });
  });

  describe("detectAgreement() - Agreement detection", () => {
    it("should detect full agreement", () => {
      const result = validator.detectAgreement(validClassification, {
        ...validClassification,
      });
      expect(result.mediumAgrees).toBe(true);
      expect(result.styleAgrees).toBe(true);
    });

    it("should detect medium disagreement", () => {
      const result = validator.detectAgreement(validClassification, {
        ...validClassification,
        medium: "calendar",
      });
      expect(result.mediumAgrees).toBe(false);
    });

    it("should detect style disagreement", () => {
      const result = validator.detectAgreement(validClassification, {
        ...validClassification,
        style: "gothic",
      });
      expect(result.styleAgrees).toBe(false);
    });

    it("should calculate theme overlap", () => {
      const result = validator.detectAgreement(validClassification, {
        ...validClassification,
        theme: ["playful-colors", "magical-realism"],
      });
      expect(result.themeOverlap >= 0 && result.themeOverlap <= 1).toBe(true);
    });
  });

  describe("sanitize() - Sanitization", () => {
    it("should sanitize valid classification", () => {
      const sanitized = validator.sanitize(validClassification);
      expect(validator.validate(sanitized)).toBe(true);
    });

    it("should fix invalid medium", () => {
      const invalid = { ...validClassification, medium: "invalid" };
      const sanitized = validator.sanitize(invalid);
      expect(validator.validMediums).toContain(sanitized.medium);
    });

    it("should fix invalid style", () => {
      const invalid = { ...validClassification, style: "invalid" };
      const sanitized = validator.sanitize(invalid);
      expect(validator.validStyles).toContain(sanitized.style);
    });

    it("should fix out-of-range confidence", () => {
      const invalid = { ...validClassification, confidence: 1.5 };
      const sanitized = validator.sanitize(invalid);
      expect(sanitized.confidence <= 1).toBe(true);
    });

    it("should limit theme array length", () => {
      const invalid = {
        ...validClassification,
        theme: ["t1", "t2", "t3", "t4", "t5", "t6"],
      };
      const sanitized = validator.sanitize(invalid);
      expect(sanitized.theme.length <= 5).toBe(true);
    });

    it("should handle null input", () => {
      const sanitized = validator.sanitize(null);
      expect(validator.validate(sanitized)).toBe(true);
    });
  });

  describe("getValidOptions() - Option retrieval", () => {
    it("should return valid mediums", () => {
      const mediums = validator.getValidOptions("mediums");
      expect(Array.isArray(mediums)).toBe(true);
      expect(mediums.length > 0).toBe(true);
      expect(mediums).toContain("ebook");
    });

    it("should return valid styles", () => {
      const styles = validator.getValidOptions("styles");
      expect(Array.isArray(styles)).toBe(true);
      expect(styles).toContain("gothic");
    });

    it("should return valid color palettes", () => {
      const palettes = validator.getValidOptions("colorPalettes");
      expect(Array.isArray(palettes)).toBe(true);
      expect(palettes).toContain("vibrant");
    });

    it("should return valid audiences", () => {
      const audiences = validator.getValidOptions("audiences");
      expect(Array.isArray(audiences)).toBe(true);
      expect(audiences).toContain("children");
    });

    it("should return empty array for unknown dimension", () => {
      const result = validator.getValidOptions("unknown");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("mergeThemes() - Theme merging", () => {
    it("should combine themes", () => {
      const merged = validator.mergeThemes(
        ["playful-colors"],
        ["magical-realism"]
      );
      expect(merged.length).toBe(2);
      expect(merged).toContain("playful-colors");
      expect(merged).toContain("magical-realism");
    });

    it("should avoid duplicates", () => {
      const merged = validator.mergeThemes(
        ["playful-colors"],
        ["playful-colors"]
      );
      expect(merged.length).toBe(1);
    });

    it("should limit to 5 themes", () => {
      const themes1 = ["t1", "t2", "t3"];
      const themes2 = ["t4", "t5", "t6"];
      const merged = validator.mergeThemes(themes1, themes2);
      expect(merged.length <= 5).toBe(true);
    });

    it("should handle empty arrays", () => {
      const merged1 = validator.mergeThemes([], ["t1"]);
      const merged2 = validator.mergeThemes(["t1"], []);
      expect(Array.isArray(merged1)).toBe(true);
      expect(Array.isArray(merged2)).toBe(true);
    });
  });

  describe("Integration", () => {
    it("should validate merged result", () => {
      const rule = validClassification;
      const ai = { ...validClassification, source: "ai", confidence: 0.9 };
      const merged = validator.merge(rule, ai);
      expect(validator.validate(merged)).toBe(true);
    });

    it("should handle complex merge scenario", () => {
      const rule = {
        medium: "ebook",
        style: "whimsical",
        theme: ["playful-colors"],
        colorPalette: "vibrant",
        confidence: 0.75,
        source: "rules",
      };
      const ai = {
        medium: "calendar",
        style: "whimsical",
        theme: ["magical-realism"],
        colorPalette: "pastel",
        confidence: 0.65,
        source: "ai",
      };

      const merged = validator.merge(rule, ai);
      expect(validator.validate(merged)).toBe(true);
      expect(merged.source).toBe("hybrid");
    });
  });
});
