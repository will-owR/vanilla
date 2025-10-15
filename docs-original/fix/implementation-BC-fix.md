# Fix Implementation Plan: Race Condition

**FRI 26TH SEP 2025 @ 9:20AM**

This document outlines the implementation steps for **Solution #1** to resolve the client-side race condition.

### ✅ Solution 1: Refactor the Flow to Isolate State Updates (Recommended)

This solution establishes a clear, one-way data flow and makes the UI components "dumb" renderers, which is a best practice in modern frontend development.

**1. Modify `generateAndPreview` in `client/src/lib/flows.js`:**

This function should become the sole orchestrator. It will be responsible for fetching the preview from the backend and explicitly setting it in the `previewStore`.

```javascript
// In client/src/lib/flows.js

import { previewStore, uiStateStore } from "../stores";
import { api } from "./api"; // Assuming a centralized API module

export async function generateAndPreview(prompt) {
  uiStateStore.set({ status: "loading", message: "Generating content..." });

  try {
    // Step 1: Kick off the generation process on the server.
    await api.submitPrompt(prompt);

    uiStateStore.set({ status: "loading", message: "Loading preview..." });

    // Step 2: Fetch the real preview HTML from the backend.
    const previewHtml = await api.getPreview();

    // Step 3: Set the authoritative preview content.
    // This is the critical step. PreviewWindow will react to this.
    previewStore.set(previewHtml);

    // Step 4: Update the UI state to success.
    uiStateStore.set({ status: "success", message: "Preview loaded" });

    // Step 5 (Optional but good practice): Persist the final content in the background.
    // This can happen after the user has already seen the preview.
    api.persistContent({ prompt, preview: previewHtml });
  } catch (error) {
    console.error("Failed to generate and preview content:", error);
    uiStateStore.set({ status: "error", message: "Failed to load preview." });
  }
}
```

**2. Simplify `PreviewWindow.svelte`:**

This component should do nothing but subscribe to `previewStore` and render its content. It should not have any logic to fetch data or manage its own state.

```svelte
<!-- In client/src/components/PreviewWindow.svelte -->
<script>
  import { previewStore } from '../stores';
</script>

<div class="preview-container">
  {#if $previewStore}
    {@html $previewStore}
  {:else}
    <div class="placeholder">Your generated preview will appear here.</div>
  {/if}
</div>

<style>
  /* ... styles ... */
</style>
```

### Rationale

- **Single Source of Truth**: `previewStore` becomes the _only_ source for the preview HTML. The `PreviewWindow` component has no choice but to render what's in it.
- **No Race Condition**: The optimistic UI problem is eliminated because the UI now shows a "loading" state until the real data arrives from the backend and is placed in `previewStore`.
- **Clear Responsibility**: `flows.js` handles the logic (the "how" and "when"), and `PreviewWindow.svelte` handles the rendering (the "what"). This separation of concerns makes the code easier to understand, test, and debug.

### Summary of the "Brainstorming" Assessment

The refactor to "dumb" components does not remove functionality. Instead, it relocates and clarifies it:

- **UI Components (\*.svelte):** Become pure renderers. Their only job is to display data from stores. They contain no business logic.
- **Flows (flows.js):** Becomes the "brain" of the user-facing operation. It orchestrates the sequence of events, calls the API, and updates the stores. This is where the logic from the components moves to.
- **Stores (stores/index.js):** Remain the central state containers. They are the "single source of truth."
- **API (lib/api.js):** Remains the layer responsible for communication with the backend.

This is a classic and highly effective pattern for building robust frontend applications. By moving the logic to flows.js, you are not only fixing the bug but also improving the overall architecture of your client-side code.

### Actionable Implementation Plan

Here is the systematic plan to implement the fix.

- [x] **1. Refactor `generateAndPreview` in `client/src/lib/flows.js`** (Estimated Time: 15-20 minutes)

  - [x] Locate the existing `generateAndPreview` function (or equivalent logic).
  - [x] Replace its body with the new orchestration logic that calls `api.submitPrompt`, then `api.getPreview`.
  - [x] Ensure it updates `uiStateStore` for loading and success states.
  - [x] Ensure it sets the final HTML into `previewStore`.
  - [x] Add the non-awaited `api.persistContent` call for background persistence.

- [x] **2. Simplify `PreviewWindow.svelte` in `client/src/components/PreviewWindow.svelte`** (Estimated Time: 10-15 minutes)

  - [x] Remove any existing data-fetching logic (`onMount`, `useEffect`, etc.) related to fetching the preview.
  - [x] Ensure the component script only imports and subscribes to `previewStore`.
  - [x] Update the template to conditionally render `{@html $previewStore}` or a placeholder, as per the plan.

- [x] **3. Verify Integration and Entry Point** (Estimated Time: 5-10 minutes)

  - [x] Trace the call from the UI (e.g., the "Generate" button in `App.svelte` or a similar component).
  - [x] Confirm that its `on:click` handler now calls the refactored `generateAndPreview` from `flows.js`.
  - [x] Remove any old, now-redundant logic from the event handler.

- [x] **4. Manual End-to-End Testing** (Estimated Time: 5 minutes)
  - [x] Run the application locally.
  - [x] Enter a prompt and generate content.
  - [ ] **Expected Result:** You should see a "loading" message, followed by the backend-generated preview rendering correctly without any manual refresh. The optimistic placeholder content should no longer appear.
