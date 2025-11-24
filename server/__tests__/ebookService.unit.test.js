import { describe, it, expect, beforeEach, vi } from "vitest";

// Helper to inject mocked aiService behavior before importing ebookService
async function mockAI(mockImpl) {
  vi.resetModules();
  vi.doMock("../aiService", () => ({ createAIService: () => mockImpl }));
}

describe("ebookService.handle() - unit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("happy path: AI returns JSON structure and per-chapter JSON", async () => {
    const mockGen = {
      generateContent: async (p) => {
        const s = String(p || "");
        if (s.includes("Create a detailed structure")) {
          return {
            content: {
              body: JSON.stringify({
                title: "Mock Title",
                chapters: 2,
                outline: [
                  { chapter: 1, title: "One", estimated_topics: ["a"] },
                  { chapter: 2, title: "Two", estimated_topics: ["b"] },
                ],
              }),
            },
          };
        }
        if (s.includes("You are writing Chapter")) {
          const m = s.match(/Chapter (\d+)/);
          const n = (m && Number(m[1])) || 1;
          return {
            content: {
              body: JSON.stringify({
                chapter: n,
                title: `Title ${n}`,
                content: `Content ${n}`,
                summary: `Summary ${n}`,
                image: {
                  concept: `Concept ${n}`,
                  suggested_style: "whimsical",
                  tone: "mysterious",
                },
              }),
            },
          };
        }
        return { content: { body: "fallback" } };
      },
    };

    await mockAI(mockGen);
    const mod = await import("../ebookService");
    const svc = mod.default || mod;

    const payload = {
      prompt: "A detective short",
      metadata: {
        pageCount: 4,
        theme: "light",
        colorPalette: "vibrant",
        fontSizeScale: 1,
      },
    };
    const res = await svc.handle(payload);

    expect(res).toBeDefined();
    expect(Array.isArray(res.pages)).toBe(true);
    expect(res.pages.length).toBe(2); // matches mocked outline length

    // Check image contract fields
    const img = res.pages[0].image;
    expect(img).toBeDefined();
    expect(img.concept).toMatch(/Concept 1/);
    expect(img.style).toBeDefined();
    expect(img.palette_hint).toBe("vibrant");

    // Metadata
    expect(res.metadata).toBeDefined();
    expect(res.metadata.model).toBe("ebook-v1");
    expect(res.metadata.pages_count).toBe(4);
  });

  it("non-JSON AI path: falls back to heuristic outline", async () => {
    const mockGen = {
      generateContent: async (_p) => ({
        content: { body: "Some plain text that is not JSON" },
      }),
    };

    await mockAI(mockGen);
    const mod = await import("../ebookService.js");
    const svc = mod.default || mod;

    const payload = {
      prompt: "Short text",
      metadata: {
        pageCount: 3,
        theme: "dark",
        colorPalette: "standard",
        fontSizeScale: 1,
      },
    };
    const res = await svc.handle(payload);

    expect(res).toBeDefined();
    expect(Array.isArray(res.pages)).toBe(true);
    // fallback approxChapters = ceil(pageCount/2) => ceil(3/2)=2
    expect(res.pages.length).toBe(2);
  });

  it("throws on missing prompt", async () => {
    const mockGen = {
      generateContent: async () => ({ content: { body: "{}" } }),
    };
    await mockAI(mockGen);
    const mod = await import("../ebookService.js");
    const svc = mod.default || mod;

    await expect(svc.handle({})).rejects.toThrow(/prompt is required/);
  });

  it("throws on invalid pageCount", async () => {
    const mockGen = {
      generateContent: async () => ({ content: { body: "{}" } }),
    };
    await mockAI(mockGen);
    const mod = await import("../ebookService.js");
    const svc = mod.default || mod;

    const payload = { prompt: "X", metadata: { pageCount: 2 } };
    await expect(svc.handle(payload)).rejects.toThrow(
      /pageCount must be between 3 and 20/
    );
  });
});
