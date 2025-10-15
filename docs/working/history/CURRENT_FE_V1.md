# CURRENT_FE v0-1 — V1 (Implemented)

Date: 2025-10-15
Branch: aether-rewrite/client-phase2-AAA-sol1-95

Architecture Principles

1. **Always-Working Frontend First**

   - Consistent, working state
   - Independent component testing
   - Clear display/logic separation
   - Predictable data flow

2. **"Dumb" Preview Component**
   - Display-only responsibility
   - Store-driven updates
   - Clean business logic separation

These principles are fundamental and are reflected in the current implementation described below.

---

Note: per recent clarification, the previously described "preview update bug" is better characterized as a disalignment in functionality between the client and expected server responses or store wiring. This V1 file records the repository's current state so we have a canonical source of truth for how the frontend actually works today.

## High-level micro-sequence (frontend → plumbing → genieService → application services → persistence)

1. Frontend (client-v2)

   - User submits a prompt via the UI (for example, `PromptForm.svelte` dispatches `submit`), which ultimately calls `promptStore.submitPrompt()`.
   - The client performs a POST to `/prompt` with body `{ prompt: "..." }` (in dev the Vite proxy maps this to the server).

2. Server plumbing (`server/index.js` POST `/prompt`)

   - Validates input and computes a normalized hash for cache lookups.
   - If a cached prompt/result exists, returns cached result immediately (200) with metadata.
   - If not cached, calls `genieService.generate(payload)` and passes along `requestId` when present.

3. Orchestrator: `genieService.generate(payload)`

   - Centralizes service selection, sanitization, normalization, and conversion of persist intents into normalized instructions for plumbing.
   - Ensures a deterministically traceable `requestId` (reuse incoming or generate one).
   - Selects application service (heuristic + fallbacks) and calls it to obtain `{ content, metadata, persistIntents }`.
   - Sanitizes returned content fields using the server sanitizer.
   - Normalizes `persistIntents` -> `persistInstructions` for `persistence.execute()`.
   - Returns a normalized envelope: `{ success:true, data: { content: safeContent, metadata: { ...metadata, requestId }, persistInstructions, requestId } }`.

4. Plumbing responds

   - The server replies immediately to the client with a JSON envelope containing top-level `preview` (HTML string when available), `requestId`, and `data`.
   - Persistence is scheduled asynchronously: server persists prompt row, creates `ai_result` row, executes `persistence.execute(persistInstructions)`, and records artifact rows via `crud.createArtifact(...)`.

5. Client receives preview

   - Client extracts HTML from `data.content` / `data.preview` / `preview` and sets `previewStore` for `PreviewWindow` to render.
   - Persisted identifiers (ai_result_id, artifact ids) may be returned on cached responses; otherwise they appear only after async persistence completes.

---

## As implemented (truth on disk)

- Endpoint: `POST /prompt` in `server/index.js` implements two branches:
  - `POST /prompt?dev=true` — deterministic quick handler for tests (returns 201 with deterministic content and skips persistence).
  - Normal `POST /prompt` — performs cache lookup, calls `genieService.generate(...)`, responds with `preview`/`data` and schedules async persistence.
- Orchestrator: `server/genieService.js` implements selection logic, sanitization, and persist-intent normalization.
- Preview rendering/sanitization: `server/previewRenderer.js` is used by `GET /preview` and `POST /api/preview` to produce sanitized HTML; `genieService` applies sanitization to content fields returned on `/prompt`.
- Persistence: `persistence.execute()` is invoked asynchronously by `server/index.js` after response to apply `persistInstructions` and record artifacts via `crud.*`.
- Test scaffolding: `testService.js` exists to provide deterministic content for tests; a Playwright E2E test scaffold was added to exercise the end-to-end loop (test currently present in the repo).

## Representative server response shapes (as implemented)

- Cached (200) — top-level envelope with `data.content`, `metadata.requestId`, and persisted ids when available.
- New generation (201) — top-level `preview` and `data.persistInstructions` returned, with async persistence scheduled.

---

## Implemented reconciliation item

- `serviceHint` support: the backend and `genieService` include support for a `serviceHint` coming from the request payload. This allows tests to explicitly select a deterministic service implementation (e.g., `testService`) without relying on `?dev=true`.

---

## Files (where to look)

- `server/index.js`, `server/genieService.js`, `server/serviceAdapter.js`, `server/previewRenderer.js`, `server/persistence.js`, `server/testService.js`, `server/__tests__/preview-update.spec.mjs`

_This V1 file is the canonical, implemented snapshot of the frontend↔backend interaction and how the frontend is expected to behave today._
