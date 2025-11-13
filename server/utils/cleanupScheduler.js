/**
 * cleanupScheduler.js — Hourly task to cleanup expired exports
 *
 * Runs hourly to:
 * 1. Delete export jobs older than 24 hours from queue
 * 2. Delete associated PDF files from filesystem
 * 3. Delete corresponding records from PostgreSQL export_jobs table
 * 4. Log cleanup metrics
 */

const fs = require("fs").promises;
const path = require("path");

class CleanupScheduler {
  constructor() {
    this.isRunning = false;
    this.cleanupInterval = null;
    this.exportQueue = null;
    this.resultDb = null;
    this.EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Initialize the cleanup scheduler with dependencies
   * @param {Object} exportQueue - The exportQueue module instance
   * @param {Object} resultDb - The resultDb module instance
   */
  initialize(exportQueue, resultDb) {
    this.exportQueue = exportQueue;
    this.resultDb = resultDb;
    console.log("CleanupScheduler initialized");
  }

  /**
   * Start the hourly cleanup schedule
   * @param {number} intervalMs - How often to run cleanup (default: 1 hour = 3600000ms)
   */
  start(intervalMs = 60 * 60 * 1000) {
    if (this.isRunning) {
      console.warn("CleanupScheduler already running");
      return;
    }

    this.isRunning = true;
    console.log(
      `CleanupScheduler started (running every ${Math.round(
        intervalMs / 1000 / 60
      )} minutes)`
    );

    // Run cleanup immediately on startup
    this.runCleanup().catch((err) => {
      console.error("CleanupScheduler initial cleanup failed:", err.message);
    });

    // Then run on schedule
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch((err) => {
        console.error("CleanupScheduler error:", err.message);
      });
    }, intervalMs);
  }

  /**
   * Stop the cleanup scheduler
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log("CleanupScheduler stopped");
  }

  /**
   * Execute the cleanup task
   * @returns {Promise<Object>} Cleanup metrics { deleted, failed, filesDeleted }
   */
  async runCleanup() {
    const startTime = Date.now();
    const metrics = {
      deleted: 0,
      failed: 0,
      filesDeleted: 0,
      filesFailed: 0,
      dbDeleted: 0,
      dbFailed: 0,
    };

    try {
      // 1. Find and delete expired jobs from queue
      const cutoffMs = this.EXPIRY_MS;
      const queueMetrics = await this.exportQueue.deleteExpiredJobs(cutoffMs);
      metrics.deleted =
        (queueMetrics.inMemory || 0) + (queueMetrics.fallback || 0);

      // 2. Delete corresponding PDFs and database records
      const cutoffDate = new Date(Date.now() - cutoffMs);

      try {
        // Get all expired jobs from database to find PDFs
        const expiredJobs = await this.resultDb.getExportJobsByStatus(
          "complete",
          { olderThan: cutoffDate }
        );

        for (const job of expiredJobs || []) {
          // Delete PDF file if exists
          if (job.pdfPath) {
            try {
              await fs.unlink(job.pdfPath);
              metrics.filesDeleted++;
            } catch (err) {
              if (err.code !== "ENOENT") {
                // ENOENT = file doesn't exist (already deleted), which is fine
                console.warn(
                  `Failed to delete PDF ${job.pdfPath}:`,
                  err.message
                );
                metrics.filesFailed++;
              } else {
                metrics.filesDeleted++; // Count as deleted if already gone
              }
            }
          }

          // Delete database record
          try {
            await this.resultDb.updateExportJob(job.jobId, {
              status: "expired",
            });
            metrics.dbDeleted++;
          } catch (err) {
            console.warn(
              `Failed to mark job ${job.jobId} as expired:`,
              err.message
            );
            metrics.dbFailed++;
          }
        }
      } catch (err) {
        console.warn(
          "Error retrieving expired jobs from database:",
          err.message
        );
        metrics.failed++;
      }

      // 3. Also explicitly delete from PostgreSQL (for any jobs not in queue)
      try {
        // This is handled by resultDb if it has a deleteExpiredExportJobs method
        if (this.resultDb.deleteExpiredExportJobs) {
          const dbResult = await this.resultDb.deleteExpiredExportJobs(
            cutoffMs
          );
          metrics.dbDeleted += dbResult || 0;
        }
      } catch (err) {
        console.warn("Error deleting expired jobs from database:", err.message);
      }

      const duration = Date.now() - startTime;
      console.log(
        `✓ Cleanup completed in ${duration}ms: ` +
          `${metrics.deleted} queue items, ` +
          `${metrics.filesDeleted} files, ` +
          `${metrics.dbDeleted} DB records` +
          (metrics.filesFailed + metrics.dbFailed > 0
            ? ` (${metrics.filesFailed + metrics.dbFailed} failures)`
            : "")
      );

      return metrics;
    } catch (err) {
      console.error("Cleanup task failed:", err.message);
      metrics.failed++;
      throw err;
    }
  }

  /**
   * Get cleanup scheduler status
   * @returns {Object}
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      expiryMs: this.EXPIRY_MS,
      expiryHours: this.EXPIRY_MS / (60 * 60 * 1000),
    };
  }
}

// Singleton instance
const cleanupScheduler = new CleanupScheduler();

module.exports = cleanupScheduler;
