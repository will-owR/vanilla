const { describe, it, expect } = require("vitest");
const sampleService = require("../sampleService");

describe("sampleService.generate", () => {
  it("returns a canonical envelope with pages and text blocks", async () => {
    const { envelope, metadata } = await sampleService.generate("Hello world", {
      copies: 3,
    });

    expect(envelope).toBeDefined();
    expect(Array.isArray(envelope.pages)).toBe(true);
    expect(envelope.pages.length).toBe(3);

    envelope.pages.forEach((p, idx) => {
      expect(p.id).toBe(`p${idx + 1}`);
      expect(typeof p.title).toBe("string");
      expect(Array.isArray(p.blocks)).toBe(true);
      expect(p.blocks[0].type).toBe("text");
      expect(typeof p.blocks[0].content).toBe("string");
    });

    expect(metadata).toBeDefined();
    expect(typeof metadata.generatedAt).toBe("string");
  });
});
