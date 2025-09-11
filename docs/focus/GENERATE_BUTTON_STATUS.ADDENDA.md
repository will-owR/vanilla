````markdown
# Generate Button — Addenda (Actionable Implementation Guide)

This addenda converts the checklist in `GENERATE_BUTTON_STATUS.md` into a concrete, actionable plan contributors can implement, test, and verify.

Source: `docs/focus/GENERATE_BUTTON_STATUS.md`

## Purpose

- Provide a minimal API contract, UI state machine, tests, file targets, acceptance criteria, and verification steps to make the Generate button implementation actionable.

## Assumptions (inferred)

- Frontend: Svelte + Vite under `client/`.
- Backend: Node/Express under `server/` exposing preview/export endpoints.
- Tests: Vitest is available for client and server.

If these assumptions are wrong, adjust paths and commands accordingly.

## Minimal API contract (recommended)

1. Synchronous preview (demo-friendly)

- POST /prompt
- Request body: { prompt: string, template?: string, options?: object }
- Success (200): { previewHtml: string, summary?: string }
- Error (4xx/5xx): { errorCode: string, message: string, details?: object }

2. Asynchronous job (queue-based)

- POST /prompt -> returns { jobId: string }
- GET /jobs/:jobId/status -> { status: "queued"|"running"|"done"|"failed", progress?: number, previewUrl?: string, error?: {...} }
- GET /preview?jobId=:jobId -> returns previewHtml when ready

Include an optional query parameter `?dev=true` for deterministic test responses.

## UI state machine (minimal)

- invalid (input invalid) -> button disabled
- ready (input valid) -> button enabled
- loading (request in-flight) -> button disabled, show spinner
- success -> show preview, enable export, show success toast
- error -> show error message, keep input, enable retry

Behavior rules

- Prevent duplicate clicks by entering `loading` immediately on first click.
- Preserve input on error.
- Timeouts: consider client-side 60s timeout for requests; treat as recoverable with retry.

## File targets (suggested edits)

- client/src/components/GenerateButton.svelte (create or update)
  - Implement state machine, visual states (disabled, spinner, success, error), and fetch logic.
- client/src/lib/api.js (create)
  - Centralize fetch calls: `postPrompt(payload)` and `getJobStatus(jobId)` helpers with error parsing.
- client/**tests**/generate-button.test.ts
  - Unit tests for state transitions using mocked fetch responses.
- client/**tests**/generate-button.integration.ts (optional)
  - Integration test that runs against a dev stub endpoint `POST /prompt?dev=true`.

If your repo uses different locations, pick equivalent files and update import paths.

## Test matrix / Acceptance tests (automatable)

1. Unit tests (Vitest + DOM)

- Happy path: valid input → button enabled → click → loading → success → preview shown and export enabled.
- Error path: valid input → server 500 → error UI shown, input preserved, button enabled for retry.
- Duplicate click prevention: multiple rapid clicks should only send one network request.

2. Integration smoke (dev mode)

- Start server in dev mode with a deterministic `/prompt?dev=true` handler that returns `{ previewHtml: "<div>preview</div>" }`.
- Start client; in browser click Generate and confirm preview appears within 3s (local expectation) and no uncaught exceptions logged.

3. Performance check (optional)

- Measure response times in local runs; ensure button initial visual response < 500ms (client-side state change), and preview fetched/displayed < 3s on a local dev stub.

## Example client-side flow (pseudocode)

```js
// ...existing code...
// client/src/lib/api.js
export async function postPrompt(payload) {
  const res = await fetch("/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}
```
````

```svelte
<!-- client/src/components/GenerateButton.svelte (sketch) -->
/* - bind input value from parent - */
// states: 'idle'|'loading'|'success'|'error'
// on:click -> set state = 'loading'; call postPrompt(); handle response -> state = 'success' or 'error'
```

## Error taxonomy & suggested messages

- Validation error (400): "Please complete required fields."
- Transient server error (5xx / network): "Temporary server error — please retry." (offer Retry)
- AI-specific failure: "Generation failed — try changing the prompt or try again later." (include error.code when available)

## Definition of Done (DoD)

- [ ] Button enables only when input is valid.
- [ ] Clicking the button shows immediate visual feedback (spinner or state change) within 500ms.
- [ ] Duplicate clicks are prevented while a request is in-flight.
- [ ] On success: preview panel is updated with returned HTML and Export button is enabled.
- [ ] On error: meaningful message is shown, input preserved, and retry is possible.
- [ ] Unit tests cover happy and error paths and pass in CI.
- [ ] Integration smoke test passes against `?dev=true` endpoint.

## Option 1 — Document First, Actionables, Implement, Verify (recommended)

- Rationale: reduces rework by aligning implementers and reviewers on a minimal, testable slice before any code changes are merged.
- Workflow:
  1. Create or update the documentation and API contract (this file fulfills that requirement).
  2. Add explicit, small actionables to the `Time estimates & tracker` table and set `Status` to `In Progress` when someone starts work.
  3. Implement only the smallest set of code necessary to satisfy one or more DoD items.
  4. Add or update unit and integration tests that assert the acceptance criteria.
  5. Run the verification steps locally (see `Minimal acceptance commands`) and ensure all checks pass.
  6. Mark the DoD checkboxes for the tasks completed, update `Status` to `Done`, and record start/finish timestamps and actual hours.

### Check-off Template (to paste into PR description or update in this file on completion)

```
Task: <short task id/name>
Files changed: <comma-separated list>
Acceptance tests run:
 - `npm --prefix client test` : <pass|fail>
 - Integration smoke: <pass|fail> (describe environment)
DoD items completed:
 - [x] Button enables only when input is valid.
 - [x] Clicking shows immediate visual feedback within 500ms.
 - [x] Duplicate clicks prevented.
 - [x] Preview updated on success.
 - [x] Error behavior preserved input and allows retry.
Time spent: <hours>
Notes: <short notes>
```

Follow this template when opening PRs so reviewers can quickly confirm that the documented verification steps were executed.

## Minimal acceptance commands (how to verify locally)

Start servers (devcontainer or local):

```bash
# start backend
npm --prefix server run dev
# start frontend
npm --prefix client run dev
```

Run client tests:

```bash
npm --prefix client test
```

Run server smoke export (if implementing export):

```bash
node server/scripts/run_export_test_inproc.js
```

## Estimated effort (rough)

- Phase A (minimal demo + unit tests): 1–2 days
- Phase B (progress updates, cancel, retry, polishing): 2–4 days

## Time estimates & tracker

Use the table below to record the original estimate, assigned owner, start/end timestamps, and actual time spent. Update the `Status` field as work progresses (Todo → In Progress → Blocked → Done). Keep this file as the single source of truth for estimate vs actual tracking for the Generate button work.

| Task ID | Task                                                        | Estimate | Owner  |   Status    |       Started        |       Finished       | Actual (hrs) | Notes                                                                                             |
| ------: | ----------------------------------------------------------- | :------: | :----: | :---------: | :------------------: | :------------------: | :----------: | ------------------------------------------------------------------------------------------------- |
|      A1 | Add `client/src/lib/api.js` (postPrompt helper)             |   0.5d   | ke-lav |    Done     | 2025-09-11T13:00:00Z | 2025-09-11T13:30:00Z |     0.5      | Verified existing `client/src/lib/api.js` provided `submitPrompt`; no new file needed.            |
|      A2 | Implement `GenerateButton.svelte` (state machine + spinner) |    1d    | ke-lav |    Done     | 2025-09-11T13:10:00Z | 2025-09-11T15:10:00Z |     2.0      | Polished `PromptInput.svelte` generate button with spinner, aria attributes, and improved titles. |
|      A3 | Unit tests (Vitest) for Generate button                     |   0.5d   | ke-lav |    Done     | 2025-09-11T13:30:00Z | 2025-09-11T15:00:00Z |     1.5      | Added `client/__tests__/generate-button.test.ts` and iterated on Svelte 5 test adapter.           |
|      A4 | Dev-only server stub `/prompt?dev=true`                     |  0.25d   | ke-lav |    Done     | 2025-09-11T13:05:00Z | 2025-09-11T13:15:00Z |     0.17     | implemented dev stub in server/index.js                                                           |
|      A5 | Integration smoke (manual verification)                     |  0.25d   | ke-lav | In Progress | 2025-09-11T14:00:00Z |                      |              | manual smoke pending                                                                              |
|      B1 | Progress updates / polling or websocket                     |    1d    |  TBD   |    Todo     |                      |                      |              |                                                                                                   |
|      B2 | Cancellation and retry UX                                   |    1d    |  TBD   |    Todo     |                      |                      |              |                                                                                                   |
|      B3 | Input validation & error taxonomy mapping                   |   0.5d   |  TBD   |    Todo     |                      |                      |              |                                                                                                   |
|      B4 | CI integration for unit & integration tests                 |   0.5d   |  TBD   |    Todo     |                      |                      |              |                                                                                                   |

How to use the tracker

- When starting a task, fill `Owner` and `Started` (ISO 8601 timestamp) and set `Status` to `In Progress`.
- When a task is blocked, set `Status` to `Blocked` and add a short `Notes` entry describing the blocker.
- When finished, set `Finished`, compute `Actual (hrs)` (decimal hours), and set `Status` to `Done`.
- Periodically (e.g., daily), update this table with real times so we can compare against original `Estimate`.

Example entry after completion:

| A2 | Implement `GenerateButton.svelte` (state machine + spinner) | 1d | alice | Done | 2025-09-12T09:00Z | 2025-09-12T14:30Z | 5.5 | Extra time for CSS and accessibility tweaks |

This tracker is intentionally small and plain-markdown so it can be edited directly in pull requests and shown in branch diffs. If you prefer, we can also extract it to a JSON or YAML file for automated reporting.

## Next steps (recommended immediate commits)

1. Add `client/src/lib/api.js` with `postPrompt` helper and error normalization.
2. Implement `client/src/components/GenerateButton.svelte` with state machine and spinner.
3. Add unit tests under `client/__tests__/` (Vitest) and run them locally.
4. Add a small dev-only stub on the server for `/prompt?dev=true` returning deterministic preview HTML.

## Linkage back to primary source

- This addenda is an actionable companion to `docs/focus/GENERATE_BUTTON_STATUS.md`. Update the original doc to reference this addenda (example line to add to the top of the original):

  > See `GENERATE_BUTTON_STATUS.ADDENDA.md` for an actionable implementation plan, API contracts, and test commands.

---

Created to make the non-functional status actionable and testable with small, verifiable steps.

```

```
