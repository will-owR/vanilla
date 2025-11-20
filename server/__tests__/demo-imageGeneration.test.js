import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateImageForPage,
  extractConcept,
  createPlaceholder,
} from "../utils/imageGenerator.js";

describe("Module 4: imageGeneration - Image Generation", () => {
  let testJobId;
  let testPageContent;

  beforeEach(() => {
    testJobId = "test-job-123";
    testPageContent =
      "Introduction to artificial intelligence and machine learning technologies";
  });

  describe("extractConcept()", () => {
    it("extracts key concept from page content", () => {
      const concept = extractConcept(testPageContent);
      expect(concept).toBeDefined();
      expect(typeof concept).toBe("string");
      expect(concept.length).toBeGreaterThan(0);
    });

    it("extracts meaningful term from content", () => {
      const concept = extractConcept(testPageContent);
      // Should extract terms like "artificial intelligence", "machine learning", etc.
      expect(concept).toMatch(/\w+/);
    });

    it("handles empty content gracefully", () => {
      const concept = extractConcept("");
      expect(concept).toBeDefined();
      expect(typeof concept).toBe("string");
    });
  });

  describe("createPlaceholder()", () => {
    it("creates placeholder image object", () => {
      const placeholder = createPlaceholder(1);
      expect(placeholder).toBeDefined();
      expect(typeof placeholder).toBe("object");
    });

    it("placeholder has url, caption, altText", () => {
      const placeholder = createPlaceholder(1);
      expect(placeholder.url).toBeDefined();
      expect(placeholder.caption).toBeDefined();
      expect(placeholder.altText).toBeDefined();
    });

    it("placeholder url is accessible", () => {
      const placeholder = createPlaceholder(1);
      expect(placeholder.url).toMatch(/tmp-exports|placeholder|gray/i);
    });

    it("caption includes page number", () => {
      const placeholder = createPlaceholder(2);
      expect(placeholder.caption).toMatch(/2/);
    });
  });

  describe("generateImageForPage()", () => {
    it("returns image object with url, caption, altText", async () => {
      const result = await generateImageForPage(testPageContent, 1, testJobId);
      expect(result).toBeDefined();
      expect(result.url).toBeDefined();
      expect(result.caption).toBeDefined();
      expect(result.altText).toBeDefined();
    });

    it("caption includes figure number", async () => {
      const result = await generateImageForPage(testPageContent, 2, testJobId);
      expect(result.caption).toMatch(/2|Figure/);
    });

    it("altText is descriptive", async () => {
      const result = await generateImageForPage(testPageContent, 1, testJobId);
      expect(result.altText.length).toBeGreaterThan(5);
    });

    it("url is defined and non-empty", async () => {
      const result = await generateImageForPage(testPageContent, 1, testJobId);
      expect(result.url).toBeDefined();
      expect(result.url.length).toBeGreaterThan(0);
    });

    it("fallback creates placeholder when API fails", async () => {
      const result = await generateImageForPage("", 1, testJobId);
      expect(result).toBeDefined();
      expect(result.url).toBeDefined();
    });

    it("handles all page numbers 1-5", async () => {
      for (let i = 1; i <= 5; i++) {
        const result = await generateImageForPage(
          testPageContent,
          i,
          testJobId
        );
        expect(result).toBeDefined();
        expect(result.url).toBeDefined();
        expect(result.caption).toMatch(String(i));
      }
    });

    it("generates different captions for different pages", async () => {
      const result1 = await generateImageForPage(testPageContent, 1, testJobId);
      const result2 = await generateImageForPage(testPageContent, 2, testJobId);
      expect(result1.caption).not.toBe(result2.caption);
    });
  });
});
