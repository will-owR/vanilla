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
