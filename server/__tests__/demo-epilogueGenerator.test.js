import { describe, it, expect, beforeEach } from "vitest";
import { generateEpilogue } from "../utils/epilogueGenerator.js";

describe("Module 3: epilogueGenerator - Back Matter Generation", () => {
  let testMetadata;

  beforeEach(() => {
    testMetadata = {
      author: "CELS",
      contactEmail: "contact@cels.com",
      resources: [
        { title: "Research Papers", url: "https://papers.example.com" },
        { title: "Online Community", url: "https://community.example.com" },
      ],
    };
  });

  describe("generateEpilogue()", () => {
    it("generateEpilogue() returns valid epilogue object", () => {
      const result = generateEpilogue(testMetadata);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it('epilogue has type: "epilogue"', () => {
      const result = generateEpilogue(testMetadata);
      expect(result.type).toBe("epilogue");
    });

    it("epilogue has enabled: true", () => {
      const result = generateEpilogue(testMetadata);
      expect(result.enabled).toBe(true);
    });

    it('epilogue has epilogueType: "all"', () => {
      const result = generateEpilogue(testMetadata);
      expect(result.epilogueType).toBe("all");
    });

    it("epilogue.sections includes closing, bio, resources", () => {
      const result = generateEpilogue(testMetadata);
      expect(result.sections).toBeDefined();
      expect(result.sections.closing).toBeDefined();
      expect(result.sections.bio).toBeDefined();
      expect(result.sections.resources).toBeDefined();
    });

    it("closing section has title and content", () => {
      const result = generateEpilogue(testMetadata);
      const closing = result.sections.closing;
      expect(closing.title).toBeDefined();
      expect(typeof closing.title).toBe("string");
      expect(closing.content).toBeDefined();
      expect(typeof closing.content).toBe("string");
    });

    it("bio section includes author name", () => {
      const result = generateEpilogue(testMetadata);
      const bio = result.sections.bio;
      expect(bio.title).toBeDefined();
      expect(bio.content).toBeDefined();
      expect(bio.content.includes(testMetadata.author)).toBe(true);
    });

    it("bio section includes email address", () => {
      const result = generateEpilogue(testMetadata);
      const bio = result.sections.bio;
      expect(bio.email).toBe(testMetadata.contactEmail);
    });

    it("resources section formats items correctly", () => {
      const result = generateEpilogue(testMetadata);
      const resources = result.sections.resources;
      expect(resources.title).toBeDefined();
      expect(Array.isArray(resources.items)).toBe(true);
      expect(resources.items.length).toBe(testMetadata.resources.length);
      resources.items.forEach((item, index) => {
        expect(item.title).toBe(testMetadata.resources[index].title);
        expect(item.url).toBe(testMetadata.resources[index].url);
      });
    });

    it("handles missing metadata gracefully with defaults", () => {
      const result = generateEpilogue({});
      expect(result.type).toBeDefined();
      expect(result.sections).toBeDefined();
      expect(result.sections.bio).toBeDefined();
    });

    it("handles missing resources array", () => {
      const metadata = { author: "Test Author" };
      const result = generateEpilogue(metadata);
      expect(result.sections.resources).toBeDefined();
      expect(result.sections.resources.items).toBeInstanceOf(Array);
    });

    it("bio section has default content when author not provided", () => {
      const result = generateEpilogue({ contactEmail: "test@example.com" });
      const bio = result.sections.bio;
      expect(bio.content).toBeDefined();
      expect(typeof bio.content).toBe("string");
    });

    it("closing section has meaningful content", () => {
      const result = generateEpilogue(testMetadata);
      const closing = result.sections.closing;
      expect(closing.content.length).toBeGreaterThan(10);
    });

    it("returns correct structure with all required fields", () => {
      const result = generateEpilogue(testMetadata);
      expect(result.type).toBe("epilogue");
      expect(result.enabled).toBe(true);
      expect(result.epilogueType).toBe("all");
      expect(typeof result.sections).toBe("object");
      expect(Object.keys(result.sections).length).toBeGreaterThanOrEqual(3);
    });
  });
});
