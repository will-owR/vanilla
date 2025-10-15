# Actionable Plan: Fix State Management Bug (`-BB`)

This document outlines the plan to fix the state management bug that causes a UI error during content generation and persistence.

## 1. Problem Diagnosis

The root cause of the `uiState error: No valid content provided for preview` is a race condition and incorrect state update within the `persistContent` function in `client/src/stores/index.js`.

- **The Flow**:
  1.  `generateAndPreview` is called.
  2.  It calls the `/prompt` API to get the generated `title` and `body`.
  3.  It updates the `contentStore` with this new content.
  4.  Crucially, it _asynchronously_ calls `persistContent`.
  5.  `persistContent` calls the `/api/prompts` endpoint to save the content and get back a `promptId`.
  6.  **The Bug**: Upon success, `persistContent` updates the `contentStore` again, but the response from `/api/prompts` only contains the `promptId` and a few other fields, **not** the `title` and `body`. This overwrites the existing store data, wiping out the `title` and `body` that the preview component relies on.
  7.  The `previewStore`'s reactive logic sees the incomplete content and correctly reports that there is "No valid content provided for preview," triggering the UI error.

## 2. Proposed Solution

The fix is to ensure that when `persistContent` updates the `contentStore`, it **merges** the new `persisted` data (containing the `promptId`) with the **existing** content in the store, rather than overwriting it.

The implementation will involve:

1.  In `client/src/stores/index.js`, modify the `persistContent` function.
2.  Inside the function, get the current value of the `contentStore`.
3.  When the API call to `/api/prompts` is successful, perform a deep merge of the current store value and the `persisted` object returned from the API.
4.  Set the `contentStore` with this newly merged object, preserving all necessary fields (`title`, `body`, `promptId`, etc.).

## 3. Verification Plan (Checkables)

To confirm the fix is successful and has not introduced regressions, the following checks must pass:

1.  **E2E Test**: Run the `node client/tests/e2e/generate-and-verify.spec.mjs` script.

    - **Expected Outcome**: The script must complete successfully, and the log output must **not** contain the line `uiState update: {status: error, message: No valid content provided for preview}`.

2.  **Manual UI Test**:

    - Launch the application.
    - Enter a prompt and click "Generate".
    - **Expected Outcome**: The preview window on the right should update correctly with the generated content. The loading indicators should appear and then be replaced by the final preview without any intervening error messages.

3.  **Data Integrity Check**:
    - After a successful generation in the manual UI test, check the application's database (or network tab for the API response).
    - **Expected Outcome**: The persisted record for the new prompt should contain the `promptId`, `title`, and `body`. The `contentStore` in the Svelte devtools should reflect the complete, merged object.

## 4. Next steps (checklist)

The following actionable steps are recommended. Each item includes the reason why it matters and how to verify it.

- [x] Add unit tests for `persistContent` (created)

  - Why: A small unit test is the fastest way to lock in the merge behavior and prevent regressions. It documents the expected contract (server may return only an id) and ensures we preserve generated fields.
  - Files created: `client/__tests__/persistContent.spec.js` (covers create and update paths)
  - How to run: from the repository root run:

    ```bash
    # run just the new test file with Vitest
    npx vitest run client/__tests__/persistContent.spec.js
    ```

  - Status: Started — tests have been added and executed locally. See "Progress log" below for current run results and notes on flakiness.

- [x] Create manual verification instructions (documented)

  - Why: E2E and integration tests can pass while a human-driven session still trips an edge case caused by race conditions; a documented manual reproduction ensures the UX works in a browser and gives confidence for QA.
  - How to run (dev container / local):

    ```bash
    # start backend
    npm --prefix server run dev

    # start frontend
    npm --prefix client run dev

    # open http://localhost:5173 in a browser (or port printed by Vite)
    # Enter a sample prompt and click "Generate". Watch the preview window.
    ```

  - Status: Implemented (instructions added here). I recommend running this after resolving the test flakiness below.

- [ ] Fix unit-test mocking flakiness / isolation

  - Why: Running the full test suite revealed a couple of related problems: the mocked API module id must be hoisted and the integration tests exercise the preview endpoints which can trigger rate-limits (429) during tight test runs. Fixing these will make the new tests reliable in CI.
  - Suggested approaches:
    - Adjust the unit test to use a hoisted literal `vi.mock('<absolute-path>')` (done), then run the single test in isolation to validate it.
    - If mocking remains brittle, refactor `persistContent` to accept API functions as optional dependency injections (easier to unit-test) or add a small module-alias mapping in the Vitest config so the import id is stable.
  - Status: In progress (I added the hoisted mock and ran tests; see Progress log)

- [ ] Add a small Vitest unit test for the merge behavior that uses dependency injection

  - Why: If module-level mocking continues to cause friction, switching to explicit injection makes tests simpler and the function easier to reason about.

- [ ] Add a short regression test for the Preview UI (integration)
  - Why: Once the unit tests are stable, add a focused integration test that runs the minimal steps (generate -> persist -> preview) but isolates network calls (stub preview endpoint). This reduces flakiness compared to running the entire play/test matrix.

## 5. Progress log (what I implemented now)

- Created unit tests: `client/__tests__/persistContent.spec.js` (2 tests for create+update paths).
- Ran the client test suite locally (`npm --prefix client test`). Observations:
  - The new test file exists and is executed by Vitest when running the suite.
  - Running the full test suite produced unrelated integration timing issues and some 429 responses from the preview and prompts endpoints (these are environment / concurrency artifacts while integration tests exercise the server).
  - The unit tests initially hit a module-mocking resolution problem. I updated the test to use a hoisted literal `vi.mock('/workspaces/dinoWorld/client/src/lib/api', ...)` and moved the mocks to top-level so Vitest can rewrite imports before modules load. After that change I re-ran the suite.
  - Final result: the unit test file is present and executes, but running the entire test suite caused multiple test failures (some integration tests timed out because of 429 rate-limits). Running the new test in isolation is the recommended next verification step.

## 6. Recommended immediate actions (what I'll do next unless you tell me otherwise)

1. Run the new unit test in isolation and confirm it passes locally:

   ```bash
   # from repo root
   npx vitest run client/__tests__/persistContent.spec.js
   ```

2. If the isolated test passes, mark the unit test as green and move to a small refactor if needed: make `persistContent` accept injectable API functions (optional) to simplify unit testing.

3. Add one focused integration test which stubs the preview endpoint to avoid hitting rate limits in CI.

4. After tests are stable, open a PR from `AE-devolve/01-skip-puppeteer-temp-BB` to `main` with these changes and include `docs/fix/actionables-BB.md` as documentation of the fix and verification steps.

## 7. Notes / Rationale

- Why unit tests first: the bug is a pure state-management issue (merging persisted fields). A unit test is the fastest, lowest-cost verification and documents the intended contract.
- Why manual verification: integration tests can be noisy; a quick manual check validates the user's actual experience in the browser.
- Why stubbing preview in integration tests: the preview endpoint is comparatively heavy and has rate-limits; stubbing it for the focused regression keeps CI reliable.

If you'd like, I'll now run the isolated Vitest invocation for the new test and report the result here (or open a PR with the new test + doc edits). Which would you prefer next?
