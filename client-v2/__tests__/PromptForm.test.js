import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/svelte/svelte5";
import PromptForm from "../src/components/PromptForm.svelte";
import { previewStore } from "../src/lib/storeAdapter.js";
import { promptStore } from "../src/lib/promptStore.js";

// simple helper to wait microtask
const wait = () => new Promise((r) => setTimeout(r, 0));

describe("PromptForm", () => {
  beforeEach(() => {
    cleanup();
    // reset store
    previewStore.set("");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows validation error when submitting empty prompt", async () => {
    const { getByText, getByLabelText } = render(PromptForm);
    const submit = getByText("Generate");
    await fireEvent.click(submit);
    getByText("Please enter a prompt");
  });

  it("promptStore submits prompt and updates previewStore on success", async () => {
    const fakeResponse = {
      success: true,
      data: { content: { title: "T", body: "<h1>Hi</h1>" } },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(fakeResponse) })
      )
    );

    const { getByLabelText } = render(PromptForm);
    const input = getByLabelText("Prompt");

    await fireEvent.input(input, { target: { value: "Hello" } });
    // Call the store directly to perform the network call
    const result = await promptStore.submitPrompt("Hello");

    expect(global.fetch).toHaveBeenCalled();
    expect(result.success).toBe(true);

    // previewStore should have been updated with HTML
    let captured = null;
    const unsub = previewStore.subscribe((v) => {
      captured = v;
    });
    // unsubscribe immediately (we just wanted the current value)
    unsub();
    expect(result.html).toContain("Hi");
    // previewStore now has canonical shape { body }
    expect(captured && captured.body).toContain("Hi");
  });
});
