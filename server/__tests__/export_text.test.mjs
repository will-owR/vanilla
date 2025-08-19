import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

// Import the server module (CommonJS) via dynamic import; Node will expose
// module.exports as the default export when required from ESM.
const appModule = await import("../index.js");
const app = appModule.default || appModule;

beforeAll(async () => {
  // Ensure services (DB, Puppeteer) are initialized. startServer supports
  // options and will skip listening when listen=false.
  if (typeof appModule.startServer === "function") {
    await appModule.startServer({ listen: false });
  }
});

afterAll(async () => {
  // Close puppeteer browser if present to avoid hanging processes
  try {
    const browser = appModule.browser;
    if (browser && typeof browser.close === "function") {
      await browser.close();
    }
  } catch (e) {
    // ignore
  }
});

describe("POST /api/export/book", () => {
  it("returns a PDF buffer with expected poem text", async () => {
    const res = await request(app)
      .post("/api/export/book")
      .set("Accept", "application/pdf")
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .send();

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);

    const buffer = res.body;
    // Magic bytes
    expect(buffer.slice(0, 5).toString()).toBe("%PDF-");

    // Write buffer to a temp file and call the extraction script to avoid
    // importing pdf-parse directly (which can run debug code in some packages).
    const tmpPath = "./samples/test_export_tmp.pdf";
    await fs.promises.writeFile(tmpPath, buffer);
    const { stdout } = await execFileAsync(
      process.execPath,
      ["./server/scripts/extract-pdf-text.js", tmpPath],
      { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 }
    );
    expect(stdout).toContain("A Summer Day");
    // cleanup
    await fs.promises.unlink(tmpPath).catch(() => {});
  });
});
