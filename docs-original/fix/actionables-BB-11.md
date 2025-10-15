# Actionable Plan: Fixing the Preview Update Bug

This document outlines the strategy to ensure the preview window updates immediately and reliably after content is generated. The core problem is a race condition where saving the content to the database destructively overwrites the application's state.

## 1. The Fix: A Clear Strategy

The solution is to enforce a clean separation between the user-facing preview flow and the background persistence flow, and to ensure state updates are non-destructive.

### Actionable Checklist

- [ ] **Fix the State Mutation in `persistContent`:**

  - **Goal:** Ensure saving the content does not wipe out the `title` and `body` from the `contentStore`.
  - **Action:** Modify the `persistContent` function in `client/src/stores/index.js`. Instead of replacing the store's content with the server response (which only has a `promptId`), it must **merge** the new `promptId` into the existing content object.
  - **Verification:** A unit test for `persistContent` should confirm that after the function runs, the `contentStore` contains the `title`, `body`, _and_ the new `promptId`.

- [ ] **Isolate the Application Flows:**

  - **Goal:** Ensure the preview appears instantly without waiting for the database save.
  - **Action:** Review the `generateAndPreview` function in `client/src/lib/flows.js`. Confirm that it triggers the preview render immediately after receiving content from the generation endpoint, and that the call to `persistContent` is a separate, "fire-and-forget" background task that does not block or interfere with the preview.
  - **Verification:** Manual UI testing. When "Generate" is clicked, the preview should appear almost instantly. Network tab inspection should show the `/api/prompts` (save) call happening after or in parallel, not before.

- [ ] **Simplify the `PreviewWindow` Component:**
  - **Goal:** Make the UI component a "dumb" renderer that cannot trigger its own conflicting updates.
  - **Action:** Ensure `client/src/components/PreviewWindow.svelte` has no internal logic for fetching or updating previews. It should only reactively display the HTML from the `$previewStore`.
  - **Verification:** Code review. The component's script section should be minimal, primarily consuming stores (`previewStore`, `uiStateStore`) without calling any data-fetching functions itself.

---

## 2. The Broken Flow (What Is Actually Happening)

The current implementation mixes the preview and save operations, causing a destructive race condition.

1.  **Generate & Receive:** The backend correctly generates and returns `title` and `body`.
2.  **Update State & Trigger Preview:** The frontend updates the `contentStore`, and the preview render begins. For a brief moment, the UI may even look correct.
3.  **The Race Begins:** Simultaneously, the `persistContent` function is called to save the content to the database.
4.  **The State Is Destroyed:** The database saves the content and returns an object containing _only_ the `promptId` (e.g., `{ "promptId": "123" }`). The frontend code then takes this object and **overwrites** the entire `contentStore` with it.
5.  **The Crash:** The `contentStore` no longer has a `title` or `body`. It just has `{ "promptId": "123" }`. The UI components that rely on `title` and `body` break, triggering the "No valid content provided for preview" error.

The core bug is that the persistence logic **replaces** the content state instead of **updating** it.

---

## 3. The Ideal, Immediate Flow (What Should Happen)

This is the user's expectation, broken down into application steps:

1.  **Generate:** The user clicks "Generate." The frontend sends the prompt to the backend.
2.  **Receive Content:** The backend responds immediately with the generated `title` and `body`.
3.  **Update State:** The frontend puts this `title` and `body` into a central state store (our `contentStore`).
4.  **Trigger Preview:** The UI, reacting to the updated `contentStore`, immediately sends this new content to the preview-rendering endpoint.
5.  **Display Preview:** The preview endpoint returns HTML. The frontend puts this HTML into the `previewStore`, and the `PreviewWindow` component instantly displays it.
6.  **Save in Background:** _Separately and silently_, the frontend takes the `title` and `body` and sends them to a _different_ endpoint to be saved in the database. When the database confirms the save and returns a `promptId`, this ID is quietly **merged** into the `contentStore` without disrupting the UI.

This flow prioritizes getting the preview on-screen immediately. Saving is a background task.
