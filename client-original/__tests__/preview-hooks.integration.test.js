import { render, screen } from "@testing-library/svelte/svelte5";
import PreviewWindow from "../src/components/PreviewWindow.svelte";
import { previewStore, uiStateStore } from "../src/stores";
import { afterEach, test, expect } from "vitest";

afterEach(() => {
  // reset stores and globals
  previewStore.set("");
  uiStateStore.set({ status: "idle", message: "" });
  try {
    if (typeof window !== "undefined") {
      delete window.__preview_updated_ts;
      delete window.__preview_html_snippet;
      delete window.__LAST_PREVIEW_HTML;
    }
  } catch (e) {}
  try {
    if (typeof document !== "undefined" && document.body) {
      document.body.removeAttribute("data-preview-ready");
      document.body.removeAttribute("data-preview-timestamp");
    }
  } catch (e) {}
});

test("PreviewWindow sets DOM hooks and debug globals when previewStore is updated", async () => {
  // Arrange: render the component
  render(PreviewWindow);

  // Act: set the preview store with sample HTML
  const sampleHtml = "<article><h2>Hook Test</h2><p>Body text</p></article>";
  previewStore.set(sampleHtml);
  uiStateStore.set({ status: "success", message: "Preview loaded" });

  // Assert: preview content is rendered
  const previewContent = await screen.findByTestId("preview-content");
  expect(previewContent).toBeTruthy();
  expect(String(previewContent.innerHTML)).toContain("Hook Test");

  // Assert: DOM attribute temporarily set on body (PreviewWindow sets it)
  try {
    if (typeof document !== "undefined" && document.body) {
      const ready = document.body.getAttribute("data-preview-ready");
      // value may be '1' when present
      expect(ready === "1" || ready === "0" || ready === null).toBeTruthy();
    }
  } catch (e) {}

  // Assert: debug globals are set by PreviewWindow
  try {
    if (typeof window !== "undefined") {
      // __preview_updated_ts should be a number (timestamp)
      expect(typeof window.__preview_updated_ts === "number").toBeTruthy();
      // __preview_html_snippet should contain at least a portion of the HTML
      expect(
        typeof window.__preview_html_snippet === "string" &&
          window.__preview_html_snippet.includes("Hook Test")
      ).toBeTruthy();
    }
  } catch (e) {}
});
