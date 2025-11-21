import { describe, it, expect, beforeEach } from "vitest";
import TOCGenerator from "../utils/tocGenerator.js";

describe("TOCGenerator", () => {
  let chapters;
  let pageMap;

  beforeEach(() => {
    // Standard test data
    chapters = [
      { id: "ch1", title: "Chapter 1: Summer's Beginning", level: 1 },
      { id: "ch1-1", title: "The First Light", level: 2 },
      { id: "ch1-2", title: "Warm Breezes", level: 2 },
      { id: "ch2", title: "Chapter 2: Mid-Summer Reflections", level: 1 },
      { id: "ch2-1", title: "Heat and Haze", level: 2 },
      { id: "ch3", title: "Chapter 3: Summer's End", level: 1 },
    ];

    pageMap = new Map([
      ["ch1", 1],
      ["ch1-1", 3],
      ["ch1-2", 5],
      ["ch2", 7],
      ["ch2-1", 9],
      ["ch3", 11],
    ]);
  });

  // TG-001: Flat chapters (all level 1)
  it("TG-001: generates single-level TOC for flat chapters", () => {
    const flatChapters = [
      { id: "ch1", title: "Chapter 1", level: 1 },
      { id: "ch2", title: "Chapter 2", level: 1 },
      { id: "ch3", title: "Chapter 3", level: 1 },
    ];

    const result = TOCGenerator.generate(flatChapters, pageMap);

    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].level).toBe(1);
    expect(result.entries[0].children).toHaveLength(0);
    expect(result.entries[1].children).toHaveLength(0);
  });

  // TG-002: Hierarchical chapters (levels 1+2)
  it("TG-002: generates nested TOC with hierarchical chapters", () => {
    const result = TOCGenerator.generate(chapters, pageMap);

    expect(result.entries).toHaveLength(3); // 3 level 1 chapters
    expect(result.entries[0].children).toHaveLength(2); // ch1 has 2 level 2 children
    expect(result.entries[1].children).toHaveLength(1); // ch2 has 1 level 2 child
    expect(result.entries[2].children).toHaveLength(0); // ch3 has no children
  });

  // TG-003: Page numbers correctly assigned
  it("TG-003: assigns correct page numbers to entries", () => {
    const result = TOCGenerator.generate(chapters, pageMap);

    expect(result.entries[0].pageNumber).toBe(1);
    expect(result.entries[0].children[0].pageNumber).toBe(3);
    expect(result.entries[0].children[1].pageNumber).toBe(5);
    expect(result.entries[1].pageNumber).toBe(7);
    expect(result.entries[1].children[0].pageNumber).toBe(9);
    expect(result.entries[2].pageNumber).toBe(11);
  });

  // TG-004: Anchor generation (kebab-case)
  it("TG-004: generates kebab-case anchors from titles", () => {
    const result = TOCGenerator.generate(chapters, pageMap);

    expect(result.entries[0].anchor).toBe("chapter-1-summers-beginning");
    expect(result.entries[0].children[0].anchor).toBe("the-first-light");
    expect(result.entries[0].children[1].anchor).toBe("warm-breezes");
    expect(result.entries[1].anchor).toBe("chapter-2-mid-summer-reflections");
  });

  // TG-005: Anchors map generation
  it("TG-005: generates anchors map for PDF linking", () => {
    const result = TOCGenerator.generate(chapters, pageMap);

    expect(result.anchors).toBeInstanceOf(Map);
    expect(result.anchors.get("ch1")).toBe("chapter-1-summers-beginning");
    expect(result.anchors.get("ch1-1")).toBe("the-first-light");
    expect(result.anchors.get("ch2")).toBe("chapter-2-mid-summer-reflections");
  });

  // TG-006: Missing page number error
  it("TG-006: throws error when chapter page number not in pageMap", () => {
    const incompletePageMap = new Map([
      ["ch1", 1],
      ["ch1-1", 3],
      // ch1-2 missing!
    ]);

    expect(() => {
      TOCGenerator.generate(chapters, incompletePageMap);
    }).toThrow("Page number not found for chapter: ch1-2");
  });

  // TG-007: Empty chapters array
  it("TG-007: returns minimal TOC for empty chapters", () => {
    const result = TOCGenerator.generate([], new Map());

    expect(result.entries).toHaveLength(0);
    expect(result.anchors).toBeInstanceOf(Map);
    expect(result.anchors.size).toBe(0);
  });

  // TG-008: Level 2 without level 1 parent error
  it("TG-008: throws error for level 2 chapter without parent", () => {
    const invalidChapters = [
      { id: "ch1-1", title: "Section without parent", level: 2 },
    ];

    expect(() => {
      TOCGenerator.generate(invalidChapters, new Map([["ch1-1", 1]]));
    }).toThrow("Level 2 chapter without level 1 parent");
  });

  // TG-009: Anchor with special characters
  it("TG-009: sanitizes special characters in anchors", () => {
    const specialChapters = [
      { id: "ch1", title: "Summer's & Winter! #2023 [Edition]", level: 1 },
    ];

    const result = TOCGenerator.generate(
      specialChapters,
      new Map([["ch1", 1]])
    );

    expect(result.entries[0].anchor).toBe("summers-winter-2023-edition");
    expect(result.anchors.get("ch1")).toBe("summers-winter-2023-edition");
  });

  // TG-010: Anchor max length (80 chars)
  it("TG-010: limits anchors to 80 characters", () => {
    const longTitle = "A".repeat(150);
    const longChapters = [{ id: "ch1", title: longTitle, level: 1 }];

    const result = TOCGenerator.generate(longChapters, new Map([["ch1", 1]]));

    expect(result.entries[0].anchor.length).toBeLessThanOrEqual(80);
  });

  // TG-011: Invalid input - chapters not array
  it("TG-011: throws error when chapters is not an array", () => {
    expect(() => {
      TOCGenerator.generate(null, pageMap);
    }).toThrow("chapters must be an array");

    expect(() => {
      TOCGenerator.generate({}, pageMap);
    }).toThrow("chapters must be an array");
  });

  // TG-012: Invalid input - pageMap not Map
  it("TG-012: throws error when pageMap is not a Map", () => {
    expect(() => {
      TOCGenerator.generate(chapters, {});
    }).toThrow("pageMap must be a Map");

    expect(() => {
      TOCGenerator.generate(chapters, null);
    }).toThrow("pageMap must be a Map");
  });

  // TG-013: Anchor generation with apostrophes
  it("TG-013: handles apostrophes in title correctly", () => {
    const apostropheChapters = [
      { id: "ch1", title: "It's Mary's Story", level: 1 },
    ];

    const result = TOCGenerator.generate(
      apostropheChapters,
      new Map([["ch1", 1]])
    );

    expect(result.entries[0].anchor).toBe("its-marys-story");
  });

  // TG-014: Multiple level 2 sections under one parent
  it("TG-014: correctly nests multiple level 2 sections", () => {
    const multiLevelChapters = [
      { id: "ch1", title: "Chapter 1", level: 1 },
      { id: "ch1-1", title: "Section 1", level: 2 },
      { id: "ch1-2", title: "Section 2", level: 2 },
      { id: "ch1-3", title: "Section 3", level: 2 },
      { id: "ch1-4", title: "Section 4", level: 2 },
    ];

    const multiPageMap = new Map([
      ["ch1", 1],
      ["ch1-1", 2],
      ["ch1-2", 3],
      ["ch1-3", 4],
      ["ch1-4", 5],
    ]);

    const result = TOCGenerator.generate(multiLevelChapters, multiPageMap);

    expect(result.entries[0].children).toHaveLength(4);
    expect(result.entries[0].children.map((c) => c.title)).toEqual([
      "Section 1",
      "Section 2",
      "Section 3",
      "Section 4",
    ]);
  });

  // TG-015: Complex hierarchy preservation
  it("TG-015: preserves complete hierarchy with mixed structures", () => {
    const complexChapters = [
      { id: "ch1", title: "Chapter 1", level: 1 },
      { id: "ch1-1", title: "Section 1.1", level: 2 },
      { id: "ch1-2", title: "Section 1.2", level: 2 },
      { id: "ch2", title: "Chapter 2", level: 1 },
      { id: "ch3", title: "Chapter 3", level: 1 },
      { id: "ch3-1", title: "Section 3.1", level: 2 },
    ];

    const complexPageMap = new Map([
      ["ch1", 1],
      ["ch1-1", 3],
      ["ch1-2", 5],
      ["ch2", 7],
      ["ch3", 9],
      ["ch3-1", 11],
    ]);

    const result = TOCGenerator.generate(complexChapters, complexPageMap);

    // Verify structure
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].children).toHaveLength(2);
    expect(result.entries[1].children).toHaveLength(0);
    expect(result.entries[2].children).toHaveLength(1);

    // Verify all entries in anchors map
    expect(result.anchors.size).toBe(6);
  });

  // TG-016: Page numbers in sequential order
  it("TG-016: validates page numbers are in correct order", () => {
    const result = TOCGenerator.generate(chapters, pageMap);

    // Collect all pages
    const pages = [];
    const collectPages = (entry) => {
      pages.push(entry.pageNumber);
      if (entry.children) {
        entry.children.forEach(collectPages);
      }
    };
    result.entries.forEach(collectPages);

    // Check they're in order (at least non-decreasing)
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i]).toBeGreaterThanOrEqual(pages[i - 1]);
    }
  });

  // TG-017: Title with numbers and hyphens
  it("TG-017: handles titles with numbers and existing hyphens", () => {
    const hyphenChapters = [
      { id: "ch1", title: "Chapter 1: 2023-2024 Review", level: 1 },
    ];

    const result = TOCGenerator.generate(hyphenChapters, new Map([["ch1", 1]]));

    expect(result.entries[0].anchor).toBe("chapter-1-2023-2024-review");
  });

  // TG-018: Empty title edge case
  it("TG-018: generates anchor from chapterId if title is empty", () => {
    const emptyTitleChapters = [{ id: "ch1", title: "", level: 1 }];

    const result = TOCGenerator.generate(
      emptyTitleChapters,
      new Map([["ch1", 1]])
    );

    // Should use chapterId as fallback
    expect(result.entries[0].anchor).toBe("ch1");
  });

  // TG-019: Only special characters in title
  it("TG-019: generates fallback anchor for title with only special characters", () => {
    const specialChapters = [{ id: "ch1", title: "!@#$%^&*()", level: 1 }];

    const result = TOCGenerator.generate(
      specialChapters,
      new Map([["ch1", 1]])
    );

    // Should fallback to chapterId
    expect(result.entries[0].anchor).toBe("ch1");
  });

  // TG-020: All anchors unique
  it("TG-020: ensures all generated anchors are unique", () => {
    const result = TOCGenerator.generate(chapters, pageMap);

    const anchors = Array.from(result.anchors.values());
    const uniqueAnchors = new Set(anchors);

    expect(anchors.length).toBe(uniqueAnchors.size);
  });
});
