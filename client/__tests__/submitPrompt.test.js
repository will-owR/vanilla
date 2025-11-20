import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { submitPrompt } from "../src/lib/api";
import { promptStore } from "../src/stores/promptStore";
import { modeStore } from "../src/stores/modeStore";

describe("client api.submitPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds payload from stores and returns canonical envelope", async () => {
    // Set stores
    promptStore.set({
      mode: "demo",
      prompt: "Test prompt",
      metadata: { title: "T", author: "A", pages: 2 },
    });
    modeStore.setMode("demo");

    const envelope = {
      out_envelope: {
        pages: [
          { id: "p1", title: "T", blocks: [{ type: "text", content: "Body" }] },
        ],
        metadata: { generated_at: new Date().toISOString(), mode: "demo" },
        actions: { can_export: true },
      },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(envelope),
    });

    const result = await submitPrompt();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/prompt"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result).toBe(envelope.out_envelope);
  });

  it("throws INVALID_RESPONSE when server returns non-canonical shape", async () => {
    promptStore.set({ prompt: "Test" });
    modeStore.setMode("basic");
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ foo: "bar" }),
    });

    await expect(submitPrompt()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("throws server validation error when server responds with 400 and error code", async () => {
    promptStore.set({ prompt: "Test" });
    modeStore.setMode("demo");
    const errorJson = {
      error: "MISSING_METADATA",
      message: "Missing metadata",
      fields: ["title"],
    };
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve(errorJson),
    });

    await expect(submitPrompt()).rejects.toMatchObject({
      code: "MISSING_METADATA",
      fields: ["title"],
    });
  });
});
