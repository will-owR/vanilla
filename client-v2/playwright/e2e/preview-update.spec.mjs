import { test, expect } from "@playwright/test";

test.describe("Preview Window Update", () => {
  test("should update with content from testService when using serviceHint", async ({
    page,
  }) => {
    // Navigate to a page where the App is running, e.g., the root.
    await page.goto("/");

    // Wait for the main app component to be visible
    await expect(page.locator("main.app-container")).toBeVisible();

    // The initial state should be the placeholder text.
    const previewWindow = page.locator(".preview-window-content");
    await expect(page.locator(".placeholder")).toContainText(
      "Your generated preview will appear here."
    );
    await expect(previewWindow).not.toBeVisible();

    // Wait for the store to be available on the window object
    await page.waitForFunction(() => window.promptStore);

    // Use page.evaluate to directly call the client-side logic.
    // This is a reliable way to trigger the action without depending on UI interactions.
    await page.evaluate(() => {
      // @ts-ignore - promptStore is globally available on the window for testing
      window.promptStore.submitPrompt({
        prompt: "test-preview",
        serviceHint: "testService",
      });
    });

    // Now, wait for the preview window to contain the expected text.
    // This assertion validates the entire round-trip:
    // client -> server -> genieService -> testService -> response -> client store -> UI update
    await expect(previewWindow).toContainText("Test Service Active");
    await expect(previewWindow).toContainText("Preview is working.");

    // Also verify the data-preview-ready attribute is set, as per CURRENT_FE_v0-1.md
    await expect(previewWindow).toHaveAttribute("data-preview-ready", "true");
  });
});
