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
});
