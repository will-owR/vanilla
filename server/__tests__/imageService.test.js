import { describe, it, expect, beforeEach, vi } from "vitest";
import ImageService from "../utils/imageService.js";

describe("ImageService", () => {
  let mockDb;
  let mockGemini;

  beforeEach(() => {
    // Mock database
    mockDb = {
      svgLibrary: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    // Mock Gemini client
    mockGemini = {
      generateImage: vi.fn(async (opts) => ({
        svg: `<svg>${opts.prompt}</svg>`,
      })),
    };
  });

  // IS-001: Cache hit returns SVG
  it("IS-001: returns cached SVG on cache hit", async () => {
    const mockSVG = "<svg>cached</svg>";
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce({
      id: "svg-1",
      svg: mockSVG,
      usage: 10,
    });

    const result = await ImageService.getImage(
      "summer",
      "watercolor",
      8,
      mockDb,
      mockGemini
    );

    expect(result.svg).toBe(mockSVG);
    expect(result.cached).toBe(true);
    expect(result.source).toBe("library");
    expect(result.usage).toBe(11); // Incremented
  });

  // IS-002: Cache miss generates with Gemini
  it("IS-002: generates image via Gemini on cache miss", async () => {
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce(null);

    const result = await ImageService.getImage(
      "summer",
      "abstract",
      8,
      mockDb,
      mockGemini
    );

    expect(result.cached).toBe(false);
    expect(result.source).toBe("gemini");
    expect(mockGemini.generateImage).toHaveBeenCalled();
    expect(result.svg).toBeDefined();
  });

  // IS-003: Usage incremented on cache hit
  it("IS-003: increments usage counter on cache hit", async () => {
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce({
      id: "svg-1",
      svg: "<svg/>",
      usage: 5,
    });

    await ImageService.getImage("nature", "minimalist", 10, mockDb, mockGemini);

    expect(mockDb.svgLibrary.update).toHaveBeenCalledWith({
      where: { id: "svg-1" },
      data: { usage: { increment: 1 } },
    });
  });

  // IS-004: New image stored in library
  it("IS-004: stores generated image in library", async () => {
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce(null);
    mockDb.svgLibrary.create.mockResolvedValueOnce({
      id: "svg-new",
      svg: "<svg/>",
      metadata: { topic: "summer", style: "watercolor" },
      usage: 1,
    });

    await ImageService.getImage("summer", "watercolor", 8, mockDb, mockGemini);

    expect(mockDb.svgLibrary.create).toHaveBeenCalled();
  });

  // IS-005: Graceful fallback on Gemini error
  it("IS-005: returns fallback SVG on Gemini error", async () => {
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce(null);
    mockGemini.generateImage.mockRejectedValueOnce(
      new Error("Gemini API error")
    );

    const result = await ImageService.getImage(
      "summer",
      "watercolor",
      8,
      mockDb,
      mockGemini
    );

    expect(result.cached).toBe(false);
    expect(result.source).toBe("fallback");
    expect(result.error).toBeDefined();
    expect(result.svg).toContain("Image unavailable");
  });

  // IS-006: Works without DB (uses mocks)
  it("IS-006: works with internal mocks when DB not provided", async () => {
    const result = await ImageService.getImage("summer", "watercolor", 8);

    expect(result.svg).toBeDefined();
    expect(result.source).toMatch(/library|gemini/);
  });

  // IS-007: Invalid topic throws error
  it("IS-007: throws error for invalid topic", async () => {
    expect(async () => {
      await ImageService.getImage("", "watercolor", 8, mockDb, mockGemini);
    }).rejects.toThrow("topic must be a non-empty string");

    expect(async () => {
      await ImageService.getImage(null, "watercolor", 8, mockDb, mockGemini);
    }).rejects.toThrow("topic must be a non-empty string");
  });

  // IS-008: Invalid style throws error
  it("IS-008: throws error for invalid style", async () => {
    expect(async () => {
      await ImageService.getImage("summer", "", 8, mockDb, mockGemini);
    }).rejects.toThrow("style must be a non-empty string");

    expect(async () => {
      await ImageService.getImage("summer", null, 8, mockDb, mockGemini);
    }).rejects.toThrow("style must be a non-empty string");
  });

  // IS-009: Invalid pageCount throws error
  it("IS-009: throws error for invalid pageCount", async () => {
    expect(async () => {
      await ImageService.getImage(
        "summer",
        "watercolor",
        2,
        mockDb,
        mockGemini
      );
    }).rejects.toThrow("pageCount must be between 3 and 20");

    expect(async () => {
      await ImageService.getImage(
        "summer",
        "watercolor",
        25,
        mockDb,
        mockGemini
      );
    }).rejects.toThrow("pageCount must be between 3 and 20");

    expect(async () => {
      await ImageService.getImage(
        "summer",
        "watercolor",
        "invalid",
        mockDb,
        mockGemini
      );
    }).rejects.toThrow("pageCount must be between 3 and 20");
  });

  // IS-010: Mock SVG generation
  it("IS-010: generates valid SVG for testing", async () => {
    // Test through public method (internal mock SVG)
    const result = await ImageService.getImage("summer", "watercolor", 8);
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");
  });

  // IS-011: Gemini called with correct prompt
  it("IS-011: calls Gemini with structured prompt", async () => {
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce(null);

    await ImageService.getImage("nature", "abstract", 15, mockDb, mockGemini);

    const callArgs = mockGemini.generateImage.mock.calls[0][0];
    expect(callArgs.prompt).toContain("nature");
    expect(callArgs.prompt).toContain("abstract");
    expect(callArgs.size).toBe("512x512");
  });

  // IS-012: Library stats calculation
  it("IS-012: calculates library statistics", async () => {
    mockDb.svgLibrary.findMany.mockResolvedValueOnce([
      { usage: 100, metadata: { topic: "summer" } },
      { usage: 50, metadata: { topic: "nature" } },
      { usage: 25, metadata: { topic: "summer" } },
    ]);

    const stats = await ImageService.getLibraryStats(mockDb);

    expect(stats.totalImages).toBe(3);
    expect(stats.totalUsage).toBe(175);
    expect(stats.hitRate).toBeGreaterThan(0);
    expect(stats.topTopics).toContain("summer");
  });

  // IS-013: Multiple cache hits increase usage
  it("IS-013: handles multiple cache hits correctly", async () => {
    const mockSVG = { id: "svg-1", svg: "<svg/>", usage: 1 };

    mockDb.svgLibrary.findFirst.mockResolvedValue(mockSVG);

    // First call
    await ImageService.getImage("summer", "watercolor", 8, mockDb, mockGemini);
    expect(mockDb.svgLibrary.update).toHaveBeenCalledTimes(1);

    // Second call
    await ImageService.getImage("summer", "watercolor", 8, mockDb, mockGemini);
    expect(mockDb.svgLibrary.update).toHaveBeenCalledTimes(2);
  });

  // IS-014: Fallback SVG contains topic
  it("IS-014: fallback SVG includes topic name", async () => {
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce(null);
    mockGemini.generateImage.mockRejectedValueOnce(new Error("API error"));

    const result = await ImageService.getImage(
      "Summer Adventure",
      "watercolor",
      8,
      mockDb,
      mockGemini
    );

    expect(result.svg).toContain("Summer Adventure");
    expect(result.svg).toContain("unavailable");
  });

  // IS-015: Different topics create separate library entries
  it("IS-015: treats different topics as separate entries", async () => {
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce(null);

    await ImageService.getImage("summer", "watercolor", 8, mockDb, mockGemini);
    await ImageService.getImage("winter", "watercolor", 8, mockDb, mockGemini);

    const createCalls = mockDb.svgLibrary.create.mock.calls;
    expect(createCalls.length).toBe(2);
    expect(createCalls[0][0].data.metadata.topic).toBe("summer");
    expect(createCalls[1][0].data.metadata.topic).toBe("winter");
  });

  // IS-016: pageCount influences prompt density
  it("IS-016: adjusts prompt density based on pageCount", async () => {
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce(null);

    // Sparse (3 pages)
    await ImageService.getImage("summer", "watercolor", 3, mockDb, mockGemini);
    let prompt = mockGemini.generateImage.mock.calls[0][0].prompt;
    expect(prompt).toContain("sparse");

    // Medium (10 pages)
    mockGemini.generateImage.mockClear();
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce(null);
    await ImageService.getImage("summer", "watercolor", 10, mockDb, mockGemini);
    prompt = mockGemini.generateImage.mock.calls[0][0].prompt;
    expect(prompt).toContain("medium");

    // Dense (20 pages)
    mockGemini.generateImage.mockClear();
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce(null);
    await ImageService.getImage("summer", "watercolor", 20, mockDb, mockGemini);
    prompt = mockGemini.generateImage.mock.calls[0][0].prompt;
    expect(prompt).toContain("dense");
  });

  // IS-017: Clear library deletes all records
  it("IS-017: clears library on demand", async () => {
    mockDb.svgLibrary.deleteMany.mockResolvedValueOnce({ count: 42 });

    const count = await ImageService.clearLibrary(mockDb);

    expect(count).toBe(42);
    expect(mockDb.svgLibrary.deleteMany).toHaveBeenCalled();
  });

  // IS-018: DB error doesn't prevent image generation
  it("IS-018: continues image generation on DB error", async () => {
    mockDb.svgLibrary.findFirst.mockRejectedValueOnce(new Error("DB error"));

    // Should still generate with Gemini as fallback
    const result = await ImageService.getImage(
      "summer",
      "watercolor",
      8,
      mockDb,
      mockGemini
    );

    expect(result.svg).toBeDefined();
  });

  // IS-019: Metadata stored with image
  it("IS-019: stores metadata with generated images", async () => {
    mockDb.svgLibrary.findFirst.mockResolvedValueOnce(null);

    await ImageService.getImage("summer", "watercolor", 12, mockDb, mockGemini);

    const createCall = mockDb.svgLibrary.create.mock.calls[0][0];
    expect(createCall.data.metadata).toEqual({
      topic: "summer",
      style: "watercolor",
      pageCount: 12,
    });
  });

  // IS-020: Hit rate simulation (60% target)
  it("IS-020: simulates 60% cache hit rate without DB", async () => {
    const results = [];
    for (let i = 0; i < 100; i++) {
      const result = await ImageService.getImage("topic", "style", 8);
      results.push(result.source);
    }

    // Rough check (won't be exactly 60% but should be in range)
    const hitCount = results.filter((s) => s === "library").length;
    expect(hitCount).toBeGreaterThan(40); // At least 40 hits
    expect(hitCount).toBeLessThan(80); // At most 80 hits (60% ± margin)
  });
});
