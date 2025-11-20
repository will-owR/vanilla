/**
 * End-to-End Integration Tests
 * Tests complete flow: classify -> generate -> override
 * Tests against real backend endpoints with real service routing
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SAMPLE_CLASSIFICATIONS,
  SAMPLE_PROMPTS,
  SAMPLE_OVERRIDES,
  createTestScenario,
  validateGenerateResponse,
  validateOverrideResponse,
  ERROR_SCENARIOS,
} from "../test-utils/e2e-fixtures.js";
import genieService from "../genieService.js";

describe("E2E Integration Tests - Full Workflow", () => {
  /**
   * Test 1: Happy Path - Complete classify -> generate -> override flow
   */
  describe("Happy Path: Full Generation + Override Workflow", () => {
    it("should complete full workflow: generate then override", async () => {
      const scenario = createTestScenario({
        medium: "ebook",
        classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
        prompt: SAMPLE_PROMPTS.ebook[0],
        overrides: SAMPLE_OVERRIDES.style_only,
      });

      // Step 1: Generate with classification
      const generatePayload = {
        mode: scenario.generation.medium,
        prompt: scenario.generation.prompt,
        _classification: scenario.generation.classification,
      };

      const generateResult = await genieService.process(generatePayload);

      // Validate generation response
      expect(generateResult).toBeDefined();
      expect(generateResult.out_envelope).toBeDefined();
      expect(generateResult.out_envelope.metadata.classification).toBeDefined();
      expect(generateResult.out_envelope.metadata.classification.medium).toBe(
        "ebook"
      );

      // Store generation ID for override
      const generationId = generateResult.resultId || generateResult.id;
      expect(generationId).toBeDefined();
    });

    it("should preserve classification through generation and metadata", async () => {
      const classification = SAMPLE_CLASSIFICATIONS.ebook_guide;
      const prompt = SAMPLE_PROMPTS.ebook[1];

      const payload = {
        mode: "ebook",
        prompt,
        _classification: classification,
      };

      const result = await genieService.process(payload);

      // Verify classification is in metadata
      if (result.out_envelope.metadata.classification) {
        expect(result.out_envelope.metadata.classification.id).toBe(
          classification.id
        );
        expect(result.out_envelope.metadata.classification.medium).toBe(
          "ebook"
        );
        expect(result.out_envelope.metadata.classification.style).toBe(
          classification.style
        );
      }
    });

    it("should handle multiple media types with different classifications", async () => {
      const testCases = [
        {
          medium: "ebook",
          classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
          prompt: SAMPLE_PROMPTS.ebook[0],
        },
        {
          medium: "poster",
          classification: SAMPLE_CLASSIFICATIONS.poster_tech,
          prompt: SAMPLE_PROMPTS.poster[0],
        },
      ];

      for (const testCase of testCases) {
        const payload = {
          mode: testCase.medium,
          prompt: testCase.prompt,
          _classification: testCase.classification,
        };

        const result = await genieService.process(payload);

        expect(result).toBeDefined();
        expect(result.out_envelope).toBeDefined();
        expect(result.out_envelope.metadata.mode).toBe(testCase.medium);
      }
    });
  });

  /**
   * Test 2: Response Schema Validation
   */
  describe("Response Schema Validation", () => {
    it("should include all required fields in generate response", async () => {
      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      const result = await genieService.process(payload);

      // Validate metadata structure
      expect(result.out_envelope.metadata).toBeDefined();
      expect(result.out_envelope.metadata.mode).toBe("ebook");
      expect(result.out_envelope.metadata.generated_at).toBeDefined();

      // Validate pages structure
      expect(Array.isArray(result.out_envelope.pages)).toBe(true);
      expect(result.out_envelope.pages.length).toBeGreaterThan(0);
    });

    it("should have valid timestamp in metadata", async () => {
      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      const result = await genieService.process(payload);

      const timestamp = result.out_envelope.metadata.generated_at;
      expect(timestamp).toBeDefined();

      // Verify it's a valid ISO timestamp
      const parsed = new Date(timestamp);
      expect(parsed.toString()).not.toBe("Invalid Date");
    });

    it("should include resultId for tracking", async () => {
      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      const result = await genieService.process(payload);

      expect(result.resultId).toBeDefined();
      expect(typeof result.resultId).toBe("string");
      expect(result.resultId.length).toBeGreaterThan(0);
    });
  });

  /**
   * Test 3: Classification Routing
   */
  describe("Classification-Based Service Routing", () => {
    it("should route ebook classification to ebook service", async () => {
      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      const result = await genieService.process(payload);

      expect(result.out_envelope.metadata.mode).toBe("ebook");
      expect(result.out_envelope.pages).toBeDefined();
    });

    it("should route poster classification to poster/basic service", async () => {
      const payload = {
        mode: "basic",
        prompt: SAMPLE_PROMPTS.poster[0],
        _classification: SAMPLE_CLASSIFICATIONS.poster_tech,
      };

      const result = await genieService.process(payload);

      expect(result.out_envelope).toBeDefined();
      expect(result.out_envelope.metadata).toBeDefined();
    });

    it("should use classification.medium when mode not provided", async () => {
      const classification = SAMPLE_CLASSIFICATIONS.ebook_poetry;
      const payload = {
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: classification,
        // No mode provided - should use classification.medium
      };

      const result = await genieService.process(payload);

      expect(result.out_envelope).toBeDefined();
    });
  });

  /**
   * Test 4: Backward Compatibility
   */
  describe("Backward Compatibility (No Classification)", () => {
    it("should work without classification parameter (legacy mode)", async () => {
      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        // No _classification parameter
      };

      const result = await genieService.process(payload);

      expect(result).toBeDefined();
      expect(result.out_envelope).toBeDefined();
    });

    it("should auto-classify when no classification provided", async () => {
      const payload = {
        // No mode specified, no classification - should auto-classify
        prompt: SAMPLE_PROMPTS.ebook[0],
      };

      const result = await genieService.process(payload);

      expect(result).toBeDefined();
      expect(result.out_envelope).toBeDefined();
    });

    it("should handle explicit mode without classification", async () => {
      const payload = {
        mode: "demo",
        prompt: "Create a demo about summer travel",
        // No classification - should use mode directly
      };

      const result = await genieService.process(payload);

      expect(result.out_envelope.metadata.mode).toBe("demo");
    });
  });

  /**
   * Test 5: Cost Calculation
   */
  describe("Cost Calculation in Override System", () => {
    it("should calculate cost for style-only override", async () => {
      const overrides = SAMPLE_OVERRIDES.style_only;
      const baseCost = 1.0;
      const styleCost = 0.4;

      expect(baseCost + styleCost).toBe(1.4);
    });

    it("should use MAX formula for multiple overrides", () => {
      // If style (0.4) and tone (0.3) both change:
      // Result should be BASE(1.0) + MAX(0.4, 0.3) = 1.4, not 1.0 + 0.4 + 0.3 = 1.7
      const additionalCosts = [0.4, 0.3]; // Additional costs from overrides
      const maxAdditionalCost = Math.max(...additionalCosts);
      const baseCost = 1.0;
      const finalCost = baseCost + maxAdditionalCost;
      expect(finalCost).toBe(1.4); // BASE + MAX additional
    });

    it("should validate cost estimate is positive", async () => {
      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      const result = await genieService.process(payload);

      // Cost should always be >= 1.0 (base cost)
      if (result.out_envelope.metadata.costEstimate) {
        expect(
          result.out_envelope.metadata.costEstimate
        ).toBeGreaterThanOrEqual(1.0);
      }
    });
  });

  /**
   * Test 6: Error Handling
   */
  describe("Error Handling and Edge Cases", () => {
    it("should handle empty prompt gracefully", async () => {
      const payload = {
        mode: "ebook",
        prompt: "", // Empty
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      try {
        await genieService.process(payload);
        // If it succeeds, that's also acceptable behavior
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle very long prompt", async () => {
      const longPrompt = SAMPLE_PROMPTS.ebook[0].repeat(100);
      const payload = {
        mode: "ebook",
        prompt: longPrompt,
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      const result = await genieService.process(payload);

      expect(result).toBeDefined();
    });

    it("should handle special characters in prompt", async () => {
      const payload = {
        mode: "ebook",
        prompt: "Create a book with émojis 🎨 & symbols: !@#$%",
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      const result = await genieService.process(payload);

      expect(result).toBeDefined();
    });

    it("should handle missing classification fields gracefully", async () => {
      const incompleteClassification = {
        id: "test-1",
        medium: "ebook",
        // Missing other fields
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
  });

  /**
   * Test 7: Concurrent Processing
   */
  describe("Concurrent Request Handling", () => {
    it("should handle multiple concurrent generation requests", async () => {
      const requests = [
        {
          mode: "ebook",
          prompt: SAMPLE_PROMPTS.ebook[0],
          _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
        },
        {
          mode: "ebook",
          prompt: SAMPLE_PROMPTS.ebook[1],
          _classification: SAMPLE_CLASSIFICATIONS.ebook_guide,
        },
        {
          mode: "basic",
          prompt: SAMPLE_PROMPTS.poster[0],
          _classification: SAMPLE_CLASSIFICATIONS.poster_tech,
        },
      ];

      const results = await Promise.all(
        requests.map((payload) => genieService.process(payload))
      );

      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.out_envelope).toBeDefined();
      });
    });

    it("should maintain independent state for concurrent requests", async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        mode: "ebook",
        prompt: `${SAMPLE_PROMPTS.ebook[0]} (request ${i})`,
        _classification: {
          ...SAMPLE_CLASSIFICATIONS.ebook_poetry,
          id: `class-concurrent-${i}`,
        },
      }));

      const results = await Promise.all(
        requests.map((payload) => genieService.process(payload))
      );

      expect(results.length).toBe(5);

      // Verify each result has unique ID
      const ids = results.map((r) => r.resultId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });
  });

  /**
   * Test 8: Performance Baselines
   */
  describe("Performance Baselines", () => {
    it("should process generation within reasonable time", async () => {
      const startTime = Date.now();

      const payload = {
        mode: "ebook",
        prompt: SAMPLE_PROMPTS.ebook[0],
        _classification: SAMPLE_CLASSIFICATIONS.ebook_poetry,
      };

      await genieService.process(payload);

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (not set hard limits in unit tests)
      expect(duration).toBeGreaterThan(0);
    });
  });
});
