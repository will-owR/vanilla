import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte/svelte5";
import { writable } from "svelte/store";

// Minimal smoke tests for the store adapter contract
import { createStoreAdapter, previewStore } from "../src/lib/storeAdapter.js";
import PreviewStub from "../src/__test__/PreviewStub.svelte";

describe("storeAdapter (client-v2)", () => {
  it("creates an adapter with subscribe/set/update", () => {
    const adapter = createStoreAdapter();
    expect(typeof adapter.subscribe).toBe("function");
    expect(typeof adapter.set).toBe("function");
    expect(typeof adapter.update).toBe("function");
  });

  it("previewStore updates reflect in DOM (stub)", async () => {
    // set the store before rendering so the stub shows content synchronously
    previewStore.set("<h2>Title</h2><div>Body</div>");
    const { getByTestId } = render(PreviewStub, {});
    const el = await getByTestId("preview-content");
    expect(el.innerHTML).toContain("Title");
    expect(document.body.getAttribute("data-preview-ready")).toBe("1");
    // store is canonical shape
    const val = previewStore;
    // subscribe once to assert body exists
    let cur = null;
    const unsub = previewStore.subscribe((v) => (cur = v));
    unsub();
    expect(cur && cur.body).toContain("Title");
  });
});
