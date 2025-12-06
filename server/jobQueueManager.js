/**
 * Job Queue Manager
 *
 * Manages background ebook generation jobs using polling model
 * - Accepts generation requests and returns immediately with jobId
 * - Tracks job progress and status (processing, deferred, complete, error)
 * - Stores completed results for retrieval
 * - Implements cleanup for old jobs
 * - Integrates with quota tracker to defer jobs during API quota limits
 */

const { v4: uuidv4 } = require("uuid");
const { quotaTracker } = require("./geminiClient");

class JobQueueManager {
  constructor() {
    this.jobs = new Map(); // jobId → job state
    this.deferredQueue = []; // jobIds waiting to be resumed after quota cooldown
    this.cleanupInterval = 60000; // Clean up old jobs every 60 seconds
    this.maxJobAge = 3600000; // Keep jobs for 1 hour after completion
    this.maxQueueSize = 50; // Prevent unbounded queue growth
    this.deferralCheckInterval = 5000; // Check deferred jobs every 5 seconds
    this.startCleanupScheduler();
    this.startDeferralProcessor();
  }

  /**
   * Create a new job for ebook generation
   * Checks quota status and defers job if needed
   * @param {Object} params - Generation parameters {prompt, pageCount, theme, colorPalette, fontSizeScale}
   * @returns {Object} - {jobId, statusUrl, resultUrl, deferred?, deferredUntil?, message?}
   */
  createJob(params) {
    const jobId = uuidv4();

    // Check if we should defer this job due to quota
    const quotaStatus = quotaTracker.getStatus();
    const shouldDefer = quotaStatus.percentUsed >= 90 || quotaStatus.isPaused;

    let status = "processing";
    let deferredUntil = null;
    let deferralReason = null;
    let deferralMessage = null;

    if (shouldDefer) {
      // Check queue size to prevent unbounded growth
      if (this.deferredQueue.length >= this.maxQueueSize) {
        return {
          jobId: null,
          error: `Queue is full (${this.maxQueueSize} jobs waiting). Try again in a few minutes.`,
          statusCode: 503,
        };
      }

      status = "deferred";
      deferredUntil = quotaStatus.pauseUntil || Date.now() + 65000;
      deferralReason = "quota_cooldown";
      deferralMessage =
        `Quota limit reached (${quotaStatus.callCount}/${quotaStatus.limit}). ` +
        `Your request will start in ~${quotaStatus.secondsUntilReset}s.`;

      this.deferredQueue.push(jobId);
      console.log(`[JobQueue] Job ${jobId} deferred: ${deferralMessage}`);
    }

    const job = {
      jobId,
      status,
      progress: 0,
      startTime: Date.now(),
      completedAt: null,
      result: null,
      error: null,
      message:
        status === "deferred"
          ? deferralMessage
          : "Initializing ebook generation...",
      deferredUntil,
      deferralReason,
      params,
    };

    this.jobs.set(jobId, job);
    console.log(`[JobQueue] Created job ${jobId}, status: ${status}`);

    return {
      jobId,
      statusUrl: `/api/ebook/generate/${jobId}/status`,
      resultUrl: `/api/ebook/${jobId}`,
      deferred: shouldDefer,
      deferredUntil,
      message: deferralMessage,
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
      deferred: 0,
    };

    for (const job of this.jobs.values()) {
      stats[job.status] = (stats[job.status] || 0) + 1;
    }

    return stats;
  }

  /**
   * Start periodic processor to resume deferred jobs when quota available
   */
  startDeferralProcessor() {
    this.deferralTimer = setInterval(() => {
      this.processDeferredQueue();
    }, this.deferralCheckInterval);

    console.log(
      `[JobQueue] Started deferral processor (check every ${this.deferralCheckInterval}ms)`
    );
  }

  /**
   * Check if any deferred jobs can be resumed
   * Resume jobs whose deferralUntil time has passed and quota is available
   */
  processDeferredQueue() {
    if (this.deferredQueue.length === 0) return;

    const quotaStatus = quotaTracker.getStatus();
    const now = Date.now();
    const toResume = [];

    for (const jobId of this.deferredQueue) {
      const job = this.jobs.get(jobId);
      if (!job) continue;

      const canResume =
        !quotaStatus.isPaused && job.deferredUntil && now >= job.deferredUntil;

      if (canResume) {
        toResume.push(jobId);
        job.status = "processing";
        job.deferredUntil = null;
        job.message =
          "Starting ebook generation (resumed from quota cooldown)...";
        console.log(`[JobQueue] Job ${jobId} resumed from deferral`);
      }
    }

    // Remove resumed jobs from deferred queue
    for (const jobId of toResume) {
      const idx = this.deferredQueue.indexOf(jobId);
      if (idx !== -1) {
        this.deferredQueue.splice(idx, 1);
      }
    }

    if (toResume.length > 0) {
      console.log(
        `[JobQueue] Resumed ${toResume.length} deferred jobs. ` +
          `${this.deferredQueue.length} jobs still deferred.`
      );
    }
  }

  /**
   * Stop the deferral processor
   */
  stopDeferralProcessor() {
    if (this.deferralTimer) {
      clearInterval(this.deferralTimer);
      console.log("[JobQueue] Stopped deferral processor");
    }
  }
}

// Export singleton instance
module.exports = new JobQueueManager();
