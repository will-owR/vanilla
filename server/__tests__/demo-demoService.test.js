import { describe, it, expect, beforeEach } from "vitest";
import demoService from "../demoService.js";

describe("Module 1: demoService - Content Generation", () => {
  let testPrompt;
  let testMetadata;

  beforeEach(() => {
    testPrompt =
      "Create a presentation about AI futures and technological innovation";
    testMetadata = {
      pages: 5,
      theme: "dark",
      author: "CELS",
    };
  });

  describe("generatePages()", () => {
    it("generates 5 pages from prompt", async () => {
      const result = await demoService.generatePages(testPrompt, testMetadata);
      expect(result.pages).toHaveLength(5);
    });

    it("each page has id (p1-p5), title, and blocks", async () => {
      const result = await demoService.generatePages(testPrompt, testMetadata);
      result.pages.forEach((page, index) => {
        const pageNum = index + 1;
        expect(page.id).toBe(`p${pageNum}`);
        expect(page.title).toBeDefined();
        expect(page.title).not.toBe("");
        expect(page.blocks).toBeInstanceOf(Array);
        expect(page.blocks.length).toBeGreaterThan(0);
      });
    });

    it("distributes content evenly across pages", async () => {
      const result = await demoService.generatePages(testPrompt, testMetadata);
      result.pages.forEach((page) => {
        expect(page.blocks.length).toBeGreaterThanOrEqual(3);
        expect(page.blocks.length).toBeLessThanOrEqual(4);
      });
    });

    it("blocks have correct types: text, image, callout", async () => {
      const result = await demoService.generatePages(testPrompt, testMetadata);
      const validTypes = ["text", "image", "callout"];
      result.pages.forEach((page) => {
        page.blocks.forEach((block) => {
          expect(block.type).toMatch(/text|image|callout/);
          expect(validTypes).toContain(block.type);
        });
      });
    });

    it("each block has required content properties", async () => {
      const result = await demoService.generatePages(testPrompt, testMetadata);
      result.pages.forEach((page) => {
        page.blocks.forEach((block) => {
          expect(block.content || block.caption || block.text).toBeDefined();
        });
      });
    });

    it("metadata includes pages_count: 5", async () => {
      const result = await demoService.generatePages(testPrompt, testMetadata);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.pages_count).toBe(5);
    });

    it("metadata includes theme: dark", async () => {
      const result = await demoService.generatePages(testPrompt, testMetadata);
      expect(result.metadata.theme).toBe("dark");
    });

    it("actions include generate_pdf, generate_images, generate_cover, generate_copyright, generate_epilogue", async () => {
      const result = await demoService.generatePages(testPrompt, testMetadata);
      expect(result.actions).toBeDefined();
      expect(result.actions.generate_pdf).toBe(true);
      expect(result.actions.generate_images).toBe(true);
      expect(result.actions.generate_cover).toBe(true);
      expect(result.actions.generate_copyright).toBe(true);
      expect(result.actions.generate_epilogue).toBe(true);
    });

    it("handles short prompts without crashing", async () => {
      const shortPrompt = "AI is great";
      const result = await demoService.generatePages(shortPrompt, testMetadata);
      expect(result.pages).toHaveLength(5);
      expect(result.metadata.pages_count).toBe(5);
    });

    it("handles long prompts by distributing content", async () => {
      const longPrompt = "Lorem ipsum dolor sit amet. ".repeat(50);
      const result = await demoService.generatePages(longPrompt, testMetadata);
      expect(result.pages).toHaveLength(5);
      expect(result.metadata.pages_count).toBe(5);
    });

    it("returns valid out_envelope structure", async () => {
      const result = await demoService.generatePages(testPrompt, testMetadata);
      expect(result.pages).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.pages)).toBe(true);
      expect(typeof result.metadata).toBe("object");
      expect(typeof result.actions).toBe("object");
    });
  });
});
