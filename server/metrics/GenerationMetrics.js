// Simple in-memory GenerationMetrics implementation (CJS)
// Follows the module spec in BATCH_OPTIMIZATION_MODULE_SPECS.md
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
      },
      quality: {
        batchSuccessRate: this._batchSuccessRate(s),
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
}

// Ensure singleton across module load variants (CJS/ESM interop)
if (!global.__GENERATION_METRICS_SINGLETON) {
  global.__GENERATION_METRICS_SINGLETON = new GenerationMetrics();
}

module.exports = global.__GENERATION_METRICS_SINGLETON;
