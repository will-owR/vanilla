import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";

import app from "../index";
import persistence from "../persistence";

function listFilesRecursive(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) results.push(...listFilesRecursive(full));
    else results.push(full);
  }
  return results;
}

describe("Persistence executor integration", () => {
  let tmpExportDir;

  beforeAll(async () => {
    // Create isolated temporary export directory
    tmpExportDir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-exports-"));
    persistence.setBaseExportDir(tmpExportDir);
    // Start server (initializes DB)
    if (typeof app.startServer === "function") await app.startServer();
  });

  afterAll(async () => {
    // Cleanup files
    try {
      if (tmpExportDir && fs.existsSync(tmpExportDir)) {
        fs.rmSync(tmpExportDir, { recursive: true, force: true });
      }
    } catch (e) {
      // ignore cleanup errors
    }
  });

  it("writes artifacts atomically, records DB rows, and returns preview HTML for 'hello' prompt", async () => {
    const prompt = `hello ${Date.now()}`;

    // Ensure persistence executor uses our temp dir just before making request
    persistence.setBaseExportDir(tmpExportDir);
    process.env.PERSISTENCE_BASE_DIR = tmpExportDir;

    const res = await request(app).post("/prompt").send({ prompt });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("requestId");
    expect(res.body.success).toBe(true);
    const { data, requestId } = res.body;
    expect(data).toBeTruthy();
    expect(data.resultId).toBeTruthy();

    // persisted paths should be returned
    expect(Array.isArray(data.persisted)).toBe(true);
    expect(data.persisted.length).toBeGreaterThan(0);

    // Files exist and contents match helloWorldService expectations
    const persisted = data.persisted;
    const paths = persisted.map((p) => p.path);
    for (const p of persisted) {
      // Ensure file exists
      expect(fs.existsSync(p.path)).toBe(true);
      // Ensure the target directory has no leftover .tmp- files
      const dir = path.dirname(p.path);
      const dirFiles = fs.readdirSync(dir);
      const leftoverTmp = dirFiles.filter((f) => f.includes(".tmp-"));
      expect(leftoverTmp.length).toBe(0);
    }

    // Verify file contents for known purposes
    const promptFileEntry = persisted.find((x) => x.purpose === "promptFile");
    const previewHtmlEntry = persisted.find((x) => x.purpose === "previewHtml");
    expect(promptFileEntry).toBeTruthy();
    expect(previewHtmlEntry).toBeTruthy();

    const promptContents = fs.readFileSync(promptFileEntry.path, "utf8");
    expect(promptContents.trim()).toBe("Hello, world!");

    const previewContents = fs.readFileSync(previewHtmlEntry.path, "utf8");
    expect(previewContents).toContain("Hello, world!");

    // Ensure no leftover tmp files
    const allFiles = listFilesRecursive(tmpExportDir);
    const leftoverTmp = allFiles.filter((f) => f.includes(".tmp-"));
    expect(leftoverTmp.length).toBe(0);

    // Verify artifacts recorded in the DB and linked to ai_result_id by
    // opening a direct sqlite connection to the DB file. This avoids
    // importing the app's db instance which may live in another module
    // system context during tests.
    const sqlite3 = require("sqlite3").verbose();
    const dbPath = path.join(__dirname, "..", "data", "your-database-name.db");
    const dbConn = new sqlite3.Database(dbPath);
    const artifactRows = await new Promise((resolve, reject) => {
      dbConn.all(
        "SELECT * FROM artifacts WHERE ai_result_id = ?",
        [data.resultId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
    dbConn.close();
    expect(Array.isArray(artifactRows)).toBe(true);
    const purposes = artifactRows.map((r) => r.purpose);
    expect(purposes).toEqual(
      expect.arrayContaining(["promptFile", "previewHtml"])
    );
    for (const row of artifactRows) {
      expect(row.request_id).toBe(requestId);
      expect(fs.existsSync(row.path)).toBe(true);
      expect(paths.includes(row.path)).toBe(true);
    }

    // Clean up DB rows created by this test to avoid polluting shared DB
    try {
      const cleanupDb = new sqlite3.Database(dbPath);
      await new Promise((resolve, reject) => {
        cleanupDb.run(
          "DELETE FROM artifacts WHERE ai_result_id = ?",
          [data.resultId],
          function (err) {
            if (err) return reject(err);
            resolve();
          }
        );
      });
      await new Promise((resolve, reject) => {
        cleanupDb.run(
          "DELETE FROM ai_results WHERE id = ?",
          [data.resultId],
          function (err) {
            if (err) return reject(err);
            resolve();
          }
        );
      });
      if (data && data.promptId) {
        await new Promise((resolve, reject) => {
          cleanupDb.run(
            "DELETE FROM prompts WHERE id = ?",
            [data.promptId],
            function (err) {
              if (err) return reject(err);
              resolve();
            }
          );
        });
      }
      cleanupDb.close();
    } catch (e) {
      // ignore cleanup errors
    }
  });
});
