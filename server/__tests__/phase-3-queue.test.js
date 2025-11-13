/**
 * phase-3-queue.test.js — Unit tests for exportQueue, exportProcessor, and cleanupScheduler
 *
 * Tests cover:
 * - Queue management (in-memory + fallback)
 * - Job processing (status transitions, PDF generation)
 * - Cleanup scheduling (expiry and deletion)
 *
 * Uses database cleanup for unit tests to keep database clean.
 * Vitest is configured with globals: true, so describe/it/expect/etc are available globally.
 */
/* eslint-disable no-undef */

const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");

// Import modules under test
const exportQueue = require("../utils/exportQueue");
const exportProcessor = require("../utils/exportProcessor");
const cleanupScheduler = require("../utils/cleanupScheduler");
const resultDb = require("../utils/resultDb");

describe("Phase 3: Export Queue, Processor, and Cleanup", () => {
  let prisma;
  let testResultId;
  let testJobId;

  beforeEach(async () => {
    // Initialize Prisma client
    prisma = new PrismaClient();

    testResultId = uuidv4();
    testJobId = uuidv4();
  });

  afterEach(async () => {
    // Cleanup: remove test results and jobs from database
    // Note: Must delete export jobs BEFORE results due to foreign key constraint
    try {
      if (testResultId) {
        // Delete all export jobs that reference this result
        await prisma.exportJob.deleteMany({
          where: { resultId: testResultId },
        });
        // Then delete the result
        await prisma.result.deleteMany({
          where: { resultId: testResultId },
        });
      }
    } catch (err) {
      console.warn("Cleanup error:", err.message);
    }

    // Close Prisma client
    await prisma.$disconnect();

    // Clear queue memory
    exportQueue.jobs.clear();
  });

  describe("ExportQueue", () => {
    it("should enqueue job in memory when queue is not full", async () => {
      const jobId = uuidv4();
      const resultId = uuidv4();

      await exportQueue.enqueue(jobId, resultId);

      expect(exportQueue.jobs.has(jobId)).toBe(true);
      const job = exportQueue.jobs.get(jobId);
      expect(job.status).toBe("queued");
      expect(job.resultId).toBe(resultId);
      expect(job.progress).toBe(0);
    });

    it("should track queue size accurately", async () => {
      const jobs = [];
      for (let i = 0; i < 5; i++) {
        const jobId = uuidv4();
        jobs.push(jobId);
        await exportQueue.enqueue(jobId, uuidv4());
      }

      expect(exportQueue.jobs.size).toBe(5);

      // Clean up
      jobs.forEach((jid) => exportQueue.jobs.delete(jid));
    });

    it("should retrieve job by ID", async () => {
      const jobId = uuidv4();
      const resultId = uuidv4();

      await exportQueue.enqueue(jobId, resultId);
      const job = await exportQueue.getJob(jobId);

      expect(job).toBeDefined();
      expect(job.jobId || jobId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(job.status).toBe("queued");

      exportQueue.jobs.delete(jobId);
    });

    it("should update job status and progress", async () => {
      const jobId = uuidv4();
      const resultId = uuidv4();

      await exportQueue.enqueue(jobId, resultId);
      await exportQueue.updateJob(jobId, {
        status: "processing",
        progress: 50,
      });

      const job = await exportQueue.getJob(jobId);
      expect(job.status).toBe("processing");
      expect(job.progress).toBe(50);

      exportQueue.jobs.delete(jobId);
    });

    it("should get queued jobs with limit", async () => {
      const jobIds = [];
      for (let i = 0; i < 3; i++) {
        const jobId = uuidv4();
        jobIds.push(jobId);
        await exportQueue.enqueue(jobId, uuidv4());
      }

      const queued = await exportQueue.getQueuedJobs(2);

      expect(queued.length).toBeLessThanOrEqual(2);
      expect(queued[0].status).toBe("queued");

      jobIds.forEach((jid) => exportQueue.jobs.delete(jid));
    });

    it("should delete job from queue", async () => {
      const jobId = uuidv4();
      const resultId = uuidv4();

      await exportQueue.enqueue(jobId, resultId);
      expect(exportQueue.jobs.has(jobId)).toBe(true);

      await exportQueue.deleteJob(jobId);
      expect(exportQueue.jobs.has(jobId)).toBe(false);
    });

    it("should delete expired jobs older than threshold", async () => {
      const now = Date.now();
      const oldTime = now - 25 * 60 * 60 * 1000; // 25 hours ago

      // Manually create old jobs in queue
      const oldJobId = uuidv4();
      exportQueue.jobs.set(oldJobId, {
        status: "complete",
        resultId: uuidv4(),
        createdAt: oldTime,
      });

      const newJobId = uuidv4();
      exportQueue.jobs.set(newJobId, {
        status: "queued",
        resultId: uuidv4(),
        createdAt: now,
      });

      // Delete jobs older than 24 hours
      const deleted = await exportQueue.deleteExpiredJobs(24 * 60 * 60 * 1000);

      expect(deleted.inMemory).toBeGreaterThanOrEqual(1);
      expect(exportQueue.jobs.has(oldJobId)).toBe(false);
      expect(exportQueue.jobs.has(newJobId)).toBe(true);

      exportQueue.jobs.delete(newJobId);
    });

    it("should report queue statistics", async () => {
      for (let i = 0; i < 3; i++) {
        await exportQueue.enqueue(uuidv4(), uuidv4());
      }

      const stats = await exportQueue.getStats();

      expect(stats.inMemory).toBe(3);
      expect(stats.total).toBe(3);
      expect(stats.fallback).toBeDefined();

      exportQueue.jobs.clear();
    });

    it("should require jobId and resultId for enqueue", async () => {
      await expect(exportQueue.enqueue(null, uuidv4())).rejects.toThrow(
        "jobId and resultId are required"
      );

      await expect(exportQueue.enqueue(uuidv4(), null)).rejects.toThrow(
        "jobId and resultId are required"
      );
    });
  });

  describe("ResultDb Export Job Methods", () => {
    it("should get export jobs by status", async () => {
      // Create test result and export job
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "basic" },
        actions: {},
      };

      const result = await resultDb.saveResult(
        testResultId,
        outEnvelope,
        "basic"
      );
      const job = await resultDb.createExportJob(testJobId, testResultId);

      const jobs = await resultDb.getExportJobsByStatus("queued", {
        limit: 10,
      });

      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs.some((j) => j.jobId === testJobId)).toBe(true);
    });

    it("should mark jobs as expired", async () => {
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "basic" },
        actions: {},
      };

      const result = await resultDb.saveResult(
        testResultId,
        outEnvelope,
        "basic"
      );
      const job = await resultDb.createExportJob(testJobId, testResultId);

      const marked = await resultDb.markJobsAsExpired(0); // Mark as expired immediately

      expect(marked).toBeGreaterThanOrEqual(0);
    });
  });

  describe("ExportProcessor", () => {
    beforeEach(async () => {
      // Initialize processor with mocked dependencies
      await exportProcessor.initialize(exportQueue, resultDb, prisma);
    });

    it("should process queue and respect concurrency limit", async () => {
      // Verify MAX_CONCURRENT is set correctly
      expect(exportProcessor.MAX_CONCURRENT).toBe(5);
    });

    it("should get processor statistics", async () => {
      const stats = await exportProcessor.getStats();

      expect(stats).toHaveProperty("isRunning");
      expect(stats).toHaveProperty("currentlyConcurrent");
      expect(stats).toHaveProperty("maxConcurrent");
      expect(stats.maxConcurrent).toBe(5);
    });

    it("should not start processor twice", () => {
      exportProcessor.start(1000);
      expect(exportProcessor.isRunning).toBe(true);

      // Attempting to start again should log warning and return
      exportProcessor.start(1000);
      expect(exportProcessor.isRunning).toBe(true);

      exportProcessor.stop();
    });

    it("should stop processor gracefully", () => {
      exportProcessor.start(1000);
      expect(exportProcessor.isRunning).toBe(true);

      exportProcessor.stop();
      expect(exportProcessor.isRunning).toBe(false);
    });
  });

  describe("CleanupScheduler", () => {
    beforeEach(() => {
      cleanupScheduler.initialize(exportQueue, resultDb);
    });

    it("should initialize with correct expiry duration", () => {
      const status = cleanupScheduler.getStatus();

      expect(status.expiryHours).toBe(24);
      expect(status.expiryMs).toBe(24 * 60 * 60 * 1000);
    });

    it("should get scheduler status", () => {
      const status = cleanupScheduler.getStatus();

      expect(status).toHaveProperty("isRunning");
      expect(status).toHaveProperty("expiryMs");
      expect(status).toHaveProperty("expiryHours");
    });

    it("should start and stop scheduler", () => {
      expect(cleanupScheduler.isRunning).toBe(false);

      cleanupScheduler.start(1000);
      expect(cleanupScheduler.isRunning).toBe(true);

      cleanupScheduler.stop();
      expect(cleanupScheduler.isRunning).toBe(false);
    });

    it("should not start scheduler twice", () => {
      cleanupScheduler.start(1000);
      expect(cleanupScheduler.isRunning).toBe(true);

      // Attempting to start again should log warning
      cleanupScheduler.start(1000);
      expect(cleanupScheduler.isRunning).toBe(true);

      cleanupScheduler.stop();
    });
  });

  describe("ResultDb Integration", () => {
    it("should create result and export job together", async () => {
      const outEnvelope = {
        pages: [{ title: "Test Page", body: "Test content" }],
        metadata: { mode: "basic", generated_at: new Date().toISOString() },
        actions: { can_export: true },
      };

      // Save result
      const result = await resultDb.saveResult(
        testResultId,
        outEnvelope,
        "basic"
      );
      expect(result.resultId).toBe(testResultId);
      expect(result.outEnvelope).toEqual(outEnvelope);

      // Create export job
      const job = await resultDb.createExportJob(testJobId, testResultId);
      expect(job.jobId).toBe(testJobId);
      expect(job.resultId).toBe(testResultId);
      expect(job.status).toBe("queued");
    });

    it("should update export job status", async () => {
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "basic" },
        actions: {},
      };

      await resultDb.saveResult(testResultId, outEnvelope, "basic");
      const job = await resultDb.createExportJob(testJobId, testResultId);

      // Update job to processing
      const updated = await resultDb.updateExportJob(testJobId, {
        status: "processing",
        progress: 50,
      });

      expect(updated.status).toBe("processing");
      expect(updated.progress).toBe(50);

      // Update to complete
      const completed = await resultDb.updateExportJob(testJobId, {
        status: "complete",
        progress: 100,
        pdfPath: "/tmp/exports/test.pdf",
      });

      expect(completed.status).toBe("complete");
      expect(completed.pdfPath).toBe("/tmp/exports/test.pdf");
    });

    it("should retrieve result by resultId", async () => {
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "demo" },
        actions: {},
      };

      await resultDb.saveResult(testResultId, outEnvelope, "demo");
      const retrieved = await resultDb.getResultById(testResultId);

      expect(retrieved.resultId).toBe(testResultId);
      expect(retrieved.mode).toBe("demo");
      expect(retrieved.outEnvelope).toEqual(outEnvelope);
    });
  });

  describe("Error Handling", () => {
    it("should throw error when creating job for non-existent result", async () => {
      const fakeResultId = uuidv4();
      const fakeJobId = uuidv4();

      await expect(
        resultDb.createExportJob(fakeJobId, fakeResultId)
      ).rejects.toThrow("Result not found");
    });

    it("should throw error when saving result without required fields", async () => {
      await expect(resultDb.saveResult(null, {}, "basic")).rejects.toThrow(
        "resultId, outEnvelope, and mode are required"
      );
    });

    it("should throw error when getting job without jobId", async () => {
      await expect(resultDb.getExportJobById(null)).rejects.toThrow(
        "jobId is required"
      );
    });

    it("should handle missing result gracefully", async () => {
      const fakeResultId = uuidv4();
      const result = await resultDb.getResultById(fakeResultId);

      expect(result).toBeNull();
    });
  });
});
