# ARCHITECTURE v1 — Consolidated View

Date: 2025-10-15
Branch: aether-rewrite/client-phase2-AAA-sol1-95

Short take (big picture)

This document consolidates the validated V1 pieces of the system: plumbing and transport, backend orchestrator/services, and the frontend interaction model. The goal is a single, readable reference that describes how a prompt flows from the UI to the server, how the server resolves and sanitizes content, how persistence is handled, and the expected client contracts (requestId, preview HTML, and persistence handles). Keep these core contracts stable: server returns sanitized, display-ready preview HTML; responses include `requestId` both as `X-Request-Id` and in JSON metadata; preview updates are store-driven and deterministic.

---

## 1. Architecture Principles (canonical)

1. Always-Working Frontend First

   - Consistent, working state
   - Independent component testing
   - Clear display/logic separation
   - Predictable data flow

2. "Dumb" Preview Component

   - Display-only responsibility
   - Store-driven updates
   - Clean business logic separation

These principles are non-negotiable. The consolidated architecture enforces them by centralizing orchestration on the backend, centralizing rendering/sanitization, and keeping the preview UI purely display-driven.

---

## 2. Big-picture flow (micro-sequence)

1. Frontend submits a prompt (via `promptStore.submitPrompt()` / `storeAdapter`) and POSTs a normalized payload.
2. Server plumbing (`server/index.js`) validates, optionally caches, and forwards the payload to the orchestrator (`genieService.generate(payload)`).
3. `genieService` chooses a concrete application service (via `serviceAdapter` or heuristics), sanitizes/normalizes output, converts persist intents to persist instructions, and returns a normalized envelope.
4. Plumbing responds immediately with a JSON envelope containing `preview` (sanitized HTML when applicable), `data.content`, `metadata.requestId`, and `persistInstructions` (or persisted ids if cached).
5. Persistence executes asynchronously: prompt row, `ai_result` row, artifact files (atomic tmp->rename) and artifact DB rows are written; persistence results may be discoverable via `requestId`.
6. Client consumes the envelope and updates `previewStore`; a dumb `PreviewWindow` renders store state and toggles `data-preview-ready` when content is ready.

---

## 3. Plumbing / Transport (what's implemented)

- `server/index.js` — Express plumbing with middleware (CORS, rate-limit, request-id), route handlers (legacy and new), and lifecycle management for Puppeteer exports.
- Request-correlation: request-id middleware sets `req.requestId`, attaches `X-Request-Id` header on responses, and middleware ensures `requestId` is propagated into service metadata.
- `server/previewRenderer.js` — centralized rendering and sanitization for preview and export flows.
- Persistence utilities: `server/persistence.js` implements safe path validation and atomic file writes; `server/crud.js` and `server/db.js` manage DB persistence.
- Error handling: `server/utils/errorHandler.js` centralizes consistent JSON error shapes and logging.

Where to look: `server/index.js`, `server/previewRenderer.js`, `server/persistence.js`, `server/utils/errorHandler.js`.

---

## 4. Backend orchestrator & services (what's implemented)

- `server/serviceAdapter.js` — resolves the concrete generator implementation (default: `genieService`).
- `server/genieService.js` — orchestrator responsible for:
  - service selection (heuristics, `serviceHint`, defaults)
  - sanitization of returned content (title/body/html)
  - normalizing `persistIntents` → `persistInstructions`
  - returning the normalized envelope expected by plumbing
- Application services: `server/sampleService.js`, `server/aiService.js`, `server/testService.js` — business logic and provider wrappers.

Where to look: `server/genieService.js`, `server/serviceAdapter.js`, `server/sampleService.js`, `server/aiService.js`.

---

## 5. Frontend (what's implemented)

- `storeAdapter` / `promptStore` — the client-side entrypoint that submits normalized payloads and is currently dual-aware for migration flows (legacy endpoints vs V1 `/api/generate` when payload includes `formDefaults`).
- `PreviewWindow` — a dumb, store-driven component that renders `previewStore` content and reflects state via DOM attributes such as `data-preview-ready`.
- Testing scaffolding: deterministic `testService` stubs and Playwright E2E tests exist; tests were hardened to avoid leaving artifacts and to run deterministically.

Where to look: `client-v2/src/lib/storeAdapter.js`, client stores (promptStore/previewStore), `client` preview components, and `playwright/` tests.

---

## 6. Glue: contracts and expectations (how they become one)

Core contracts — these are the glue that keeps plumbing, orchestrator, and frontend aligned:

1. Sanitized preview HTML

   - Server guarantees that HTML returned in `preview` or `data.content.body` is sanitized and safe to embed. `previewRenderer.js` is the canonical renderer for preview/export flows.

2. Request correlation (`requestId`)

   - Each inbound request has a `requestId`. Responses include `X-Request-Id` and `metadata.requestId` to allow clients to correlate responses and ignore stale results.

3. Normalized envelope

   - The server responds with a predictable JSON envelope: `{ success, requestId, preview?, data: { content, metadata, persistInstructions? } }`.

4. Persist contract

   - `genieService` produces `persistInstructions` for `persistence.execute()`; file writes are atomic (tmp->rename), and artifacts are recorded in the DB.

5. Testability hooks

   - `serviceHint` can be passed from client tests to `genieService` to select deterministic services for E2E and unit tests; `?dev=true` is deprecated in favor of `serviceHint`.

6. Migration routing (staged rollout)

   - `storeAdapter` remains dual-aware during the staged rollout and routes to V1 `/api/generate` for the new payload shape while preserving legacy `/prompt`/`/genie` behavior until Stage 3 (contract) is complete.

---

## 7. Outstanding work (dv02 pointers)

- Stabilize preview-store driven updates and ensure `PreviewWindow` renders deterministically (move any remaining presentation logic out of the component).
- Add `GET /api/ai_results?requestId=<id>` or similar discoverability endpoint for persisted results.
- Canonicalize `persistInstructions` naming and fully document sanitization responsibility (service-level vs plumbing-level).
- Harden Playwright E2E harness and unit tests for preview store transitions.
- Complete staged rollout: implement `/api/generate`, update `storeAdapter` to route based on payload shape, migrate tests, then remove legacy endpoints.

---

## 8. Where to look (quick references)

- Backend: `server/index.js`, `server/genieService.js`, `server/serviceAdapter.js`, `server/previewRenderer.js`, `server/persistence.js`, `server/utils/errorHandler.js`.
- Frontend: `client-v2/src/lib/storeAdapter.js`, client stores and `PreviewWindow` components.
- Tests: `server/__tests__`, `playwright/`, `client` unit tests.

---

## 9. Next recommended steps

1. Stabilize previewStore → PreviewWindow flows with focused unit tests and fix any remaining store wiring disalignment.
2. Implement the `/api/generate` thin wrapper endpoint and the `architecture-v1-flow` test to validate the new payload shape end-to-end in CI.
3. Canonicalize naming and update docs: `persistInstructions`, `requestId` contract, sanitizer responsibilities.
4. After validation, perform the Stage 3 contract step: remove legacy endpoints and simplify `storeAdapter`.

---

_This consolidated file merges the authoritative V1 artifacts for plumbing, backend services, and frontend expectations to provide a single-stop reference for developers and reviewers._
