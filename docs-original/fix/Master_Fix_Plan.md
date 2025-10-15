# Master Fix Plan: Resolving the Preview Disconnect

**SAT 28 SEP 2025**

> NOTE (quick diagnostics):
>
> - Recent runtime diagnostics and probe outputs are available via `client/tmp/inspect-preview.mjs` (run locally to reproduce). The probe prints JSON containing `previewGlobal`, `writeLog`, `canonical`, and `previewWindowLast` fields.
> - Relevant instrumented files: `client/src/stores/index.js`, `client/src/components/PreviewWindow.svelte` (dev-only onMount instrumentation records `window.__PREVIEW_WINDOW_LAST__`), and `client/tmp/inspect-preview.mjs`.
> - To resume quickly: the frontend and backend auto-start on session startup in this dev environment — you can run `node client/tmp/inspect-preview.mjs` immediately to collect the probe JSON. Paste the `previewGlobal`, `writeLog`, `canonical`, and `previewWindowLast` fields into the conversation and say: "Resume: read probe output".

This document synthesizes all previous findings into a single, actionable strategy to resolve the frontend preview failure. It outlines the root cause and a prioritized list of solutions to be implemented systematically.

## Master Root Cause: Store Singleton Violation via HMR

The primary issue is a **Store Singleton Violation**, triggered by Vite's **Hot Module Replacement (HMR)** during development.

This creates duplicate, disconnected instances of the Svelte stores in memory, severing the reactive link between the application's logic (which updates one store instance) and its UI (which subscribes to another, unchanged instance). This core problem explains why E2E tests pass in a clean environment (no HMR) while manual testing consistently fails during a typical development session.

## Modus Operandi: Systematic Implementation & Verification

Each solution will be implemented on a **new, dedicated branch** named with a solution suffix (e.g., `...-solution1`). After implementing a solution, a full validation suite will be executed to assess its efficacy.

The process for each solution is:

1. Create a new branch from the latest baseline.
2. Implement the code changes for the solution.
3. Execute the full verification checklist.
4. Document the results. If the solution is not a complete fix, keep the changes if they are otherwise beneficial; otherwise, revert and proceed to the next solution.

---

## ✅ Solution #1: Implement HMR-Proof Svelte Stores (Highest Priority)

**Goal:** Directly target the root cause by making the Svelte stores immune to HMR-induced duplication.

### Actionables

- [x] **1. Branch:** Create a new branch ending in `-solution1`.
- [x] **2. Implement HMR-Proof Singleton:** Modify `client/src/stores/index.js` to use a global `window` key. This ensures that even if the module is reloaded, every part of the application receives a reference to the exact same store objects created on the very first load.

  ```javascript
  // In client/src/stores/index.js
  import { writable } from "svelte/store";

  const GLOBAL_KEY = "__CHRONOS_STORES__";

  function createStores() {
    const previewStore = writable("");
    const uiStateStore = writable({ status: "idle", message: "" });
    // ... other stores
    return { previewStore, uiStateStore };
  }

  function getStores() {
    if (typeof window !== "undefined" && window[GLOBAL_KEY]) {
      return window[GLOBAL_KEY];
    }
    const stores = createStores();
    if (typeof window !== "undefined") {
      window[GLOBAL_KEY] = stores;
    }
    return stores;
  }

  export const { previewStore, uiStateStore } = getStores();
  ```

  #### Session update (SAT 28 SEP 2025) — branch: AE-devolve/01-skip-puppeteer-preview-solution1

  Summary of edits applied in this session (keeps the Master Fix Plan current):

  - Implemented a canonical global container and robust promotion from legacy global key in `client/src/stores/index.js`.
  - Reworked store initialization to prefer canonical instances and rebound module-local store variables to canonical instances to preserve identity across HMR.
  - Added dev instrumentation for E2E and debugging:
    - write-log for `previewStore.set` (recorded to `window.__STORE_WRITE_LOG__`).
    - debug wrappers that set `window.__LAST_PREVIEW_HTML`, `window.__preview_html_snippet`, and `window.__preview_updated_ts` on preview writes.
  - Restored and stabilized `PreviewWindow.svelte` rendering to a simpler reactive implementation to prevent SSR/test harness regressions.
  - Added small debug logs in `client/src/lib/flows.js` before `previewStore.set(...)` calls to emit `__chronos_id` and canonical registry information.
  - Created and iteratively enhanced `client/tmp/inspect-preview.mjs` (Playwright probe) to:
    - trigger a generate action in the running UI,
    - wait for preview globals or DOM to appear,
    - capture `__LAST_PREVIEW_HTML`, `__STORE_WRITE_LOG__`, and the canonical registry for analysis.

  Key findings from the probe run:
  **Key findings from the probe runs (after instrumentation):**

  - The running frontend does execute the preview writer. `window.__LAST_PREVIEW_HTML` and `window.__STORE_WRITE_LOG__` contain the generated HTML and a write-log entry whose `storeId` matches the canonical id found under `window.__CHRONOS_STORES__.__STORE_IDS__.previewStore`.

  - Despite the canonical write, the mounted `PreviewWindow` component did not observe (or did not render) that value in the probe runs: the DOM still showed the placeholder and the component-level probe global (`window.__PREVIEW_WINDOW_LAST__`) was not populated by the component in earlier runs.

  - This is strong evidence of a persistent duplicate-store situation at runtime: the writer is writing to the canonical store, while the mounted component is (in at least some runs) subscribed to a different store instance created by a separate module evaluation (HMR/module-resolution divergence). That mismatch disconnects writer → UI even though the canonical container holds the correct value.

  - Small changes were made to reduce the surface area of the problem (rebinding module-local exports to canonical instances, simplifying `PreviewWindow.svelte` to avoid SSR/test harness issues). Those were necessary stabilizations but did not, by themselves, fully eliminate the mismatch observed in the running dev server.

  Immediate diagnostic step already performed in this session:

  - Added a dev-only, onMount subscription in `PreviewWindow.svelte` (guarded by `IS_DEV`) which writes what the mounted component actually observes into `window.__PREVIEW_WINDOW_LAST__`. Updated the Playwright probe to set `window.IS_DEV` prior to app bootstrap and to capture `__PREVIEW_WINDOW_LAST__` alongside other globals.

  Observed outcome after the instrumentation:

  - The probe confirms the canonical write log and canonical store ids are present, but `PreviewWindow` still did not consistently report seeing the same value (the component-level probe global was empty in the captured runs while the canonical write-log showed the new HTML). In short: the writer writes the canonical store; the mounted PreviewWindow is not reliably reading it.

  Short-term recommended next steps (ordered, dev-only first):

  1. Dev-only canonical observer (fast, decisive):

  - Add a second, dev-only subscription in `PreviewWindow.svelte` that subscribes directly to the canonical store object (if present) at `window.__CHRONOS_STORES__.previewStore` and record what that subscription sees into `window.__PREVIEW_WINDOW_LAST__.canonicalObserved`. This will prove, at runtime, whether the canonical store actually contains the HTML _and_ whether a subscription from the component's context can see it.

  2. If the canonical observer shows the component can see the canonical store when subscribed explicitly, that indicates the component's default import path still resolves to a different instance. The short-term remediation then is to ensure our store module always re-exports (rebinding) the canonical instance at import time (already partially implemented) and sweep any remaining import aliases.

  3. If explicit canonical subscription still does not see the canonical value, the problem is deeper (multiple globals or fragmented runtime realms). In that case escalate to a broader runtime hardening approach:

  - Force singletons at import time (definitive rebind) in `client/src/stores/index.js` so the module always sets its exports to the global canonical object (this is the durable fix for HMR-caused duplicates).
  - Add a short test harness that validates runtime identity: a unit test that imports the store from multiple relative paths and asserts the `__chronos_id` values are identical.

  4. After confirming the above, run the verification checklist (client tests, E2E smoke, manual HMR trial) and iterate.

  Operational notes:

  - The dev-only instrumentation is safe to enable in local dev sessions only (guarded by `IS_DEV`). Keep it temporary and remove after the root cause is fixed.
  - The updated Playwright probe (`client/tmp/inspect-preview.mjs`) now sets `window.IS_DEV` before the app loads, triggers a generate, and captures the new developer diagnostics for easy comparison.

  Current branch status:

  - All updated files for the HMR-proof store work and the dev instrumentation were committed to branch `AE-devolve/01-skip-puppeteer-preview-solution1` and pushed upstream.

#### ADDENDUM: MON 29 SEP 2025 — The Rogue Subscriber Hunt: Next Steps

**Discovery & Status Update:**

Following the implementation of the HMR-proof singleton (Solution #1), the core issue persisted. The `PreviewWindow.svelte` component was not updating, indicating it was subscribed to a stale, "rogue" store instance.

The first hypothesis—a desynchronized Vite cache—was tested by stopping the dev server and deleting the `client/node_modules/.vite` directory. **This action did not resolve the issue.** Upon restarting the server, the preview remained disconnected.

This outcome rules out a simple cache corruption and suggests a more deterministic and persistent cause for the module resolution conflict. The investigation now proceeds to the next hypotheses.

**Pending Investigation & Fixes:**

The following steps will be taken to isolate the source of the rogue store instance.

**1. Implement Direct Module Identity Inspection (Hypothesis 1, Part B)**

- **Goal:** To get undeniable proof within the running application that `PreviewWindow.svelte` is importing a different module instance than the rest of the app.
- **Actionables:**
  - **Tag Canonical Stores:** In `client/src/stores/index.js`, a unique property (e.g., `__is_canonical = true;`) will be added to the store objects created within the canonical `createStores` function.
  - **Add Runtime Check:** In `client/src/components/PreviewWindow.svelte`, a dev-only check will be added immediately after the store import. This check will test for the presence of the `__is_canonical` tag. If the tag is missing, a detailed error will be logged to the browser console, confirming a rogue import and providing an immediate diagnostic signal.

**2. Investigate Component Lifecycle & Render Path (Hypothesis 2)**

- **Goal:** To determine if the Svelte component lifecycle or its specific render path is causing its module script to be evaluated in a separate context from the main application.
- **Actionables:**
  - **Audit `onMount`:** Re-verify that no store subscriptions or access occur at the top-level of the `<script>` block in `PreviewWindow.svelte`. All browser-dependent logic must be strictly confined to `onMount` or later.
  - **Analyze Render Tree:** Examine how `PreviewWindow.svelte` is rendered within its parent components (e.g., `App.svelte`). Look for asynchronous rendering patterns (`{#await}` blocks, dynamic imports) that could create unusual module evaluation timing.

**3. Audit Build Tooling Configuration (Hypothesis 3)**

- **Goal:** To rule out any misconfiguration in the build tools that could be causing incorrect module resolution.
- **Actionables:**
  - **Review `vite.config.js`:** Scrutinize `resolve.alias`, custom plugins, and `optimizeDeps` for any rules that might uniquely affect the `$lib/stores` path or modules under `src/components`.
  - **Check for Duplicate Dependencies:** Run `npm --prefix client ls svelte` to ensure only one version of the `svelte` package is resolved in the dependency tree, preventing a split-context scenario.

This structured approach will systematically test each remaining hypothesis, with the direct module identity inspection expected to provide the most definitive clue to guide the final fix.

- [ ] **3. Verification:**
  - [ ] **Client Tests:** Run the full Vitest suite for the client.
  - [ ] **E2E Test:** Execute the `node client/tests/e2e/generate-and-verify.spec.mjs` script.
  - [ ] **Manual Walk-through:**
    - Start the dev server.
    - Generate a preview.
    - Make a cosmetic change to a Svelte component (e.g., `PreviewWindow.svelte`) to trigger HMR.
    - Generate a second preview.
  - [ ] **4. Assessment:** Document whether the preview updates correctly after the HMR event.

---

## ✅ Solution #2: Enforce Canonical Import Paths

**Goal:** Prevent the singleton issue at its source by enforcing a single, consistent import path for stores across the entire application. This is a critical best practice.

### Actionables

- [ ] **1. Branch:** Create a new branch ending in `-solution2`.
- [ ] **2. Audit & Refactor Imports:**
  - [ ] Search the entire `client/` directory for store imports using relative paths (e.g., `../stores`, `../../stores`).
  - [ ] Refactor all found instances to use the established path alias (e.g., `$lib/stores`).
- [ ] **3. Verification:**
  - [ ] **Client Tests:** Run the full Vitest suite for the client.
  - [ ] **E2E Test:** Execute the `generate-and-verify.spec.mjs` script.
  - [ ] **Manual Walk-through:** Perform the same manual test as in Solution #1.
  - [ ] **4. Assessment:** Document if standardizing paths alone resolves the HMR issue.

---

## ✅ Solution #3: Simplify the Backend API (Architectural Improvement)

**Goal:** Make the system more robust and easier to maintain by consolidating the multi-step preview process into a single, atomic backend transaction.

### Actionables

- [ ] **1. Branch:** Create a new branch ending in `-solution3`.
- [ ] **2. Implement Backend Endpoint:** Create a new, consolidated `/api/generate` endpoint in the server that handles content generation, preview creation, and database persistence in one call.
- [ ] **3. Refactor Frontend:** Simplify the `generateAndPreview` flow in `client/src/lib/flows.js` to call this single endpoint and place the returned HTML directly into the `previewStore`.
- [ ] **4. Deprecate Old Endpoints:** Once the new flow is verified, remove the old, multi-step API endpoints.
- [ ] **5. Verification:**
  - [ ] **Client Tests:** Update and run the client test suite to reflect the new API call.
  - [ ] **E2E Test:** Update and run the E2E test to use the new flow.
  - [ ] **Manual Walk-through:** Confirm the end-to-end functionality works as expected.
  - [ ] **6. Assessment:** Document the results of the architectural simplification.

---

## ✅ Missing Part: Add Content Validation to E2E Test

**Goal:** Enhance the E2E test to ensure it verifies not just the _process_, but also the _correctness_ of the rendered content.

### Actionables

- [ ] **1. Branch:** This can be implemented on the same branch as the final, successful solution.
- [ ] **2. Enhance E2E Test:** Modify `client/tests/e2e/generate-and-verify.spec.mjs`.
  - [ ] After the preview HTML artifact is saved, read its content.
  - [ ] Add an assertion to verify the HTML does **not** contain the raw prompt text (e.g., `E2E smoke: short summer poem...`).
  - [ ] Add an assertion to verify the HTML **does** contain a characteristic of successfully generated content (e.g., a specific class, or simply being non-empty and different from the prompt).
- [ ] **3. Verification:** Run the E2E test and confirm that it passes with the new, stricter assertions.
- [ ] **4. Assessment:** The E2E test is now a more reliable indicator of true success.

---

### STATUS UPDATE: Identity instrumentation and HMR stress test plan (29 SEP 2025)

- Identity-check instrumentation (marker + runtime assertion) has been added to `client/src/stores/index.js` and `client/src/components/PreviewWindow.svelte`. The instrumentation runs only in development (`IS_DEV`) and writes diagnostic information to the console and to globals such as `window.__PREVIEW_WINDOW_LAST__` and `window.__STORE_WRITE_LOG__`.

- E2E probe run after adding instrumentation (clean Playwright session) showed no rogue-store assertion (the `PreviewWindow` did not report a non-canonical import during the clean E2E run). This is consistent with prior observations: the bug reproduces under HMR cycles, not initial loads.

- Next step: run an automated HMR stress test to try to reproduce the rogue-store situation in a repeatable way. The stress test will perform the following steps:

  1. Ensure dev server is running.
  2. Loop N times (recommended N=20):
     - Touch (update mtime) a harmless client file that triggers HMR (e.g., `client/src/components/PreviewWindow.svelte` or a small `client/src/tmp/hmr-touch.js`).
     - After each touch, wait for the dev server to finish HMR (monitor Vite websocket logs in `client/nohup.out` for update messages) and then run the Playwright E2E probe `node client/tests/e2e/generate-and-verify.spec.mjs` to exercise generate->preview and check whether the dev-only assertion logs a diagnostic.
  3. If any iteration logs the diagnostic, capture `/workspaces/AetherPressDeux/test-artifacts/` and stop.

- Time estimate for stress test run: ~15–30 minutes (20 iterations with short waits). If the rogue instance appears rarely, increase N or add randomized delays.

- I will now commit this status update and run the HMR stress test (N=20). If the stress test reproduces the issue, I'll capture logs and update this plan with the discovery, including stack/module paths where possible. If it doesn't reproduce, I'll escalate to deeper instrumentation (stack traces on store creation) and proceed to audit `vite.config.js` and import paths.

### HMR Stress Test: run 29 SEP 2025

- Test plan: touched a tracked helper file (`client/src/lib/hmr-touch.js`) 20 times, after each touch running the E2E probe `node client/tests/e2e/generate-and-verify.spec.mjs` to exercise the generate->preview flow and capture any dev-only diagnostic logs from `PreviewWindow.svelte`.

- Outcome summary:

  - Iterations attempted: 20
  - Rogue-store diagnostic (`Imported previewStore is NOT canonical`) was **not observed** in any of the iterations.
  - The application successfully completed the generate->preview flow and saved the artifact multiple times during the stress test (several iterations recorded `E2E smoke completed successfully — preview saved to /workspaces/AetherPressDeux/test-artifacts/preview-fetched-from-e2e.html`).
  - Intermittent issues observed during the run:
    - Several E2E attempts encountered HTTP 429 (Too Many Requests) from `/prompt` during tight loops. This is a rate-limiting symptom caused by repeated automated requests in quick succession. Some attempts timed out waiting for preview as a result.
    - Vite dev server printed occasional `WebSocket closed without opened` errors in the Playwright page logs. These did not prevent the E2E probe from completing successfully in many iterations.

- Conclusion:

  - This HMR stress test did not reproduce the rogue-store import in 20 iterations. That means the issue is either rarer than this test's sample size, dependent on a specific sequence of HMR events we didn't trigger, or connected to developer interactions (manual edits, route changes, or certain plugins) not simulated here.

- Immediate next steps (recommended):

  1. Increase stress-test coverage:
     - Raise iteration count (e.g., N=100) and add randomized small delays between touches to broaden coverage.
     - Include touching different modules (e.g., `client/src/components/PreviewWindow.svelte`, `client/src/lib/flows.js`, and `client/src/stores/index.js` itself) in varying sequences to better emulate real developer edits.
  2. Add stack-trace instrumentation at store creation:
     - When `getOrCreateStore` creates a new store instance, capture a short stack trace (e.g., new Error().stack) and store it in `store.__creation_stack` so we can later correlate which importer created the instance.
  3. Audit and enforce import paths:
     - Run a repo-wide search for any relative imports of the stores and refactor them to `$lib/stores` to reduce chances of duplicate module resolution.
  4. Check for duplicate Svelte runtime versions:
     - Run `npm --prefix client ls svelte` and address any duplicates by deduping or locking versions.
  5. If a reproducible case appears, capture artifacts immediately (page console, `client/nohup.out`, `window.__STORE_WRITE_LOG__`, and `window.__PREVIEW_WINDOW_LAST__`) and attach to this plan for analysis.

- Time estimate for next actions:
  - Increase stress test to N=100 with randomized delays: 30–60 minutes (run time included).
  - Add stack-trace instrumentation and re-run stress test: 30–90 minutes.
  - Repo-wide import audit and refactor: 30–120 minutes depending on findings.

I will commit this update now and push it to the branch, then await your instruction whether to (A) increase the HMR stress test iteration count now, (B) add stack-trace instrumentation first, or (C) run the import-audit step next.

## Next Actions (formalized) — pick one after lunch

During the HMR stress test I proposed three pragmatic follow-ups. To keep the Master Fix Plan authoritative, I've promoted those options into the plan as formal actionable items. These are written so the team can pick one to run after a lunch break; each item includes a short description, acceptance criteria, and a time estimate.

- [ ] A. Increase HMR stress test coverage (Priority: High)

  - Description: Run an extended HMR stress test (recommended N=100) that touches multiple files in varying sequences (e.g., `client/src/lib/hmr-touch.js`, `client/src/components/PreviewWindow.svelte`, `client/src/lib/flows.js`, and `client/src/stores/index.js`) with randomized short delays. The goal is to raise the probability of reproducing the rogue-store import under more realistic dev editing patterns.
  - Acceptance: either (1) the `Imported previewStore is NOT canonical` diagnostic is observed and captured, or (2) after 100 iterations no diagnostic appears and we can deprioritize intermittent HMR races in favor of deeper instrumentation.
  - Time estimate: ~30–60 minutes (run time included).

- [ ] **B. Add stack-trace instrumentation at store creation** (Priority: High — Recommended)

  - Description: When a store is created (`getOrCreateStore`), capture a short stack trace (e.g., `new Error().stack`) and attach it to the store as `__creation_stack`. Re-run a shorter HMR stress test and, if a rogue instance appears, examine `store.__creation_stack` to identify the importer/module path responsible for creating that instance.
  - Acceptance: when a non-canonical store is observed, we can identify the module path or call-site responsible via the saved stack trace. This yields a direct lead for fixing the import/path or timing issue.
  - Time estimate: ~30–90 minutes (implementation + short stress-run).

- [ ] C. Repo-wide import-audit & path standardization (Priority: Medium)
  - Description: Search the `client/` tree for any relative imports of the stores (patterns like `../stores` or `../../stores`) and refactor them to the canonical alias (`$lib/stores`). Add a lightweight CI check or linter rule to ensure store imports use the alias going forward.
  - Acceptance: no relative store import paths remain; dev server and tests still pass; re-run a short HMR stress test to see if the issue persists.
  - Time estimate: ~30–120 minutes depending on number of occurrences and test/CI adjustments.

Notes:

- These items are now part of the Master Fix Plan and are tracked with checkboxes above. Pick one to run after lunch and I will execute it and record results back into this document.
- Recommended next step: run B (stack-trace instrumentation) because it provides the clearest diagnostic signal and helps target a fix quickly.
