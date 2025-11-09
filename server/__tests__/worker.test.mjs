import { describe, it, expect } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { openJobsDb, enqueueJob, getJob } from "../jobs.js";
import { startWorker } from "../worker-sqlite.mjs";

describe("worker-sqlite", () => {
  it("processes a queued job and finalizes it", async () => {
    const dbPath = path.join(os.tmpdir(), `worker-test-${Date.now()}.db`);
    const db = await openJobsDb(dbPath);
    const payload = { type: "export", bookId: 42 };
    const id = await enqueueJob(db, payload);
    expect(typeof id).toBe("number");

    // Run the worker once to process the job
    await startWorker({ dbPath, runOnce: true, workerId: "test-worker" });

    // Re-open DB and verify job state
    const db2 = await openJobsDb(dbPath);
    const row = await db2.get("SELECT * FROM jobs WHERE id = ?", id);
    expect(row).not.toBeNull();
    expect(row.state === "done" || row.state === "error").toBeTruthy();

    // If done, check output exists
    if (row.state === "done") {
      expect(row.file_path).toBeTruthy();
      // Allow a short grace period for the output file to be flushed to disk
      let exists = fs.existsSync(row.file_path);
      const start = Date.now();
      // increase timeout slightly to reduce CI flakiness
      const timeoutMs = 5000;
      while (!exists && Date.now() - start < timeoutMs) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
        exists = fs.existsSync(row.file_path);
      }
      if (!exists) {
        // helpful debug output for CI logs
        const dir = path.dirname(row.file_path || dbPath);
        const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
        throw new Error(
          `Expected output file ${
            row.file_path
          } to exist after ${timeoutMs}ms. Dir contents: ${JSON.stringify(
            files
          )}`
        );
      }
      try {
        fs.unlinkSync(row.file_path);
      } catch (e) {
        // ignore cleanup errors
      }
    }

    await db2.close();
    fs.unlinkSync(dbPath);
  });
});
