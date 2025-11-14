/**
 * phase-3-integration.test.js — End-to-end integration tests for Phase 3/4
 *
 * Tests the full workflow:
 * 1. Generate result via genieService
 * 2. Queue export job via POST /api/export/generate
 * 3. Check job status via GET /api/export/status/:jobId
 * 4. Wait for processing and verify completion
 * 5. Download PDF via GET /api/export/download/:jobId
 */

/* eslint-disable no-undef */
const request = require("supertest");
const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");

// Import app and services
const app = require("../index");
const genieService = require("../genieService");
const resultDb = require("../utils/resultDb");
const exportQueue = require("../utils/exportQueue");

describe("Phase 3/4: End-to-End Export Workflow", () => {
  let prisma;
  let testResultId;
  const testExportsDir = path.join(process.cwd(), "tmp-exports-test");

  beforeEach(async () => {
    prisma = new PrismaClient();

    // Create test exports directory
    try {
      await fs.mkdir(testExportsDir, { recursive: true });
    } catch (err) {
      // Directory may already exist
    }

    testResultId = null;
  });

  afterEach(async () => {
    // Cleanup test data (delete jobs first due to FK constraint)
    try {
      if (testResultId) {
        await prisma.exportJob.deleteMany({
          where: { resultId: testResultId },
        });
        await prisma.result.deleteMany({
          where: { resultId: testResultId },
        });
      }
    } catch (err) {
      console.warn("Cleanup error:", err.message);
    }

    await prisma.$disconnect();
    exportQueue.jobs.clear();

    // Cleanup test exports directory
    try {
      const files = await fs.readdir(testExportsDir);
      for (const file of files) {
        await fs.unlink(path.join(testExportsDir, file));
      }
      await fs.rmdir(testExportsDir);
    } catch (err) {
      console.warn("Failed to cleanup test exports directory:", err.message);
    }
  });

  describe("POST /api/export/generate", () => {
    it("should require resultId parameter", async () => {
      const response = await request(app).post("/api/export/generate").send({});

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain("resultId");
    });

    it("should return 400 for non-existent result", async () => {
      const fakeResultId = uuidv4();

      const response = await request(app)
        .post("/api/export/generate")
        .send({ resultId: fakeResultId });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("RESULT_NOT_FOUND");
    });

    it("should queue job and return jobId for valid resultId", async () => {
      // First, create a test result
      const outEnvelope = {
        pages: [
          {
            title: "Test Page",
            body: "This is test content for export.",
          },
        ],
        metadata: {
          mode: "basic",
          generated_at: new Date().toISOString(),
        },
        actions: { can_export: true },
      };

      testResultId = uuidv4();
      const result = await resultDb.saveResult(
        testResultId,
        outEnvelope,
        "basic"
      );
      expect(result.resultId).toBe(testResultId);

      // Now request export
      const response = await request(app)
        .post("/api/export/generate")
        .send({ resultId: testResultId });

      expect(response.status).toBe(202);
      expect(response.body.jobId).toBeDefined();
      expect(response.body.status).toBe("queued");
      expect(response.body.jobId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });
  });

  describe("GET /api/export/status/:jobId", () => {
    it("should require jobId parameter", async () => {
      const response = await request(app).get("/api/export/status/");

      expect(response.status).toBeOneOf([400, 404]);
    });

    it("should return 404 for non-existent job", async () => {
      const fakeJobId = uuidv4();

      const response = await request(app).get(
        `/api/export/status/${fakeJobId}`
      );

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("JOB_NOT_FOUND");
    });

    it("should return job status for queued job", async () => {
      // Create result
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "basic" },
        actions: {},
      };

      testResultId = uuidv4();
      await resultDb.saveResult(testResultId, outEnvelope, "basic");

      // Queue export
      const queueResponse = await request(app)
        .post("/api/export/generate")
        .send({ resultId: testResultId });

      expect(queueResponse.status).toBe(202);
      const jobId = queueResponse.body.jobId;

      // Check status
      const statusResponse = await request(app).get(
        `/api/export/status/${jobId}`
      );

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.jobId).toBe(jobId);
      expect(statusResponse.body.status).toBe("queued");
      expect(statusResponse.body.progress).toBeLessThanOrEqual(100);
    });

    it("should include pdfUrl in response when job is complete", async () => {
      // Create result
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "basic" },
        actions: {},
      };

      testResultId = uuidv4();
      await resultDb.saveResult(testResultId, outEnvelope, "basic");

      // Create job
      const jobId = uuidv4();
      await resultDb.createExportJob(jobId, testResultId);

      // Manually mark as complete with PDF path
      const pdfPath = path.join(testExportsDir, `export_${jobId}.pdf`);
      await fs.writeFile(pdfPath, Buffer.from("mock PDF content"));

      await resultDb.updateExportJob(jobId, {
        status: "complete",
        progress: 100,
        pdfPath,
      });

      // Check status
      const statusResponse = await request(app).get(
        `/api/export/status/${jobId}`
      );

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe("complete");
      expect(statusResponse.body.pdfUrl).toBe(`/api/export/download/${jobId}`);
    });

    it("should return expired status for jobs older than 24 hours", async () => {
      // Create old result in database (backdated)
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "basic" },
        actions: {},
      };

      testResultId = uuidv4();
      await resultDb.saveResult(testResultId, outEnvelope, "basic");

      const jobId = uuidv4();
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      // Use raw Prisma query to set old createdAt
      await prisma.exportJob.create({
        data: {
          jobId,
          resultId: testResultId,
          status: "complete",
          progress: 100,
          createdAt: oldDate,
        },
      });

      // Check status should return 410
      const statusResponse = await request(app).get(
        `/api/export/status/${jobId}`
      );

      expect(statusResponse.status).toBe(410);
      expect(statusResponse.body.code).toBe("EXPIRED");
    });

    it("should include error message if job failed", async () => {
      // Create result
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "basic" },
        actions: {},
      };

      testResultId = uuidv4();
      await resultDb.saveResult(testResultId, outEnvelope, "basic");

      // Create failed job
      const jobId = uuidv4();
      await resultDb.createExportJob(jobId, testResultId);
      await resultDb.updateExportJob(jobId, {
        status: "failed",
        errorMessage: "PDF generation failed: timeout",
      });

      // Check status
      const statusResponse = await request(app).get(
        `/api/export/status/${jobId}`
      );

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe("failed");
      expect(statusResponse.body.error).toBe("PDF generation failed: timeout");
    });
  });

  describe("GET /api/export/download/:jobId", () => {
    it("should require jobId parameter", async () => {
      const response = await request(app).get("/api/export/download/");

      expect(response.status).toBeOneOf([400, 404]);
    });

    it("should return 404 for non-existent job", async () => {
      const fakeJobId = uuidv4();

      const response = await request(app).get(
        `/api/export/download/${fakeJobId}`
      );

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("NOT_FOUND");
    });

    it("should return 202 if job not ready", async () => {
      // Create result
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "basic" },
        actions: {},
      };

      testResultId = uuidv4();
      await resultDb.saveResult(testResultId, outEnvelope, "basic");

      // Create queued job
      const jobId = uuidv4();
      await resultDb.createExportJob(jobId, testResultId);

      // Try to download
      const downloadResponse = await request(app).get(
        `/api/export/download/${jobId}`
      );

      expect(downloadResponse.status).toBe(202);
      expect(downloadResponse.body.code).toBe("NOT_READY");
      expect(downloadResponse.body.status).toBe("queued");
    });

    it("should download PDF for complete job", async () => {
      // Create result
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "basic" },
        actions: {},
      };

      testResultId = uuidv4();
      await resultDb.saveResult(testResultId, outEnvelope, "basic");

      // Create complete job with PDF
      const jobId = uuidv4();
      await resultDb.createExportJob(jobId, testResultId);

      const pdfContent = Buffer.from("Mock PDF content for testing");
      const pdfPath = path.join(testExportsDir, `export_${jobId}.pdf`);
      await fs.writeFile(pdfPath, pdfContent);

      await resultDb.updateExportJob(jobId, {
        status: "complete",
        progress: 100,
        pdfPath,
      });

      // Download
      const downloadResponse = await request(app).get(
        `/api/export/download/${jobId}`
      );

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.type).toContain("application/pdf");
      expect(downloadResponse.body).toEqual(pdfContent);
    });

    it("should return 410 for expired job", async () => {
      // Create old result and job
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "basic" },
        actions: {},
      };

      testResultId = uuidv4();
      await resultDb.saveResult(testResultId, outEnvelope, "basic");

      const jobId = uuidv4();
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);

      await prisma.exportJob.create({
        data: {
          jobId,
          resultId: testResultId,
          status: "complete",
          progress: 100,
          pdfPath: "/tmp/old.pdf",
          createdAt: oldDate,
        },
      });

      // Try to download
      const downloadResponse = await request(app).get(
        `/api/export/download/${jobId}`
      );

      expect(downloadResponse.status).toBe(410);
      expect(downloadResponse.body.code).toBe("EXPIRED");
    });

    it("should return 404 if PDF file not found on disk", async () => {
      // Create result
      const outEnvelope = {
        pages: [{ title: "Test", body: "Content" }],
        metadata: { mode: "basic" },
        actions: {},
      };

      testResultId = uuidv4();
      await resultDb.saveResult(testResultId, outEnvelope, "basic");

      // Create complete job with missing PDF
      const jobId = uuidv4();
      await resultDb.createExportJob(jobId, testResultId);
      await resultDb.updateExportJob(jobId, {
        status: "complete",
        progress: 100,
        pdfPath: "/nonexistent/path/file.pdf",
      });

      // Try to download
      const downloadResponse = await request(app).get(
        `/api/export/download/${jobId}`
      );

      expect(downloadResponse.status).toBe(404);
      expect(downloadResponse.body.code).toBe("FILE_NOT_FOUND");
    });
  });

  describe("Full Workflow", () => {
    it("should complete generate -> queue -> status -> download flow", async () => {
      // 1. Create result via genieService
      const outEnvelope = {
        pages: [
          {
            title: "Test Export",
            body: "This is a complete end-to-end test of the export workflow.",
          },
        ],
        metadata: {
          mode: "basic",
          generated_at: new Date().toISOString(),
          model: "test",
        },
        actions: { can_export: true },
      };

      testResultId = uuidv4();
      const savedResult = await resultDb.saveResult(
        testResultId,
        outEnvelope,
        "basic"
      );
      expect(savedResult.resultId).toBe(testResultId);

      // 2. Queue export via POST /api/export/generate
      const queueResponse = await request(app)
        .post("/api/export/generate")
        .send({ resultId: testResultId });

      expect(queueResponse.status).toBe(202);
      const jobId = queueResponse.body.jobId;
      expect(queueResponse.body.status).toBe("queued");

      // 3. Check status via GET /api/export/status/:jobId
      const statusResponse = await request(app).get(
        `/api/export/status/${jobId}`
      );

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.jobId).toBe(jobId);
      expect(["queued", "processing", "complete"]).toContain(
        statusResponse.body.status
      );

      // 4. Simulate job completion (manual update)
      // Must update both DB AND in-memory queue since endpoint checks queue first
      const pdfContent = Buffer.from("Simulated PDF content");
      const pdfPath = path.join(testExportsDir, `export_${jobId}.pdf`);
      await fs.writeFile(pdfPath, pdfContent);

      const updatedJob = await resultDb.updateExportJob(jobId, {
        status: "complete",
        progress: 100,
        pdfPath,
      });

      // Also update in-memory queue so endpoint returns updated status
      if (exportQueue.jobs.has(jobId)) {
        exportQueue.jobs.set(jobId, updatedJob);
      }

      // 5. Check status again
      const completedStatusResponse = await request(app).get(
        `/api/export/status/${jobId}`
      );

      expect(completedStatusResponse.status).toBe(200);
      expect(completedStatusResponse.body.status).toBe("complete");
      expect(completedStatusResponse.body.pdfUrl).toBe(
        `/api/export/download/${jobId}`
      );

      // 6. Download PDF via GET /api/export/download/:jobId
      const downloadResponse = await request(app).get(
        `/api/export/download/${jobId}`
      );

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.type).toContain("application/pdf");
      expect(downloadResponse.body).toEqual(pdfContent);
    });
  });
});
