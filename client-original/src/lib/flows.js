import { get } from "svelte/store";
import {
  submitPrompt,
  loadPreview,
  savePromptContent,
  updatePromptContent,
} from "./api";

const IS_DEV =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
import genieServiceFE from "./genieServiceFE";
import {
  contentStore,
  previewStore,
  uiStateStore,
  setUiLoading,
  setUiSuccess,
  setUiError,
  persistContent,
} from "$lib/stores";

const _win = typeof window !== "undefined" ? window : {};

const DEFAULT_TIMEOUT_MS = 10000; // 10s

// Controller for the in-flight preview request so it can be cancelled
let previewAbortController = null;

export function cancelPreview() {
  try {
    if (previewAbortController) {
      // Only abort if the signal isn't already aborted to avoid spurious
      // DOMExceptions in some environments.
      try {
        if (!previewAbortController.signal.aborted)
          previewAbortController.abort();
      } catch (inner) {
        // ignore
      }
      previewAbortController = null;
    }
  } catch (e) {
    // swallow - cancellation should be best-effort
  }
}

import { withTimeout } from "./timeout";

/**
 * Call the preview API for a piece of content and update stores/UI state.
 * Returns the HTML string on success.
 */
export async function previewFromContent(
  content,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  if (!content || !content.title || !content.body) {
    const err = new Error("No valid content provided for preview");
    uiStateStore.set({ status: "error", message: err.message });
    throw err;
  }

  // Cancel any previously running preview to avoid race conditions and create
  // a fresh controller for this request. Capture the controller locally so
  // we can tell if a later cancellation corresponds to this request or a
  // newer one.
  cancelPreview();
  previewAbortController = new AbortController();
  const myController = previewAbortController;
  const signal = myController.signal;

  setUiLoading("Loading preview...");

  try {
    const html = await withTimeout(loadPreview(content, { signal }), timeoutMs);

    // Debug logging for preview chain
    if (IS_DEV) {
      console.debug("[DEV] Preview chain debug:", {
        content: content,
        previewHtml: html?.substring(0, 100) + "...",
        htmlLength: html?.length,
      });
    }

    // Ensure previewStore is updated with the returned HTML
    try {
      if (IS_DEV) {
        try {
          console.debug(
            "[DEV] previewStore.set (previewFromContent) storeId:",
            previewStore && previewStore.__chronos_id,
            "canonicalIds:",
            (_win.__CHRONOS_STORES__ &&
              _win.__CHRONOS_STORES__.__STORE_IDS__) ||
              null
          );
        } catch (e) {}
      }
    } catch (e) {}
    previewStore.set(html);

    if (IS_DEV) {
      console.debug("[DEV] previewStore updated:", {
        storeValue: get(previewStore)?.substring(0, 100) + "...",
        valueLength: get(previewStore)?.length,
      });
    }

    uiStateStore.set({ status: "success", message: "Preview loaded" });
    // If this request is still the active controller, clear the global
    // reference so subsequent calls start fresh. If a newer request has
    // replaced the global controller, leave it as-is.
    if (previewAbortController === myController) previewAbortController = null;
    return html;
  } catch (err) {
    // If the request was aborted (due to a newer preview request), treat
    // it as a non-error — don't surface it to the user or clear the
    // existing preview. This prevents noisy AbortError logs when users
    // rapidly change prompts or when a previous request is intentionally
    // cancelled.
    if (err && (err.name === "AbortError" || err.type === "aborted")) {
      // Keep existing preview and UI state; return an empty string so
      // callers can continue without treating this as a failure.
      // Clear the global controller only if it belongs to this request.
      try {
        if (previewAbortController === myController)
          previewAbortController = null;
      } catch (e) {}
      return "";
    }

    setUiError(err.message || "Preview failed");
    // clear preview on failure to avoid stale views
    try {
      previewStore.set("");
    } catch (e) {}
    throw err;
  }
}

/**
 * Submit a prompt, update contentStore and trigger a preview for the generated content.
 * Returns the preview HTML string on success.
 */
export async function generateAndPreview(
  prompt,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  if (!prompt || !String(prompt).trim()) {
    const err = new Error("Prompt cannot be empty.");
    uiStateStore.set({ status: "error", message: err.message });
    throw err;
  }

  setUiLoading("Generating content...");

  try {
    // Step 1: Kick off the generation and get the server response. Wrap the
    // submit step in a timeout so tests that simulate a never-resolving
    // submission can be exercised deterministically.
    const submitPromptWithTimeout = withTimeout(
      submitPrompt(prompt),
      timeoutMs
    );

    // Await the timed-out promise
    const response = await submitPromptWithTimeout;

    // Extract the actual content from the response object.
    // The server may wrap the content in `data.content`.
    const content =
      (response && response.data && response.data.content) ||
      response.content ||
      response;

    // Validate the extracted content.
    if (!content || !content.title || !content.body) {
      console.error("Invalid server response structure:", response);
      throw new Error("Invalid content response from server.");
    }

    setUiLoading("Loading preview...");

    // Step 2: Fetch the real preview HTML, passing the content.
    const loadPreviewWithTimeout = withTimeout(loadPreview(content), timeoutMs);
    const previewHtml = await loadPreviewWithTimeout;

    // Step 3: Set the content in the store *before* persisting.
    contentStore.set(content);

    // Step 4: Set the authoritative preview content.
    try {
      if (IS_DEV) {
        try {
          console.debug(
            "[DEV] previewStore.set (generateAndPreview) storeId:",
            previewStore && previewStore.__chronos_id,
            "canonicalIds:",
            (_win.__CHRONOS_STORES__ &&
              _win.__CHRONOS_STORES__.__STORE_IDS__) ||
              null
          );
        } catch (e) {}
      }
    } catch (e) {}
    previewStore.set(previewHtml);

    // Step 5: Update the UI state to success.
    setUiSuccess("Preview loaded");

    // Step 6: Persist the final content in the background.
    persistContent().catch((err) => {
      console.warn("Background content persistence failed:", err);
    });

    return previewHtml;
  } catch (err) {
    setUiError(err.message || "Generation failed");
    throw err;
  }
}
