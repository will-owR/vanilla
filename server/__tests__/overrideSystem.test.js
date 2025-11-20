/**
 * Override System - Module 8 Tests
 * 20 comprehensive tests covering change detection, transforms, validation, cost, integration
 */

import { describe, it, expect, beforeEach } from "vitest";
const { OverrideSystem, OverrideError } = require("../utils/overrideSystem");

describe("Override System - Module 8", () => {
  let overrideSystem = null;

  beforeEach(() => {
    overrideSystem = new OverrideSystem();
  });

  // ========================================
  // DETECTION: 4 tests
  // ========================================
  describe("Change Detection", () => {
    it("should detect medium change", () => {
      const oldClassification = {
        medium: "ebook",
        style: "minimalist",
        colorPalette: "vibrant",
        theme: ["nature"],
      };

      const newClassification = {
        medium: "poster",
        style: "minimalist",
        colorPalette: "vibrant",
        theme: ["nature"],
      };

      const changes = overrideSystem.detectChanges(
        oldClassification,
        newClassification
      );

      expect(changes.changedMedium).toBe(true);
      expect(changes.changedStyle).toBe(false);
      expect(changes.changedColors).toBe(false);
      expect(changes.oldMedium).toBe("ebook");
      expect(changes.newMedium).toBe("poster");
    });

    it("should detect style change", () => {
      const oldClassification = {
        medium: "ebook",
        style: "minimalist",
        colorPalette: "vibrant",
        theme: [],
      };

      const newClassification = {
        medium: "ebook",
        style: "gothic",
        colorPalette: "vibrant",
        theme: [],
      };

      const changes = overrideSystem.detectChanges(
        oldClassification,
        newClassification
      );

      expect(changes.changedMedium).toBe(false);
      expect(changes.changedStyle).toBe(true);
      expect(changes.oldStyle).toBe("minimalist");
      expect(changes.newStyle).toBe("gothic");
    });

    it("should detect color change", () => {
      const oldClassification = {
        medium: "calendar",
        style: "modern",
        colorPalette: "vibrant",
        theme: ["business"],
      };

      const newClassification = {
        medium: "calendar",
        style: "modern",
        colorPalette: "muted",
        theme: ["business"],
      };

      const changes = overrideSystem.detectChanges(
        oldClassification,
        newClassification
      );

      expect(changes.changedMedium).toBe(false);
      expect(changes.changedStyle).toBe(false);
      expect(changes.changedColors).toBe(true);
      expect(changes.oldColorPalette).toBe("vibrant");
      expect(changes.newColorPalette).toBe("muted");
    });

    it("should detect multiple changes", () => {
      const oldClassification = {
        medium: "ebook",
        style: "minimalist",
        colorPalette: "vibrant",
        theme: ["nature"],
      };

      const newClassification = {
        medium: "poster",
        style: "bold",
        colorPalette: "muted",
        theme: ["urban"],
      };

      const changes = overrideSystem.detectChanges(
        oldClassification,
        newClassification
      );

      expect(changes.changedMedium).toBe(true);
      expect(changes.changedStyle).toBe(true);
      expect(changes.changedColors).toBe(true);
      expect(changes.changedTheme).toBe(true);
    });
  });

  // ========================================
  // TRANSFORMS: 8 tests
  // ========================================
  describe("Transform Strategies", () => {
    it("should apply layout transform for medium change", () => {
      const output = {
        type: "ebook",
        html: "<html>ebook content</html>",
      };

      const oldClassification = {
        medium: "ebook",
        style: "minimalist",
        colorPalette: "vibrant",
      };

      const newClassification = {
        medium: "poster",
        style: "minimalist",
        colorPalette: "vibrant",
      };

      const result = overrideSystem.applyOverride(
        output,
        oldClassification,
        newClassification
      );

      expect(result.output.layoutTransformed).toBe(true);
      expect(result.output.originalMedium).toBe("ebook");
      expect(result.output.targetMedium).toBe("poster");
      expect(result.costMultiplier).toBeGreaterThan(0.9); // 100% regen needed
    });

    it("should apply style transform for style change", () => {
      const output = {
        type: "ebook",
        html: "<html>ebook content</html>",
      };

      const oldClassification = {
        medium: "ebook",
        style: "minimalist",
        colorPalette: "vibrant",
      };

      const newClassification = {
        medium: "ebook",
        style: "gothic",
        colorPalette: "vibrant",
      };

      const result = overrideSystem.applyOverride(
        output,
        oldClassification,
        newClassification
      );

      expect(result.output.styleTransformed).toBe(true);
      expect(result.output.oldStyle).toBe("minimalist");
      expect(result.output.newStyle).toBe("gothic");
    });

    it("should apply color transform for color change", () => {
      const output = {
        type: "calendar",
        html: "<html>calendar content</html>",
      };

      const oldClassification = {
        medium: "calendar",
        style: "modern",
        colorPalette: "vibrant",
      };

      const newClassification = {
        medium: "calendar",
        style: "modern",
        colorPalette: "muted",
      };

      const result = overrideSystem.applyOverride(
        output,
        oldClassification,
        newClassification
      );

      expect(result.output.colorTransformed).toBe(true);
      expect(result.output.oldPalette).toBe("vibrant");
      expect(result.output.newPalette).toBe("muted");
    });

    it("should apply all transforms sequentially", () => {
      const output = {
        type: "ebook",
        html: "<html>ebook content</html>",
      };

      const oldClassification = {
        medium: "ebook",
        style: "minimalist",
        colorPalette: "vibrant",
      };

      const newClassification = {
        medium: "poster",
        style: "bold",
        colorPalette: "muted",
      };

      const result = overrideSystem.applyOverride(
        output,
        oldClassification,
        newClassification
      );

      expect(result.output.layoutTransformed).toBe(true);
      expect(result.output.styleTransformed).toBe(true);
      expect(result.output.colorTransformed).toBe(true);
    });

    it("should preserve original output if no changes", () => {
      const output = {
        type: "ebook",
        html: "<html>ebook content</html>",
      };

      const oldClassification = {
        medium: "ebook",
        style: "minimalist",
        colorPalette: "vibrant",
      };

      const newClassification = {
        medium: "ebook",
        style: "minimalist",
        colorPalette: "vibrant",
      };

      const result = overrideSystem.applyOverride(
        output,
        oldClassification,
        newClassification
      );

      expect(result.output.type).toBe("ebook");
      expect(result.output.html).toBe("<html>ebook content</html>");
      expect(result.costMultiplier).toBe(0);
    });

    it("should return changed dimensions metadata", () => {
      const output = {
        type: "calendar",
        html: "<html>calendar</html>",
      };

      const oldClassification = {
        medium: "calendar",
        style: "modern",
        colorPalette: "vibrant",
        theme: ["business"],
      };

      const newClassification = {
        medium: "calendar",
        style: "artistic",
        colorPalette: "muted",
        theme: ["creative"],
      };

      const result = overrideSystem.applyOverride(
        output,
        oldClassification,
        newClassification
      );

      expect(result.changedDimensions.medium).toBe(false);
      expect(result.changedDimensions.style).toBe(true);
      expect(result.changedDimensions.colors).toBe(true);
      expect(result.changedDimensions.theme).toBe(true);
    });

    it("should throw on invalid output", async () => {
      const oldClassification = {
        medium: "ebook",
        style: "minimalist",
        colorPalette: "vibrant",
      };

      const newClassification = {
        medium: "poster",
        style: "minimalist",
        colorPalette: "vibrant",
      };

      expect(() =>
        overrideSystem.applyOverride(null, oldClassification, newClassification)
      ).toThrow(OverrideError);
    });

    it("should throw on incompatible style", () => {
      const output = { type: "app-ui", html: "<html>app</html>" };

      const oldClassification = {
        medium: "app-ui",
        style: "modern",
        colorPalette: "vibrant",
      };

      const newClassification = {
        medium: "app-ui",
        style: "romantic", // Not compatible with app-ui
        colorPalette: "vibrant",
      };

      expect(() =>
        overrideSystem.applyOverride(
          output,
          oldClassification,
          newClassification
        )
      ).toThrow(OverrideError);
    });
  });

  // ========================================
  // VALIDATION: 4 tests
  // ========================================
  describe("Compatibility Validation", () => {
    it("should allow compatible medium transforms", () => {
      expect(overrideSystem.canTransform("ebook", "calendar")).toBe(true);
      expect(overrideSystem.canTransform("calendar", "poster")).toBe(true);
      expect(overrideSystem.canTransform("poster", "stickers")).toBe(true);
    });

    it("should reject incompatible medium transforms", () => {
      expect(overrideSystem.canTransform("app-ui", "ebook")).toBe(false);
      expect(overrideSystem.canTransform("stickers", "journal")).toBe(false);
      expect(overrideSystem.canTransform("journal", "poster")).toBe(false);
    });

    it("should allow same medium transform", () => {
      expect(overrideSystem.canTransform("ebook", "ebook")).toBe(true);
      expect(overrideSystem.canTransform("calendar", "calendar")).toBe(true);
    });

    it("should validate style compatibility with medium", () => {
      expect(overrideSystem.isStyleCompatible("ebook", "minimalist")).toBe(
        true
      );
      expect(overrideSystem.isStyleCompatible("ebook", "gothic")).toBe(true);
      expect(overrideSystem.isStyleCompatible("calendar", "playful")).toBe(
        true
      );
      expect(overrideSystem.isStyleCompatible("app-ui", "playful")).toBe(false); // Not in app-ui styles
    });
  });

  // ========================================
  // COST ESTIMATION: 2 tests
  // ========================================
  describe("Cost Estimation", () => {
    it("should estimate cost for different change types", () => {
      // Medium change = 100% (1.0)
      const mediumChange = { changedMedium: true };
      expect(overrideSystem.estimateCost(mediumChange)).toBe(1.0);

      // Style change (no medium) = 40% (0.4)
      const styleChange = { changedStyle: true, changedMedium: false };
      expect(overrideSystem.estimateCost(styleChange)).toBeCloseTo(0.4);

      // Color change (no style, no medium) = 5% (0.05)
      const colorChange = {
        changedColors: true,
        changedStyle: false,
        changedMedium: false,
      };
      expect(overrideSystem.estimateCost(colorChange)).toBeCloseTo(0.05);

      // Theme change (no others) = 20% (0.2)
      const themeChange = {
        changedTheme: true,
        changedStyle: false,
        changedMedium: false,
        changedColors: false,
      };
      expect(overrideSystem.estimateCost(themeChange)).toBeCloseTo(0.2);
    });

    it("should cap cost at 100% (1.0)", () => {
      const allChanged = {
        changedMedium: true,
        changedStyle: true,
        changedColors: true,
        changedTheme: true,
      };

      const cost = overrideSystem.estimateCost(allChanged);
      expect(cost).toBeLessThanOrEqual(1.0);
    });
  });

  // ========================================
  // INTEGRATION: 2 tests
  // ========================================
  describe("Integration", () => {
    it("should handle full override pipeline: ebook to poster", () => {
      const output = {
        type: "ebook",
        html: "<html>ebook content</html>",
      };

      const oldClassification = {
        medium: "ebook",
        style: "minimalist",
        colorPalette: "vibrant",
        theme: ["nature"],
      };

      const newClassification = {
        medium: "poster",
        style: "bold",
        colorPalette: "muted",
        theme: ["urban"],
      };

      // This should work: ebook → poster is compatible
      const result = overrideSystem.applyOverride(
        output,
        oldClassification,
        newClassification
      );

      expect(result.output).toBeDefined();
      expect(result.costMultiplier).toBeGreaterThan(0.9); // ~100% since medium changed
      expect(result.changedDimensions.medium).toBe(true);
      expect(result.changedDimensions.style).toBe(true);
    });

    it("should provide transformation metadata", () => {
      const output = {
        type: "calendar",
        html: "<html>calendar</html>",
      };

      const oldClassification = {
        medium: "calendar",
        style: "modern",
        colorPalette: "vibrant",
      };

      const newClassification = {
        medium: "calendar",
        style: "artistic",
        colorPalette: "muted",
      };

      const result = overrideSystem.applyOverride(
        output,
        oldClassification,
        newClassification
      );

      expect(result).toHaveProperty("output");
      expect(result).toHaveProperty("costMultiplier");
      expect(result).toHaveProperty("changedDimensions");
      expect(typeof result.costMultiplier).toBe("number");
      expect(result.costMultiplier).toBeGreaterThanOrEqual(0);
      expect(result.costMultiplier).toBeLessThanOrEqual(1);
    });
  });

  // ========================================
  // UTILITY METHODS: Test helper methods
  // ========================================
  describe("Utility Methods", () => {
    it("should get valid mediums", () => {
      const mediums = overrideSystem.getValidMediums();
      expect(mediums.length).toBe(8);
      expect(mediums).toContain("ebook");
      expect(mediums).toContain("calendar");
      expect(mediums).toContain("poster");
    });

    it("should get compatible styles for medium", () => {
      const ebookStyles = overrideSystem.getCompatibleStyles("ebook");
      expect(Array.isArray(ebookStyles)).toBe(true);
      expect(ebookStyles).toContain("minimalist");
      expect(ebookStyles).toContain("gothic");
    });

    it("should get compatible transforms for medium", () => {
      const ebookTransforms = overrideSystem.getCompatibleTransforms("ebook");
      expect(Array.isArray(ebookTransforms)).toBe(true);
      expect(ebookTransforms).toContain("calendar");
      expect(ebookTransforms).toContain("poster");
      // ebook can transform to all except app-ui (typically)
      expect(ebookTransforms.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // ERROR HANDLING: Edge cases and errors
  // ========================================
  describe("Error Handling", () => {
    it("should throw on null classifications", () => {
      expect(() => {
        overrideSystem.detectChanges(null, {
          medium: "ebook",
          style: "minimalist",
          colorPalette: "vibrant",
        });
      }).toThrow(OverrideError);
    });

    it("should throw on invalid medium in canTransform", () => {
      expect(() => {
        overrideSystem.canTransform("invalid", "ebook");
      }).toThrow(OverrideError);
    });

    it("should throw on invalid medium in getCompatibleStyles", () => {
      expect(() => {
        overrideSystem.getCompatibleStyles("invalid-medium");
      }).toThrow(OverrideError);
    });

    it("should throw on invalid changes object for cost", () => {
      expect(() => {
        overrideSystem.estimateCost(null);
      }).toThrow(OverrideError);
    });

    it("should reject incompatible medium transforms in applyOverride", () => {
      const output = { type: "app-ui", html: "<html>app</html>" };

      const oldClassification = {
        medium: "app-ui",
        style: "modern",
        colorPalette: "vibrant",
      };

      const newClassification = {
        medium: "ebook", // app-ui cannot transform to ebook
        style: "modern",
        colorPalette: "vibrant",
      };

      expect(() =>
        overrideSystem.applyOverride(
          output,
          oldClassification,
          newClassification
        )
      ).toThrow(OverrideError);
    });
  });
});
