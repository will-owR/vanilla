# PROTO_Valid_GUI — Phase A (Frontend visual mock)

Recorded: 2025-09-08

Modus Operandi (how we work)

- Branch-per-actionable: each implementation task gets its own branch named `proto/<phase>-<short-desc>` (this document guides Phase A: visual mock - branch `proto/phaseA-visual-mock`).
- No direct edits to `proto/valid-gui`: `proto/valid-gui` is the canonical prototype baseline and receives only verified merges from phase branches.
- Mock-first, test-early: implement UI with mocks first, validate visually and via a headful smoke test (Playwright), then iterate to backend alignment.
- Keep changes minimal and reversible: adapter pattern for API calls so production code can be restored easily.
- Short cycles: aim for hours, not days; each phase should be small, verifiable, and merged quickly into `proto/valid-gui` after signoff.

Phase A — Frontend visual mock (goal: get a working, visually-real GUI quickly)

Overview:

- Create a dedicated branch `proto/phaseA-visual-mock` off `proto/valid-gui`.
- Implement a mock adapter that satisfies the UI's current API calls and returns canned responses.
- Reuse existing Svelte components. Minimize code changes — prefer adapter swap and small wiring only.
- Add a minimal Playwright smoke test to assert page mounts, mock flow works, and no console errors.

High-level checklist (checkable)

- [ ] Create branch `proto/phaseA-visual-mock` (from `proto/valid-gui`) — DONE/Created
- [ ] Create tracking doc (this file) in `docs/focus/` — DONE
- [ ] Add `src/mocks/mockApi.js` adapter (returns canned prompt/preview/export payloads)
- [ ] Wire adapter into client in branch only (swap import path or use env flag)
- [ ] Ensure PreviewWindow, PromptInput, ExportButton render correctly with mock data
- [ ] Add visual polish and accessible states (loading spinner, banners, disabled/active states)
- [ ] Add Playwright smoke test that: mounts page headful, asserts prompt input focusable, clicks Generate, waits for preview, checks cancel behavior, and asserts no console errors
- [ ] Manual UX validation: record a short screencast or screenshots and note any console errors
- [ ] Create PR from `proto/phaseA-visual-mock` -> `proto/valid-gui` with screenshots and test results

Detailed expansion (concrete tasks)

1. Mock adapter (30–90 minutes)

- Create `client/src/mocks/mockApi.js` exposing async functions: `submitPrompt(prompt)`, `loadPreview(content)`, `exportToPdf(content)`.
- Each function returns a Promise that resolves after configurable latency (e.g., 150–600ms) with canned responses:
  - `submitPrompt` → { content: { title, body, background } }
  - `loadPreview` → HTML snippet string (small sample of preview page)
  - `exportToPdf` → simulated blob download trigger or resolved success
- Make adapter easy to swap: the client code should `import { submitPrompt, loadPreview, exportToPdf } from '../lib/api'` — for this branch, ensure that path resolves to the mock adapter (adjust index barrel or use a small `src/lib/apiAdapter.js` that re-exports the mock)

2. Minimal UI wiring (30–120 minutes)

- Ensure `PreviewWindow` uses the adapter and handles aborts (existing abortable fetch behavior may be retained but mock should honor an `abort()` pattern).
- Ensure status banners and spinners show during mock latency and success or error states are exercised.

3. Playwright smoke test (30–90 minutes)

- Add `client/__tests__/e2e/phaseA.smoke.spec.js` or reuse `client/scripts/browser_cancel_test.mjs` updated to run headful and assert:
  - Page loads and no console errors on initial mount
  - Prompt input is focusable and editable
  - Clicking Generate shows spinner and then preview content
  - Clicking Cancel aborts preview and returns to editable state
- Keep test short and flaky-robust (timeouts generous but not excessive)

4. Manual verification and signoff (15–30 minutes)

- Run `cd client && npm run dev` and open http://localhost:5173
- Run Playwright smoke locally (or run headful test) and capture console output
- If all green, create PR with screenshots, test run output, and brief notes.

Acceptance criteria (Phase A complete)

- Page mounts and shows the main UI within 2s in a local dev browser
- Prompt input is focusable and editable immediately
- Mock-generated preview shows within configured latency when clicking Generate
- Cancel aborts in-flight preview and returns UI to editable state
- No uncaught exceptions in browser console during initial mount
- Playwright smoke test passes headful locally

Merge & handoff process

- Once Phase A verified, open a PR from `proto/phaseA-visual-mock` -> `proto/valid-gui` with screenshots and test logs
- After PR approval merge into `proto/valid-gui`
- `proto/valid-gui` remains the canonical prototype branch—further phases branch off from it

Timebox & owners

- Estimated Phase A time: 2–6 hours (optimistic). Target: 4 hours.
- Suggested owner: whoever is available to implement quickly; reviewer: one teammate for signoff.

Notes on reuse

- Reuse existing Svelte components to preserve prior investment
- Avoid deep refactors in Phase A; prefer adapter swap and small wiring
- Keep the mock adapter intentionally simple and temporary (comment and clearly mark it in code)

Next immediate actions (pick one to start Phase A)

- (1) I will produce a file-level change checklist (exact files to add/modify and sample mock payloads) so an implementer can begin (no repo edits). Time ~30–60m.
- (2) I will create the branch `proto/phaseA-visual-mock` on the remote (done) and prepare a PR template and checklist for the implementer to use. Time ~10–20m.
- (3) I will draft the mock response payloads (sample HTML and JSON) for the adapter to return (copy-paste ready). Time ~15–30m.

Pick 1, 2, or 3 and I'll proceed (no implementation until you say go).
