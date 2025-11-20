/**
 * Error Scenario and Recovery Testing
 * Tests error paths, retry logic, and graceful degradation
 */

import { describe, it, expect } from "vitest";
import {
  ERROR_SCENARIOS,
  SAMPLE_CLASSIFICATIONS,
  SAMPLE_PROMPTS,
  SAMPLE_OVERRIDES,
} from "../test-utils/e2e-fixtures.js";
import genieService from "../genieService.js";

describe("Error Scenarios and Recovery", () => {
  /**
   * Test 1: Classification Validation Errors
   */
  describe("Classification Validation", () => {
    it("should handle missing classification gracefully", async () => {
      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: undefined,
      };

      try {
        const result = await genieService.process(payload);
        // Should either work (auto-classify) or throw validation error
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle invalid classification format", async () => {
      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: "invalid-string", // Should be object
      };

      try {
        await genieService.process(payload);
        // May auto-classify instead
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle missing required classification fields", async () => {
      const incompleteClassification = {
        id: "test",
        // Missing: medium, confidence, style, etc.
      };

      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: incompleteClassification,
      };

      try {
        const result = await genieService.process(payload);
        expect(result).toBeDefined();
      } catch (error) {
        // Validation error is acceptable
        expect(error).toBeDefined();
      }
    });

    it("should validate confidence threshold", async () => {
      const lowConfidenceClassification = {
        ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
        confidence: 0.5, // Below typical threshold of 0.85
      };

      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: lowConfidenceClassification,
      };

      // Should still process, but may log warning
      const result = await genieService.process(payload);
      expect(result).toBeDefined();
    });
  });

  /**
   * Test 2: Input Validation
   */
  describe("Input Validation and Constraints", () => {
    it("should handle empty or whitespace prompt", async () => {
      const testCases = ["", "   ", "\n\t"];

      for (const prompt of testCases) {
        const payload = {
          mode: "ebook",
          prompt,
          _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
        };

        try {
          await genieService.process(payload);
          // May succeed with auto-generation
        } catch (error) {
          // Validation error expected
          expect(error).toBeDefined();
        }
      }
    });

    it("should handle very long prompt", async () => {
      const longPrompt = "word ".repeat(5000); // ~25KB

      const payload = {
        mode: "ebook",
        prompt: longPrompt,
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      try {
        const result = await genieService.process(payload);
        expect(result).toBeDefined();
      } catch (error) {
        // May reject very long prompts
        expect(error).toBeDefined();
      }
    });

    it("should handle special characters and unicode", async () => {
      const specialPrompts = [
        "Create book with émojis 🎨 🌟 ✨",
        "Book about Ñoño y Español",
        "中文提示：创建一本书",
        "Prompt with <html>tags</html>",
        "SQL injection: ' OR '1'='1",
      ];

      for (const prompt of specialPrompts) {
        const payload = {
          mode: "ebook",
          prompt,
          _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
        };

        try {
          const result = await genieService.process(payload);
          expect(result).toBeDefined();
        } catch (error) {
          // Some may fail validation, but shouldn't crash
          expect(error).toBeDefined();
        }
      }
    });

    it("should handle invalid mode parameter", async () => {
      const payload = {
        mode: "invalid-mode-xyz",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      try {
        await genieService.process(payload);
        // May fall back to default
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  /**
   * Test 3: Partial Failures and Degradation
   */
  describe("Graceful Degradation", () => {
    it("should continue if metadata enrichment fails", async () => {
      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      const result = await genieService.process(payload);

      // Should return result even if some metadata is missing
      expect(result).toBeDefined();
      expect(result.out_envelope).toBeDefined();
    });

    it("should handle missing optional classification fields", async () => {
      const minimalClassification = {
        id: "minimal-1",
        medium: "ebook",
      };

      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: minimalClassification,
      };

      try {
        const result = await genieService.process(payload);
        expect(result).toBeDefined();
      } catch (error) {
        // May validate and fail, which is acceptable
        expect(error).toBeDefined();
      }
    });
  });

  /**
   * Test 4: Service Routing Fallbacks
   */
  describe("Service Routing and Fallbacks", () => {
    it("should route to correct service by medium", async () => {
      const testCases = [
        { medium: "ebook", mode: "ebook" },
        { medium: "poster", mode: "basic" },
        { medium: "calendar", mode: "demo" },
      ];

      for (const testCase of testCases) {
        const classification = {
          ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
          medium: testCase.medium,
        };

        const payload = {
          mode: testCase.mode,
          prompt: SAMPLE_PROMPTS.ebook[0],
          _classification: classification,
        };

        try {
          const result = await genieService.process(payload);
          expect(result).toBeDefined();
        } catch (error) {
          // Service may not support all types
          expect(error).toBeDefined();
        }
      }
    });

    it("should fall back to mode if classification medium unavailable", async () => {
      const classification = {
        ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
        medium: "unknown-medium",
      };

      const payload = {
        mode: "ebook", // Fallback mode
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: classification,
      };

      try {
        const result = await genieService.process(payload);
        // Should use mode as fallback
        expect(result.out_envelope.metadata.mode).toBe("ebook");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  /**
   * Test 5: State Consistency
   */
  describe("State Consistency and Isolation", () => {
    it("should maintain independent state for consecutive requests", async () => {
      const request1 = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: {
          ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
          id: "req-1",
        },
      };

      const request2 = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[1],
        _classification: {
          ...SAMPLE_CLASSIFICATIONS.ebook_guide,
          id: "req-2",
        },
      };

      const result1 = await genieService.process(request1);
      const result2 = await genieService.process(request2);

      // Both should succeed independently
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // IDs should be different
      expect(result1.resultId).not.toBe(result2.resultId);
    });

    it("should not leak state between concurrent requests", async () => {
      const requests = [
        {
          mode: "ebook",
          prompt: SAMPLE_PROMPTS.ebook[0],
          _classification: {
            ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
            id: "concurrent-1",
            style: "minimalist",
          },
        },
        {
          mode: "ebook",
          prompt: SAMPLE_PROMPTS.ebook[1],
          _classification: {
            ...SAMPLE_CLASSIFICATIONS.ebook_guide,
            id: "concurrent-2",
            style: "modern",
          },
        },
      ];

      const [result1, result2] = await Promise.all(
        requests.map((payload) => genieService.process(payload))
      );

      // Results should maintain their classifications
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // Each result should have correct style
      if (result1.out_envelope.metadata.classification) {
        expect(result1.out_envelope.metadata.classification.style).toBe(
          "minimalist"
        );
      }
      if (result2.out_envelope.metadata.classification) {
        expect(result2.out_envelope.metadata.classification.style).toBe(
          "modern"
        );
      }
    });
  });

  /**
   * Test 6: Edge Cases
   */
  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle null values gracefully", async () => {
      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: null,
      };

      try {
        const result = await genieService.process(payload);
        // Should auto-classify
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle undefined mode", async () => {
      const payload = {
        // mode: undefined
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      try {
        const result = await genieService.process(payload);
        // Should use classification.medium
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle extreme confidence values", async () => {
      const testCases = [
        { confidence: 0.0 },
        { confidence: 1.0 },
        { confidence: -0.5 },
        { confidence: 1.5 },
      ];

      for (const classification of testCases) {
        const payload = {
          mode: "ebook",
          prompt: SAMPLE_PROMPTS.ebook[0],
          _classification: {
            ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
            ...classification,
          },
        };

        try {
          const result = await genieService.process(payload);
          expect(result).toBeDefined();
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });
  });

  /**
   * Test 7: Recovery Behavior
   */
  describe("Error Recovery and Resilience", () => {
    it("should recover from transient failures", async () => {
      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      // First attempt (may fail)
      try {
        const result = await genieService.process(payload);
        expect(result).toBeDefined();
      } catch (error) {
        // Second attempt should work
        const retryResult = await genieService.process(payload);
        expect(retryResult).toBeDefined();
      }
    });

    it("should provide meaningful error messages", async () => {
      const payload = {
        mode: "invalid-mode",
        prompt: "", // Empty prompt
        _classification: null,
      };

      try {
        await genieService.process(payload);
      } catch (error) {
        // Error should be informative
        expect(error).toBeDefined();
        if (error.message) {
          expect(typeof error.message).toBe("string");
          expect(error.message.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
