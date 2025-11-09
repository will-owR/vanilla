import { writable } from "svelte/store";

// Define the initial state
const initialState = {
  mode: "demo",
  prompt: "",
  metadata: {
    title: "",
    author: "",
    pages: undefined,
  },
  generating: false,
  error: null,
};

// Create the store with initial state
export const promptStore = writable(initialState);

// Helper functions for common operations
export function resetMetadata() {
  promptStore.update((state) => ({
    ...state,
    metadata: {
      title: "",
      author: "",
      pages: undefined,
    },
  }));
}

export function setMode(mode) {
  promptStore.update((state) => ({
    ...state,
    mode,
    // Reset metadata when switching back to basic mode
    metadata: mode === "basic" ? undefined : state.metadata,
  }));
}

export function setGenerating(generating) {
  promptStore.update((state) => ({
    ...state,
    generating,
    error: null, // Clear any previous errors when starting generation
  }));
}

export function setError(error) {
  promptStore.update((state) => ({
    ...state,
    error,
    generating: false, // Stop generating state if there's an error
  }));
}
