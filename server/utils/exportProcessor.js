/**
 * exportProcessor.js — Background async PDF generation processor
 *
 * Continuously monitors exportQueue for queued jobs and processes them:
 * 1. Lookup result from results table by resultId
 * 2. Generate PDF from out_envelope via exportService
 * 3. Save PDF to filesystem
 * 4. Update job status in both queue and PostgreSQL
 *
 * Concurrency limit: MAX_CONCURRENT = 5 (prevents Puppeteer overload)
 */

const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");

/**
 * Get or create the tmp-exports directory
 */
async function ensureExportsDir() {
  const exportsDir = path.join(process.cwd(), "tmp-exports");
  try {
    await fs.mkdir(exportsDir, { recursive: true });
    return exportsDir;
  } catch (err) {
    console.error("Failed to create tmp-exports directory:", err.message);
    throw err;
  }
}

class ExportProcessor {
  constructor() {
    this.MAX_CONCURRENT = 5;
    this.processing = new Set(); // Set of jobIds currently being processed
    this.isRunning = false;
    this.processorInterval = null;
    this.exportQueue = null;
    this.resultDb = null;
    this.prismaClient = null;
  }

  /**
   * Initialize the processor with dependencies
   * @param {Object} exportQueue - The exportQueue module instance
   * @param {Object} resultDb - The resultDb module instance
   * @param {Object} prismaClient - Prisma Client for direct queries
   */
  async initialize(exportQueue, resultDb, prismaClient) {
    this.exportQueue = exportQueue;
    this.resultDb = resultDb;
    this.prismaClient = prismaClient;
    await ensureExportsDir();
    console.log("ExportProcessor initialized");
  }

  /**
   * Start the background processor loop
   * @param {number} intervalMs - How often to check for queued jobs (default: 1000ms)
   */
  start(intervalMs = 1000) {
    if (this.isRunning) {
      console.warn("ExportProcessor already running");
      return;
    }

    this.isRunning = true;
    console.log(
      `ExportProcessor started (checking every ${intervalMs}ms, max ${this.MAX_CONCURRENT} concurrent)`
    );

    this.processorInterval = setInterval(() => {
      this.processQueue().catch((err) => {
        console.error("ExportProcessor error:", err.message);
      });
    }, intervalMs);
  }

  /**
   * Stop the background processor loop
   */
  stop() {
    if (this.processorInterval) {
      clearInterval(this.processorInterval);
      this.processorInterval = null;
    }
    this.isRunning = false;
    console.log("ExportProcessor stopped");
  }

  /**
   * Main processing loop: fetch queued jobs and process up to MAX_CONCURRENT
   * @returns {Promise<void>}
   */
  async processQueue() {
    // Skip if already at max concurrency
    if (this.processing.size >= this.MAX_CONCURRENT) {
      return;
    }

    // Get next batch of queued jobs
    const available = this.MAX_CONCURRENT - this.processing.size;
    const queuedJobs = await this.exportQueue.getQueuedJobs(available);

    if (queuedJobs.length === 0) {
      return;
    }

    // Process each job without awaiting (fire-and-forget with error handling)
    for (const job of queuedJobs) {
      this.processing.add(job.jobId);

      this.processJob(job)
        .then(() => {
          console.log(`✓ Export ${job.jobId} completed`);
        })
        .catch((err) => {
          console.error(`✗ Export ${job.jobId} failed:`, err.message || err);
        })
        .finally(() => {
          this.processing.delete(job.jobId);
        });
    }
  }

  /**
   * Process a single export job
   * @param {Object} job - Job object { jobId, resultId, status, progress, createdAt }
   * @returns {Promise<void>}
   */
  async processJob(job) {
    const { jobId, resultId } = job;

    try {
      // 1. Update status to "processing"
      await this.exportQueue.updateJob(jobId, {
        status: "processing",
        progress: 10,
      });

      // 2. Lookup result from database
      let result;
      try {
        result = await this.resultDb.getResultById(resultId);
      } catch (err) {
        throw new Error(
          `Failed to retrieve result ${resultId}: ${err.message}`
        );
      }

      if (!result) {
        throw new Error(`Result ${resultId} not found`);
      }

      // 3. Generate PDF from out_envelope
      let pdfBuffer;
      try {
        const exportService = require("./exportService");
        const generated = await exportService.generate(result.outEnvelope, {
          validate: true,
        });
        pdfBuffer = generated.buffer;
      } catch (err) {
        throw new Error(`PDF generation failed: ${err.message}`);
      }

      if (!pdfBuffer) {
        throw new Error("PDF generation returned empty buffer");
      }

      // 4. Save PDF to filesystem
      const exportsDir = path.join(process.cwd(), "tmp-exports");
      const pdfFilename = `export_${jobId}.pdf`;
      const pdfPath = path.join(exportsDir, pdfFilename);

      try {
        await fs.writeFile(pdfPath, pdfBuffer);
      } catch (err) {
        throw new Error(`Failed to write PDF to ${pdfPath}: ${err.message}`);
      }

      // 5. Update job status to "complete" in queue
      await this.exportQueue.updateJob(jobId, {
        status: "complete",
        progress: 100,
        pdfPath,
        completedAt: Date.now(),
      });

      // 6. Persist to PostgreSQL for durability
      try {
        await this.resultDb.updateExportJob(jobId, {
          status: "complete",
          progress: 100,
          pdfPath,
          completedAt: new Date(),
        });
      } catch (err) {
        console.warn(
          `Failed to persist job ${jobId} to database:`,
          err.message
        );
        // Non-fatal: job is already marked complete in queue
      }
    } catch (error) {
      // Mark job as failed in queue
      const errorMsg = error.message || String(error);
      await this.exportQueue.updateJob(jobId, {
        status: "failed",
        errorMessage: errorMsg,
      });

      // Try to persist failure to database
      try {
        await this.resultDb.updateExportJob(jobId, {
          status: "failed",
          errorMessage: errorMsg,
        });
      } catch (err) {
        console.warn(`Failed to persist failure for ${jobId}:`, err.message);
      }

      throw error;
    }
  }

  /**
   * Get current processor statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const queueStats = await this.exportQueue.getStats();
    return {
      isRunning: this.isRunning,
      currentlyConcurrent: this.processing.size,
      maxConcurrent: this.MAX_CONCURRENT,
      queue: queueStats,
    };
  }
}

// Singleton instance
const exportProcessor = new ExportProcessor();

module.exports = exportProcessor;
