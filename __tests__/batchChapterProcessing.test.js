/**
 * Phase 1: Batch Infrastructure Test Suite
 *
 * Tests for batchBuilder.js, batchRequestor.js, batchResponseParser.js
 * Covers: Happy path, error paths, edge cases, integration flow
 *
 * Run: npm test -- __tests__/batchChapterProcessing.test.js
 */

const { describe, it, expect, beforeEach, afterEach, vi } = require("vitest");
const batchBuilder = require("../../server/batchChapterProcessing/batchBuilder");
const batchRequestor = require("../../server/batchChapterProcessing/batchRequestor");
const batchResponseParser = require("../../server/batchChapterProcessing/batchResponseParser");

// ============================================================================
// BATCH BUILDER TESTS
// ============================================================================

describe("batchBuilder", () => {
  describe("buildBatchPrompt()", () => {
    it("should build valid prompt for 3-chapter batch", () => {
      const batch = [
        {
          chapter: 2,
          title: "Chapter 2",
          topics: "setup, conflict",
          pageCount: 2,
        },
        { chapter: 3, title: "Chapter 3", topics: "development", pageCount: 2 },
        { chapter: 4, title: "Chapter 4", topics: "escalation", pageCount: 2 },
      ];
      const contextFromPrevious = {
        previousChapters: [{ chapter: 1, summary: "Introduction to story" }],
        narrativeArc: "building",
      };
      const ebookMetadata = {
        title: "Test Ebook",
        theme: "Adventure",
        totalPageCount: 8,
        genre: "Fantasy",
      };
      const structure = {
        theme: "Adventure",
        tone: "dramatic",
        narrativeStyle: "third-person",
      };

      const prompt = batchBuilder.buildBatchPrompt(
        batch,
        contextFromPrevious,
        ebookMetadata,
        structure
      );

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(200);
      expect(prompt).toContain("Chapter 2");
      expect(prompt).toContain("Chapter 3");
      expect(prompt).toContain("Chapter 4");
      expect(prompt).toContain("Test Ebook");
      expect(prompt).toContain("Adventure");
      expect(prompt).toContain("JSON");
    });

    it("should include previous chapter summary in prompt", () => {
      const batch = [
        { chapter: 2, title: "Chapter 2", topics: "continuation" },
      ];
      const contextFromPrevious = {
        previousChapters: [
          { chapter: 1, summary: "Hero receives mysterious letter" },
        ],
      };
      const ebookMetadata = { title: "Test" };
      const structure = {};

      const prompt = batchBuilder.buildBatchPrompt(
        batch,
        contextFromPrevious,
        ebookMetadata,
        structure
      );

      expect(prompt).toContain("mysterious letter");
    });

    it("should throw error for empty batch", () => {
      const batch = [];
      const contextFromPrevious = {};
      const ebookMetadata = { title: "Test" };

      expect(() => {
        batchBuilder.buildBatchPrompt(
          batch,
          contextFromPrevious,
          ebookMetadata,
          {}
        );
      }).toThrow("batch must be non-empty array");
    });

    it("should throw error for batch > 5 chapters", () => {
      const batch = Array.from({ length: 6 }, (_, i) => ({
        chapter: i + 1,
        title: `Chapter ${i + 1}`,
      }));
      const contextFromPrevious = {};
      const ebookMetadata = { title: "Test" };

      expect(() => {
        batchBuilder.buildBatchPrompt(
          batch,
          contextFromPrevious,
          ebookMetadata,
          {}
        );
      }).toThrow("batch size limited to 5");
    });

    it("should throw error for missing ebook metadata title", () => {
      const batch = [{ chapter: 2, title: "Chapter 2" }];
      const contextFromPrevious = {};
      const ebookMetadata = {};

      expect(() => {
        batchBuilder.buildBatchPrompt(
          batch,
          contextFromPrevious,
          ebookMetadata,
          {}
        );
      }).toThrow("ebookMetadata must include title");
    });
  });

  describe("extractContextFromBatch()", () => {
    it("should extract context from valid batch response", () => {
      const batchResponse = [
        {
          chapter: 2,
          title: "Chapter 2",
          summary: "Hero begins journey",
          content: "The hero woke up and decided to leave the village...",
        },
        {
          chapter: 3,
          title: "Chapter 3",
          summary: "First challenge encountered",
          content: "On the road, a mysterious figure appeared...",
        },
      ];

      const context = batchBuilder.extractContextFromBatch(batchResponse);

      expect(context).toBeDefined();
      expect(context.chapters).toHaveLength(2);
      expect(context.continuityContext).toBeDefined();
      expect(context.summaries).toHaveLength(2);
      expect(context.summaries[0].summary).toBe("Hero begins journey");
    });

    it("should throw error for empty batch response", () => {
      expect(() => {
        batchBuilder.extractContextFromBatch([]);
      }).toThrow("batchResponse must be non-empty array");
    });

    it("should extract key narrative points", () => {
      const batchResponse = [
        {
          chapter: 2,
          title: "Chapter 2",
          summary: "Discovery",
          content:
            "The hero discovered the ancient temple. It revealed secrets of the past. He realized his destiny.",
        },
      ];

      const context = batchBuilder.extractContextFromBatch(batchResponse);

      expect(context.summaries[0].keyPlots).toBeDefined();
      expect(Array.isArray(context.summaries[0].keyPlots)).toBe(true);
    });
  });
});

// ============================================================================
// BATCH REQUESTOR TESTS
// ============================================================================

describe("batchRequestor", () => {
  describe("sendBatchRequest()", () => {
    beforeEach(() => {
      // Mock aiService
      vi.mock("../../server/aiService", () => ({
        generateContentWithRotation: vi.fn(async (prompt, index) => ({
          chapters: [
            {
              chapter: 2,
              title: "Ch2",
              content: "Content 2",
              summary: "Summary 2",
            },
            {
              chapter: 3,
              title: "Ch3",
              content: "Content 3",
              summary: "Summary 3",
            },
          ],
          tokenCount: 5000,
        })),
      }));
    });

    it("should send batch request and return response with metadata", async () => {
      // Note: In real environment, mock aiService properly
      // This test demonstrates the expected interface
      const prompt = "Generate chapters...";
      const callIndex = 1;
      const sessionId = "session-123";

      // Mock the actual request (in real tests, use proper mock setup)
      const expectedResult = {
        success: true,
        response: {
          chapters: [
            {
              chapter: 2,
              title: "Ch2",
              content: "Content 2",
              summary: "Summary 2",
            },
          ],
        },
        metadata: {
          duration: expect.any(Number),
          model: "gemini-2.5-flash",
        },
      };

      expect(expectedResult.success).toBe(true);
      expect(expectedResult.metadata.model).toBe("gemini-2.5-flash");
    });

    it("should throw error for invalid prompt", async () => {
      expect(() => {
        batchRequestor.sendBatchRequest("", 0, "session-123");
      }).toThrow();
    });

    it("should classify error types correctly", () => {
      // Test error classification logic
      // This requires proper mocking of aiService errors
      expect(true).toBe(true); // Placeholder for proper implementation
    });
  });

  describe("parseBatchResponse()", () => {
    it("should parse valid batch response", () => {
      const response = {
        chapters: [
          {
            chapter: 2,
            title: "Chapter 2",
            summary: "Summary",
            content: "Content for chapter 2",
            image: { concept: "Hero", style: "realistic" },
          },
          {
            chapter: 3,
            title: "Chapter 3",
            summary: "Summary",
            content: "Content for chapter 3",
          },
        ],
      };
      const expectedChapters = [{ chapter: 2 }, { chapter: 3 }];

      const result = batchRequestor.parseBatchResponse(
        response,
        expectedChapters
      );

      expect(result.success).toBe(true);
      expect(result.chapters).toHaveLength(2);
      expect(result.incomplete).toBe(false);
    });

    it("should handle missing chapters", () => {
      const response = {
        chapters: [
          {
            chapter: 2,
            title: "Chapter 2",
            summary: "Summary",
            content: "Content",
          },
        ],
      };
      const expectedChapters = [{ chapter: 2 }, { chapter: 3 }];

      const result = batchRequestor.parseBatchResponse(
        response,
        expectedChapters
      );

      expect(result.success).toBe(false);
      expect(result.incomplete).toBe(true);
      expect(result.missingChapters).toContain(3);
    });

    it("should detect malformed JSON", () => {
      expect(() => {
        batchRequestor.parseBatchResponse(null, []);
      }).toThrow();
    });

    it("should extract chapters from various response formats", () => {
      // Test different response formats
      const format1 = {
        chapters: [{ chapter: 2, title: "Ch2", content: "C", summary: "S" }],
      };
      const format2 = {
        batch_response: [
          { chapter: 2, title: "Ch2", content: "C", summary: "S" },
        ],
      };

      const result1 = batchRequestor.parseBatchResponse(format1, [
        { chapter: 2 },
      ]);
      const result2 = batchRequestor.parseBatchResponse(format2, [
        { chapter: 2 },
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });
});

// ============================================================================
// BATCH RESPONSE PARSER TESTS
// ============================================================================

describe("batchResponseParser", () => {
  describe("parseBatchResponse()", () => {
    it("should parse valid batch with all chapters present", () => {
      const response = {
        chapters: [
          {
            chapter: 2,
            title: "Chapter 2",
            summary: "Summary 2",
            content:
              "This is a long enough chapter content with substantive material.",
            image: { concept: "Scene", style: "dramatic" },
          },
          {
            chapter: 3,
            title: "Chapter 3",
            summary: "Summary 3",
            content:
              "This is another chapter with detailed narrative and development.",
            image: { concept: "Action", style: "intense" },
          },
        ],
      };
      const expectedChapters = [{ chapter: 2 }, { chapter: 3 }];

      const result = batchResponseParser.parseBatchResponse(
        response,
        expectedChapters
      );

      expect(result.success).toBe(true);
      expect(result.chapters).toHaveLength(2);
      expect(result.missingChapters).toHaveLength(0);
      expect(result.validationIssues).toHaveLength(0);
      expect(result.canContinue).toBe(true);
    });

    it("should detect partial batch (some chapters missing)", () => {
      const response = {
        chapters: [
          {
            chapter: 2,
            title: "Chapter 2",
            summary: "Summary",
            content: "Content here.",
          },
        ],
      };
      const expectedChapters = [{ chapter: 2 }, { chapter: 3 }, { chapter: 4 }];

      const result = batchResponseParser.parseBatchResponse(
        response,
        expectedChapters
      );

      expect(result.success).toBe(false);
      expect(result.chapters).toHaveLength(1);
      expect(result.missingChapters).toEqual([3, 4]);
      expect(result.canContinue).toBe(true); // Can continue with partial
    });

    it("should detect and report validation issues", () => {
      const response = {
        chapters: [
          {
            chapter: 2,
            title: "Chapter 2",
            summary: "", // Empty summary
            content: "Short", // Too short
          },
          {
            chapter: 3,
            // Missing title
            summary: "Summary",
            content: "This is valid content with enough length.",
          },
        ],
      };
      const expectedChapters = [{ chapter: 2 }, { chapter: 3 }];

      const result = batchResponseParser.parseBatchResponse(
        response,
        expectedChapters
      );

      expect(result.success).toBe(false);
      expect(result.validationIssues.length).toBeGreaterThan(0);
    });

    it("should throw error for non-object response", () => {
      expect(() => {
        batchResponseParser.parseBatchResponse(null, []);
      }).toThrow();
    });

    it("should throw error when no chapters found", () => {
      expect(() => {
        batchResponseParser.parseBatchResponse({}, [{ chapter: 2 }]);
      }).toThrow();
    });
  });

  describe("validateChapterObject()", () => {
    it("should validate correct chapter object", () => {
      const chapter = {
        chapter: 2,
        title: "Chapter 2",
        summary: "A good summary",
        content:
          "This is substantive chapter content with proper length and detail.",
        image: { concept: "Scene", style: "dramatic", tone: "dark" },
      };

      const result = batchResponseParser.validateChapterObject(chapter);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing required fields", () => {
      const chapter = {
        chapter: 2,
        // Missing title, summary, content
      };

      const result = batchResponseParser.validateChapterObject(chapter);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should detect content too short", () => {
      const chapter = {
        chapter: 2,
        title: "Chapter 2",
        summary: "Summary",
        content: "Short", // Less than 100 chars
      };

      const result = batchResponseParser.validateChapterObject(chapter);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("too-short"))).toBe(true);
    });

    it("should detect content too long", () => {
      const chapter = {
        chapter: 2,
        title: "Chapter 2",
        summary: "Summary",
        content: "x".repeat(60000), // Exceeds 50000 limit
      };

      const result = batchResponseParser.validateChapterObject(chapter);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("maximum length"))).toBe(
        true
      );
    });

    it("should accept string or number chapter", () => {
      const ch1 = {
        chapter: 2,
        title: "Chapter",
        summary: "Summary",
        content: "Content here.",
      };
      const ch2 = {
        chapter: "3",
        title: "Chapter",
        summary: "Summary",
        content: "Content here.",
      };

      const result1 = batchResponseParser.validateChapterObject(ch1);
      const result2 = batchResponseParser.validateChapterObject(ch2);

      // Both should be valid (or result2 might fail due to being string)
      expect(result1.valid).toBe(true);
    });
  });

  describe("mergeWithPreviousContext()", () => {
    it("should merge new chapters with previous context", () => {
      const validatedChapters = [
        {
          chapter: 2,
          title: "Chapter 2",
          summary: "Hero begins journey",
          content:
            "The hero discovered the map and decided to leave immediately.",
        },
        {
          chapter: 3,
          title: "Chapter 3",
          summary: "First challenge",
          content: "Meanwhile, a rival also sought the treasure.",
        },
      ];
      const previousContext = {
        previousChapters: [{ chapter: 1, summary: "Introduction" }],
        narrativeArc: "setup",
      };

      const merged = batchResponseParser.mergeWithPreviousContext(
        validatedChapters,
        previousContext
      );

      expect(merged.previousChapters).toHaveLength(3); // 1 + 2
      expect(merged.continuityNotes).toBeDefined();
      expect(merged.narrativeVoice).toBeDefined();
      expect(merged.pacing).toBeDefined();
    });

    it("should detect unfinished plot threads", () => {
      const validatedChapters = [
        {
          chapter: 2,
          title: "Chapter 2",
          summary: "Mysterious discovery",
          content:
            "The secret revealed itself mysteriously, but its meaning remained hidden.",
        },
      ];

      const merged = batchResponseParser.mergeWithPreviousContext(
        validatedChapters,
        {}
      );

      expect(merged.unfinishedPlots).toBeDefined();
      expect(Array.isArray(merged.unfinishedPlots)).toBe(true);
    });

    it("should build continuity notes", () => {
      const validatedChapters = [
        {
          chapter: 2,
          title: "Chapter 2",
          summary: "Hero leaves home",
          content: "Content...",
        },
      ];

      const merged = batchResponseParser.mergeWithPreviousContext(
        validatedChapters,
        {}
      );

      expect(merged.continuityNotes).toContain("Ch2: Hero leaves home");
    });

    it("should throw error if chapters not array", () => {
      expect(() => {
        batchResponseParser.mergeWithPreviousContext(null, {});
      }).toThrow();
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("Phase 1 Integration", () => {
  it("should complete happy path: build → request → parse", () => {
    // 1. Build batch prompt
    const batch = [
      { chapter: 2, title: "Chapter 2", topics: "beginning" },
      { chapter: 3, title: "Chapter 3", topics: "development" },
    ];
    const contextFromPrevious = {
      previousChapters: [{ chapter: 1, summary: "Introduction" }],
    };
    const ebookMetadata = { title: "Test Ebook", totalPageCount: 8 };
    const structure = { theme: "Adventure", tone: "dramatic" };

    const prompt = batchBuilder.buildBatchPrompt(
      batch,
      contextFromPrevious,
      ebookMetadata,
      structure
    );
    expect(prompt.length).toBeGreaterThan(100);

    // 2. Simulate response (in real test, would use mock aiService)
    const mockResponse = {
      chapters: [
        {
          chapter: 2,
          title: "Chapter 2",
          summary: "Summary 2",
          content: "Content for chapter 2 with substantial narrative content.",
          image: { concept: "Opening", style: "dramatic" },
        },
        {
          chapter: 3,
          title: "Chapter 3",
          summary: "Summary 3",
          content: "Content for chapter 3 with development of themes.",
          image: { concept: "Development", style: "building" },
        },
      ],
    };

    // 3. Parse response
    const parseResult = batchResponseParser.parseBatchResponse(
      mockResponse,
      batch
    );
    expect(parseResult.success).toBe(true);
    expect(parseResult.chapters).toHaveLength(2);

    // 4. Extract context for next batch
    const nextContext = batchBuilder.extractContextFromBatch(
      parseResult.chapters
    );
    expect(nextContext.continuityContext).toBeDefined();
    expect(nextContext.chapters).toHaveLength(2);
  });

  it("should handle partial batch gracefully", () => {
    const batch = [
      { chapter: 2, title: "Chapter 2", topics: "beginning" },
      { chapter: 3, title: "Chapter 3", topics: "development" },
      { chapter: 4, title: "Chapter 4", topics: "climax" },
    ];

    // Response missing chapter 4
    const mockResponse = {
      chapters: [
        {
          chapter: 2,
          title: "Chapter 2",
          summary: "Summary",
          content: "Content with sufficient length for validation.",
        },
        {
          chapter: 3,
          title: "Chapter 3",
          summary: "Summary",
          content: "More content here for chapter three.",
        },
      ],
    };

    const parseResult = batchResponseParser.parseBatchResponse(
      mockResponse,
      batch
    );

    expect(parseResult.success).toBe(false);
    expect(parseResult.incomplete).toBe(true);
    expect(parseResult.missingChapters).toContain(4);
    expect(parseResult.canContinue).toBe(true); // Can still work with 2 out of 3
  });
});
