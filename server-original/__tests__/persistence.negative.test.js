import { describe, it, expect } from "vitest";
import persistence from "../persistence";
import fs from "fs";
import os from "os";
import path from "path";

describe("persistence executor - negative cases", () => {
  it("rejects instructions that would write outside the base dir via folderHint traversal", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-exports-"));
    try {
      // ensure module uses our temp dir for the execution
      persistence.setBaseExportDir(tmpDir);

      const malicious = [
        {
          purpose: "promptFile",
          folderHint: "../../etc",
          filenameHint: "bad.txt",
          content: "pwn",
          encoding: "utf8",
        },
      ];

      await expect(persistence.execute(malicious)).rejects.toThrow(
        /Attempt to write outside base directory/i
      );

      // ensure nothing was written under tmpDir
      const files = fs.readdirSync(tmpDir);
      expect(files.length).toBe(0);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });

  it("sanitizes filename hints by stripping path separators instead of allowing traversal", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-exports-"));
    let results = null;
    try {
      persistence.setBaseExportDir(tmpDir);

      const instr = [
        {
          purpose: "promptFile",
          folderHint: "prompts",
          filenameHint: "..\\..\\bad.txt",
          content: "ok",
          encoding: "utf8",
        },
      ];

      results = await persistence.execute(instr);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
      // file path should be under tmpDir and filename sanitized
      const p = results[0].path;
      expect(p.startsWith(tmpDir)).toBe(true);
      expect(fs.existsSync(p)).toBe(true);
      const baseName = path.basename(p);
      expect(baseName).not.toContain("..\\");
    } finally {
      try {
        if (results) {
          for (const r of results) {
            try {
              fs.unlinkSync(r.path);
            } catch (e) {}
          }
        }
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });
});
