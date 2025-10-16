# Bug Report: Frontend Preview Does Not Update

**Date:** 2025-10-16
**Branch:** `aether-rewrite/client-phase2-P1`

## 1. Summary

A critical frontend bug prevents the preview window from updating after a user submits a prompt. Although the backend server processes the request and sends a valid JSON response containing previewable HTML, the client-side UI remains stuck on its initial placeholder text: `Your generated preview will appear here.`.

This indicates a failure in the frontend's data-handling and rendering pipeline.

## 2. The Expected Frontend Data Flow

The process, from user action to UI update, should be:

1.  **Click 'Generate'**: The UI calls a function in the `promptStore`.
2.  **Fetch**: The `promptStore` (via `storeAdapter`) sends a `POST` request to the backend.
3.  **Receive**: The `fetch` call resolves, and the client now holds the server's JSON response.
4.  **Update Store**: The client-side logic extracts the preview HTML from the response and updates the `previewStore` with the new content.
5.  **Render**: The `PreviewWindow.svelte` component, which is subscribed to the `previewStore`, automatically detects the change and re-renders to display the new HTML.

The failure occurs at **Step 4**, **Step 5**, or both.

---

## 3. Scenario A: Failure to Update the Store (Step 4)

In this scenario, the `PreviewWindow` component is correctly written, but it never receives new data because the `previewStore` is not being updated.

### Description of Problem

The JavaScript code responsible for handling the `fetch` response in the `storeAdapter` or `promptStore` is flawed.

- **Cause 1: Data Contract Mismatch.** The code expects the HTML content at a specific path in the JSON response (e.g., `response.data.content.body`) but the server is providing it at another (e.g., `response.preview`). When the code doesn't find the data where it's looking, it does nothing.
- **Cause 2: Logic Error.** The success handler for the `fetch` call simply fails to call `previewStore.set()` or `previewStore.update()`. This could be a commented-out line or a logical branch that is never entered.
- **Cause 3: Silent Error.** The response processing is wrapped in a `try...catch` block that swallows an error. For example, trying to access a property on a `null` or `undefined` object would throw an error that, if caught and ignored, would halt execution before the store is updated.

### Solution(s)

The logic in the `storeAdapter` (or wherever the `fetch` is handled) must be made more robust.

**Example Fix for `storeAdapter.js`:**

```javascript
// ... inside the function that handles the fetch response

import { previewStore } from './stores'; // Ensure store is imported

// ...
.then(response => response.json())
.then(result => {
  if (result && result.success) {
    // --- SOLUTION ---
    // Be flexible about where the preview content is found.
    const html = result.preview || (result.data && result.data.preview) || (result.data && result.data.content && result.data.content.body);

    if (html) {
      // Update the store with the new content.
      // Assuming previewStore holds an object like { title, body }.
      previewStore.update(current => ({ ...current, body: html }));
    } else {
      // Log an error if no content was found in the successful response.
      console.error("Preview update failed: No valid HTML content found in server response.", result);
    }
  } else {
    console.error("Preview update failed: Server indicated failure.", result);
  }
})
.catch(error => {
  // Ensure network or parsing errors are logged.
  console.error("Preview update failed: Network or fetch error.", error);
});
```

---

## 4. Scenario B: Failure to Render the Store (Step 5)

In this scenario, the `previewStore` is being updated correctly, but the `PreviewWindow.svelte` component is failing to display the new data.

### Description of Problem

The Svelte component's code is incorrect.

- **Cause 1: Incorrect Reactivity.** The component is not properly subscribed to the store. Svelte's automatic reactivity requires using the `$` prefix. A common mistake is to access the store's value once without the prefix, which creates a static variable that never updates.
- **Cause 2: Incorrect Rendering.** The template is trying to render the wrong data structure. For example, if the store holds an object `{ body: '...' }`, the template must use `{@html $previewStore.body}`. Using `{@html $previewStore}` would fail because you cannot render an entire object as HTML.

### Solution(s)

The `PreviewWindow.svelte` component must be corrected to use Svelte's reactivity and rendering features properly.

**Example Fix for `PreviewWindow.svelte`:**

```svelte
<script>
  import { previewStore } from '$lib/stores'; // Ensure store is imported
  // The '$' prefix makes this a reactive subscription.
  // The component will automatically re-render when `previewStore` changes.
</script>

<div class="preview-container">
  {#if $previewStore && $previewStore.body}
    <!-- Use {@html} to render the HTML string. -->
    <!-- Access the 'body' property of the store's value. -->
    <div class="content">
      {@html $previewStore.body}
    </div>
  {:else}
    <!-- Fallback placeholder text. -->
    <p>Your generated preview will appear here.</p>
  {/if}
</div>

<style>
  /* ... styles ... */
</style>
```

---

## 5. Scenario C: Combined Failure (Steps 4 & 5)

This is a common and frustrating scenario where both problems exist simultaneously. The `storeAdapter` fails to update the store, _and_ the `PreviewWindow` component has a rendering bug. One bug effectively masks the other.

### Description of Problem

A developer trying to fix the `PreviewWindow` component (Step 5) would see no change because it never receives new data. Conversely, a developer fixing the `storeAdapter` (Step 4) would also see no change because the component is incapable of rendering the data being sent to it.

### Solution(s)

A two-step, systematic approach is required to diagnose and fix this.

1.  **Fix the Data Flow First (Step 4):**

    - Ignore the UI entirely for a moment. Focus on the `storeAdapter`.
    - Add `console.log(result)` inside the `fetch` handler to see the exact data structure the server is sending back.
    - Implement the fix from **Scenario A**, ensuring the code correctly extracts the HTML and calls `previewStore.update()`.
    - **Crucially, verify the store is being updated.** This can be done by adding a temporary subscription in the `storeAdapter` itself or in the root Svelte component:
      ```javascript
      // Add this temporarily to any .js or .svelte file to watch the store
      import { previewStore } from "./stores";
      previewStore.subscribe((value) => {
        console.log("previewStore was updated:", value);
      });
      ```
    - Do not proceed until the console log confirms the store is receiving the HTML.

2.  **Fix the Rendering Second (Step 5):**
    - Once you have confirmed the `previewStore` is being populated with data, the problem is isolated to the `PreviewWindow.svelte` component.
    - Apply the fixes from **Scenario B**.
    - Ensure the component uses the `$` prefix for reactive subscription.
    - Ensure the `{@html}` directive is rendering the correct property from the store's value (e.g., `$previewStore.body`).

By fixing and verifying each step independently, both bugs can be resolved.
