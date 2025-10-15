# ARCHITECTURE dv02 — Consolidated Pending Tasks

Date: 2025-10-15
Branch: aether-rewrite/client-phase2-AAA-sol1-95

Short take (big picture)

This consolidated dv02 document merges the outstanding and migration-focused work from the plumbing, frontend, and backend architecture dv02 notes. It defines the changes required to align the frontend's behavior with the backend's V1 expectations, close security and robustness gaps (sanitization, persistence safety), and complete the staged rollout to the new `/api/generate` flow. The core goal is a predictable, testable system where the frontend is always working, the preview component is dumb and store-driven, and the backend provides stable, sanitized envelopes and traceability.

---

## 1. Plumbing / Transport (pending)

- Ensure sanitizer contract is fully specified and covered by unit tests (edge cases: scripts, event handlers, data URIs).
- Remove any remaining presentation logic from `server/index.js` and centralize rendering in `server/previewRenderer.js` used by both preview and export flows.
- Design and implement streaming/incremental preview support (SSE or fetch streams) and plumbing helpers to expose async iterables or chunk callbacks that application services can use.
- Stabilize and test requestId propagation in all endpoints; include it in structured error payloads.
- Add CI checks and lint rules preventing application services from writing files directly (persistence must go through `persistence.execute`).
- Add discovery API: `GET /api/ai_results?requestId=<id>` (or `GET /api/by-request/<id>`) so clients can poll for persisted artifacts.

Priority checklist (plumbing)

1. Unit tests for `server/sanitizer.js` and `server/previewRenderer.js` (high).
2. Audit `server/index.js` to remove inline templating and invoke `renderPreview` uniformly (high).
3. Add `GET /api/ai_results?requestId=` endpoint (medium).
4. Design streaming API & plumbing helper (medium → separate spike required).

---

## 2. Frontend (pending)

- Stabilize `previewStore` → `PreviewWindow` flow so updates are deterministic and UI states (loading/ready/failed) are explicit.
- Ensure `PreviewWindow` is display-only: migrate any remaining logic for formatting/sanitization to server-side renderer or a shared renderer utility.
- Replace `?dev=true` test plumbing with `serviceHint` pass-through; add validation and gating for production use.
- Harden Playwright and unit test harnesses to be resilient against component loading order and asynchronous store updates.

Priority checklist (frontend)

1. Add unit tests for `previewStore` transitions and DOM assertions for `PreviewWindow` (high).
2. Remove presentation code from `PreviewWindow` and ensure it consumes only `previewStore` (high).
3. Implement `serviceHint` usage in test harnesses and deprecate `?dev=true` (medium).
4. Harden E2E Playwright tests to reliably reproduce and validate the preview flow (medium).

---

## 3. Backend orchestrator & migration (pending)

- Implement `/api/generate` thin wrapper endpoint and run the new payload format through `genieService.generate()` (stage 1 of rollout).
- Formalize `genieService` selection logic (Primacy of Defaults) and ensure `serviceHint` and `formDefaults` are honored and validated.
- Canonicalize persistence naming: use `persistInstructions` consistently across services and plumbing.
- Ensure persistence executor (`persistence.execute`) validates paths (negative tests) and writes atomically (tmp -> rename) with DB artifact records including `requestId` for traceability.

Priority checklist (backend/orchestrator)

1. Add `/api/generate` thin wrapper and update docs (high).
2. Add `architecture-v1-flow.spec.mjs` test to validate end-to-end new payload flows (high).
3. Canonicalize `persistInstructions` naming and update `genieService` and `persistence.execute()` usage (medium).
4. Add negative persistence tests for path traversal and invalid folder/filename hints (high, small immediate task).

---

## 4. Glue: cross-cutting contracts to enforce

1. Sanitization contract: server returns sanitized, display-ready HTML for preview endpoints and export flows. Tests must assert sanitizer behavior on edge inputs.
2. Request correlation: every generation/export response includes `X-Request-Id` header and `metadata.requestId` in the JSON envelope.
3. Normalized envelope: the server returns `{ success, requestId, preview?, data: { content, metadata, persistInstructions? } }` consistently.
4. Persist contract: `persistInstructions` are the canonical persistence payload accepted by `persistence.execute()`; artifacts are recorded in DB with `requestId`.
5. Test hooks: `serviceHint` is the canonical, validated way for tests to request deterministic services; `?dev=true` is deprecated.

---

## 5. Suggested implementation plan (practical order)

Phase A (0.5–2 hours each, high-impact):

1. Write negative persistence test to assert path traversal is rejected by `persistence.execute()` (0.5–1 hour).
2. Add sanitizer unit tests and audit `renderPreview` usage (1–2 hours).
3. Implement `/api/generate` thin wrapper and add `architecture-v1-flow` test scaffolding (1–2 hours).

Phase B (medium):

4. Harden Playwright E2E harness and add focused tests for `previewStore` → `PreviewWindow` transitions (2–4 hours).
5. Design streaming API spike and prototype (6–12 hours if pursued).

Phase C (contract):

6. Remove legacy endpoints and simplify `storeAdapter` after migration is validated (1–2 hours plus coordination).

---

## 6. Acceptance criteria (dv02 consolidated)

- Sanitizer unit tests pass and demonstrate safe handling of scripts, event attributes, and data URIs (or a documented decision not to allow them).
- `PreviewWindow` renders only store-driven content and unit tests assert loading/ready/failed transitions.
- `/api/generate` handles new payloads, `storeAdapter` correctly routes V1 payloads, and `architecture-v1-flow` test passes in CI.
- Negative persistence tests pass and show `persistence.execute()` rejects attempts to escape the base export directory.
- CI enforces sanitizer tests, persistence tests, and prevents direct file writes from application services.

---

## 7. Where to look / references

- Plumbing dv02: `docs/working/PATH_FORWARD_Plumbing_Separation_dv02.md`
- Frontend dv02: `docs/working/CURRENT_FE_dv02.md`
- Backend dv02: `docs/working/BE_service_architecture_dv02.md`

---

If you'd like, I will now create the immediate high-impact items: the negative persistence test and sanitizer unit tests, commit them, and open a PR. Or I can keep the documents separate; both approaches are valid — consolidation helps with a single action plan, whereas separate docs are easier to assign to different owners. Which do you prefer?
