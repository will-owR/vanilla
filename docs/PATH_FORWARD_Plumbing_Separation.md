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

If you want, I can implement any of the short checklist items (one at a time) and run a minimal test. Specify which item to implement first and I will make the change and validate it locally.

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

## Practical guarantees to keep the frontend dumb

- PromptForm only assembles JSON input (prompt, contentType, mediaType, pages) and submits to the backend.
- Preview.svelte remains display-only: it subscribes to `previewStore` and renders loading/error/content states; it never calls fetch or writes files.
- previewService (client-side) should be thin: call the HTTP endpoint, receive the normalized envelope (content, metadata, filenames, requestId), and write to `previewStore` only.
- All persistence decisions, path resolution, sanitization, and atomic writes are performed server-side by the orchestrator + plumbing executor.

Small recommendation

- Keep `previewService` minimal and focused on calling the API and updating stores. Any logic that decides file placement, naming, sanitization rules, or allowed folders belongs on the server.

---

## ADDENDUM: Preliminary Work for Phase 2 Alignment

_Date: 2025-10-08_

This addendum outlines the preliminary work required to bring `server/index.js` into alignment with the architectural principles described in this document and the broader Phase 2 objectives.

**Note:** The work will be implemented in side branch `aether-rewrite/client-phase2-AAA-0`

### Key Issues Identified

A review of the existing server implementation confirms that `server/index.js` has accumulated responsibilities beyond its core "plumbing" role. This misalignment introduces maintenance overhead and security risks. The most critical issues are:

1.  **Presentation Logic in Plumbing**: `server/index.js` is responsible for HTML templating, a presentation concern that belongs in a dedicated rendering layer.
2.  **Security Vulnerability (XSS)**: The server directly injects AI-generated content into HTML without sanitization, creating a cross-site scripting (XSS) risk.
3.  **Lack of Request Correlation**: Endpoints do not return a unique `requestId`, making it difficult for the client to manage concurrent requests and avoid race conditions.

### Three-Task Recommendation

To address these issues and align the server with Phase 2 production-readiness goals, the following three tasks are recommended:

1.  **Isolate Presentation Logic (Est: 2-3 hours)**

    - **Action**: Create a `server/previewRenderer.js` module to handle all HTML templating and sanitization.
    - **Outcome**: Decouples presentation concerns from the transport layer, improving modularity and maintainability.

2.  **Refactor Server Endpoints (Est: 3-4 hours)**

    - **Action**: Update `server/index.js` to use the new `previewRenderer.js`. Implement `requestId` generation and include it in all API responses.
    - **Outcome**: Enforces clear separation of concerns and provides the client with the necessary context to manage asynchronous operations reliably.

3.  **Implement Robust Error Boundaries (Est: 4-6 hours)**
    - **Action**: Introduce distinct error types for transport-level and application-level failures. Implement centralized error-handling middleware.
    - **Outcome**: Creates a more resilient, predictable, and debuggable server architecture.

**Total Estimated Time: 9-13 hours.**

Completing this work is a prerequisite for meeting the quality and security standards required for Phase 2.
