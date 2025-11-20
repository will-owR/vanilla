/**
 * exportQueue.js — In-memory job queue with SQLite fallback
 *
 * Manages async export job queueing with a two-tier strategy:
 * 1. In-memory Map for fast access (limit: 100 jobs)
 * 2. SQLite fallback when in-memory is full (for persistence across requests)
 *
 * This provides graceful degradation: fast for typical load, persistent for surge.
 */

const fs = require("fs").promises;
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");

/**
 * SQLite fallback database for when in-memory queue is full
 * Creates simple jobs table with jobId, resultId, status, progress, createdAt
 */
async function initFallbackDb(dbPath = null) {
  const resolvedPath =
    dbPath || path.join(process.cwd(), "data", "export-jobs-fallback.db");

  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(resolvedPath, (err) => {
      if (err) return reject(err);

      // Create fallback jobs table if not exists
      db.run(
        `
        CREATE TABLE IF NOT EXISTS export_jobs_fallback (
          jobId TEXT PRIMARY KEY,
          resultId TEXT NOT NULL,
          status TEXT DEFAULT 'queued',
          progress INTEGER DEFAULT 0,
          pdfPath TEXT,
          errorMessage TEXT,
          createdAt INTEGER NOT NULL,
          completedAt INTEGER
        )
      `,
        (err) => {
          if (err) return reject(err);
          resolve(db);
        }
      );
    });
  });
}

/**
 * Promisified SQLite methods
 */
function promisifyDb(db) {
  return {
    run: promisify((sql, params, cb) => db.run(sql, params, cb)),
    get: promisify((sql, params, cb) => db.get(sql, params, cb)),
    all: promisify((sql, params, cb) => db.all(sql, params, cb)),
    close: promisify((cb) => db.close(cb)),
  };
}

class ExportQueue {
  constructor() {
    this.jobs = new Map(); // jobId -> { status, progress, resultId, createdAt, pdfPath?, errorMessage? }
    this.MAX_IN_MEMORY = 100;
    this.fallbackDb = null;
    this.fallbackDbPath = null;
  }

  /**
   * Initialize fallback database (async)
   */
  async initialize(dbPath = null) {
    try {
      this.fallbackDbPath =
        dbPath || path.join(process.cwd(), "data", "export-jobs-fallback.db");
      this.fallbackDb = await initFallbackDb(this.fallbackDbPath);
      console.log(
        "ExportQueue fallback database initialized at",
        this.fallbackDbPath
      );
    } catch (err) {
      console.warn(
        "ExportQueue fallback database initialization failed:",
        err.message
      );
      // Continue without fallback; queue will only use in-memory
    }
  }

  /**
   * Enqueue a job: store in memory or fallback
   * @param {string} jobId - UUID of the job
   * @param {string} resultId - UUID of the result to export
   * @returns {Promise<void>}
   */
  async enqueue(jobId, resultId) {
    if (!jobId || !resultId) {
      throw new Error("jobId and resultId are required");
    }

    const now = Date.now();

    // Try in-memory first
    if (this.jobs.size < this.MAX_IN_MEMORY) {
      this.jobs.set(jobId, {
        status: "queued",
        progress: 0,
        resultId,
        createdAt: now,
      });
      console.log(
        `Job ${jobId} queued in memory (${this.jobs.size}/${this.MAX_IN_MEMORY})`
      );
      return;
    }

    // Fallback: use SQLite
    if (this.fallbackDb) {
      try {
        const db = promisifyDb(this.fallbackDb);
        await db.run(
          `
          INSERT INTO export_jobs_fallback 
          (jobId, resultId, status, progress, createdAt) 
          VALUES (?, ?, 'queued', 0, ?)
        `,
          [jobId, resultId, now]
        );
        console.log(`Job ${jobId} queued in fallback (in-memory full)`);
        return;
      } catch (err) {
        console.error("Failed to enqueue in fallback:", err.message);
        throw new Error(
          `Export queue full and fallback unavailable: ${err.message}`
        );
      }
    }

    // No fallback available
    throw new Error(
      "Export queue full (100 jobs) and fallback database unavailable"
    );
  }

  /**
   * Get a job by jobId
   * @param {string} jobId - UUID of the job
   * @returns {Promise<Object|null>}
   */
  async getJob(jobId) {
    // Check in-memory first
    if (this.jobs.has(jobId)) {
      return this.jobs.get(jobId);
    }

    // Check fallback
    if (this.fallbackDb) {
      try {
        const db = promisifyDb(this.fallbackDb);
        const row = await db.get(
          "SELECT * FROM export_jobs_fallback WHERE jobId = ?",
          [jobId]
        );
        return row || null;
      } catch (err) {
        console.error("Failed to get job from fallback:", err.message);
        return null;
      }
    }

    return null;
  }

  /**
   * Update a job (status, progress, pdfPath, errorMessage, etc.)
   * @param {string} jobId - UUID of the job
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  async updateJob(jobId, updates) {
    if (!jobId) {
      throw new Error("jobId is required");
    }

    // Check if in-memory
    if (this.jobs.has(jobId)) {
      const job = this.jobs.get(jobId);
      this.jobs.set(jobId, { ...job, ...updates });
      return;
    }

    // Try fallback
    if (this.fallbackDb) {
      try {
        const db = promisifyDb(this.fallbackDb);
        const fields = Object.keys(updates)
          .map((k) => `${k} = ?`)
          .join(", ");
        const values = Object.values(updates);
        await db.run(
          `UPDATE export_jobs_fallback SET ${fields} WHERE jobId = ?`,
          [...values, jobId]
        );
        return;
      } catch (err) {
        console.error("Failed to update job in fallback:", err.message);
        throw err;
      }
    }

    throw new Error(`Job ${jobId} not found in queue`);
  }

  /**
   * Get all queued jobs (in-memory + fallback)
   * @param {number} limit - Max number of jobs to return
   * @returns {Promise<Array>}
   */
  async getQueuedJobs(limit = 10) {
    const queued = [];

    // Get from in-memory
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === "queued" && queued.length < limit) {
        queued.push({ jobId, ...job });
      }
    }

    // If we still need more, check fallback
    if (queued.length < limit && this.fallbackDb) {
      try {
        const db = promisifyDb(this.fallbackDb);
        const remaining = limit - queued.length;
        const rows = await db.all(
          "SELECT jobId, resultId, status, progress, createdAt FROM export_jobs_fallback WHERE status = 'queued' LIMIT ?",
          [remaining]
        );
        if (rows) {
          queued.push(...rows);
        }
      } catch (err) {
        console.warn("Failed to get queued jobs from fallback:", err.message);
      }
    }

    return queued;
  }

  /**
   * Delete an expired job (remove from memory and fallback)
   * @param {string} jobId - UUID of the job
   * @returns {Promise<void>}
   */
  async deleteJob(jobId) {
    // Remove from in-memory
    this.jobs.delete(jobId);

    // Remove from fallback
    if (this.fallbackDb) {
      try {
        const db = promisifyDb(this.fallbackDb);
        await db.run("DELETE FROM export_jobs_fallback WHERE jobId = ?", [
          jobId,
        ]);
      } catch (err) {
        console.warn("Failed to delete job from fallback:", err.message);
      }
    }
  }

  /**
   * Delete all jobs older than cutoffMs (24 hours by default)
   * @param {number} cutoffMs - Age threshold in milliseconds
   * @returns {Promise<{inMemory: number, fallback: number}>}
   */
  async deleteExpiredJobs(cutoffMs = 24 * 60 * 60 * 1000) {
    const cutoffTime = Date.now() - cutoffMs;
    const deleted = { inMemory: 0, fallback: 0 };

    // Delete from in-memory
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < cutoffTime) {
        this.jobs.delete(jobId);
        deleted.inMemory++;
      }
    }

    // Delete from fallback
    if (this.fallbackDb) {
      try {
        const db = promisifyDb(this.fallbackDb);
        const result = await db.run(
          "DELETE FROM export_jobs_fallback WHERE createdAt < ?",
          [Math.floor(cutoffTime)]
        );
        // SQLite doesn't return row count via promisified callback, so we estimate
        deleted.fallback = result?.changes || 0;
      } catch (err) {
        console.warn(
          "Failed to delete expired jobs from fallback:",
          err.message
        );
      }
    }

    return deleted;
  }

  /**
   * Get queue statistics
   * @returns {Promise<{inMemory: number, fallback: number, total: number}>}
   */
  async getStats() {
    const stats = {
      inMemory: this.jobs.size,
      fallback: 0,
      total: this.jobs.size,
    };

    if (this.fallbackDb) {
      try {
        const db = promisifyDb(this.fallbackDb);
        const result = await db.get(
          "SELECT COUNT(*) as count FROM export_jobs_fallback"
        );
        stats.fallback = result?.count || 0;
        stats.total = stats.inMemory + stats.fallback;
      } catch (err) {
        console.warn("Failed to get fallback queue stats:", err.message);
      }
    }

    return stats;
  }

  /**
   * Close the fallback database
   * @returns {Promise<void>}
   */
  async close() {
    if (this.fallbackDb) {
      try {
        const db = promisifyDb(this.fallbackDb);
        await db.close();
        this.fallbackDb = null;
        console.log("ExportQueue fallback database closed");
      } catch (err) {
        console.warn("Error closing fallback database:", err.message);
      }
    }
  }
}

// Singleton instance
const exportQueue = new ExportQueue();

module.exports = exportQueue;
