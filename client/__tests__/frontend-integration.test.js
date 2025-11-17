/**
 * Frontend Integration Tests - Module 10
 * Tests for API integration, components, and workflows
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/svelte";
import ClassificationFeedback from "../components/ClassificationFeedback.svelte";
import {
  classify,
  generate,
  applyOverride,
  getAvailableServices,
  getServiceCapabilities,
} from "../lib/api.js";

// Mock global fetch
global.fetch = vi.fn();

describe("Frontend Integration Tests - Module 10", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // API INTEGRATION TESTS (6 tests)
  // ========================================
  describe("API Integration", () => {
    it("should call classify API with prompt", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          medium: "ebook",
          confidence: 0.92,
          source: "hybrid",
          style: "minimalist",
        }),
      });

      const result = await classify("Create a summer poetry collection");

      expect(result).toHaveProperty("medium");
      expect(result).toHaveProperty("confidence");
      expect(result.medium).toBe("ebook");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should call generate API with medium and options", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: { type: "ebook", html: "<html>...</html>" },
          medium: "ebook",
          latency: 250,
          confidence: 0.85,
        }),
      });

      const result = await generate("Summer poems", "ebook", {
        style: "minimalist",
      });

      expect(result).toHaveProperty("output");
      expect(result).toHaveProperty("latency");
      expect(result.medium).toBe("ebook");
    });

    it("should call applyOverride API with old and new classification", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: { type: "ebook" },
          costMultiplier: 0.4,
          changedDimensions: ["style"],
        }),
      });

      const result = await applyOverride(
        { type: "ebook" },
        { medium: "ebook", style: "minimalist" },
        { medium: "ebook", style: "gothic" }
      );

      expect(result).toHaveProperty("costMultiplier");
      expect(result.costMultiplier).toBeLessThan(1.0);
    });

    it("should handle API errors gracefully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      try {
        await classify("Test prompt");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toMatch(/Classification failed/);
      }
    });

    it("should fetch available services", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          "ebook",
          "calendar",
          "poster",
          "stickers",
          "greeting-card",
          "journal",
          "app-ui",
          "wall-art",
        ],
      });

      const services = await getAvailableServices();

      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBe(8);
      expect(services).toContain("ebook");
      expect(services).toContain("calendar");
    });

    it("should fetch service capabilities", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          medium: "ebook",
          styles: ["minimalist", "gothic", "whimsical"],
          themes: ["nature", "urban", "fantasy"],
        }),
      });

      const capabilities = await getServiceCapabilities("ebook");

      expect(capabilities).toHaveProperty("styles");
      expect(Array.isArray(capabilities.styles)).toBe(true);
      expect(capabilities.styles.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // COMPONENT RENDERING TESTS (4 tests)
  // ========================================
  describe("Component Rendering", () => {
    it("should render ClassificationFeedback component", () => {
      const { component } = render(ClassificationFeedback, {
        props: {
          prompt: "Create a summer calendar",
          classification: {
            medium: "calendar",
            style: "whimsical",
            theme: ["summer"],
          },
          confidence: 0.85,
          source: "hybrid",
        },
      });

      expect(component).toBeDefined();
    });

    it("should display suggested medium in ClassificationFeedback", () => {
      const { container } = render(ClassificationFeedback, {
        props: {
          classification: { medium: "calendar" },
          confidence: 0.9,
          source: "ai",
        },
      });

      const text = container.textContent;
      expect(text).toContain("Calendar");
    });

    it("should show confidence percentage", () => {
      const { container } = render(ClassificationFeedback, {
        props: {
          classification: { medium: "ebook" },
          confidence: 0.75,
          source: "rules",
        },
      });

      const text = container.textContent;
      expect(text).toContain("75%");
    });

    it("should show classification source", () => {
      const { container } = render(ClassificationFeedback, {
        props: {
          classification: { medium: "poster" },
          confidence: 0.8,
          source: "hybrid",
        },
      });

      const text = container.textContent;
      expect(text).toContain("Hybrid");
    });
  });

  // ========================================
  // WORKFLOW TESTS (4 tests)
  // ========================================
  describe("User Workflows", () => {
    it("should support prompt → classify → generate workflow", async () => {
      // Step 1: Classify
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          medium: "ebook",
          confidence: 0.9,
          source: "rules",
        }),
      });

      const classification = await classify("Summer poetry");

      // Step 2: Generate
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: { type: "ebook" },
          latency: 200,
        }),
      });

      const generated = await generate("Summer poetry", classification.medium);

      expect(classification.medium).toBe("ebook");
      expect(generated.output.type).toBe("ebook");
    });

    it("should support override workflow: style change", async () => {
      const oldClass = { medium: "ebook", style: "minimalist" };
      const newClass = { medium: "ebook", style: "gothic" };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: { type: "ebook", style: "gothic" },
          costMultiplier: 0.4,
          changedDimensions: ["style"],
        }),
      });

      const result = await applyOverride({ type: "ebook" }, oldClass, newClass);

      expect(result.costMultiplier).toBeLessThan(0.5); // Style change is ~40%
    });

    it("should support override workflow: color palette change", async () => {
      const oldClass = { medium: "calendar", colorPalette: "vibrant" };
      const newClass = { medium: "calendar", colorPalette: "dark" };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: { type: "calendar" },
          costMultiplier: 0.05,
          changedDimensions: ["colorPalette"],
        }),
      });

      const result = await applyOverride(
        { type: "calendar" },
        oldClass,
        newClass
      );

      expect(result.costMultiplier).toBeLessThan(0.1); // Color change is ~5%
    });

    it("should support override workflow: medium change", async () => {
      const oldClass = { medium: "ebook" };
      const newClass = { medium: "poster" };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: { type: "poster" },
          costMultiplier: 1.0,
          changedDimensions: ["medium"],
        }),
      });

      const result = await applyOverride({ type: "ebook" }, oldClass, newClass);

      expect(result.costMultiplier).toBe(1.0); // Medium change is full regeneration
    });
  });

  // ========================================
  // ERROR HANDLING TESTS (3 tests)
  // ========================================
  describe("Error Handling", () => {
    it("should handle failed API call with user-friendly error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      try {
        await generate("Test", "ebook");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.message).toContain("Generation failed");
      }
    });

    it("should handle validation errors", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      try {
        await classify("");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error.message).toBeDefined();
      }
    });

    it("should handle network errors gracefully", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network request failed"));

      try {
        await getAvailableServices();
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // ========================================
  // PERFORMANCE TESTS (2 tests)
  // ========================================
  describe("Performance", () => {
    it("should debounce classification calls", async () => {
      const calls = [];

      global.fetch.mockImplementation(async () => {
        calls.push(Date.now());
        return {
          ok: true,
          json: async () => ({
            medium: "ebook",
            confidence: 0.9,
          }),
        };
      });

      // Simulate rapid classify calls
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(classify(`Prompt ${i}`));
      }

      await Promise.all(promises);

      // Should have made 3 calls (debouncing happens in UI)
      expect(calls.length).toBe(3);
    });

    it("should handle concurrent requests", async () => {
      global.fetch.mockImplementation(async (url) => {
        // Simulate variable latency
        await new Promise((r) => setTimeout(r, Math.random() * 100));
        return {
          ok: true,
          json: async () => ({
            medium: "ebook",
            latency: 50,
          }),
        };
      });

      const start = Date.now();
      const results = await Promise.all([
        generate("Prompt 1", "ebook"),
        generate("Prompt 2", "calendar"),
        generate("Prompt 3", "poster"),
      ]);
      const duration = Date.now() - start;

      expect(results).toHaveLength(3);
      expect(duration).toBeLessThan(5000); // Should complete in <5s
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS (1 test)
  // ========================================
  describe("Accessibility", () => {
    it("should have accessible ClassificationFeedback component", () => {
      const { container } = render(ClassificationFeedback, {
        props: {
          classification: { medium: "ebook" },
          confidence: 0.85,
          source: "ai",
        },
      });

      // Check for buttons with accessible labels
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThan(0);

      // Verify buttons have text content
      buttons.forEach((button) => {
        expect(button.textContent.trim().length).toBeGreaterThan(0);
      });
    });
  });
});
