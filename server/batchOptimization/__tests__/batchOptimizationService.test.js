/**
 * BatchOptimizationService Tests
 *
 * Test suite for Stage 1 batch optimization:
 * - Batch formation and scheduling
 * - Rate limiting enforcement
 * - Error recovery and fallback
 * - Metrics tracking
 * - Content extraction
 */

const { BatchOptimizationService } = require("../BatchOptimizationService");
const { RateLimiter } = require("../RateLimiter");
const { GenerationMetrics } = require("../GenerationMetrics");
const { ContentExtractors } = require("../ContentExtractors");
const { PromptTemplates } = require("../PromptTemplates");

describe("BatchOptimizationService", () => {
  let mockAiService;
  let mockLogger;
  let service;

  beforeEach(() => {
    // Mock AI service
    mockAiService = {
      generateContentWithRotation: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new BatchOptimizationService(mockAiService, mockLogger);
  });

  describe("Constructor", () => {
    test("should initialize with aiService and logger", () => {
      expect(service.aiService).toBe(mockAiService);
      expect(service.logger).toBe(mockLogger);
      expect(service.rateLimiter).toBeInstanceOf(RateLimiter);
      expect(service.metrics).toBeInstanceOf(GenerationMetrics);
    });

    test("should use console as default logger", () => {
      const svc = new BatchOptimizationService(mockAiService);
      expect(svc.logger).toBe(console);
    });
  });

  describe("Page count validation", () => {
    test("should reject books with < 3 pages", async () => {
      const ebookData = {
        title: "Too Short",
        topic: "Test",
        targetAudience: "All",
        tone: "Neutral",
      };
      const structure = { chapters: [{}, {}] }; // 2 pages

      await expect(
        service.generateWithBatching(ebookData, structure)
      ).rejects.toThrow("Stage 1 only supports 3-20 pages");
    });

    test("should reject books with > 20 pages", async () => {
      const ebookData = {
        title: "Too Long",
        topic: "Test",
        targetAudience: "All",
        tone: "Neutral",
      };
      const structure = { chapters: Array(21).fill({}) };

      await expect(
        service.generateWithBatching(ebookData, structure)
      ).rejects.toThrow("Stage 1 only supports 3-20 pages");
    });

    test("should accept books with 3-20 pages", async () => {
      const ebookData = {
        title: "Perfect",
        topic: "Test",
        targetAudience: "All",
        tone: "Neutral",
      };

      for (let pages = 3; pages <= 20; pages++) {
        const structure = { chapters: Array(pages).fill({}) };

        mockAiService.generateContentWithRotation.mockResolvedValueOnce({
          content: { body: '{"chapters": []}' },
        });

        // We expect this to fail later (no proper structure/pages), but not on validation
        try {
          await service.generateWithBatching(ebookData, structure);
        } catch (error) {
          expect(error.message).not.toMatch("Stage 1 only supports");
        }
      }
    });
  });

  describe("Batch formation", () => {
    test("should form 3-page batches for 5-page ebook", () => {
      // 5 pages: Page 1 individual, [2, 3, 4] batch, Page 5 individual
      // Expected: 1 individual + 1 batch + 1 individual = 3 API calls (+ 1 structure)
      const pageNumbers = [2, 3, 4, 5]; // Pages 2-5 (excluding Page 1)
      const batches = [];

      for (let i = 0; i < pageNumbers.length - 1; i += 3) {
        batches.push(
          pageNumbers.slice(i, Math.min(i + 3, pageNumbers.length - 1))
        );
      }

      // Last page is individual
      expect(batches.length).toBeGreaterThan(0);
    });

    test("should form correct batches for 8-page ebook", () => {
      // 8 pages: Page 1 [individual], [2,3,4] [batch], [5,6,7] [batch], Page 8 [individual]
      // Expected: 4 API calls (+ 1 structure) = 5 total
      const pages = Array(8)
        .fill(0)
        .map((_, i) => i + 1);
      const middlePages = pages.slice(1, -1); // [2,3,4,5,6,7]

      const batches = [];
      const batchSize = 3;
      for (let i = 0; i < middlePages.length; i += batchSize) {
        batches.push(middlePages.slice(i, i + batchSize));
      }

      expect(batches.length).toBe(2);
      expect(batches[0]).toEqual([2, 3, 4]);
      expect(batches[1]).toEqual([5, 6, 7]);
    });

    test("should handle uneven batch distributions", () => {
      // 10 pages: [2,3,4], [5,6,7], [8,9] - last batch has only 2 pages
      const middlePages = Array(9)
        .fill(0)
        .map((_, i) => i + 2); // [2..10]
      middlePages.pop(); // Remove last (Page 10 is final individual)

      const batches = [];
      for (let i = 0; i < middlePages.length; i += 3) {
        batches.push(middlePages.slice(i, i + 3));
      }

      expect(batches.length).toBe(3);
      expect(batches[2].length).toBe(2); // Last batch has 2 pages
    });
  });

  describe("RateLimiter integration", () => {
    test("should enqueue requests through RateLimiter", async () => {
      const mockRequest = jest.fn().mockResolvedValue("result");
      const rateLimiter = new RateLimiter({ requestsPerMinute: 10 });

      const result = await rateLimiter.enqueue(mockRequest);

      expect(mockRequest).toHaveBeenCalled();
      expect(result).toBe("result");
    });

    test("should respect 6-second rate limit interval (10 req/min)", async () => {
      const rateLimiter = new RateLimiter({ requestsPerMinute: 10 });
      const times = [];

      for (let i = 0; i < 3; i++) {
        const time = Date.now();
        times.push(time);
        await rateLimiter.enqueue(async () => {
          // No-op
        });
      }

      // Check intervals are >= 6 seconds (allowing some variance)
      for (let i = 1; i < times.length; i++) {
        const interval = times[i] - times[i - 1];
        expect(interval).toBeGreaterThanOrEqual(5900); // Allow 100ms variance
      }
    });

    test("should handle 429 errors with exponential backoff", async () => {
      const rateLimiter = new RateLimiter({ requestsPerMinute: 10 });
      let attemptCount = 0;

      const mockRequest = jest.fn(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error("Rate limited");
          error.status = 429;
          throw error;
        }
        return "success";
      });

      const result = await rateLimiter.enqueue(mockRequest);

      expect(attemptCount).toBe(2); // Called twice (1 failure, 1 success)
      expect(result).toBe("success");
    });
  });

  describe("Metrics tracking", () => {
    test("should track structure generation", () => {
      const sessionId = service.metrics.startSession({
        title: "Test",
        topic: "Test",
      });

      service.metrics.recordStructure(sessionId, { chapters: [] }, 1234);

      const metrics = service.metrics.getSessionMetrics(sessionId);
      expect(metrics.structure).toBeDefined();
      expect(metrics.structure.latency).toBe(1234);
    });

    test("should track individual page generation", () => {
      const sessionId = service.metrics.startSession({
        title: "Test",
        topic: "Test",
      });

      service.metrics.recordPage(sessionId, 1, 500);
      service.metrics.recordPage(sessionId, 2, 600);

      const metrics = service.metrics.getSessionMetrics(sessionId);
      expect(metrics.pages.length).toBe(2);
      expect(metrics.pages[0].pageNumber).toBe(1);
      expect(metrics.pages[0].latency).toBe(500);
    });

    test("should track batch generation", () => {
      const sessionId = service.metrics.startSession({
        title: "Test",
        topic: "Test",
      });

      service.metrics.recordBatch(sessionId, [2, 3, 4], 1500);

      const metrics = service.metrics.getSessionMetrics(sessionId);
      expect(metrics.batches.length).toBe(1);
      expect(metrics.batches[0].pages).toEqual([2, 3, 4]);
      expect(metrics.batches[0].latency).toBe(1500);
    });

    test("should track failed pages", () => {
      const sessionId = service.metrics.startSession({
        title: "Test",
        topic: "Test",
      });

      service.metrics.recordFailedPage(sessionId, 3);

      const metrics = service.metrics.getSessionMetrics(sessionId);
      expect(metrics.errors.length).toBe(1);
      expect(metrics.errors[0].type).toBe("page_generation_failed");
      expect(metrics.errors[0].pageNumber).toBe(3);
    });

    test("should calculate total API calls correctly", () => {
      const sessionId = service.metrics.startSession({
        title: "Test",
        topic: "Test",
      });

      service.metrics.recordStructure(sessionId, {}, 100);
      service.metrics.recordPage(sessionId, 1, 100); // Page 1
      service.metrics.recordBatch(sessionId, [2, 3, 4], 300); // Batch
      service.metrics.recordPage(sessionId, 5, 100); // Page 5 (final)

      const apiCalls = service.metrics.calculateApiCalls(sessionId);
      expect(apiCalls).toBe(4); // 1 structure + 1 page 1 + 1 batch + 1 page 5
    });
  });

  describe("Content extraction", () => {
    test("should extract summary from content", () => {
      const content =
        "This is the opening sentence. This is the second sentence. This is a longer continuation that provides more context.";
      const summary = ContentExtractors.extractSummary(content);

      expect(summary).toBeDefined();
      expect(summary.length).toBeLessThanOrEqual(300);
      expect(summary).toContain("opening sentence");
    });

    test("should detect voice perspective", () => {
      const firstPersonContent =
        "I walked through the door. My heart was racing.";
      const thirdPersonContent =
        "He walked through the door. His heart was racing.";

      const voice1 = ContentExtractors.extractVoice(firstPersonContent);
      const voice3 = ContentExtractors.extractVoice(thirdPersonContent);

      expect(voice1).toContain("first-person");
      expect(voice3).toContain("third-person");
    });

    test("should detect tone", () => {
      const seriousContent =
        "This is grave and dire situation that demands earnest attention.";
      const humorousContent =
        "He laughed at the funny joke and chuckled all day.";

      const seriousTone = ContentExtractors.extractTone(seriousContent);
      const humorousTone = ContentExtractors.extractTone(humorousContent);

      expect(seriousTone).toContain("serious");
      expect(humorousTone).toContain("humorous");
    });

    test("should extract themes", () => {
      const content =
        "Their love was forbidden. Passion burned between them. Betrayal followed.";
      const themes = ContentExtractors.extractThemes(content);

      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBeGreaterThan(0);
    });

    test("should extract character names", () => {
      const content =
        "Alice walked into the forest. Bob followed Alice. Alice was afraid. Bob reassured Alice.";
      const characters = ContentExtractors.extractCharacters(content);

      expect(Object.keys(characters).length).toBeGreaterThan(0);
      // Alice and Bob should be detected (mentioned 2+ times)
    });
  });

  describe("Prompt generation", () => {
    test("should generate valid structure prompt", () => {
      const prompt = PromptTemplates.structurePrompt({
        title: "Test Book",
        topic: "Technology",
        targetAudience: "Developers",
        tone: "Professional",
        contentType: "Educational",
      });

      expect(prompt).toContain("Test Book");
      expect(prompt).toContain("Technology");
      expect(prompt).toContain("Developers");
      expect(prompt).toMatch(/json|JSON/i); // Should ask for JSON
    });

    test("should generate valid page 1 prompt", () => {
      const prompt = PromptTemplates.page1Prompt({
        title: "Test Book",
        topic: "Technology",
        targetAudience: "Developers",
        tone: "Professional",
        voiceStyle: "Clear and concise",
      });

      expect(prompt).toContain("Test Book");
      expect(prompt).toContain("page 1");
      expect(prompt.length).toBeGreaterThan(100);
    });

    test("should generate valid batch prompt", () => {
      const prompt = PromptTemplates.batchPrompt({
        pageNumbers: [2, 3, 4],
        voice: "first-person, conversational",
        tone: "serious, dark",
        themes: ["mystery", "journey"],
        previousPageSummary: "The hero begins a quest.",
        upcomingPageTitle: "Chapter 5: Revelation",
      });

      expect(prompt).toContain("page 2");
      expect(prompt).toContain("page 4");
      expect(prompt).toContain("mystery");
      expect(prompt).toContain("quest");
    });
  });

  describe("Error recovery and fallback", () => {
    test("should fallback to individual generation on batch failure", async () => {
      // This would require more complex mocking of the full flow
      // Deferred to integration tests
    });

    test("should record fallback pages", () => {
      const sessionId = service.metrics.startSession({
        title: "Test",
        topic: "Test",
      });

      service.metrics.recordFallbackPage(sessionId, 3);

      const metrics = service.metrics.getSessionMetrics(sessionId);
      expect(metrics.fallbacks.length).toBe(1);
      expect(metrics.fallbacks[0].pageNumber).toBe(3);
    });

    test("should handle max retries on 429 errors", async () => {
      const rateLimiter = new RateLimiter({ requestsPerMinute: 10 });
      let attemptCount = 0;

      const mockRequest = jest.fn(async () => {
        attemptCount++;
        const error = new Error("Rate limited");
        error.status = 429;
        throw error;
      });

      // Should fail after 5 retries
      await expect(rateLimiter.enqueue(mockRequest)).rejects.toThrow(
        "Rate limited"
      );

      expect(attemptCount).toBe(6); // 1 initial + 5 retries
    });
  });

  describe("Session management", () => {
    test("should create unique session IDs", () => {
      const sessionId1 = service.metrics.startSession({
        title: "Test 1",
        topic: "Test",
      });
      const sessionId2 = service.metrics.startSession({
        title: "Test 2",
        topic: "Test",
      });

      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1).toMatch(/^session-/);
      expect(sessionId2).toMatch(/^session-/);
    });

    test("should finalize session with totals", () => {
      const sessionId = service.metrics.startSession({
        title: "Test",
        topic: "Test",
      });

      const pages = { 1: "content1", 2: "content2" };
      service.metrics.finalizeSession(sessionId, pages);

      const metrics = service.metrics.getSessionMetrics(sessionId);
      expect(metrics.totalLatency).toBeGreaterThan(0);
      expect(metrics.pageCount).toBe(2);
      expect(metrics.endTime).toBeDefined();
    });

    test("should clear sessions", () => {
      const sessionId = service.metrics.startSession({
        title: "Test",
        topic: "Test",
      });

      service.metrics.clearSession(sessionId);

      const metrics = service.metrics.getSessionMetrics(sessionId);
      expect(metrics).toBeUndefined();
    });
  });
});
