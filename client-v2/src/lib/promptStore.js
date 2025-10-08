import { writable } from "svelte/store";
import { previewStore } from "./storeAdapter";

// Minimal prompt store: manages prompt state and performs network call to
// server when submitting prompts. It updates the shared previewStore with
// HTML returned by the server so the PreviewWindow remains display-only.
const store = writable({ prompt: "", loading: false, error: null });

async function submitPrompt(newPrompt, opts = {}) {
  // opts: { dev: boolean } -> when true, call /prompt?dev=true
  const dev = opts.dev === true;
  store.update((s) => ({
    ...s,
    prompt: newPrompt,
    loading: true,
    error: null,
  }));

  try {
    const url = dev ? "/prompt?dev=true" : "/prompt";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: newPrompt }),
    });
    const json = await res.json();

    // Extract HTML from a few known shapes.
    const html =
      (json &&
        json.data &&
        json.data.content &&
        (json.data.content.html || json.data.content.body)) ||
      (json && json.data && json.data.preview) ||
      (json && json.preview) ||
      null;

    if (!html) {
      const err = new Error("Invalid server response: no html found");
      store.update((s) => ({ ...s, loading: false, error: err.message }));
      throw err;
    }

    // Update the shared preview store with HTML for display
    previewStore.set(html);

    // Persisted artifacts (if provided) can be returned to callers
    const persisted =
      json && json.data && json.data.persisted ? json.data.persisted : null;

    store.update((s) => ({ ...s, loading: false, error: null }));

    return { success: true, persisted, html };
  } catch (e) {
    store.update((s) => ({
      ...s,
      loading: false,
      error: e && e.message ? e.message : String(e),
    }));
    return { success: false, error: e && e.message ? e.message : String(e) };
  }
}

export const promptStore = {
  subscribe: store.subscribe,
  submitPrompt,
  _raw: store,
};
