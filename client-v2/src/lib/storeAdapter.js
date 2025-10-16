import { writable } from "svelte/store";

// Minimal in-memory adapter: exposes a Svelte writable store and a factory
export function createStoreAdapter(initial = { body: "" }) {
  const store = writable(initial);

  // Attach a simple id for diagnostics (optional)
  store.__chronos_id = "client-v2-preview-store";
  store.__is_canonical = true;

  return store;
}

// Create and export a singleton previewStore for convenience tests
export const previewStore = createStoreAdapter({ body: "" });

export default {
  createStoreAdapter,
  previewStore,
};
