import { get } from "svelte/store";
import {
  submitPrompt,
  loadPreview,
  savePromptContent,
  updatePromptContent,
} from "./api";
import genieServiceFE from "./genieServiceFE";
import {
  contentStore,
  previewStore,
  uiStateStore,
  setUiLoading,
  setUiSuccess,
  setUiError,
  persistContent,
} from "../stores";

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

function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
}

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
    // Ensure previewStore is updated with the returned HTML
    previewStore.set(html);
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
    // Prefer using the frontend genie service which may implement a dev/demo
    // implementation or delegate to the server. Fall back to submitPrompt
    // to preserve existing behaviour.
    let response;
    try {
      response = await withTimeout(
        genieServiceFE.generate(prompt, {}),
        timeoutMs
      );
    } catch (e) {
      // If the frontend service fails for some reason, fall back to the
      // existing server API call to avoid breaking the flow.
      response = await withTimeout(submitPrompt(prompt), timeoutMs);
    }

    // Normalize various response shapes into a usable `content` object.
    // Possible shapes:
    // - { content: { title, body } }
    // - { data: { content: { title, body } } }
    // - { content: "plain string" }
    // - "plain string"
    let content = null;
    if (!response) content = null;
    else if (typeof response === "string") {
      content = { title: "Prompt result", body: response };
    } else if (response.content && typeof response.content === "string") {
      content = { title: "Prompt result", body: response.content };
    } else if (
      response.data &&
      response.data.content &&
      typeof response.data.content === "string"
    ) {
      content = { title: "Prompt result", body: response.data.content };
    } else if (response.content && typeof response.content === "object") {
      content = response.content;
    } else if (
      response.data &&
      response.data.content &&
      typeof response.data.content === "object"
    ) {
      content = response.data.content;
    } else if (response.content) {
      content = response.content;
    } else if (response.data && response.data.content) {
      content = response.data.content;
    } else {
      content = response;
    }

    if (!content || (!content.title && !content.body)) {
      throw new Error("Invalid response structure from server.");
    }

    // Immediately set the generated content locally so the UI can render a
    // fallback preview without waiting for network persistence.
    contentStore.set(content);

    // Persist content to server prompts API in background. If it succeeds,
    // persistContent will update contentStore with server-provided fields
    // (like promptId). If it fails, we surface a non-blocking warning but
    // don't block the user from seeing the preview.
    let persisted = content;
    (async () => {
      try {
        const result = await persistContent(content);
        persisted = result || content;
        // After persistence, attempt to refresh the preview with persisted data
        try {
          await previewFromContent(persisted, timeoutMs);
        } catch (e) {
          // ignore preview refresh errors here; previewFromContent already
          // sets UI state appropriately
        }
      } catch (saveErr) {
        console.warn(
          "Failed to persist generated content to server",
          saveErr && saveErr.message
        );
        // Surface a non-blocking UI warning
        uiStateStore.set({
          status: "error",
          message: "Saved locally; failed to persist to server.",
        });
      }
    })();

    // Trigger preview for the newly generated content (use local content so
    // the user sees something immediately).
    const html = await previewFromContent(content, timeoutMs);
    return html;
  } catch (err) {
    setUiError(err.message || "Generation failed");
    throw err;
  }
}
