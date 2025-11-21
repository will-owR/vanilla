/**
 * ContentChunker Tests - Phase B
 * Test suite covering all 15 test cases from PHASE_B_MODULE_SPECS.md
 */

import { describe, it, expect, beforeEach } from "vitest";
import ContentChunker from "../utils/contentChunker.js";

describe("ContentChunker", () => {
  // Test utilities
  const generateText = (wordCount) => {
    const words = [
      "summer",
      "evening",
      "poem",
      "nature",
      "nostalgia",
      "memory",
      "twilight",
      "golden",
    ];
    let text = "";
    for (let i = 0; i < wordCount; i++) {
      text += `${words[i % words.length]} `;
    }
    return text.trim();
  };

  beforeEach(() => {
    // Reset state if needed
  });

  // CC-001: Short prompt (100 words)
  it("CC-001: analyzes short prompt as light density", async () => {
    const shortPrompt = generateText(100);
    const result = await ContentChunker.analyze(shortPrompt);

    expect(result.density).toBe("light");
    expect(result.metadata.wordCount).toBe(100);
    expect(result.chapters.length).toBeGreaterThan(0);
    expect(result.chapters.length).toBeLessThanOrEqual(5);
  });

  // CC-002: Medium prompt (1000 words)
  it("CC-002: analyzes medium prompt as medium density", async () => {
    const mediumPrompt = generateText(1000);
    const result = await ContentChunker.analyze(mediumPrompt);

    expect(result.density).toBe("medium");
    expect(result.metadata.wordCount).toBe(1000);
    expect(result.chapters.length).toBeGreaterThan(2);
    expect(result.chapters.length).toBeLessThanOrEqual(8);
  });

  // CC-003: Long prompt (3000 words)
  it("CC-003: analyzes long prompt as dense density", async () => {
    const longPrompt = generateText(3000);
    const result = await ContentChunker.analyze(longPrompt);

    expect(result.density).toBe("dense");
    expect(result.metadata.wordCount).toBe(3000);
    expect(result.chapters.length).toBeGreaterThan(3);
  });

  // CC-004: Empty prompt
  it("CC-004: throws validation error for empty prompt", async () => {
    await expect(ContentChunker.analyze("")).rejects.toThrow(/prompt must be/);
  });

  // CC-005: targetPageCount=3 (minimum)
  it("CC-005: handles minimum page count (3 pages)", async () => {
    const result = await ContentChunker.analyze(generateText(500), {
      targetPageCount: 3,
    });

    expect(result.totalPages).toBe(3);
    expect(result.structure).toBeDefined();
    expect(result.structure[0].pageStart).toBe(1);
    expect(result.structure[result.structure.length - 1].pageEnd).toBe(3);
  });

  // CC-006: targetPageCount=20 (maximum)
  it("CC-006: handles maximum page count (20 pages)", async () => {
    const result = await ContentChunker.analyze(generateText(2000), {
      targetPageCount: 20,
    });

    expect(result.totalPages).toBe(20);
    expect(result.chapters.length).toBeGreaterThan(4);
  });

  // CC-007: Topic extraction
  it("CC-007: extracts topics from prompt", async () => {
    const prompt =
      "Summer evenings in the garden bring peace and reflection memories of childhood summers";
    const result = await ContentChunker.analyze(prompt);

    expect(result.metadata.estimatedTopics).toBeDefined();
    expect(result.metadata.estimatedTopics.length).toBeGreaterThan(0);
    expect(result.metadata.estimatedTopics.length).toBeLessThanOrEqual(8);
  });

  // CC-008: Deduplication of topics
  it("CC-008: deduplicates repeated topics", async () => {
    const prompt = "summer summer summer evening evening peace peace summer";
    const result = await ContentChunker.analyze(prompt);

    const topics = result.metadata.estimatedTopics;
    const uniqueTopics = new Set(topics);
    expect(uniqueTopics.size).toBe(topics.length);
  });

  // CC-009: Hierarchical chapters (level 1 and 2)
  it("CC-009: creates hierarchical chapters with levels", async () => {
    const result = await ContentChunker.analyze(generateText(1500), {
      targetPageCount: 8,
    });

    const level1Chapters = result.chapters.filter((ch) => ch.level === 1);
    const level2Chapters = result.chapters.filter((ch) => ch.level === 2);

    expect(level1Chapters.length).toBeGreaterThan(0);
    expect(level1Chapters[0].level).toBe(1);
    if (level2Chapters.length > 0) {
      expect(level2Chapters[0].level).toBe(2);
    }
  });

  // CC-010: Page distribution accuracy
  it("CC-010: distributes pages according to target count", async () => {
    const result = await ContentChunker.analyze(generateText(1000), {
      targetPageCount: 12,
    });

    expect(result.totalPages).toBe(12);
    expect(result.structure[result.structure.length - 1].pageEnd).toBe(12);
  });

  // CC-011: Structure mapping (sequential pages)
  it("CC-011: creates sequential structure with no gaps or overlaps", async () => {
    const result = await ContentChunker.analyze(generateText(1500), {
      targetPageCount: 10,
    });

    const structure = result.structure;
    for (let i = 0; i < structure.length - 1; i++) {
      expect(structure[i].pageEnd).toBeLessThanOrEqual(
        structure[i + 1].pageStart
      );
    }
    expect(structure[0].pageStart).toBe(1);
    expect(structure[structure.length - 1].pageEnd).toBe(10);
  });

  // CC-012: Topic diversity (no repetition)
  it("CC-012: ensures topic diversity across chapters", async () => {
    const result = await ContentChunker.analyze(generateText(2000), {
      targetPageCount: 8,
    });

    const topics = result.chapters
      .filter((ch) => ch.level === 1)
      .map((ch) => ch.topic);
    const uniqueTopics = new Set(topics);

    // Should have some topic diversity (at least 50% unique)
    expect(uniqueTopics.size).toBeGreaterThan(Math.floor(topics.length * 0.5));
  });

  // CC-013: Metadata accuracy
  it("CC-013: calculates metadata accurately", async () => {
    const result = await ContentChunker.analyze(generateText(1200), {
      targetPageCount: 8,
    });

    expect(result.metadata).toBeDefined();
    expect(result.metadata.wordCount).toBe(1200);
    expect(result.metadata.complexity).toBeDefined();
    expect(parseFloat(result.metadata.complexity)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(result.metadata.complexity)).toBeLessThanOrEqual(1);
    expect(result.metadata.chapterCount).toBe(result.chapters.length);
  });

  // CC-014: Very short page count (3 pages, edge case)
  it("CC-014: handles minimal 3-page scenario", async () => {
    const result = await ContentChunker.analyze(generateText(300), {
      targetPageCount: 3,
    });

    expect(result.totalPages).toBe(3);
    expect(result.chapters.length).toBeGreaterThan(0);
    expect(result.structure).toHaveLength(result.chapters.length);
  });

  // CC-015: maxChapters option
  it("CC-015: respects maxChapters option", async () => {
    const result = await ContentChunker.analyze(generateText(2000), {
      targetPageCount: 12,
      maxChapters: 3,
    });

    // Should not exceed maxChapters (counting only level 1)
    const level1Count = result.chapters.filter((ch) => ch.level === 1).length;
    expect(level1Count).toBeLessThanOrEqual(3);
  });

  // Additional edge case tests
  it("CC-016: throws error for invalid pageCount < 3", async () => {
    await expect(
      ContentChunker.analyze(generateText(500), { targetPageCount: 2 })
    ).rejects.toThrow(/targetPageCount must be between 3 and 20/);
  });

  it("CC-017: throws error for invalid pageCount > 20", async () => {
    await expect(
      ContentChunker.analyze(generateText(500), { targetPageCount: 21 })
    ).rejects.toThrow(/targetPageCount must be between 3 and 20/);
  });

  it("CC-018: handles null prompt", async () => {
    // @ts-ignore - testing error handling for invalid type
    await expect(ContentChunker.analyze(null)).rejects.toThrow(
      /prompt must be/
    );
  });

  it("CC-019: handles numeric prompt", async () => {
    // @ts-ignore - testing error handling for invalid type
    await expect(ContentChunker.analyze(12345)).rejects.toThrow(
      /prompt must be/
    );
  });

  it("CC-020: all chapters have required properties", async () => {
    const result = await ContentChunker.analyze(generateText(1000));

    result.chapters.forEach((chapter) => {
      expect(chapter.id).toBeDefined();
      expect(chapter.title).toBeDefined();
      expect(chapter.topic).toBeDefined();
      expect(chapter.estimatedPages).toBeGreaterThan(0);
      expect([1, 2]).toContain(chapter.level);
      expect(chapter.content).toBeNull();
    });
  });
});
