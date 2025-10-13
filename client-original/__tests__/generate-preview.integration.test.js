import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";

// Import modules dynamically so we can inject stubs
const FLOWS_PATH = "../src/lib/flows.js";
const STORES_PATH = "../src/stores/index.js";

function clearModuleCache() {
  Object.keys(require.cache).forEach((k) => delete require.cache[k]);
}

// Hoisted mocks - vi.mock factories are hoisted to top-of-file, so any
// referenced variables must be declared at top-level.
const mockHtml = "<div>PREVIEW</div>";
const saveMock = vi.fn();
const updateMock = vi.fn();
const loadPreviewMock = vi.fn();
const submitPromptMock = vi.fn();

describe("generateAndPreview integration", () => {
  beforeEach(() => {
    clearModuleCache();
  });
  afterEach(() => {
    clearModuleCache();
    vi.resetAllMocks();
  });

  it("updates previewStore automatically after generation and preserves content during persist", async () => {
    // Stub the api module used by flows and stores using ESM-aware mocking.
    // Define mocks inside the factory so the hoisted call does not reference
    // outer-scope variables (Vitest requirement).
    vi.mock("../src/lib/api", () => {
      const mockHtml = "<div>PREVIEW</div>";
      const save = vi.fn().mockResolvedValue({ promptId: "p-123" });
      const update = vi.fn().mockResolvedValue({ promptId: "p-123" });
      const load = vi.fn().mockResolvedValue(mockHtml);
      const submit = vi
        .fn()
        .mockResolvedValue({ data: { content: { title: "T", body: "B" } } });
      return {
        submitPrompt: submit,
        loadPreview: load,
        savePromptContent: save,
        updatePromptContent: update,
      };
    });

    // Also stub genieServiceFE to be deterministic
    vi.mock("../src/lib/genieServiceFE", () => ({
      default: {
        generate: vi
          .fn()
          .mockResolvedValue({ content: { title: "T", body: "B" } }),
      },
    }));

    // Now import flows and stores dynamically so the mocks take effect
    const flows = await import(FLOWS_PATH);
    const stores = await import(STORES_PATH);

    // Ensure stores are empty
    stores.contentStore.set(null);
    stores.previewStore.set("");

    // Kick off the flow
    const html = await flows.generateAndPreview("generate me");

    expect(html).toBe(mockHtml);

    const contentNow = get(stores.contentStore);
    expect(contentNow).toEqual(
      expect.objectContaining({ title: "T", body: "B" })
    );

    // previewStore should have been updated
    const previewNow = get(stores.previewStore);
    expect(previewNow).toBe(mockHtml);

    // Save should have been triggered in background; wait a tiny bit then assert promptId merged
    // Poll for the promptId merge
    let final = get(stores.contentStore);
    const start = Date.now();
    while (!final || !final.promptId) {
      if (Date.now() - start > 2000)
        throw new Error("promptId not merged in time");
      await new Promise((r) => setTimeout(r, 50));
      final = get(stores.contentStore);
    }
    expect(final.promptId).toBe("p-123");
  }, 10000);
});
