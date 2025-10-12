import App from "./App.svelte";
import { promptStore } from "./lib/promptStore.js";

import { previewStore } from "./lib/storeAdapter.js";

const app = new App({
  target: document.getElementById("app"),
});

// Expose stores for testing purposes when in development mode.
// This is the standard Vite way to check the environment.
if (import.meta.env.MODE === "development") {
  // @ts-ignore
  window.promptStore = promptStore;
  // @ts-ignore
  window.previewStore = previewStore;
}

export default app;
