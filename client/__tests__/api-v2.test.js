import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  classify,
  generate,
  applyOverride,
  CONFIG,
} from "../src/lib/api-v2.js";

// Mock fetch globally
global.fetch = vi.fn();

describe("API Client - Phase 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("classify()", () => {
    it("should successfully classify a valid prompt", async () => {
      const mockResponse = {
        id: "class-123",
        medium: "ebook",
        confidence: 0.92,
        style: "modern",
        themes: ["summer", "beach"],
        audience: "adults",
        genre: "fiction",
        tone: "uplifting",
        source: "ai",
        metadata: { model: "gemini-1.5" },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await classify(
        "Create a beautiful summer poster with vibrant colors",
        "poster"
      );

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/classify",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("should throw error on invalid prompt (too short)", async () => {
      try {
        await classify("Short", "ebook");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.status).toBe(400);
        expect(error.message).toContain("at least 10 characters");
        expect(error.retryable).toBe(false);
      }
    });

    it("should throw error on invalid medium", async () => {
      try {
        await classify(
          "Create a beautiful summer poster with vibrant colors",
          "invalid"
        );
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.status).toBe(400);
        expect(error.message).toContain("Invalid medium");
        expect(error.retryable).toBe(false);
      }
    });

    it("should handle server errors (500)", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ message: "Server error" }),
      });

      try {
        await classify("Create a beautiful summer poster", "poster");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.status).toBe(500);
        expect(error.retryable).toBe(true);
      }
    });

    it("should handle timeouts", async () => {
      // Mock fetch to reject with AbortError when timeout occurs
      global.fetch.mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      });

      try {
        await classify("Create a beautiful summer poster", "poster");
        expect.fail("Should have thrown timeout error");
      } catch (error) {
        expect(error.status).toBe(408);
        expect(error.message).toContain("timeout");
        expect(error.retryable).toBe(true);
      }
    });
  });

  describe("generate()", () => {
    it("should successfully generate a PDF", async () => {
      const mockClassification = {
        id: "class-123",
        medium: "ebook",
        confidence: 0.92,
      };

      const mockResponse = {
        id: "gen-456",
        pdfUrl: "/tmp-exports/abc123.pdf",
        pageCount: 12,
        medium: "ebook",
        style: "modern",
        classification: mockClassification,
        metadata: { imageCount: 5 },
        latency: 8500,
        costEstimate: 0.5,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generate(
        "Create a beautiful summer poster",
        "ebook",
        mockClassification
      );

      expect(result).toEqual(mockResponse);
    });

    it("should throw error on missing classification", async () => {
      try {
        await generate("Create a beautiful summer poster", "ebook", null);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.status).toBe(400);
        expect(error.message).toContain("classification");
        expect(error.retryable).toBe(false);
      }
    });

    it("should throw error on invalid medium", async () => {
      const mockClassification = {
        id: "class-123",
        medium: "ebook",
      };

      try {
        await generate(
          "Create a beautiful summer poster",
          "invalid",
          mockClassification
        );
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.status).toBe(400);
        expect(error.retryable).toBe(false);
      }
    });
  });

  describe("applyOverride()", () => {
    it("should successfully apply override", async () => {
      const mockClassification = {
        id: "class-123",
        medium: "ebook",
      };

      const mockResponse = {
        id: "override-789",
        pdfUrl: "/tmp-exports/def456.pdf",
        costMultiplier: 1.2,
        costBreakdown: { style: 0.4, tone: 0.3 },
        regenerationStrategy: "full",
        metadata: {},
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await applyOverride("gen-456", mockClassification, {
        style: "gothic",
        tone: "dramatic",
      });

      expect(result).toEqual(mockResponse);
    });

    it("should throw error on missing overrides", async () => {
      const mockClassification = {
        id: "class-123",
        medium: "ebook",
      };

      try {
        await applyOverride("gen-456", mockClassification, {});
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.status).toBe(400);
        expect(error.message).toContain("No overrides");
        expect(error.retryable).toBe(false);
      }
    });

    it("should throw error on invalid generation ID", async () => {
      const mockClassification = {
        id: "class-123",
        medium: "ebook",
      };

      try {
        await applyOverride("", mockClassification, { style: "gothic" });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.status).toBe(400);
        expect(error.message).toContain("generation ID");
        expect(error.retryable).toBe(false);
      }
    });
  });

  describe("CONFIG", () => {
    it("should have correct timeout values", () => {
      expect(CONFIG.TIMEOUTS.CLASSIFY).toBe(30000);
      expect(CONFIG.TIMEOUTS.GENERATE).toBe(30000);
      expect(CONFIG.TIMEOUTS.OVERRIDE).toBe(10000);
    });

    it("should have all supported media", () => {
      expect(CONFIG.SUPPORTED_MEDIA).toContain("ebook");
      expect(CONFIG.SUPPORTED_MEDIA).toContain("calendar");
      expect(CONFIG.SUPPORTED_MEDIA).toContain("poster");
      expect(CONFIG.SUPPORTED_MEDIA).toContain("stickers");
      expect(CONFIG.SUPPORTED_MEDIA).toContain("card");
    });

    it("should have correct confidence threshold", () => {
      expect(CONFIG.CONFIDENCE_THRESHOLD).toBe(0.85);
    });
  });
});
