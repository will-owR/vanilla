# Implementation Tracker: AE-devolve/01-skip-puppeteer-temp-BC

**THU 25TH SEP 2025 @ 5:05PM**

Purpose: track the initial, low-risk steps for branch `AE-devolve/01-skip-puppeteer-temp-BC` focused on implementing the preview-persist fix.

Started: basic docs and task breakdown.

Completed implementation notes (AE-devolve/01-skip-puppeteer-temp-BC)

Summary of changes applied

- persistContent (client/src/stores/index.js):

  - Accepts an optional `api` object for DI (so unit tests can inject mocks).
  - Lazily imports the real `../lib/api` when no `api` is provided (avoids test-time module load failures).
  - Normalizes server responses (unwraps common envelopes, maps `id` → `promptId` while preserving `id`).
  - Uses an atomic `contentStore.update(curr => ({ ...curr, ...normalized }))` to merge persisted fields — avoids destructive overwrites and get()+set() races.

- Preview flow (client/src/lib/flows.js):

  - `generateAndPreview` writes generated content into `contentStore` immediately, starts background persistence (non-await), then calls `previewFromContent(content)` to fetch and set `previewStore` right away.

- PreviewWindow (client/src/components/PreviewWindow.svelte):

  - Converted to consumer-only: it no longer fetches previews itself. It subscribes to `previewStore` and `uiStateStore` and renders whatever HTML is present.
  - Provides a dev-only `forceLocalPreview` fallback that sets `previewStore` from local content for debugging/tests.

- Tests added/updated:
  - Updated `client/__tests__/persistContent.spec.js` (unit tests) to assert atomic merge behavior (create and update paths).
  - Added `client/__tests__/generate-preview.integration.test.js` — focused integration test that stubs generation, preview, and save endpoints and asserts that preview updates automatically without user action and that `promptId` is merged later by background persist.

Test results

- Ran client test suite (Vitest). All client tests passed locally (28 tests across unit and integration files). Logs show generate -> preview -> background persist sequence and the expected store merges.

Rationale and notes

- This change set focuses on the two critical fixes: (1) prevent persistence from clobbering generated content, and (2) make preview rendering canonical and immediate. Making `PreviewWindow` display-only prevents competing preview fetchers and simplifies the contract: flows write to `previewStore`, components render it.
- The DI seam for `persistContent` improves test determinism and avoids brittle module-level mocking.
- I preserved shallow-merge semantics for now; if nested object merges become required, we should add targeted deep-merge behavior for specified keys only.

Files changed (high level)

- client/src/stores/index.js — persistContent refactor + DI + normalization + atomic merge
- client/src/lib/flows.js — confirmed generate flow triggers preview before await persist
- client/src/components/PreviewWindow.svelte — consumer-only render logic
- client/**tests**/persistContent.spec.js — unit tests (existing) updated/verified
- client/**tests**/generate-preview.integration.test.js — new focused integration test

Next steps (optional)

1. Add preview request de-duplication (in-flight map keyed by content hash) to avoid duplicate /preview calls and potential 429s.
2. Add observability (preview latency metrics, persist failure logs) and small non-blocking UI indicators for preview or persist issues.
3. Open PR for review and run CI; if you want I can prepare the PR and push the branch.

Tracker status: Implementation complete for the immediate fix and tests; ready to commit & push.

### What to Investigate Next:

**FRI 26TH SEP 2025 @ 9:05AM**

To pinpoint the exact cause, you should focus on the client-side code that handles the state transitions from prompt submission to preview rendering.

1.  **Examine the `contentStore` and `previewStore`**: Look at how these stores are updated. Is it possible that `contentStore` is being populated with local/placeholder data and is overwriting the `previewStore` data, or preventing the component that displays the preview from listening to `previewStore`?
2.  **Review the UI Component**: Inspect the Svelte/React/Vue component responsible for rendering the preview. How does it react to changes in `previewStore` and `contentStore`? Is it correctly subscribed to the final data from the backend?
3.  **Add Logging**: Add `console.log` statements in your manual browser session to trace the exact sequence of state updates and see if the backend HTML is ever received by the store. Compare this sequence to the one from the E2E test log.

### Investigation Results: Race Condition Confirmed

**FRI 26TH SEP 2025 @ 9:15AM**

The discrepancy between the successful E2E test and the failing manual test is confirmed to be a **race condition on the client side**. The automated test's predictable, paused execution masks a timing flaw that is immediately apparent during real-world manual use.

#### Summary of the Flaw

1.  **Optimistic UI Update**: When a user generates content, the UI immediately creates a _placeholder preview_ using the initial prompt text. This content is saved to `contentStore`, and the UI renders it instantly to feel responsive.
2.  **Backend Request**: In parallel, a request is sent to the server to generate the real content and fetch it via the `/preview` endpoint.
3.  **State Reconciliation Failure**: The real HTML from the backend is correctly received and saved into `previewStore`. However, the UI component responsible for displaying the preview is not correctly updating with this new data. It continues to display the initial placeholder content from `contentStore`.

The core issue is a failure to **reconcile the optimistic UI state with the final, authoritative state from the backend**.

#### Overview of the Fix

The solution requires ensuring the UI component reliably updates when the backend data arrives. The fix will involve:

1.  **Centralizing State Logic**: Modifying the `generateAndPreview` flow to be the single source of truth. It will handle both the initial optimistic state and the final update.
2.  **Enforcing UI Updates**: Ensuring the `PreviewWindow` component is subscribed _only_ to the `previewStore`, which will receive the final HTML. This component will be "dumb" and simply render whatever HTML it is given.
3.  **Correcting the Flow**: The `generateAndPreview` function will first trigger the backend generation and, upon receiving the real HTML, will place it into `previewStore`, forcing the listening `PreviewWindow` to re-render with the correct content.
