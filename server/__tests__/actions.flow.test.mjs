import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const tmpDir = path.join(process.cwd(), "tmp-test-logs");

beforeEach(() => {
  process.env.PROMPT_LOG_PATH = tmpDir;
  // Disable persistence to avoid DB interactions in tests
  process.env.GENIE_PERSISTENCE_ENABLED = "0";
});

afterEach(() => {
  try {
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      for (const f of files) fs.unlinkSync(path.join(tmpDir, f));
      fs.rmdirSync(tmpDir);
    }
  } catch (e) {
    // ignore
  }
});

describe("actions routing", () => {
  it("empty actions -> DEFAULT path", async () => {
    const genie = require("../genieService");

    // Inject a mock sample service that returns empty actions
    genie._setSampleService({
      generateFromPrompt: async ({ in_envelope }) => {
        return {
          out_envelope: {
            content: { title: "T", body: "B" },
            actions: {},
          },
        };
      },
    });

    const res = await genie.generate("hello");
    expect(res).toBeDefined();
    expect(res.success).toBe(true);
    expect(res.data && res.data.content).toBeDefined();
    genie._resetSampleService();
  });

  it("non-empty actions -> actionsModule invoked and result returned", async () => {
    const genie = require("../genieService");

    genie._setSampleService({
      generateFromPrompt: async () => {
        return {
          out_envelope: {
            content: { title: "A", body: "B" },
            actions: { "print-to-file": true },
          },
        };
      },
    });

    const res = await genie.generate("hello actions");
    expect(res).toBeDefined();
    // actionsModule returns success true for print-to-file
    expect(res.success).toBe(true);
    expect(res.data && res.data.metadata && res.data.metadata.action).toBe(
      "print-to-file"
    );
    genie._resetSampleService();
  });
});
