/**
 * Job Queue Manager
 *
 * Manages background ebook generation jobs using polling model
 * - Accepts generation requests and returns immediately with jobId
 * - Tracks job progress and status
 * - Stores completed results for retrieval
 * - Implements cleanup for old jobs
 */

const { v4: uuidv4 } = require("uuid");

class JobQueueManager {
  constructor() {
    this.jobs = new Map(); // jobId → job state
    this.cleanupInterval = 60000; // Clean up old jobs every 60 seconds
    this.maxJobAge = 3600000; // Keep jobs for 1 hour after completion
    this.startCleanupScheduler();
  }

  /**
   * Create a new job for ebook generation
   * @param {Object} params - Generation parameters {prompt, pageCount, theme, colorPalette, fontSizeScale}
   * @returns {Object} - {jobId, statusUrl, resultUrl}
   */
  createJob(params) {
    const jobId = uuidv4();
    const job = {
      jobId,
      status: "processing", // 'processing', 'complete', 'error'
      progress: 0,
      startTime: Date.now(),
      completedAt: null,
      result: null,
      error: null,
      message: "Initializing ebook generation...",
      params,
    };

    this.jobs.set(jobId, job);
    console.log(`[JobQueue] Created job ${jobId}`);

    return {
      jobId,
      statusUrl: `/api/ebook/generate/${jobId}/status`,
      resultUrl: `/api/ebook/${jobId}`,
    };
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Object} - Job status information
   */
  getStatus(jobId) {
    const job = this.jobs.get(jobId);

    if (!job) {
      return {
        error: "Job not found",
        jobId,
      };
    }

    const elapsed = Date.now() - job.startTime;
    const response = {
      jobId,
      status: job.status,
      progress: job.progress,
      message: job.message,
      elapsedSeconds: Math.round(elapsed / 1000),
    };

    if (job.status === "error") {
      response.error = job.error;
    }

    // Estimate time remaining (very rough)
    if (job.status === "processing" && job.progress > 0 && job.progress < 100) {
      const estimatedTotal = (elapsed / job.progress) * 100;
      const estimatedRemaining = estimatedTotal - elapsed;
      response.estimatedTimeRemainingSeconds = Math.max(
        0,
        Math.round(estimatedRemaining / 1000)
      );
    }

    return response;
  }

  /**
   * Get completed job result
   * @param {string} jobId - Job ID
   * @returns {Object} - Job result or status if not complete
   */
  getResult(jobId) {
    const job = this.jobs.get(jobId);

    if (!job) {
      return {
        error: "Job not found",
        jobId,
      };
    }

    if (job.status === "error") {
      return {
        error: job.error,
        jobId,
        status: "error",
      };
    }

    if (job.status !== "complete") {
      return {
        status: job.status,
        progress: job.progress,
        message: job.message,
        jobId,
      };
    }

    // Return full result if complete
    return job.result;
  }

  /**
   * Update job progress
   * @param {string} jobId - Job ID
   * @param {number} progress - Progress 0-100
   * @param {string} message - Status message
   */
  updateProgress(jobId, progress, message) {
    const job = this.jobs.get(jobId);

    if (!job) {
      console.warn(`[JobQueue] Attempted to update non-existent job ${jobId}`);
      return;
    }

    job.progress = Math.min(100, Math.max(0, progress));
    job.message = message;
    console.log(`[JobQueue] ${jobId} progress: ${job.progress}% - ${message}`);
  }

  /**
   * Mark job as complete
   * @param {string} jobId - Job ID
   * @param {Object} result - Complete result object
   */
  completeJob(jobId, result) {
    const job = this.jobs.get(jobId);

    if (!job) {
      console.warn(
        `[JobQueue] Attempted to complete non-existent job ${jobId}`
      );
      return;
    }

    job.status = "complete";
    job.progress = 100;
    job.result = result;
    job.completedAt = Date.now();
    job.message = "Complete";
    console.log(
      `[JobQueue] ${jobId} completed in ${Date.now() - job.startTime}ms`
    );
  }

  /**
   * Mark job as failed
   * @param {string} jobId - Job ID
   * @param {string} error - Error message
   */
  failJob(jobId, error) {
    const job = this.jobs.get(jobId);

    if (!job) {
      console.warn(`[JobQueue] Attempted to fail non-existent job ${jobId}`);
      return;
    }

    job.status = "error";
    job.error = error;
    job.completedAt = Date.now();
    job.message = `Error: ${error}`;
    console.log(`[JobQueue] ${jobId} failed: ${error}`);
  }

  /**
   * Start periodic cleanup of old jobs
   */
  startCleanupScheduler() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldJobs();
    }, this.cleanupInterval);

    console.log(
      `[JobQueue] Started cleanup scheduler (interval: ${this.cleanupInterval}ms, max age: ${this.maxJobAge}ms)`
    );
  }

  /**
   * Remove jobs older than maxJobAge
   */
  cleanupOldJobs() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.completedAt && now - job.completedAt > this.maxJobAge) {
        this.jobs.delete(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[JobQueue] Cleanup: removed ${cleanedCount} old jobs`);
    }
  }

  /**
   * Stop the cleanup scheduler
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      console.log(`[JobQueue] Stopped cleanup scheduler`);
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const stats = {
      totalJobs: this.jobs.size,
      processing: 0,
      complete: 0,
      error: 0,
    };

    for (const job of this.jobs.values()) {
      stats[job.status] = (stats[job.status] || 0) + 1;
    }

    return stats;
  }
}

// Export singleton instance
module.exports = new JobQueueManager();
