import { get } from "svelte/store";
import { submitPrompt, loadPreview } from "./api";
import {
  contentStore,
  previewStore,
  uiStateStore,
  setUiLoading,
  setUiSuccess,
  setUiError,
} from "../stores";

const DEFAULT_TIMEOUT_MS = 10000; // 10s

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

  setUiLoading("Loading preview...");

  try {
    const html = await withTimeout(loadPreview(content), timeoutMs);
    // Ensure previewStore is updated with the returned HTML
    previewStore.set(html);
    uiStateStore.set({ status: "success", message: "Preview loaded" });
    return html;
  } catch (err) {
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
    const response = await withTimeout(submitPrompt(prompt), timeoutMs);
    // submitPrompt returns an object; legacy callers expect response.data.content
    const content =
      (response && response.data && response.data.content) ||
      response.content ||
      null;
    if (!content) {
      throw new Error("Invalid response structure from server.");
    }

    contentStore.set(content);

    // Trigger preview for the newly generated content
    const html = await previewFromContent(content, timeoutMs);
    return html;
  } catch (err) {
    setUiError(err.message || "Generation failed");
    throw err;
  }
}

/**
 * Minimal generate-only flow used in EMERGENCY_MODE.
 * Submits a prompt, updates contentStore with the returned content and
 * sets minimal UI state. Does NOT call previewFromContent.
 */
export async function generateOnly(prompt, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!prompt || !String(prompt).trim()) {
    const err = new Error("Prompt cannot be empty.");
    uiStateStore.set({ status: "error", message: err.message });
    throw err;
  }

  setUiLoading("Generating (emergency)...");

  try {
    const response = await withTimeout(submitPrompt(prompt), timeoutMs);
    const content =
      (response && response.data && response.data.content) ||
      response.content ||
      null;
    if (!content) {
      throw new Error("Invalid response structure from server.");
    }

    // Only update the content store; skip the preview step intentionally.
    contentStore.set(content);
    uiStateStore.set({ status: "success", message: "Generated (emergency)" });
    return content;
  } catch (err) {
    setUiError(err.message || "Emergency generation failed");
    throw err;
  }
}
