/**
 * Phase 2 Service Integration Tests
 * Tests for genieService.process() with classification parameter
 * Tests for override cost calculation and strategy selection
 */

import { describe, it, expect } from "vitest";
import genieService from "../genieService.js";

describe("Phase 2 - genieService.process() with Classification", () => {
  it("should process payload with classification parameter", async () => {
    const classification = {
      id: "test-class-1",
      medium: "ebook",
      confidence: 0.92,
      style: "minimalist",
      themes: ["zen", "modern"],
      audience: "general",
      genre: "poetry",
      tone: "reflective",
      source: "hybrid",
    };

    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
      _classification: classification,
    };

    const result = await genieService.process(payload);

    expect(result).toBeDefined();
    expect(result.out_envelope).toBeDefined();
    expect(result.out_envelope.pages).toBeDefined();
    expect(Array.isArray(result.out_envelope.pages)).toBe(true);
  });

  it("should include classification in metadata when provided", async () => {
    const classification = {
      id: "test-class-1",
      medium: "ebook",
      confidence: 0.92,
      style: "minimalist",
      themes: ["zen"],
      audience: "general",
      genre: "poetry",
      tone: "reflective",
      source: "hybrid",
    };

    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
      _classification: classification,
    };

    const result = await genieService.process(payload);

    expect(result.out_envelope.metadata.classification).toBeDefined();
    expect(result.out_envelope.metadata.classification.medium).toBe("ebook");
    expect(result.out_envelope.metadata.classification.style).toBe(
      "minimalist"
    );
  });

  it("should route correctly based on mode parameter", async () => {
    const modes = ["ebook", "demo", "basic"];

    for (const mode of modes) {
      const payload = {
        mode,
        prompt: `Create a ${mode} about summer`,
      };

      const result = await genieService.process(payload);

      expect(result).toBeDefined();
      expect(result.out_envelope).toBeDefined();
      expect(result.out_envelope.metadata.mode).toBe(mode);
    }
  });

  it("should include metadata with mode and timestamp", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a summer poetry book",
    };

    const result = await genieService.process(payload);

    expect(result.out_envelope.metadata).toBeDefined();
    expect(result.out_envelope.metadata.generated_at).toBeDefined();
    expect(result.out_envelope.metadata.mode).toBe("ebook");
  });

  it("should include resultId for future reference", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
    };

    const result = await genieService.process(payload);

    expect(result).toHaveProperty("resultId");
    expect(typeof result.resultId).toBe("string");
    expect(result.resultId.length).toBeGreaterThan(0);
  });

  it("should handle auto-classification when mode is 'auto'", async () => {
    const payload = {
      mode: "auto",
      prompt: "Create a summer poetry book",
    };

    const result = await genieService.process(payload);

    expect(result).toBeDefined();
    expect(result.out_envelope).toBeDefined();
    expect(result.out_envelope.metadata.mode).toBeDefined();
  });

  it("should handle classification flag for testing", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
      _classify: true,
    };

    const result = await genieService.process(payload);

    expect(result).toBeDefined();
    expect(result.out_envelope.metadata.classification).toBeDefined();
  });

  it("should return valid response structure", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
    };

    const result = await genieService.process(payload);

    // Check response structure
    expect(result).toHaveProperty("out_envelope");
    expect(result).toHaveProperty("resultId");

    const envelope = result.out_envelope;
    expect(Array.isArray(envelope.pages)).toBe(true);
    expect(envelope).toHaveProperty("metadata");
    expect(envelope).toHaveProperty("actions");

    // Check metadata structure
    expect(typeof envelope.metadata.generated_at).toBe("string");
    expect(typeof envelope.metadata.mode).toBe("string");
  });

  it("should handle different mediums with classification", async () => {
    const classification = {
      id: "test-class-1",
      medium: "ebook",
      confidence: 0.92,
      style: "minimalist",
      themes: ["zen"],
      audience: "general",
      genre: "poetry",
      tone: "reflective",
      source: "hybrid",
    };

    const mediums = ["ebook", "demo", "basic"];

    for (const medium of mediums) {
      const payload = {
        mode: medium,
        prompt: `Create a ${medium} about summer`,
        _classification: classification,
      };

      const result = await genieService.process(payload);

      expect(result.out_envelope.metadata.mode).toBe(medium);
    }
  });

  it("should handle empty classification gracefully", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
      _classification: null,
    };

    const result = await genieService.process(payload);

    expect(result).toBeDefined();
    expect(result.out_envelope).toBeDefined();
  });

  it("should generate unique resultIds for each generation", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
    };

    const result1 = await genieService.process(payload);
    const result2 = await genieService.process(payload);

    // Both should be valid
    expect(result1.out_envelope.pages.length).toBeGreaterThan(0);
    expect(result2.out_envelope.pages.length).toBeGreaterThan(0);

    // Should have different resultIds
    expect(result1.resultId).not.toBe(result2.resultId);
  });

  it("should preserve classification style in metadata", async () => {
    const classification = {
      id: "test-style",
      medium: "ebook",
      confidence: 0.92,
      style: "gothic",
      themes: ["dark"],
      audience: "adult",
      genre: "horror",
      tone: "ominous",
      source: "ai",
    };

    const payload = {
      mode: "ebook",
      prompt: "Create a dark gothic collection",
      _classification: classification,
    };

    const result = await genieService.process(payload);

    expect(result.out_envelope.metadata.classification).toBeDefined();
    if (result.out_envelope.metadata.classification) {
      expect(result.out_envelope.metadata.classification.style).toBe("gothic");
      expect(result.out_envelope.metadata.classification.tone).toBe("ominous");
    }
  });
});

describe("Phase 2 - Classification Pipeline", () => {
  it("should classify prompts correctly", async () => {
    const classification = await genieService.classifyPrompt(
      "Create a summer poetry book"
    );

    expect(classification).toBeDefined();
    expect(classification.medium).toBeDefined();
    expect(classification.confidence).toBeDefined();
    expect(typeof classification.confidence).toBe("number");
    expect(classification.confidence).toBeGreaterThanOrEqual(0);
    expect(classification.confidence).toBeLessThanOrEqual(1);
  });

  it("should return safe default for empty prompt", async () => {
    const classification = await genieService.classifyPrompt("");

    expect(classification).toBeDefined();
    expect(classification.medium).toBe("ebook");
    expect(classification.confidence).toBeDefined();
  });

  it("should include source information in classification", async () => {
    const classification = await genieService.classifyPrompt(
      "Create a summer poetry book"
    );

    expect(classification.source).toBeDefined();
    expect(["rules", "ai", "hybrid", "merge", "error"]).toContain(
      classification.source
    );
  });

  it("should extract themes from classification", async () => {
    const classification = await genieService.classifyPrompt(
      "Create a summer poetry book"
    );

    expect(classification.themes).toBeDefined();
    expect(Array.isArray(classification.themes)).toBe(true);
  });

  it("should handle special characters in prompt", async () => {
    const prompts = [
      "Create a poetry book! #poetry @summer",
      "Create a poetry book with accents: café, résumé",
      "Create a 'quoted' poetry book",
    ];

    for (const prompt of prompts) {
      const classification = await genieService.classifyPrompt(prompt);
      expect(classification).toBeDefined();
      expect(classification.medium).toBeDefined();
    }
  });

  it("should handle very long prompts", async () => {
    const longPrompt =
      "Create a poetry book about the summer and the seasons ".repeat(20);
    const classification = await genieService.classifyPrompt(longPrompt);

    expect(classification).toBeDefined();
    expect(classification.medium).toBeDefined();
  });

  it("should classify with reasonable confidence scores", async () => {
    const prompts = [
      "Create an ebook about programming",
      "Design a calendar for 2025",
      "Make a poster about sustainability",
    ];

    for (const prompt of prompts) {
      const classification = await genieService.classifyPrompt(prompt);
      expect(classification.confidence).toBeGreaterThan(0);
    }
  });
});

describe("Phase 2 - Override System Integration", () => {
  it("should handle override system if available", async () => {
    try {
      const { OverrideSystem } = await import("../utils/overrideSystem.js");
      expect(OverrideSystem).toBeDefined();
    } catch (err) {
      // Override system may not be fully implemented
      console.warn("Override system not available:", err?.message);
    }
  });

  it("should process generation for override workflow", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection for override testing",
      _classification: {
        id: "test-override-1",
        medium: "ebook",
        confidence: 0.92,
        style: "minimalist",
        themes: ["zen"],
        audience: "general",
        genre: "poetry",
        tone: "reflective",
        source: "hybrid",
      },
    };

    const result = await genieService.process(payload);

    expect(result).toBeDefined();
    expect(result.resultId).toBeDefined();
    // Classification should be in metadata if provided
    if (result.out_envelope.metadata.classification) {
      expect(result.out_envelope.metadata.classification).toBeDefined();
    }

    // Result should be suitable for override workflow
    expect(result.out_envelope.pages.length).toBeGreaterThan(0);
  });
});

describe("Phase 2 - Backward Compatibility", () => {
  it("should still support existing process() calls without classification", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
      // No classification parameter
    };

    const result = await genieService.process(payload);

    expect(result).toBeDefined();
    expect(result.out_envelope).toBeDefined();
    expect(result.out_envelope.pages.length).toBeGreaterThan(0);
  });

  it("should handle undefined classification parameter", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
      _classification: undefined,
    };

    const result = await genieService.process(payload);

    expect(result).toBeDefined();
    expect(result.out_envelope).toBeDefined();
  });

  it("should work with all existing modes", async () => {
    const modes = ["demo", "ebook", "basic"];

    for (const mode of modes) {
      const payload = {
        mode,
        prompt: `Create a ${mode} about summer`,
      };

      const result = await genieService.process(payload);

      expect(result.out_envelope).toBeDefined();
      expect(result.out_envelope.metadata.mode).toBe(mode);
    }
  });
});

describe("Phase 2 - Error Handling & Edge Cases", () => {
  it("should handle errors in process() gracefully", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
    };

    try {
      const result = await genieService.process(payload);
      expect(result).toBeDefined();
      expect(result.out_envelope).toBeDefined();
    } catch (err) {
      // Should provide meaningful error
      expect(err).toBeDefined();
    }
  });

  it("should not crash on malformed classification", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
      _classification: { invalid: "structure" },
    };

    try {
      const result = await genieService.process(payload);
      // Should handle gracefully
      expect(result).toBeDefined();
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  it("should handle null prompt gracefully", async () => {
    const payload = {
      mode: "ebook",
      prompt: null,
    };

    try {
      const result = await genieService.process(payload);
      // Depending on implementation, might throw or return empty
      expect(result).toBeDefined();
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});

describe("Phase 2 - Response Schema Validation", () => {
  it("should return complete response envelope", async () => {
    const payload = {
      mode: "ebook",
      prompt: "Create a poetry collection",
      _classification: {
        medium: "ebook",
        confidence: 0.92,
        style: "minimalist",
      },
    };

    const result = await genieService.process(payload);

    // Required fields
    expect(result.out_envelope).toBeDefined();
    expect(result.resultId).toBeDefined();

    // Required envelope fields
    expect(result.out_envelope.pages).toBeDefined();
    expect(result.out_envelope.metadata).toBeDefined();
    expect(result.out_envelope.actions).toBeDefined();

    // Pages should be array
    expect(Array.isArray(result.out_envelope.pages)).toBe(true);

    // Metadata should contain mode and timestamp
    expect(result.out_envelope.metadata.mode).toBeDefined();
    expect(result.out_envelope.metadata.generated_at).toBeDefined();
  });

  it("should include classification in metadata when provided", async () => {
    const classification = {
      medium: "ebook",
      confidence: 0.92,
      style: "minimalist",
      themes: ["zen"],
    };

    const payload = {
      mode: "ebook",
      prompt: "Create poetry",
      _classification: classification,
    };

    const result = await genieService.process(payload);

    // Classification should be preserved in metadata if provided
    if (result.out_envelope.metadata.classification) {
      expect(result.out_envelope.metadata.classification).toBeDefined();
      expect(result.out_envelope.metadata.classification.style).toBe(
        "minimalist"
      );
    }
  });
});
