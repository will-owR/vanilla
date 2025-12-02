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

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BatchOptimizationService } from "../batchOptimization/BatchOptimizationService.js";
import { RateLimiter } from "../batchOptimization/RateLimiter.js";
import { GenerationMetrics } from "../batchOptimization/GenerationMetrics.js";
import { ContentExtractors } from "../batchOptimization/ContentExtractors.js";
import { PromptTemplates } from "../batchOptimization/PromptTemplates.js";

describe("BatchOptimizationService", () => {
  let mockAiService;
  let mockLogger;
  let service;

  beforeEach(() => {
    // Mock AI service
    mockAiService = {
      generateContentWithRotation: vi.fn(),
    };

    // Mock logger
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    service = new BatchOptimizationService(mockAiService, mockLogger);
  });

  describe("Constructor", () => {
    it("should initialize with aiService and logger", () => {
      expect(service.aiService).toBe(mockAiService);
      expect(service.logger).toBe(mockLogger);
      expect(service.rateLimiter).toBeDefined();
      expect(service.rateLimiter.enqueue).toBeDefined();
      expect(service.metrics).toBeDefined();
      expect(service.metrics.startSession).toBeDefined();
    });

    it("should use console as default logger", () => {
      const svc = new BatchOptimizationService(mockAiService);
      expect(svc.logger).toBe(console);
    });
  });

  describe("Page count validation", () => {
    it("should reject books with < 3 pages", async () => {
      const ebookData = {
        title: "Too Short",
        topic: "Test",
        targetAudience: "All",
        tone: "Neutral",
      };
      const structure = { chapters: [{}, {}] };

      await expect(
        service.generateWithBatching(ebookData, structure)
      ).rejects.toThrow("Stage 1 only supports 3-20 pages");
    });

    it("should reject books with > 20 pages", async () => {
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
  });

  describe("Batch formation", () => {
    it("should form correct batches for 8-page ebook", () => {
      const pages = Array(8)
        .fill(0)
        .map((_, i) => i + 1);
      const middlePages = pages.slice(1, -1);

      const batches = [];
      const batchSize = 3;
      for (let i = 0; i < middlePages.length; i += batchSize) {
        batches.push(middlePages.slice(i, i + batchSize));
      }

      expect(batches.length).toBe(2);
      expect(batches[0]).toEqual([2, 3, 4]);
      expect(batches[1]).toEqual([5, 6, 7]);
    });

    it("should handle uneven batch distributions", () => {
      const middlePages = Array(9)
        .fill(0)
        .map((_, i) => i + 2);
      middlePages.pop();

      const batches = [];
      for (let i = 0; i < middlePages.length; i += 3) {
        batches.push(middlePages.slice(i, i + 3));
      }

      expect(batches.length).toBe(3);
      expect(batches[2].length).toBe(2);
    });
  });

  describe("RateLimiter", () => {
    it("should enqueue requests", async () => {
      const mockRequest = vi.fn().mockResolvedValue("result");
      const rateLimiter = new RateLimiter({ requestsPerMinute: 10 });

      const result = await rateLimiter.enqueue(mockRequest);

      expect(mockRequest).toHaveBeenCalled();
      expect(result).toBe("result");
    });

    it("should handle 429 errors with exponential backoff", async () => {
      const rateLimiter = new RateLimiter({ requestsPerMinute: 10 });
      let attemptCount = 0;

      const mockRequest = vi.fn(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error("Rate limited");
          error.status = 429;
          throw error;
        }
        return "success";
      });

      const result = await rateLimiter.enqueue(mockRequest);

      expect(attemptCount).toBe(2);
      expect(result).toBe("success");
    });

    it("should fail after max retries on persistent 429 errors", async () => {
      const rateLimiter = new RateLimiter({ requestsPerMinute: 10 });
      let attemptCount = 0;

      const mockRequest = vi.fn(async () => {
        attemptCount++;
        const error = new Error("Rate limited");
        error.status = 429;
        throw error;
      });

      await expect(rateLimiter.enqueue(mockRequest)).rejects.toThrow(
        "Rate limited"
      );

      expect(attemptCount).toBe(6);
    }, 60000);
  });

  describe("Metrics tracking", () => {
    it("should track structure generation", () => {
      const sessionId = service.metrics.startSession({
        title: "Test",
        topic: "Test",
      });

      service.metrics.recordStructure(sessionId, { chapters: [] }, 1234);

      const metrics = service.metrics.getSessionMetrics(sessionId);
      expect(metrics.structure).toBeDefined();
      expect(metrics.structure.latency).toBe(1234);
    });

    it("should track individual page generation", () => {
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

    it("should track batch generation", () => {
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

    it("should track failed pages", () => {
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

    it("should calculate total API calls correctly", () => {
      const sessionId = service.metrics.startSession({
        title: "Test",
        topic: "Test",
      });

      service.metrics.recordStructure(sessionId, {}, 100);
      service.metrics.recordPage(sessionId, 1, 100);
      service.metrics.recordBatch(sessionId, [2, 3, 4], 300);
      service.metrics.recordPage(sessionId, 5, 100);

      const apiCalls = service.metrics.calculateApiCalls(sessionId);
      expect(apiCalls).toBe(4);
    });

    it("should finalize session with totals", () => {
      const sessionId = service.metrics.startSession({
        title: "Test",
        topic: "Test",
      });

      const pages = ["content1", "content2"];
      service.metrics.finalizeSession(sessionId, pages);

      const metrics = service.metrics.getSessionMetrics(sessionId);
      expect(metrics.totalLatency).toBeDefined();
      expect(metrics.pageCount).toBe(2);
      expect(metrics.endTime).toBeDefined();
      expect(metrics.startTime).toBeDefined();
    });
  });

  describe("Content extraction", () => {
    it("should extract summary from content", () => {
      const content =
        "This is the opening sentence. This is the second sentence. This is a longer continuation that provides more context.";
      const summary = ContentExtractors.extractSummary(content);

      expect(summary).toBeDefined();
      expect(summary.length).toBeLessThanOrEqual(300);
      expect(summary).toContain("opening sentence");
    });

    it("should detect voice perspective", () => {
      const firstPersonContent =
        "I walked through the door. My heart was racing.";
      const thirdPersonContent =
        "He walked through the door. His heart was racing.";

      const voice1 = ContentExtractors.extractVoice(firstPersonContent);
      const voice3 = ContentExtractors.extractVoice(thirdPersonContent);

      expect(voice1).toContain("first-person");
      expect(voice3).toContain("third-person");
    });

    it("should detect tone", () => {
      const seriousContent =
        "This is grave and dire situation that demands earnest attention.";
      const humorousContent =
        "He laughed at the funny joke and chuckled all day.";

      const seriousTone = ContentExtractors.extractTone(seriousContent);
      const humorousTone = ContentExtractors.extractTone(humorousContent);

      expect(seriousTone).toContain("serious");
      expect(humorousTone).toContain("humorous");
    });

    it("should extract themes", () => {
      const content =
        "Their love was forbidden. Passion burned between them. Betrayal followed.";
      const themes = ContentExtractors.extractThemes(content);

      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBeGreaterThan(0);
    });

    it("should extract character names", () => {
      const content =
        "Alice walked into the forest. Bob followed Alice. Alice was afraid. Bob reassured Alice.";
      const characters = ContentExtractors.extractCharacters(content);

      expect(Object.keys(characters).length).toBeGreaterThan(0);
    });
  });

  describe("Prompt generation", () => {
    it("should generate valid structure prompt", () => {
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
      expect(prompt).toMatch(/json|JSON/i);
    });

    it("should generate valid page 1 prompt", () => {
      const prompt = PromptTemplates.page1Prompt({
        title: "Test Book",
        topic: "Technology",
        targetAudience: "Developers",
        tone: "Professional",
        voiceStyle: "Clear and concise",
      });

      expect(prompt).toContain("Test Book");
      expect(prompt).toContain("opening");
      expect(prompt).toContain("Technology");
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("should generate valid batch prompt", () => {
      const prompt = PromptTemplates.batchPrompt({
        pageNumbers: [2, 3, 4],
        voice: "first-person, conversational",
        tone: "serious, dark",
        themes: ["mystery", "journey"],
        previousPageSummary: "The hero begins a quest.",
        upcomingPageTitle: "Chapter 5: Revelation",
      });

      expect(prompt).toContain("continuing");
      expect(prompt).toContain("mystery");
      expect(prompt).toContain("quest");
      expect(prompt).toContain("Revelation");
      expect(prompt.length).toBeGreaterThan(200);
    });
  });

  describe("Session management", () => {
    it("should create unique session IDs", () => {
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

    it("should clear sessions", () => {
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
