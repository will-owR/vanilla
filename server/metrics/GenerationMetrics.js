// In-memory GenerationMetrics implementation with TTL and cleanup
// Follows the module spec in BATCH_OPTIMIZATION_MODULE_SPECS.md
// Phase 4 enhancements: 7-day TTL, automatic cleanup, quality flags
class GenerationMetrics {
  constructor() {
    this.sessions = new Map();
    // Try to lazily initialize Prisma client for optional persistence
    this.prisma = null;
    try {
      const { PrismaClient } = require("@prisma/client");
      this.prisma = new PrismaClient();
    } catch (e) {
      // Prisma not available or not configured in this environment — that's fine.
      this.prisma = null;
    }

    // Phase 4: 7-day TTL for sessions (ms)
    this.SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Start background cleanup on first instantiation
    this._startCleanupScheduler();
  }

  _startCleanupScheduler() {
    // Run cleanup every 24 hours
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
    if (!global.__METRICS_CLEANUP_SCHEDULED) {
      global.__METRICS_CLEANUP_SCHEDULED = true;
      setInterval(() => {
        try {
          const expired = this.cleanupExpiredSessions();
          if (expired > 0) {
            console.log(
              `[GenerationMetrics] Cleaned up ${expired} expired sessions`
            );
          }
        } catch (e) {
          console.warn(
            "[GenerationMetrics] Cleanup error (non-fatal):",
            e.message
          );
        }
      }, CLEANUP_INTERVAL);
    }
  }

  startSession(sessionId, ebookMetadata) {
    if (!sessionId || typeof sessionId !== "string") {
      throw new Error("SESSION_INVALID_ID: sessionId must be non-empty string");
    }
    if (this.sessions.has(sessionId)) {
      throw new Error("SESSION_DUPLICATE: sessionId already started");
    }
    if (!ebookMetadata || typeof ebookMetadata.pageCount !== "number") {
      throw new Error("METADATA_MISSING: ebookMetadata must have pageCount");
    }

    const now = Date.now();
    this.sessions.set(sessionId, {
      sessionId,
      startTime: now,
      ebookMetadata,
      structure: null,
      batches: [],
      individual: [],
      fallbacks: [],
      totalDuration: null,
      summary: null,
    });

    // Persist session in DB if Prisma is available (best-effort)
    if (this.prisma) {
      try {
        this.prisma.metricsSession
          .create({
            data: {
              sessionId,
              startTime: new Date(now),
              ebookMetadata: ebookMetadata,
            },
          })
          .catch(() => {});
      } catch (e) {
        // swallow DB errors — metrics must remain non-fatal
      }
    }
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  finalizeSession(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error("SESSION_NOT_FOUND: sessionId not found");
    s.totalDuration = Date.now() - s.startTime;
    s.summary = this._computeSummary(s);
    // Persist finalize info (best-effort)
    if (this.prisma) {
      try {
        this.prisma.metricsSession
          .update({
            where: { sessionId },
            data: {
              endTime: new Date(Date.now()),
              summary: s.summary,
            },
          })
          .catch(() => {});
      } catch (e) {
        // ignore
      }
    }
    return s;
  }

  recordStructureGeneration(sessionId, result) {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error("SESSION_NOT_FOUND: sessionId not started");
    s.structure = { ...(result || {}), timestamp: new Date().toISOString() };
    if (this.prisma) {
      try {
        this.prisma.metricsEvent
          .create({
            data: {
              sessionId,
              type: "structure",
              payload: result || {},
            },
          })
          .catch(() => {});
      } catch (e) {}
    }
  }

  recordBatchSuccess(sessionId, batchLog) {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error("SESSION_NOT_FOUND: sessionId not started");
    s.batches.push({ ...batchLog, recordedAt: new Date().toISOString() });
    if (this.prisma) {
      try {
        this.prisma.metricsEvent
          .create({
            data: {
              sessionId,
              type: "batch_success",
              payload: batchLog || {},
            },
          })
          .catch(() => {});
      } catch (e) {}
    }
  }

  recordBatchFailure(sessionId, batchLog) {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error("SESSION_NOT_FOUND: sessionId not started");
    s.batches.push({ ...batchLog, recordedAt: new Date().toISOString() });
    if (this.prisma) {
      try {
        this.prisma.metricsEvent
          .create({
            data: {
              sessionId,
              type: "batch_failure",
              payload: batchLog || {},
            },
          })
          .catch(() => {});
      } catch (e) {}
    }
  }

  recordBatchPartialFailure(sessionId, batchLog) {
    this.recordBatchFailure(sessionId, batchLog);
  }

  recordIndividualChapter(sessionId, chapterLog) {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error("SESSION_NOT_FOUND: sessionId not started");
    s.individual.push({ ...chapterLog, timestamp: new Date().toISOString() });
    if (this.prisma) {
      try {
        this.prisma.metricsEvent
          .create({
            data: {
              sessionId,
              type: "individual",
              payload: chapterLog || {},
            },
          })
          .catch(() => {});
      } catch (e) {}
    }
  }

  recordFallback(sessionId, chapterNumber, reason) {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error("SESSION_NOT_FOUND: sessionId not started");
    s.fallbacks.push({ chapter: chapterNumber, reason, timestamp: Date.now() });
    if (this.prisma) {
      try {
        this.prisma.metricsEvent
          .create({
            data: {
              sessionId,
              type: "fallback",
              payload: { chapter: chapterNumber, reason },
            },
          })
          .catch(() => {});
      } catch (e) {}
    }
  }

  generateReport(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error("SESSION_NOT_FOUND: sessionId not found");
    // Ensure session finalized
    if (!s.summary) this.finalizeSession(sessionId);
    const report = {
      sessionId: s.sessionId,
      timestamp: new Date().toISOString(),
      ebook: s.ebookMetadata,
      timeline: {
        startTime: new Date(s.startTime).toISOString(),
        totalDurationMs: s.totalDuration,
        structureTime: s.structure ? s.structure.duration || null : null,
        chapterGenTime:
          (s.batches || []).reduce((a, b) => a + (b.duration || 0), 0) +
          (s.individual || []).reduce((a, b) => a + (b.duration || 0), 0),
      },
      results: {
        totalChapters: s.ebookMetadata.pageCount,
        batchCount: s.batches.length,
        individualCount: s.individual.length,
        fallbackCount: s.fallbacks.length,
      },
      performance: {
        avgBatchDuration: this._avg(s.batches.map((b) => b.duration)),
        avgIndividualDuration: this._avg(s.individual.map((i) => i.duration)),
        totalApiCalls: s.batches.length + s.individual.length + 1, // +1 for structure
        estimatedQuotaUsage: `${
          s.batches.length + s.individual.length + 1
        } calls`,
        latency: this._computeLatencyMetrics(s), // Phase 4: Latency p50, p95, p99
      },
      quality: {
        batchSuccessRate: this._batchSuccessRate(s),
        factuality: this._computeFactualityScore(s), // Phase 4: Content quality
        errorRateByType: this._computeErrorRateByType(s), // Phase 4: Error categorization
        failureFlags: [],
      },
      details: {
        structure: s.structure,
        batches: s.batches,
        individual: s.individual,
        fallbacks: s.fallbacks,
      },
    };
    return report;
  }

  generateCsvReport(sessionIds) {
    // Accept array or number (days) or undefined
    const rows = [];
    const ids = Array.isArray(sessionIds)
      ? sessionIds
      : Array.from(this.sessions.keys());
    for (const id of ids) {
      const s = this.sessions.get(id);
      if (!s) continue;
      const totalApiCalls =
        s.batches.length + s.individual.length + (s.structure ? 1 : 0);
      rows.push({
        sessionId: id,
        pageCount: s.ebookMetadata.pageCount,
        durationMs: s.totalDuration || Date.now() - s.startTime,
        batchCount: s.batches.length,
        individualCount: s.individual.length,
        fallbackCount: s.fallbacks.length,
        totalApiCalls,
      });
    }
    // Build CSV
    const header = Object.keys(rows[0] || {}).join(",") + "\n";
    const lines = rows.map((r) => Object.values(r).join(",")).join("\n");
    return header + lines;
  }

  getStats(filter) {
    // Simple aggregation: filter by pageCount if provided
    const sessions = Array.from(this.sessions.values()).filter((s) => {
      if (!filter) return true;
      if (filter.pageCount && s.ebookMetadata.pageCount !== filter.pageCount)
        return false;
      return true;
    });
    const total = sessions.length;
    const avgDuration = this._avg(
      sessions.map((s) => s.totalDuration || Date.now() - s.startTime)
    );
    const avgApiCalls = this._avg(
      sessions.map(
        (s) => s.batches.length + s.individual.length + (s.structure ? 1 : 0)
      )
    );
    return { totalSessions: total, avgDurationMs: avgDuration, avgApiCalls };
  }

  // Phase 4: Cleanup expired sessions (7-day TTL)
  cleanupExpiredSessions(ttlMs) {
    const ttl = ttlMs || this.SESSION_TTL_MS;
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      const age = now - session.startTime;
      if (age > ttl) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // Phase 4: Check if session has expired
  isSessionExpired(sessionId, ttlMs) {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    const ttl = ttlMs || this.SESSION_TTL_MS;
    return Date.now() - s.startTime > ttl;
  }

  // Helpers
  _avg(arr) {
    const nums = arr.filter((n) => typeof n === "number" && !Number.isNaN(n));
    if (nums.length === 0) return null;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  }

  _computeSummary(s) {
    return {
      totalChapters: s.ebookMetadata.pageCount,
      batchCount: s.batches.length,
      individualCount: s.individual.length,
      fallbackCount: s.fallbacks.length,
    };
  }

  _batchSuccessRate(s) {
    if (!s.batches || s.batches.length === 0) return "N/A";
    const successes = s.batches.filter((b) => b.status === "success").length;
    return `${Math.round((successes / s.batches.length) * 100)}%`;
  }

  // Phase 4: Latency metrics (p50, p95, p99)
  _computeLatencyMetrics(s) {
    const durations = [
      ...(s.batches || []).map((b) => b.duration || 0),
      ...(s.individual || []).map((i) => i.duration || 0),
    ].filter((d) => typeof d === "number" && d > 0);

    if (durations.length === 0) {
      return { p50: null, p95: null, p99: null };
    }

    const sorted = durations.sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  // Phase 4: Factuality/Faithfulness score (content quality)
  // Approximation: lower fallback rate + higher success rate = better factuality
  _computeFactualityScore(s) {
    const totalOps = (s.batches || []).length + (s.individual || []).length;
    if (totalOps === 0) return null;

    const successes = (s.batches || []).filter(
      (b) => b.status === "success"
    ).length;
    const fallbackCount = (s.fallbacks || []).length;

    // Factuality score: (successes - fallbacks) / total ops, normalized to 0-100
    const score = ((successes - fallbackCount) / totalOps) * 100;
    return Math.max(0, Math.round(score));
  }

  // Phase 4: Error rate by type (categorized errors)
  _computeErrorRateByType(s) {
    const errorCounts = {
      network_errors: 0,
      timeout_errors: 0,
      rate_limit_errors: 0,
      parse_errors: 0,
      other_errors: 0,
      total_errors: 0,
    };

    // Analyze batches and individual records for error patterns
    const allOps = [...(s.batches || []), ...(s.individual || [])];

    for (const op of allOps) {
      // Look for error indicators in status or error fields
      if (op.status === "failed" || op.error) {
        errorCounts.total_errors++;

        // Categorize by error message or type
        const errorMsg = (op.error || "").toLowerCase();
        if (errorMsg.includes("network") || errorMsg.includes("econnrefused")) {
          errorCounts.network_errors++;
        } else if (
          errorMsg.includes("timeout") ||
          errorMsg.includes("etimedout")
        ) {
          errorCounts.timeout_errors++;
        } else if (errorMsg.includes("429") || errorMsg.includes("rate")) {
          errorCounts.rate_limit_errors++;
        } else if (errorMsg.includes("parse") || errorMsg.includes("json")) {
          errorCounts.parse_errors++;
        } else {
          errorCounts.other_errors++;
        }
      }
    }

    const totalOps = allOps.length || 1;
    return {
      total_errors: errorCounts.total_errors,
      error_rate_percent: Math.round(
        (errorCounts.total_errors / totalOps) * 100
      ),
      breakdown: {
        network_errors: errorCounts.network_errors,
        timeout_errors: errorCounts.timeout_errors,
        rate_limit_errors: errorCounts.rate_limit_errors,
        parse_errors: errorCounts.parse_errors,
        other_errors: errorCounts.other_errors,
      },
    };
  }
}

// Ensure singleton across module load variants (CJS/ESM interop)
if (!global.__GENERATION_METRICS_SINGLETON) {
  global.__GENERATION_METRICS_SINGLETON = new GenerationMetrics();
}

module.exports = global.__GENERATION_METRICS_SINGLETON;
