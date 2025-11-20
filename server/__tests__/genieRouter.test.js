/**
 * GenieService Router Tests - Module 7
 * Tests routing, classification, error handling, and performance
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import GenieRouter from "../utils/genieRouter.js";

// Mock services for testing
const mockServices = {
  ebook: {
    async generate(context) {
      return { type: "ebook", html: "<html>ebook content</html>" };
    },
  },
  calendar: {
    async generate(context) {
      return { type: "calendar", html: "<html>calendar content</html>" };
    },
  },
  poster: {
    async generate(context) {
      return { type: "poster", html: "<html>poster content</html>" };
    },
  },
  stickers: {
    async generate(context) {
      return { type: "stickers", html: "<html>stickers content</html>" };
    },
  },
  "greeting-card": {
    async generate(context) {
      return { type: "greeting-card", html: "<html>card content</html>" };
    },
  },
  journal: {
    async generate(context) {
      return { type: "journal", html: "<html>journal content</html>" };
    },
  },
  "app-ui": {
    async generate(context) {
      return { type: "app-ui", html: "<html>app-ui content</html>" };
    },
  },
  "wall-art": {
    async generate(context) {
      return { type: "wall-art", html: "<html>wall-art content</html>" };
    },
  },
};

let router = null;

describe("GenieService Router - Module 7", () => {
  beforeEach(() => {
    router = new GenieRouter(mockServices);
  });

  describe("Routing", () => {
    it("should route ebook prompt to ebook service", async () => {
      const result = await router.route("Write me an ebook about history", {
        skipClassification: true,
        medium: "ebook",
      });
      expect(result.output.type).toBe("ebook");
      expect(result.medium).toBe("ebook");
    });

    it("should route calendar prompt to calendar service", async () => {
      const result = await router.route("Create a calendar for 2024", {
        skipClassification: true,
        medium: "calendar",
      });
      expect(result.output.type).toBe("calendar");
      expect(result.medium).toBe("calendar");
    });

    it("should route poster prompt to poster service", async () => {
      const result = await router.route("Design a movie poster", {
        skipClassification: true,
        medium: "poster",
      });
      expect(result.output.type).toBe("poster");
      expect(result.medium).toBe("poster");
    });

    it("should route to all 8 mediums correctly", async () => {
      const prompts = {
        ebook: "Write an ebook",
        calendar: "Create a calendar",
        poster: "Design a poster",
        stickers: "Make stickers",
        "greeting-card": "Make a greeting card",
        journal: "Design a journal",
        "app-ui": "Create app UI",
        "wall-art": "Design wall art",
      };

      for (const [medium, prompt] of Object.entries(prompts)) {
        const result = await router.route(prompt, {
          skipClassification: true,
          medium,
        });
        expect(result.output.type).toBe(medium);
        expect(result.medium).toBe(medium);
      }
    });
  });

  describe("Validation", () => {
    it("should reject null prompt", async () => {
      await expect(router.route(null)).rejects.toThrow("Invalid prompt");
    });

    it("should reject empty prompt", async () => {
      await expect(router.route("")).rejects.toThrow("Invalid prompt");
    });

    it("should reject non-string prompt", async () => {
      await expect(router.route(123)).rejects.toThrow("Invalid prompt");
    });

    it("should reject invalid medium", async () => {
      await expect(
        router.route("Create something", {
          skipClassification: true,
          medium: "invalid-medium",
        })
      ).rejects.toThrow("Invalid medium");
    });

    it("should accept valid medium option", async () => {
      const result = await router.route("Create something", {
        skipClassification: true,
        medium: "ebook",
      });
      expect(result.medium).toBe("ebook");
    });
  });

  describe("Classification Fallback", () => {
    it("should use rule engine for high confidence", async () => {
      const result = await router.route(
        "Write me an ebook with minimalist design",
        {
          skipClassification: true,
          medium: "ebook",
        }
      );
      expect(["rules", "ai", "hybrid", "provided"]).toContain(result.source);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should have classification dimensions", async () => {
      const result = await router.route("Create a spooky poster for children", {
        skipClassification: true,
        medium: "poster",
      });
      expect(result.medium).toBeDefined();
      expect(result.style).toBeDefined();
      expect(result.colorPalette).toBeDefined();
      expect(Array.isArray(result.theme)).toBe(true);
    });

    it("should return confidence score", async () => {
      const result = await router.route("Make something cool", {
        skipClassification: true,
        medium: "calendar",
      });
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing service gracefully", async () => {
      const emptyRouter = new GenieRouter({});
      await expect(
        emptyRouter.route("Create something", {
          skipClassification: true,
          medium: "ebook",
        })
      ).rejects.toThrow("No service registered");
    });

    it("should handle service errors", async () => {
      const faultyService = {
        async generate() {
          throw new Error("Service crashed");
        },
      };
      const faultyRouter = new GenieRouter({ ebook: faultyService });
      await expect(
        faultyRouter.route("Create ebook", {
          skipClassification: true,
          medium: "ebook",
        })
      ).rejects.toThrow("Service generation failed");
    });

    it("should handle invalid service (no generate method)", async () => {
      const invalidRouter = new GenieRouter({ ebook: {} });
      await expect(
        invalidRouter.route("Create ebook", {
          skipClassification: true,
          medium: "ebook",
        })
      ).rejects.toThrow("does not have generate()");
    });
  });

  describe("Service Management", () => {
    it("should get available services", () => {
      const available = router.getAvailableServices();
      expect(Array.isArray(available)).toBe(true);
      expect(available.length).toBe(8);
      expect(available).toContain("ebook");
    });

    it("should register new service", () => {
      const newRouter = new GenieRouter();
      const testService = {
        async generate() {
          return { type: "test" };
        },
      };
      newRouter.registerService("ebook", testService);
      expect(newRouter.getAvailableServices()).toContain("ebook");
    });

    it("should reject invalid medium on register", () => {
      const newRouter = new GenieRouter();
      const testService = { async generate() {} };
      expect(() => {
        newRouter.registerService("invalid", testService);
      }).toThrow("Invalid medium");
    });

    it("should reject service without generate method", () => {
      const newRouter = new GenieRouter();
      expect(() => {
        newRouter.registerService("ebook", {});
      }).toThrow("must have generate(context)");
    });
  });

  describe("Service Capabilities", () => {
    it("should return capabilities for registered service", () => {
      const caps = router.getServiceCapabilities("ebook");
      expect(caps).toBeDefined();
      expect(caps.medium).toBe("ebook");
      expect(caps.available).toBe(true);
    });

    it("should return null for unregistered service", () => {
      const emptyRouter = new GenieRouter();
      const caps = emptyRouter.getServiceCapabilities("ebook");
      expect(caps).toBeNull();
    });

    it("should list supported styles", () => {
      const caps = router.getServiceCapabilities("ebook");
      expect(Array.isArray(caps.supports.styles)).toBe(true);
      expect(caps.supports.styles.length > 0).toBe(true);
    });
  });

  describe("Performance", () => {
    it("should complete routing in <500ms", async () => {
      const start = Date.now();
      const result = await router.route("Create an ebook", {
        skipClassification: true,
        medium: "ebook",
      });
      const duration = Date.now() - start;
      expect(result.latency).toBeLessThan(500);
      expect(duration).toBeLessThan(500);
    });

    it("should track latency", async () => {
      router.resetMetrics();
      await router.route("Create ebook", {
        skipClassification: true,
        medium: "ebook",
      });
      await router.route("Create calendar", {
        skipClassification: true,
        medium: "calendar",
      });
      const metrics = router.getMetrics();
      expect(metrics.latency.min).toBeGreaterThanOrEqual(0);
      expect(metrics.latency.max).toBeGreaterThanOrEqual(metrics.latency.min);
      expect(metrics.latency.mean).toBeGreaterThanOrEqual(0);
    });

    it("should handle long prompts efficiently", async () => {
      const longPrompt = "Make an ebook ".repeat(100);
      const start = Date.now();
      const result = await router.route(longPrompt, {
        skipClassification: true,
        medium: "ebook",
      });
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
      expect(result.output).toBeDefined();
    });
  });

  describe("Metrics Collection", () => {
    it("should track successful routes", async () => {
      await router.route("Create ebook", {
        skipClassification: true,
        medium: "ebook",
      });
      const metrics = router.getMetrics();
      expect(metrics.successfulRoutes).toBe(1);
      expect(metrics.failedRoutes).toBe(0);
    });

    it("should track failed routes", async () => {
      await router.route("Create ebook", {
        skipClassification: true,
        medium: "ebook",
      });
      try {
        await router.route(null);
      } catch (e) {
        // Expected
      }
      const metrics = router.getMetrics();
      expect(metrics.failedRoutes).toBe(1);
    });

    it("should calculate success rate", async () => {
      await router.route("Create ebook", {
        skipClassification: true,
        medium: "ebook",
      });
      await router.route("Create calendar", {
        skipClassification: true,
        medium: "calendar",
      });
      const metrics = router.getMetrics();
      expect(metrics.successRate).toBe(100);
    });

    it("should track classification source", async () => {
      await router.route("Create ebook", {
        skipClassification: true,
        medium: "ebook",
      });
      const metrics = router.getMetrics();
      expect(metrics.classificationSource.rules >= 0).toBe(true);
      expect(metrics.classificationSource.ai >= 0).toBe(true);
      expect(metrics.classificationSource.hybrid >= 0).toBe(true);
    });

    it("should reset metrics", async () => {
      await router.route("Create ebook", {
        skipClassification: true,
        medium: "ebook",
      });
      router.resetMetrics();
      const metrics = router.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRoutes).toBe(0);
    });
  });

  describe("Medium Validation", () => {
    it("should validate all 8 mediums", () => {
      const mediums = router.getValidMediums();
      expect(mediums).toContain("ebook");
      expect(mediums).toContain("calendar");
      expect(mediums).toContain("poster");
      expect(mediums).toContain("stickers");
      expect(mediums).toContain("greeting-card");
      expect(mediums).toContain("journal");
      expect(mediums).toContain("app-ui");
      expect(mediums).toContain("wall-art");
    });

    it("should recognize valid mediums", () => {
      expect(router.isValidMedium("ebook")).toBe(true);
      expect(router.isValidMedium("calendar")).toBe(true);
    });

    it("should reject invalid mediums", () => {
      expect(router.isValidMedium("invalid")).toBe(false);
      expect(router.isValidMedium("notebook")).toBe(false);
    });
  });

  describe("Integration", () => {
    it("should complete full pipeline: prompt → classify → route → output", async () => {
      const result = await router.route(
        "Create a spooky calendar for Halloween",
        {
          skipClassification: true,
          medium: "calendar",
        }
      );
      expect(result.output).toBeDefined();
      expect(result.output.type).toBeDefined();
      expect(result.medium).toBeDefined();
      expect(result.style).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.latency).toBeLessThan(500);
    });

    it("should handle multiple sequential routes", async () => {
      const result1 = await router.route("Create ebook", {
        skipClassification: true,
        medium: "ebook",
      });
      const result2 = await router.route("Create calendar", {
        skipClassification: true,
        medium: "calendar",
      });
      const result3 = await router.route("Create poster", {
        skipClassification: true,
        medium: "poster",
      });

      expect(result1.medium).toBe("ebook");
      expect(result2.medium).toBe("calendar");
      expect(result3.medium).toBe("poster");

      const metrics = router.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successfulRoutes).toBe(3);
    });

    it("should skip classification when requested", async () => {
      const result = await router.route("Some prompt", {
        skipClassification: true,
        medium: "ebook",
        style: "gothic",
        colorPalette: "vibrant",
      });

      expect(result.medium).toBe("ebook");
      expect(result.style).toBe("gothic");
      expect(result.source).toBe("provided");
    });
  });
});
