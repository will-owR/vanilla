import { writable } from "svelte/store";
import storeAdapter, { previewStore } from "./storeAdapter";

// Minimal prompt store: manages prompt state and performs network call to
// server when submitting prompts. It updates the shared previewStore with
// HTML returned by the server so the PreviewWindow remains display-only.
const store = writable({ prompt: "", loading: false, error: null });

async function submitPrompt(payload) {
  const prompt = typeof payload === "string" ? payload : payload.prompt;

  store.update((s) => ({
    ...s,
    prompt: prompt,
    loading: true,
    error: null,
  }));

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        typeof payload === "string" ? { prompt: payload } : payload
      ),
    });

    if (!res.ok) {
      throw new Error(
        `Network response was not ok: ${res.status} ${res.statusText}`
      );
    }

    const json = await res.json();
    console.log("Server response received:", JSON.stringify(json, null, 2));

    const html =
      (json && json.preview) ||
      (json && json.data && json.data.preview) ||
      (json &&
        json.data &&
        json.data.content &&
        (json.data.content.html || json.data.content.body)) ||
      null;

    if (html === null) {
      throw new Error("Invalid server response: no html found");
    }

    previewStore.set({ body: html });
    store.update((s) => ({ ...s, loading: false, error: null }));

    const persisted =
      json && json.data && json.data.persisted ? json.data.persisted : null;
    return { success: true, persisted, html };
  } catch (e) {
    console.error("Error caught in promptStore.submitPrompt:", e);
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
