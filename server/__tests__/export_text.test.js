import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer } from "../index.js";
import appModule from "../index.js";

beforeAll(async () => {
  // Start server programmatically but do not require it to bind to the
  // network (test runners avoid listening to prevent EADDRINUSE).
  await startServer({ listen: false });
});

afterAll(async () => {
  // Attempt graceful shutdown of Puppeteer/browser if exposed
  const browser = appModule.browser;
  if (browser && browser.close) {
    try {
      await browser.close();
    } catch (e) {}
  }
});

describe("Ebook export smoke", () => {
  it("POST /api/export/book returns a PDF buffer and contains poem text", async () => {
    // Use the exported Express app directly so tests don't rely on a
    // real TCP bind (avoids ECONNREFUSED in CI where startServer skips
    // listening when NODE_ENV === 'test').
    const res = await request(appModule)
      .post("/api/export/book")
      .send({})
      .set("Content-Type", "application/json")
      .timeout(20000);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    const buf = res.body;
    // Buffer may be binary; check magic bytes
    const magic = Buffer.from(buf).slice(0, 5).toString("utf8");
    expect(magic.startsWith("%PDF-")).toBe(true);

    // Save to a unique temp file and extract text using the local extractor script (pdfjs-dist)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aetherpress-"));
    const outPath = path.resolve(tmpDir, "test_ebook.pdf");
    fs.writeFileSync(outPath, buf);
    const extractor = path.resolve("scripts", "extract-pdf-text.js");
    const { stdout } = await new Promise((resolve, reject) => {
      const cp = require("child_process").execFile(
        process.execPath,
        [extractor, outPath],
        { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) return reject(err);
          resolve({ stdout, stderr });
        }
      );
    });
    expect(stdout).toMatch(/A Summer Day/);
    expect(stdout).toMatch(/Midsummer Night/);
  }, 30000);
});
