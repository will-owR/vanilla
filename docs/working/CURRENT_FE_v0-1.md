# CURRENT_FE v0-1 — Corrected Frontend ↔ Backend View (includes genieService)

Date: 2025-10-11
Branch: aether-rewrite/client-phase2-AAA-sol1

This supplement provides a corrected bird's-eye view that explicitly names and describes `genieService` (the orchestrator), separates "As implemented" vs "Desired / Migration" items, maps responsibilities to code files, and includes a small reconciliation item (add `serviceHint` pass-through) so tests can avoid `?dev=true`.

> **IMPORTANT PRIORITY NOTE — FIX PREVIEW UPDATE BUG**
>
> The frontend currently fails to update its preview area reliably (the primary reason for creating `client-v2/`). This bug blocks verification and developer feedback loops and must be fixed before other migration work. Nothing has a higher priority than restoring the preview update behavior: reproduce the bug, add regression tests that assert `previewStore` updates result in visible changes (and the `data-preview-ready` attribute), and fix the root cause in the client or server layer as appropriate.
>
> Suggested immediate actions:
>
> - Reproduce the failure locally and capture a minimal failing test that demonstrates preview not updating.
> - Add a fast unit/integration test that fails (watch it turn green after the fix).
> - Prioritize root-cause fix (client-side store wiring, event dispatch, or server response shape) over non-blocking refactors.
>
> ---
>
> ### Addendum (Branch: ...-sol1-99)
>
> Work on this branch has focused on addressing the preview update bug by following the suggested actions. The following steps have been completed:
>
> 1.  **Created `testService.js`**: A new, predictable service was added to the backend to provide stable data for testing.
> 2.  **Implemented `serviceHint`**: The `genieService` was updated to use a `serviceHint` from the request payload, allowing tests to explicitly select the `testService` and validating the existing architecture.
> 3.  **Created E2E Test**: A new Playwright test (`preview-update.spec.mjs`) was created to automate the validation of the entire frontend-backend-frontend loop.
> 4.  **System-wide Modifications**: Numerous changes were made to support the test, including configuring the Playwright `webServer`, updating the client's `promptStore` to send the `serviceHint`, and exposing the client stores to the test environment.
>
> **Current Status**: The end-to-end test is still failing. Initial investigation has ruled out caching issues and confirmed the backend is behaving as expected. The failures appear to stem from subtle race conditions in the client-side Svelte store updates and challenges in creating a stable test environment setup that can reliably handle the component's loading states.

## Corrected bird's-eye view (explicit)

High-level micro-sequence (frontend → plumbing → genieService → application services → persistence):

1. Frontend (client-v2)

   - User submits a prompt via the UI (for example, `PromptForm.svelte` dispatches `submit`), which ultimately calls `promptStore.submitPrompt()`.
   - The client performs a POST to `/prompt` with body `{ prompt: "..." }` (in dev the Vite proxy maps this to the server).

2. Server plumbing (`server/index.js` POST `/prompt`)

   - Validates input and computes a normalized hash for cache lookups.
   - If a cached prompt/result exists, returns cached result immediately (200) with metadata.
   - If not cached, calls `genieService.generate(payload)` and passes along `requestId` when present.

3. Orchestrator: `genieService.generate(payload)` (explicit)

   - Purpose: centralize service selection, sanitization, normalization, and conversion of persistence intents into normalized instructions for plumbing.
   - Main responsibilities:
     - Accepts `payload` (string or object). Ensures a deterministically traceable `requestId` (reuse incoming or generate one).
     - Select application service to fulfill the prompt (heuristic: `helloWorldService` for simple tests; otherwise attempt `aiService`, fallback to `sampleService`). See selection logic in `server/genieService.js`.
     - Call the chosen application service to obtain `{ content, metadata, persistIntents }`.
     - Sanitize returned content fields (title/body/html) using server-side sanitizer (`server/sanitizer.js` or the internal sanitizer usage in `genieService`).
     - Normalize `persistIntents` -> `persistInstructions` (filename/folder hints, encoding, original intent preserved) so `persistence.execute()` can act consistently.
     - Return a normalized envelope: `{ success:true, data: { content: safeContent, metadata: { ...metadata, requestId }, persistInstructions, requestId } }`.

4. Plumbing responds

   - The server replies immediately to the client with a JSON envelope containing top-level `preview` (HTML string when available), `requestId`, and `data`.
   - Persistence is scheduled asynchronously: server persists prompt row, creates `ai_result` row, executes `persistence.execute(persistInstructions)`, and records artifact rows via `crud.createArtifact(...)`.

5. Client receives preview
   - Client extracts HTML from `data.content` / `data.preview` / `preview` and sets `previewStore` for `PreviewWindow` to render.
   - Persisted identifiers (ai_result_id, artifact ids) may be returned on cached responses; otherwise they appear only after async persistence completes.

## "As implemented" (truth on disk as of 2025-10-11)

- Endpoint: `POST /prompt` in `server/index.js` implements two branches:
  - `POST /prompt?dev=true` — deterministic quick handler for tests (returns 201 with deterministic content and skips persistence).
  - Normal `POST /prompt` — performs cache lookup, calls `genieService.generate(...)`, responds with `preview`/`data` and schedules async persistence.
- Orchestrator: `server/genieService.js` is the concrete orchestrator module used by plumbing. It implements the selection logic, sanitization, and persist-intent normalization.
- Preview rendering/sanitization: `server/previewRenderer.js` is used by GET `/preview` and POST `/api/preview` to produce sanitized HTML. Note: the `/prompt` path returns `genieService` output's `preview` without additional `renderPreview` post-processing in plumbing — `genieService` applies sanitization to content fields, but the preview renderer is the canonical rendering sanitizer for `/preview` routes.
- Persistence: `persistence.execute()` is invoked asynchronously by `server/index.js` after response to apply `persistInstructions` and record artifacts via `crud.*`.
- Discovery: there is not currently a dedicated `GET /api/ai_results?requestId=...` endpoint. Discovery of persisted results typically uses `ai_result_id` or `prompt_id` when included in cached responses, or uses the existing endpoints (`/api/ai_results`, `/api/ai_results/:id`, `/content/result/:id`, `/content/prompt/:id`).

### Representative server response shapes (as implemented)

- Cached (example, 200):

```

{
"success": true,
"requestId": "...",
"data": {
"content": { "title": "...", "body": "<p>...</p>" },
"metadata": { "requestId": "..." },
"persisted": [],
"cached": true,
"ai_result_id": 123,
"prompt_id": 45
}
}

```

- New generation (example, 201):

```

{
"success": true,
"requestId": "...",
"preview": "<div>...</div>",
"data": {
"content": { "title": "...", "body": "<div>...</div>" },
"metadata": { "requestId": "..." },
"persistInstructions": [ /* normalized instructions */ ]
}
}

```

## "Desired / Migration" (from CURRENT_FE.md — reconciled)

Key desired items in `CURRENT_FE.md` remain valuable and should be considered migration targets:

1. Remove `?dev=true` plumbing special-case in favor of explicit `serviceHint` or serviceAdapter registration in tests.
2. Provide a direct, discoverable API to map `requestId` → `ai_result` or `artifact` (for clients to poll by requestId). Example: `GET /api/ai_results?requestId=<id>` or `GET /api/by-request/<requestId>`.
3. Normalize naming: pick either `persistIntents` (service-level) or `persistInstructions` (plumbing-level) and enforce a single canonical field across the adapter and docs.
4. Clarify and harden sanitization contract: either require every application service to return sanitized HTML or centralize final sanitization in plumbing (before returning `preview` on `/prompt`).
5. If atomic persistence is required, implement DB transactions + file-write tmp->rename patterns and compensation logic to achieve stronger guarantees.

## File mapping (quick references)

- `server/index.js` — main HTTP plumbing; contains `POST /prompt` handler, cache check, immediate response, and async persistence.
- `server/genieService.js` — orchestrator / selection logic / sanitization / conversion of persist intents to normalized instructions.
- `server/serviceAdapter.js` — lightweight adapter to choose the concrete service implementation (env-driven). Defaults to `genie` which defers to application services.
- `server/helloWorldService.js`, `server/sampleService.js`, `server/aiService.js` — example application services; these produce service-level responses (content, metadata, persistIntents).
- `server/previewRenderer.js` — canonical preview rendering & sanitization used by `GET /preview` and `POST /api/preview`.
- `server/persistence.js` — executes persist instructions and calls `crud.createArtifact` to record artifact metadata.

## Small reconciliation item: `serviceHint` pass-through (example)

Goal: allow tests and dev harnesses to request a specific application service without relying on `?dev=true`.

Suggested minimal change (server-side):

- Accept an optional `serviceHint` in the `POST /prompt` JSON body and pass it into `genieService.generate(payload)`.

Example change in `server/index.js` (conceptual):

```js
// inside POST /prompt handler
const { prompt, serviceHint } = req.body || {};
const geniePayload = { prompt, requestId: req.requestId };
if (serviceHint) geniePayload.serviceHint = serviceHint;
const genieResult = await genieService.generate(geniePayload);
```

Example acceptance in `server/genieService.js` (conceptual):

```js
async function generate(payload) {
  const { prompt, serviceHint } = payload || {};
  // prefer explicit serviceHint if present
  if (serviceHint) {
    // use serviceAdapter or resolve directly (e.g., require(serviceHint))
    // call the selected service.generateFromPrompt(payload)
  }
  // existing selection logic (heuristics + aiService fallback) follows
}
```

Notes and guidance:

- This `serviceHint` pass-through is intentionally minimal: tests can call `POST /prompt` with `{ prompt: 'x', serviceHint: 'helloWorld' }` to force use of `helloWorldService` (or `sample`, etc.) and then we can remove or deprecate `?dev=true` after tests are migrated.
- Implementing `serviceHint` should include validation (whitelist known service keys) and only allow test/trusted actors to use it in production (or gate it with an environment flag).

## Next actions I can take for you

- If you want, I will update `docs/CURRENT_FE.md` in-place to clearly mark "As implemented" vs "Desired/migration" and link to this new `CURRENT_FE_v0-1.md`.
- I can implement the minimal `serviceHint` pass-through (server changes and a basic test) and update docs accordingly.
- I can also add a short example test request and a small `scripts/run_genie_test.js` usage note to help migrate existing tests away from `?dev=true`.

If you want me to proceed with any of those code or doc changes, tell me which and I will implement them next.

End of CURRENT_FE_v0-1.md

```

```
