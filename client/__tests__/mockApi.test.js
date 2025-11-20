import { describe, it, expect, beforeEach } from "vitest";
import {
  mockClassify,
  mockGenerate,
  mockApplyOverride,
  setMockAPIEnabled,
  setMockDelay,
  getMockAPIStatus,
} from "../src/lib/mockApi.js";

describe("Mock API", () => {
  beforeEach(() => {
    setMockAPIEnabled(true);
    setMockDelay(0); // No delay for tests
  });

  describe("mockClassify()", () => {
    it("should return valid classification response", async () => {
      const result = await mockClassify(
        "Create a beautiful summer poster with vibrant colors",
        "poster"
      );

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^class-/);
      expect(result.medium).toBe("poster");
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.style).toBeDefined();
      expect(result.themes).toBeInstanceOf(Array);
      expect(result.themes.length).toBeGreaterThan(0);
      expect(result.audience).toBeDefined();
      expect(result.genre).toBeDefined();
      expect(result.tone).toBeDefined();
      expect(["rules", "ai", "hybrid"]).toContain(result.source);
      expect(result.metadata).toBeDefined();
    });

    it("should inject error when prompt contains [error]", async () => {
      try {
        await mockClassify("This is a test [error] prompt", "poster");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.status).toBe(500);
        expect(error.retryable).toBe(true);
      }
    });

    it("should inject timeout when prompt contains [timeout]", async () => {
      try {
        await mockClassify("This is a test [timeout] prompt", "poster");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.status).toBe(408);
        expect(error.retryable).toBe(true);
      }
    });

    it("should inject validation error when prompt contains [validation]", async () => {
      try {
        await mockClassify("This is a test [validation] prompt", "poster");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.status).toBe(422);
        expect(error.retryable).toBe(false);
      }
    });
  });

  describe("mockGenerate()", () => {
    it("should return valid generation response", async () => {
      const mockClassification = {
        id: "class-123",
        style: "modern",
        tone: "uplifting",
      };

      const result = await mockGenerate(
        "Create a beautiful summer poster with vibrant colors",
        "poster",
        mockClassification
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined(); // UUID format, no prefix required
      expect(typeof result.id).toBe("string");
      expect(result.pdfUrl).toMatch(/^\/tmp-exports\//);
      expect(result.pdfUrl).toMatch(/\.pdf$/);
      expect(typeof result.pageCount).toBe("number");
      expect(result.pageCount).toBeGreaterThanOrEqual(10);
      expect(result.pageCount).toBeLessThanOrEqual(50);
      expect(result.medium).toBe("poster");
      expect(result.style).toBe("modern");
      expect(result.classification).toEqual(mockClassification);
      expect(typeof result.latency).toBe("number");
      expect(typeof result.costEstimate).toBe("number");
      expect(result.metadata).toBeDefined();
    });

    it("should have consistent mediums and styles", async () => {
      const mockClassification = {
        id: "class-456",
        style: "gothic",
        tone: "dramatic",
      };

      const result = await mockGenerate(
        "Create a dark gothic poster",
        "ebook",
        mockClassification
      );

      expect(result.medium).toBe("ebook");
      expect(result.style).toBe("gothic");
    });
  });

  describe("mockApplyOverride()", () => {
    it("should return valid override response", async () => {
      const mockClassification = {
        id: "class-789",
        style: "modern",
        tone: "professional",
      };

      const result = await mockApplyOverride("gen-123", mockClassification, {
        style: "gothic",
        tone: "dramatic",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined(); // UUID format, no prefix required
      expect(typeof result.id).toBe("string");
      expect(result.pdfUrl).toMatch(/^\/tmp-exports\//);
      expect(typeof result.costMultiplier).toBe("number");
      expect(result.costMultiplier).toBeGreaterThan(1.0);
      expect(result.costBreakdown).toBeDefined();
      expect(typeof result.costBreakdown.base).toBe("number");
      expect(result.regenerationStrategy).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.originalGenerationId).toBe("gen-123");
    });

    it("should calculate cost multiplier based on overrides", async () => {
      const mockClassification = {
        id: "class-test",
        style: "modern",
        tone: "casual",
        themes: ["summer"],
      };

      // Override all properties
      const result = await mockApplyOverride("gen-test", mockClassification, {
        style: "gothic",
        tone: "dramatic",
        themes: ["winter"],
      });

      // Cost should reflect all overrides
      expect(result.costMultiplier).toBeGreaterThan(1.0);
      expect(result.costBreakdown.style).toBeGreaterThan(0);
      expect(result.costBreakdown.tone).toBeGreaterThan(0);
      expect(result.costBreakdown.themes).toBeGreaterThan(0);
    });

    it("should inject validation error for invalid style", async () => {
      const mockClassification = {
        id: "class-invalid",
        style: "modern",
      };

      try {
        await mockApplyOverride("gen-invalid", mockClassification, {
          style: "invalid_style_name",
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error.status).toBe(422);
        expect(error.retryable).toBe(false);
      }
    });
  });

  describe("Mock API Configuration", () => {
    it("should get mock API status", () => {
      const status = getMockAPIStatus();
      expect(status.enabled).toBe(true);
      expect(typeof status.delayMs).toBe("number");
      expect(status.errorInjection).toBeDefined();
    });

    it("should toggle mock API on/off", () => {
      setMockAPIEnabled(false);
      let status = getMockAPIStatus();
      expect(status.enabled).toBe(false);

      setMockAPIEnabled(true);
      status = getMockAPIStatus();
      expect(status.enabled).toBe(true);
    });

    it("should set mock delay", () => {
      setMockDelay(1000);
      const status = getMockAPIStatus();
      expect(status.delayMs).toBe(1000);
    });
  });

  describe("UUID Generation", () => {
    it("should generate unique IDs", async () => {
      const result1 = await mockClassify("Test prompt 1", "ebook");
      const result2 = await mockClassify("Test prompt 2", "ebook");

      expect(result1.id).not.toBe(result2.id);
    });
  });
});
