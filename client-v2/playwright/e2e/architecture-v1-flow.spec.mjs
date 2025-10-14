import { test, expect } from "@playwright/test";

test.describe("Architecture v1: Full E2E Flow", () => {
  test("should correctly route to testService and update preview when defaults are unchanged", async ({
    page,
  }) => {
    // 1. Navigate to the app's root page.
    await page.goto("/");

    // 2. Wait for the main app container to be visible, ensuring the app has loaded.
    await expect(page.locator("main.app-container")).toBeVisible();

    // 3. Verify the initial state: the placeholder is visible, and the content area is not.
    await expect(page.locator(".placeholder")).toContainText(
      "Your generated preview will appear here."
    );
    await expect(page.locator(".preview-window-content")).not.toBeVisible();

    // 4. Wait for the client-side store to be available on the window object.
    await page.waitForFunction(() => window.promptStore);

    // 5. Use page.evaluate to directly call the client-side logic.
    // This payload simulates the exact conditions required by the new architecture.
    await page.evaluate(() => {
      // @ts-ignore - promptStore is globally available on the window for testing
      window.promptStore.submitPrompt({
        prompt: "test-preview",
        // Crucially, we include the formDefaults to confirm they are unchanged.
        formDefaults: {
          contentType: 0,
          mediaType: 0,
        },
        // The serviceHint is included for completeness, matching the old test.
        serviceHint: "testService",
      });
    });

    // 6. Now, wait for the preview window to contain the expected text.
    // This assertion validates the entire round-trip through the new architecture.
    const previewContent = page.locator(".preview-window-content");
    await expect(previewContent).toContainText("Test Service Active");
    await expect(previewContent).toContainText("Preview is working.");

    // 7. Also verify the data-preview-ready attribute is set, confirming UI state updates.
    await expect(previewContent).toHaveAttribute("data-preview-ready", "true");
  });
});
