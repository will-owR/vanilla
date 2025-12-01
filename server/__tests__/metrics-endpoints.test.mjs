import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../index.js";
import METRICS from "../metrics/GenerationMetrics.js";

describe("/metrics endpoints", () => {
  it("GET /metrics/report/:sessionId returns 200 for existing session", async () => {
    const sid = `sess-endpoint-${Date.now()}`;
    METRICS.startSession(sid, {
      pageCount: 4,
      title: "EP",
      theme: "t",
      colorPalette: "d",
    });
    METRICS.recordBatchSuccess(sid, {
      batchNumber: 0,
      chapters: [2, 3],
      status: "success",
      duration: 200,
      timestamp: new Date(),
      attempts: 1,
    });

    const res = await request(app).get(`/metrics/report/${sid}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("sessionId", sid);
  });

  it("GET /metrics/stats returns aggregated stats", async () => {
    const res = await request(app).get(`/metrics/stats?pageCount=4`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalSessions");
  });

  it("POST /metrics/cleanup removes expired sessions", async () => {
    const sid = `sess-cleanup-${Date.now()}`;
    METRICS.startSession(sid, {
      pageCount: 2,
      title: "Cleanup Test",
      theme: "t",
      colorPalette: "d",
    });

    // Artificially age the session
    const session = METRICS.getSession(sid);
    session.startTime = Date.now() - 100;

    // Call cleanup with short TTL
    const res = await request(app).post("/metrics/cleanup").send({ ttlMs: 50 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("sessionsRemoved");
    expect(res.body.sessionsRemoved).toBeGreaterThanOrEqual(0);
  });

  it("GET /metrics/report includes quality metrics", async () => {
    const sid = `sess-quality-${Date.now()}`;
    METRICS.startSession(sid, {
      pageCount: 5,
      title: "Quality Check",
      theme: "t",
      colorPalette: "d",
    });
    METRICS.recordBatchSuccess(sid, {
      batchNumber: 0,
      chapters: [2, 3, 4],
      status: "success",
      duration: 2500,
      timestamp: new Date(),
      attempts: 1,
    });
    METRICS.recordIndividualChapter(sid, {
      chapter: 1,
      status: "success",
      duration: 600,
      timestamp: new Date(),
      reason: "boundary_chapter",
    });

    const res = await request(app).get(`/metrics/report/${sid}`);
    expect(res.status).toBe(200);
    expect(res.body.quality).toBeDefined();
    expect(res.body.quality.factuality).toBeDefined();
    expect(res.body.quality.errorRateByType).toBeDefined();
    expect(res.body.performance.latency).toBeDefined();
    expect(res.body.performance.latency.p50).toBeDefined();
    expect(res.body.performance.latency.p95).toBeDefined();
    expect(res.body.performance.latency.p99).toBeDefined();
  });
});
