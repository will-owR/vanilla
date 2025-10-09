import { describe, it, expect, vi } from "vitest";
import fs from "fs";

describe("Error handler middleware (unit)", () => {
  it("builds a structured JSON response and logs the error", () => {
    const { errorMiddleware } = require("../utils/errorHandler");

    // Spy on fs.appendFileSync to avoid disk writes and assert it's called
    const appendSpy = vi
      .spyOn(fs, "appendFileSync")
      .mockImplementation(() => {});

    // Create mock req/res objects
    const req = {
      method: "GET",
      originalUrl: "/__unit/error",
      body: {},
      requestId: "req-123",
    };
    const res = {
      locals: {},
      headersSent: false,
      _headers: {},
      setHeader(k, v) {
        this._headers[k] = v;
      },
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      jsonPayload: null,
      json(obj) {
        this.jsonPayload = obj;
        return this;
      },
    };

    const err = new Error("boom");
    errorMiddleware(err, req, res, () => {});

    expect(appendSpy).toHaveBeenCalled();
    expect(res._headers["X-Request-Id"]).toBeDefined();
    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload).toBeTruthy();
    expect(res.jsonPayload.error).toBeTruthy();
    expect(res.jsonPayload.error.requestId).toBe(res._headers["X-Request-Id"]);

    appendSpy.mockRestore();
  });

  it("does not include details in production mode", () => {
    const { errorMiddleware } = require("../utils/errorHandler");
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const appendSpy = vi
      .spyOn(fs, "appendFileSync")
      .mockImplementation(() => {});

    const req = {
      method: "POST",
      originalUrl: "/__unit/error2",
      body: {},
      requestId: "req-456",
    };
    const res = {
      locals: {},
      headersSent: false,
      _headers: {},
      setHeader(k, v) {
        this._headers[k] = v;
      },
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      jsonPayload: null,
      json(obj) {
        this.jsonPayload = obj;
        return this;
      },
    };

    const err = new Error("secret detail");
    errorMiddleware(err, req, res, () => {});

    expect(res.jsonPayload).toBeTruthy();
    expect(res.jsonPayload.error).toBeTruthy();
    expect(
      res.jsonPayload.error.details === null ||
        typeof res.jsonPayload.error.details === "undefined"
    ).toBeTruthy();
    expect(String(res.jsonPayload.error.message).toLowerCase()).not.toContain(
      "secret"
    );

    appendSpy.mockRestore();
    process.env.NODE_ENV = oldEnv;
  });
});
