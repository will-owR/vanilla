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

- Implemented since the review:

  - Created `server/previewRenderer.js` and removed inline HTML templating from the main handler; preview rendering is now centralized and uses a server-side sanitizer (jsdom + DOMPurify or equivalent). Files touched: `server/previewRenderer.js`, `server/index.js`.
  - Added request correlation plumbing: a request-id middleware now generates/propagates a `requestId` into `req.requestId` and `res.locals.requestId` and sets the `X-Request-Id` response header. Several endpoints now include `requestId` in their JSON responses. Files touched: `server/index.js`, `server/genieService.js`.
  - Centralized error handling: introduced typed error helpers and a single error middleware that produces consistent JSON error shapes and writes structured error lines to `logs/errors.log`. File touched: `server/utils/errorHandler.js`.
  - Adjusted service behavior to preserve testable failure modes: `genieService` now prefers an incoming `requestId` and only falls back to sample generators for module-load errors; `aiService` mocks were hardened to include `metadata.tokens` and to limit stub usage. Files touched: `server/genieService.js`, `server/aiService.js`.
  - Tests and CI: added requestId propagation tests (`server/__tests__/requestId.test.js`) and made existing server tests more resilient to `supertest` parsing quirks (falling back to `res.text` when `res.body` is empty). Many server tests were run and most are green in repeated runs.
  - Branching & commits: work was implemented on branches `aether-rewrite/client-phase2-AAA-0` and `aether-rewrite/client-phase2-AAA` (commits pushed with messages referencing requestId, renderer, and error-handler refactors).

- Current test status and open issue:

  - Most server tests pass. One intermittent failing assertion remains in the new request-id tests: `/api/preview` returns a `X-Request-Id` response header but the JSON payload's `metadata` object is sometimes empty (`metadata: {}`) rather than containing `metadata.requestId`. Debug traces confirmed the header is set while the metadata object was not populated on a particular code path.
  - This is likely a plumbing bug where a code path constructing the preview JSON omitted attaching `requestId` to the `metadata` object; the request-id middleware is working correctly (header exists). Fixing this is a small, targeted change (see next-actions).

- Outstanding work (what remains) with estimates:

  1. Stabilize preview metadata requestId contract and tests — ensure `metadata.requestId` is set consistently or decide that the header is the canonical location and update tests/docs. Estimate: 0.5–1.5 hours.
  2. Finish robust error boundaries and add test coverage — tighten `TransportError`/`ServiceError` usage across handlers, add unit tests that assert error shapes and that `requestId` is present in error payloads, and remove transient debug logging. Estimate: 2–3 hours.
  3. Implement persistence executor and intent→instruction wiring — create `server/persistence.js` (atomic writes / safe path validation) and update `/prompt` and `/genie` handlers to execute `persistInstructions` returned by the orchestrator. Add tests for intent translation and safe writes. Estimate: 3–5 hours.
  4. Complete tests, docs, and CI adjustments — add tests for renderer XSS protections, add docs/README updates, and add CI checks (lint + tests) for the new behavior. Estimate: 2–4 hours.
  5. (Optional) Design/implement streaming/incremental preview endpoint — SSE or fetch-stream mode, plus plumbing helper and client consumer. Spiking and prototyping this is larger and can be deferred. Estimate: 6–12 hours (spike).

  - Conservative total for remaining non-optional work: ~8–14 hours.

- Acceptance criteria for finishing Phase A alignment:

  - `server/previewRenderer.js` is the single canonical renderer used by preview and export paths and server-side sanitization is demonstrated by unit tests.
  - All public endpoints return `X-Request-Id` header; tests confirm the header plus (if chosen) `metadata.requestId` in JSON responses consistently.
  - Centralized error middleware emits structured error JSON including `requestId` and is covered by tests.
  - Persistence executor validates paths, performs atomic writes, and is exercised by unit tests.
  - CI green for new tests and lint rules.

- Immediate next action (recommended):
  1. Trace `/api/preview` handler(s) to find the code path that constructs the `metadata` object; make the handler explicitly set `metadata.requestId = req.requestId` in all code paths OR update the test to accept the header-only contract if that is preferred. Re-run the server test suite and remove temporary debug logging once the test passes. (Estimate: 30–90 minutes)

Then: take a short break.

---

## Architecture diagram

Below is a simple diagram that makes the plumbing ↔ application-service relationship explicit. The frontend's application service (e.g., `previewService`) constructs the JSON payload and calls the plumbing (HTTP client). The server's plumbing (`index.js`) resolves the chosen application implementation via `serviceAdapter` which delegates to `genieService` / `sampleService` / `aiService`. The preview updates flow back into `previewStore` and are displayed by the dumb `Preview` component.

```mermaid
flowchart LR
  subgraph Frontend
    PF[PromptForm] -->|submit JSON| AppSvc[frontend: previewService (application service)]
    AppSvc -->|POST JSON / stream| HTTPClient[httpClient (plumbing client)]
    PreviewComp[Preview.svelte (dumb)] -->|subscribe| PreviewStore[$previewStore]
  end

  subgraph ClientServices
    AppSvc -->|update| PreviewStore
  end

  subgraph Server
    HTTPServer[/Express (server/index.js) - plumbing/transport/handlers/route/headers]
    HTTPServer --> ServiceAdapter[serviceAdapter.js]
    ServiceAdapter --> Genie[genieService.js / sampleService / aiService (application services)]
    Genie -->|content payload| ServiceAdapter
    HTTPServer --> PreviewRenderer[previewRenderer.js (presentation/sanitizer - recommended)]
    HTTPServer --> DB[crud.js / db.js]
    HTTPServer --> Puppeteer[Export / Puppeteer (plumbing)]
  end

  HTTPClient -->|HTTP| HTTPServer
  PreviewStore --> PreviewComp

  classDef appSvc fill:#f9f,stroke:#333,stroke-width:1px;
  class AppSvc appSvc;
```

ASCII fallback (if Mermaid isn't rendered):

```
Frontend PromptForm --> frontend previewService (build JSON) --> httpClient (plumbing)
httpClient --> Express/index.js (plumbing)
Express/index.js --> serviceAdapter --> genieService / sampleService / aiService (application services)
application services return normalized content --> Express/index.js --> (persist via crud/db) and/or render via previewRenderer
Express/index.js (or previewService) updates previewStore -> Preview.svelte subscribes and renders
```

---

## Intent-based flow: service intent → orchestrator → plumbing executor

This project will move to an "intent-based" pattern for service outputs: application services (like `sampleService`) produce declarative intents describing what should be persisted or exported, but MUST NOT perform filesystem or IO themselves. The `genieService` acts as the orchestrator: it validates, sanitizes, assigns `requestId`, and resolves intents into authoritative `persistInstructions` that the plumbing executes.

Why: this keeps single responsibility boundaries clear: services decide "what" (domain), the orchestrator decides "how" (policy), and plumbing executes "where" (IO).

Contract: sampleService (intent producer)

- Returns: { success:true, data: { content, metadata, persistIntents: [...] } }
- `content`: { title, body, layout?, assets? }
- `persistIntents`: array of objects, each intent contains:
  - purpose: string (e.g., "promptFile", "previewHtml", "asset")
  - folderHint: string (e.g., "samples", "tmp-exports") // hint only
  - filenameHint?: string // optional suggestion
  - content: string | base64 // data to write
  - encoding?: "utf8"|"base64"

Example sampleService response (stubbed):

```
{
  "success": true,
  "data": {
    "content": { "title": "Prompt: Autumn", "body": "A poem..." },
    "metadata": { "model": "sample", "pages": 1, "contentType": "Poem", "mediaType": "eBook" },
    "persistIntents": [
      { "purpose": "promptFile", "folderHint": "samples", "filenameHint": "latest_prompt.txt", "content": "Write raw prompt here", "encoding": "utf8" }
    ]
  }
}
```

Contract: genieService (orchestrator)

- Receives the sampleService output and the original request payload.
- Responsibilities:
  - Validate the content and intents.
  - Sanitize HTML/text as required (explicitly mark sanitized vs raw).
  - Assign `requestId` (UUID) to this generation.
  - Resolve `persistIntents` into authoritative `persistInstructions` with server-side final paths and safe filenames. Example instruction fields:
    { purpose, path: 'samples/latest_prompt-<requestId>.txt', content, encoding, atomic:true }
  - Return the normalized envelope to the plumbing (HTTP handler): { success:true, data: { content, metadata, persistInstructions, requestId } }

Contract: plumbing executor (HTTP handler / persistence helper)

- Receives `persistInstructions` from `genieService`.
- Responsibilities:
  - Validate final paths are under allowed base directories (no traversal).
  - Perform atomic writes (tmp file + rename) and return final filenames.
  - Optionally persist traceability in DB (link requestId to filenames).
  - Return final response to the client with `{ filenames, requestId }`.

Security & safety rules (enforced by orchestrator/plumbing)

- Application services must not write to disk.
- Orchestrator/plumbing must reject any instruction that attempts to write outside allowed directories.
- All HTML content must be sanitized by the orchestrator before being rendered or persisted as HTML. If content is returned as already-sanitized, the orchestrator must verify or re-sanitize.

Implementation checklist (Phase A minimal steps)

1. Change `sampleService.generateFromPrompt(prompt, opts)` to return `persistIntents` and generated `content` — do not write files.
2. Update `genieService.generate(payload)` to forward payload to the chosen implementation and to:
   - receive `persistIntents`,
   - generate `requestId`,
   - sanitize and validate content,
   - convert intents into final `persistInstructions` with server-side paths and safe filenames,
   - return the envelope `{ data: { content, metadata, persistInstructions, requestId } }` to the HTTP handler.
3. Implement a small persistence helper (e.g., `server/persistence.js`) used by the HTTP layer to execute `persistInstructions` atomically and return final filenames.
4. Update the `/prompt` and `/genie` handlers to call persistence helper and include `filenames` and `requestId` in the HTTP response.
5. Add unit tests for intents -> instructions translation, sanitization, and persistence execution.

This intent-based pipeline preserves your constraint: the plumbing executes the writes (and nothing else), while application services describe the domain intent. We'll implement these steps next unless you want a different ordering.

---

## Update: DB-first prompt lookup, versioning, and traceability (Phase A continuation)

The server will adopt a DB-first strategy for prompt handling to provide deterministic behavior, deduplication, and full traceability. This document section summarizes the updated design, data model, and implementation plan.

Goals

- Avoid unnecessary AI calls by returning cached results for exact prompt matches.
- Keep a full history of generated results (versioned) and allow users to see and choose previous versions.
- Persist request correlation (requestId) across prompts, ai_results, and artifacts for traceability.

Design

- Prompt normalization & fingerprinting

  - Normalize: trim + collapse whitespace, Unicode NFKC, lowercase.
  - Compute SHA256(normalizedPrompt) as `prompt_hash` for exact matching.
  - (Optional) Add fuzzy similarity later for semantic reuse.

- Versioning and retention

  - `prompts` table stores canonical prompt text and `prompt_hash`.
  - `ai_results` table stores individual generated results with `version`, `request_id`, and `content` JSON.
  - Always insert new ai_result rows for regenerations or user-edited saves; do not overwrite previous results.
  - Default served result is the highest `version` (newest) unless user selects otherwise.

- Request correlation
  - Persist `requestId` from plumbing into `ai_results.request_id`, `artifacts.request_id`, and `prompts.request_first_id` for tracing.
  - Include requestId in response headers and JSON metadata for all generation and error responses.

Implementation Plan (this sprint)

1. Database schema and migrations (server/db.js)

- Ensure `prompts.prompt_hash`, `prompts.normalized` columns exist (and add if missing).
- Ensure `ai_results` includes `request_id` and `version` columns (add if missing).
- Add `artifacts` table to link persisted files to ai_results for traceability.
- Implement a safe migration helper that checks columns via `PRAGMA table_info` and adds columns only when necessary.
- Time estimate: 30–60 minutes.

2. CRUD surface extensions (server/crud.js)

- Add `getPromptByHash(hash)`, `createPromptWithHash(prompt, normalized, hash, requestId)`, `getLatestAIResultForPrompt(prompt_id)`, `createAIResultWithMeta(prompt_id, result, requestId, version)` and artifact insert helpers.
- Keep legacy functions for backward compatibility and add new ones in dual-mode (callback or Promise).
- Time estimate: 30–60 minutes.

3. Plumbing: POST /prompt (server/index.js)

- On POST /prompt (no dev flag): normalize prompt, compute hash, check `getPromptByHash`.
- If found, fetch latest ai_result for that prompt and return it (still log current request with a new requestId and return it in the response). Do not call AI.
- If not found, call `genieService.generate(...)` to obtain content and persistIntents, then:
  - create prompt row via `createPromptWithHash`
  - create ai_result row with `requestId` and `version=1`
  - execute `persistence.execute()` for persistInstructions and record artifacts via CRUD
  - return the normalized envelope to client with `requestId` and persisted paths
- Time estimate: 1–2 hours (includes tests).

4. Tests

- Integration test: POST same prompt twice -> assert second call returned cached ai_result and that AI provider factory was not called the second time.
- Request correlation test: assert requestId in header = DB ai_results.request_id.
- Persistence executor tests: ensure files written atomically and artifacts recorded in DB.
- Time estimate: 1–3 hours.

Acceptance criteria

- Exact prompt reuse: posting same prompt twice reuses the stored ai_result (no extra AI calls) and logs a new request entry with requestId.
- Versioning: re-generation or explicit user-save creates a new ai_result row with incremented version.
- Traceability: requestId is present in response, in DB rows, and in artifact records for correlation.
