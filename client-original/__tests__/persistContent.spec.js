import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";

// We will import the module under test dynamically so we can replace its
// api dependencies with mocks before the module initializes.

const MODULE_PATH = "../src/stores/index.js";

// Hoisted mocks are no longer needed with dependency injection.
const saveMock = vi.fn();
const updateMock = vi.fn();

// Helper to reset module mocks between tests
function clearModuleCache() {
  Object.keys(require.cache).forEach((k) => delete require.cache[k]);
}

describe("persistContent", () => {
  let stores;

  beforeEach(() => {
    // clear require cache and reset hoisted mocks before each test
    clearModuleCache();
    saveMock.mockReset();
    updateMock.mockReset();

    // Import the stores module after stubbing api
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    stores = require(MODULE_PATH);
  });

  afterEach(() => {
    vi.resetAllMocks();
    clearModuleCache();
  });

  it("merges persisted promptId into existing content without removing title/body (create path)", async () => {
    const { contentStore, persistContent } = stores;

    // Set generated content that has title/body but no promptId
    contentStore.set({ title: "Poem", body: "Waves crash" });

    // Mock savePromptContent to return only { promptId }
    saveMock.mockResolvedValue({ promptId: "abc123" });

    const persisted = await persistContent({
      savePromptContent: saveMock,
      updatePromptContent: updateMock,
    });

    expect(saveMock).toHaveBeenCalled();
    expect(persisted).toEqual({ promptId: "abc123" });

    const final = get(contentStore);
    expect(final).toEqual({
      title: "Poem",
      body: "Waves crash",
      promptId: "abc123",
    });
  });

  it("merges update response into existing content without removing title/body (update path)", async () => {
    const { contentStore, persistContent } = stores;

    // existing content with promptId
    contentStore.set({
      title: "Poem",
      body: "Waves crash",
      promptId: "abc123",
    });

    // Mock updatePromptContent to return partial fields (e.g., updated timestamp)
    updateMock.mockResolvedValue({
      promptId: "abc123",
      updatedAt: "2025-09-25T00:00:00Z",
    });

    const persisted = await persistContent({
      savePromptContent: saveMock,
      updatePromptContent: updateMock,
    });

    expect(updateMock).toHaveBeenCalledWith("abc123", expect.any(Object));
    expect(persisted).toEqual({
      promptId: "abc123",
      updatedAt: "2025-09-25T00:00:00Z",
    });

    const final = get(contentStore);
    expect(final).toEqual({
      title: "Poem",
      body: "Waves crash",
      promptId: "abc123",
      updatedAt: "2025-09-25T00:00:00Z",
    });
  });
});
