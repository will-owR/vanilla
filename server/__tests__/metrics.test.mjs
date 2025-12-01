import { describe, it, expect, beforeEach } from "vitest";
import METRICS from "../metrics/GenerationMetrics.js";

describe("GenerationMetrics basic operations", () => {
  beforeEach(() => {
    // Reset internal map by creating a fresh instance module cache clear
    // But simplest: use a unique sessionId per test
  });

  it("should start and finalize a session", () => {
    const sid = `sess-${Date.now()}`;
    METRICS.startSession(sid, {
      pageCount: 8,
      title: "T",
      theme: "demo",
      colorPalette: "d",
    });
    METRICS.recordStructureGeneration(sid, {
      duration: 1200,
      model: "gemini-2.5-pro",
    });
    METRICS.recordBatchSuccess(sid, {
      batchNumber: 1,
      chapters: [2, 3, 4],
      status: "success",
      duration: 3000,
      timestamp: new Date(),
      attempts: 1,
    });
    METRICS.recordIndividualChapter(sid, {
      chapter: 1,
      status: "success",
      duration: 500,
      timestamp: new Date(),
      reason: "boundary_chapter",
    });
    METRICS.recordFallback(sid, 5, "timeout");
    const report = METRICS.generateReport(sid);
    expect(report.sessionId).toBe(sid);
    expect(report.results.totalChapters).toBe(8);
    expect(report.results.batchCount).toBe(1);
    expect(report.results.fallbackCount).toBe(1);
  });

  it("should generate CSV report", () => {
    const sid = `sess-csv-${Date.now()}`;
    METRICS.startSession(sid, {
      pageCount: 3,
      title: "C",
      theme: "t",
      colorPalette: "d",
    });
    METRICS.recordBatchSuccess(sid, {
      batchNumber: 0,
      chapters: [2],
      status: "success",
      duration: 100,
      timestamp: new Date(),
      attempts: 1,
    });
    const csv = METRICS.generateCsvReport([sid]);
    expect(csv).toContain("sessionId");
    expect(csv).toContain(sid);
  });
});

describe("GenerationMetrics Phase 4: TTL and Cleanup", () => {
  it("should detect expired sessions based on TTL", async () => {
    const sid = `sess-expire-${Date.now()}`;
    METRICS.startSession(sid, {
      pageCount: 4,
      title: "Expire Test",
      theme: "demo",
      colorPalette: "d",
    });

    // Session is fresh, not expired
    expect(METRICS.isSessionExpired(sid, 1000)).toBe(false);

    // Wait a bit and then check with very short TTL
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(METRICS.isSessionExpired(sid, 5)).toBe(true);
  });
  it("should cleanup expired sessions", () => {
    const sid1 = `sess-cleanup1-${Date.now()}`;
    const sid2 = `sess-cleanup2-${Date.now()}`;

    METRICS.startSession(sid1, {
      pageCount: 2,
      title: "Old",
      theme: "demo",
      colorPalette: "d",
    });

    // Artificially age the first session
    const session1 = METRICS.getSession(sid1);
    session1.startTime = Date.now() - 100; // 100ms old

    METRICS.startSession(sid2, {
      pageCount: 2,
      title: "New",
      theme: "demo",
      colorPalette: "d",
    });

    const cleaned = METRICS.cleanupExpiredSessions(50); // TTL of 50ms
    expect(cleaned).toBeGreaterThanOrEqual(1); // At least sid1 cleaned
    expect(METRICS.getSession(sid1)).toBeUndefined(); // sid1 should be gone
    expect(METRICS.getSession(sid2)).toBeDefined(); // sid2 should remain
  });
});

describe("GenerationMetrics Phase 4: Quality Flags", () => {
  it("should compute latency metrics (p50, p95, p99)", () => {
    const sid = `sess-latency-${Date.now()}`;
    METRICS.startSession(sid, {
      pageCount: 5,
      title: "Latency Test",
      theme: "demo",
      colorPalette: "d",
    });

    // Record operations with various durations
    METRICS.recordBatchSuccess(sid, {
      batchNumber: 0,
      chapters: [2, 3],
      status: "success",
      duration: 1000,
      timestamp: new Date(),
      attempts: 1,
    });
    METRICS.recordBatchSuccess(sid, {
      batchNumber: 1,
      chapters: [4, 5],
      status: "success",
      duration: 2000,
      timestamp: new Date(),
      attempts: 1,
    });
    METRICS.recordIndividualChapter(sid, {
      chapter: 1,
      status: "success",
      duration: 500,
      timestamp: new Date(),
      reason: "boundary",
    });

    const report = METRICS.generateReport(sid);
    expect(report.performance.latency).toBeDefined();
    expect(report.performance.latency.p50).toBeDefined();
    expect(report.performance.latency.p95).toBeDefined();
    expect(report.performance.latency.p99).toBeDefined();
    expect(report.performance.latency.p50).toBeGreaterThan(0);
  });

  it("should compute factuality/faithfulness score", () => {
    const sid = `sess-factuality-${Date.now()}`;
    METRICS.startSession(sid, {
      pageCount: 5,
      title: "Factuality Test",
      theme: "demo",
      colorPalette: "d",
    });

    // Record mostly successful operations
    METRICS.recordBatchSuccess(sid, {
      batchNumber: 0,
      chapters: [2, 3, 4],
      status: "success",
      duration: 2000,
      timestamp: new Date(),
      attempts: 1,
    });
    METRICS.recordIndividualChapter(sid, {
      chapter: 1,
      status: "success",
      duration: 500,
      timestamp: new Date(),
      reason: "boundary",
    });
    // Only one fallback
    METRICS.recordFallback(sid, 5, "api_timeout");

    const report = METRICS.generateReport(sid);
    expect(report.quality.factuality).toBeDefined();
    expect(report.quality.factuality).toBeGreaterThanOrEqual(0);
    expect(report.quality.factuality).toBeLessThanOrEqual(100);
  });

  it("should compute error rate by type", () => {
    const sid = `sess-errors-${Date.now()}`;
    METRICS.startSession(sid, {
      pageCount: 4,
      title: "Error Rate Test",
      theme: "demo",
      colorPalette: "d",
    });

    // Record mixed success and failure operations
    METRICS.recordBatchSuccess(sid, {
      batchNumber: 0,
      chapters: [2, 3],
      status: "success",
      duration: 1500,
      timestamp: new Date(),
      attempts: 1,
    });
    METRICS.recordIndividualChapter(sid, {
      chapter: 1,
      status: "success",
      duration: 400,
      timestamp: new Date(),
      reason: "boundary",
    });

    const report = METRICS.generateReport(sid);
    expect(report.quality.errorRateByType).toBeDefined();
    expect(report.quality.errorRateByType.total_errors).toBeGreaterThanOrEqual(
      0
    );
    expect(
      report.quality.errorRateByType.error_rate_percent
    ).toBeGreaterThanOrEqual(0);
    expect(report.quality.errorRateByType.breakdown).toBeDefined();
    expect(
      report.quality.errorRateByType.breakdown.network_errors
    ).toBeGreaterThanOrEqual(0);
  });
});
