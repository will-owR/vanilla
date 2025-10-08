# PATH_FORWARD: Plumbing vs Application Service Separation

Date: 2025-10-06
Branch: aether-rewrite/client-phase2-AAA

This document records the findings from a review of the server implementation with a focus on the separation between plumbing (transport/IO) and application services (business logic/orchestration). It summarizes what is implemented, important gaps and risks, and prioritized next steps.

**Note:** The role of serviceAdapter is to link plumbing to application services (it’s the resolver/switch); plumbing interacts with it to get a concrete service. Application services are the resolved targets and do not themselves interact with the adapter.

---

## What’s implemented (inventory)

- Service adapter / implementation selection

  - `server/serviceAdapter.js` resolves the concrete generator implementation (default: `genieService`). Good single-point swap for different generator implementations.

- Application-level generator implementations

  - `server/genieService.js` — demo application service that orchestrates generation (delegates to `sampleService`) and normalizes the output shape (content + metadata).
  - `server/aiService.js` — provider abstraction with `MockAIService` (dev/test) and `RealAIService` (Gemini wrapper). Encapsulates provider parsing and heuristics.

- Transport / plumbing (HTTP, middleware, Puppeteer)

  - `server/index.js` — Express routes, middleware (CORS, rate-limit, request-id), Puppeteer lifecycle, preview/export endpoints, and route handlers (e.g., POST `/prompt`, POST `/genie`, `/preview`, `/api/preview`, `/api/export`).

- Persistence and utilities

  - `server/crud.js`, `server/db.js` for storing prompts and AI results (index.js attempts non-fatal persistence after generation).
  - `utils/imageRewrite`, `pdfGenerator`, and `rewriteImagesForExportAsync` for export-related plumbing.

- Demo / deterministic stubs
  - `server/sampleService.js` used by `genieService` to provide deterministic content for local/dev/testing flows.

Overall: the repo already embodies a clear adapter + application-service pattern: plumbing is centralized in `index.js`, application services live in service modules (`genieService`, `aiService`), and `serviceAdapter` wires implementations together.

---

## Important gaps & risks

- HTML sanitization / XSS risk

  - `index.js` constructs `previewTemplate` and injects `content.body` and `content.title` directly into HTML before returning it. There is no explicit sanitization step in the request path. If AI/provider content can contain HTML, this is an XSS risk. Recommendation: sanitize server-side (application service or dedicated renderer) before embedding.

- Presentation code inside transport layer

  - The `previewTemplate` HTML lives in `index.js`. That mixes presentation concerns into the plumbing file. Consider moving templating/presentation into a dedicated `previewRenderer` or into the application service responsible for content shaping.

- No streaming / partial preview support

  - Current generator endpoints return full JSON responses. There's no streaming (chunked) endpoint or plumbing helper for incremental generation. If the UI will append chunks to `previewStore` (partial updates), backend plumbing and service must be extended (SSE / fetch streams / websocket) and the http plumbing should support callbacks or async iterables.

- No request correlation/requestId in responses

  - Without a requestId returned in responses, the client can't easily ignore stale results when multiple generation requests are in flight. Adding request IDs helps the application service and client avoid out-of-order overwrites.

- Sanitization responsibility unclear

  - Currently `genieService` normalizes content shape but does not explicitly sanitize HTML. Decide where sanitization happens (server preferred) and make it a documented, unit-tested step in the application service pipeline.

- Presentation vs export duplication
  - The export pipeline (Puppeteer) and preview rendering both use the `previewTemplate`; duplication and location of template logic makes it easy for differences to creep in. A shared renderer module would reduce drift.

---

## Prioritized recommendations (short term, Phase A → Phase B)

1. (High) Add server-side sanitization before embedding user/AI content into HTML responses. Implement a small sanitizer utility (e.g., using DOMPurify on server or a whitelist policy) inside the application service or a `render` module.

2. (High) Move `previewTemplate` into a dedicated module (e.g., `server/previewRenderer.js`) used by `index.js` and by export logic so presentation is centralized.

3. (Medium) Add request correlation: generate `requestId` at application service start and return it in the JSON response (and, if streaming, in stream metadata). Clients can use it to ignore stale completions.

4. (Medium) Design and add streaming support to plumbing (`/prompt/stream` or streaming mode on existing endpoint). Implement an http plumbing helper that exposes stream chunks (async iterable or `onChunk` callback) that application services can call into `previewStore.appendPreviewChunk`.

5. (Low) Explicitly document where sanitization and HTML shaping occur (in the roadmap/docs). Make the contract: "server returns sanitized, display-ready HTML" or "server returns plain text and client sanitizes" — pick one and implement consistently.

6. (Optional) Add `requestId` to persisted DB records for traceability between frontend request and stored AI results.

---

## Suggested short checklist to implement next (Phase A)

1. Create `server/previewRenderer.js` with `renderPreview(content)` that sanitizes and returns HTML.
2. Update `server/index.js` to use the renderer and remove inline template.
3. Add `requestId` generation in the server request handler and include in JSON responses on `/prompt` and `/genie`.
4. If incremental UI is desired, design the streaming endpoint and add a simple `httpClient`/stream helper on the frontend to consume chunks.

---

## Progress update (as of 2025-10-08)

- Implemented since the review (actualized):

  - Created `server/previewRenderer.js` and removed inline HTML templating from the main handler; preview rendering is centralized and uses a server-side sanitizer. Files touched: `server/previewRenderer.js`, `server/index.js`, and related tests.
  - Added request-correlation plumbing: request-id middleware that normalizes and exposes `req.requestId`, sets the `X-Request-Id` response header, and propagates `requestId` into service metadata where appropriate. Files touched: `server/index.js`, `server/genieService.js`.
  - Centralized and hardened error handling: introduced typed error helpers and a single error middleware that produces consistent JSON error shapes and writes structured error lines to logs. File: `server/utils/errorHandler.js` (unit tests added).
  - Adjusted application services for testability: `genieService` preserves incoming `requestId`, converts `persistIntents` → `persistInstructions`, and delegates to application services that only return intents. Files touched: `server/genieService.js`, `server/sampleService.js`.
  - Implemented persistence executor and tests: `server/persistence.js` performs safe path validation and atomic writes (tmp + rename), and the new integration test (`server/__tests__/persistence.integration.test.js`) verifies atomic writes, absence of leftover tmp files, and that artifact DB rows are recorded and correlated with `requestId`. The test avoids module-instance DB issues by verifying artifacts using a direct sqlite3 file connection to the server DB and cleans up created files/rows after assertions.
  - Test hardening: made prompt-related tests deterministic by using unique prompts per run to avoid cache collisions; added cleanup steps so tests do not leave DB rows or exported files behind.
  - CI / branch hygiene: accidental test artifacts written during early development were removed from the repo; commits and PRs include these test and persistence changes.

- Current test & CI status (actual):

  - Server test suite runs green locally and on the dev container after the persistence and test robustness fixes. All server tests pass in the full server test run (integration and unit tests exercised).
  - The new persistence integration test successfully asserts:
    - Files are written atomically (tmp->rename) and contain expected content.
    - No `.tmp-` leftovers remain in the written folders after persistence completes.
    - Artifact rows exist in the `artifacts` table, point to the written files, and contain the `request_id` matching the HTTP response header.

- Lessons learned / small follow-ups already applied:

  - Tests that rely on DB state must either (a) use unique inputs and clean up, or (b) orchestrate DB initialization and teardown in a shared test fixture. We applied (a) for quick wins and wrote the persistence test to explicitly clean artifacts/ai_results/prompts it creates.
  - Avoid importing the app's `db` module for cross-process assertions in tests — opening a direct sqlite3 connection to the DB file is a robust way to inspect persisted rows from test code and avoids module-instance mismatches in the test runner.

---

## Outstanding work (what remains — revised)

1. Stabilize and document the `requestId` contract across handlers and consumers (short):

   - Ensure all generation and preview/export handlers consistently include `requestId` in the HTTP response header (`X-Request-Id`) and, where chosen, in the JSON `metadata` object. Tests should assert both header and metadata as part of the contract so clients can rely on either/both places.
   - Estimate: 0.5–1.5 hours.

2. Robust error boundary coverage (short → medium):

   - Expand unit tests for `TransportError`/`ServiceError` shapes and ensure `requestId` is present in every structured error payload returned to clients. Remove any remaining ad-hoc debug logging used during test development.
   - Estimate: 2–3 hours.

3. Streaming / incremental preview design (medium):

   - If incremental preview UI is desired, design a streaming mode (SSE or fetch streams) and add plumbing helpers and a frontend consumer that appends to `previewStore`. This is a larger change and can be scoped as a separate sprint.
   - Estimate: 6–12 hours (spike + prototype).

4. Documentation and CI additions (short):

   - Update README and the `PATH_FORWARD` doc with the finalized sanitizer behavior (server-side sanitization) and the intent→instruction contract.
   - Add CI checks that enforce: sanitization unit tests, persistence executor tests, and lint rules for not writing files from application services.
   - Estimate: 2–4 hours.

5. Negative test for persistence safety (small, immediate):
   - Add a focused test asserting that `persistence.execute` rejects intents whose `folderHint` or `filenameHint` would resolve outside the allowed base directory (for example, `folderHint: "../../etc"` or a filename with path separators). This guards against accidental path traversal via malicious or buggy intents.
   - Next logical test to add: verify `persistence.execute` rejects unsafe `folderHint` values (e.g., "../../etc"). I can add this negative test next.
   - Estimate: 0.5–1 hour.

---

(Other items from the original checklist such as a formal migration UX for versioning and additional export parity checks have either been partially implemented or are lower priority and can be scheduled as part of Phase B.)
