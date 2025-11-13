# End-to-end walk-through

date: 2025-11-08
status: closed
description: |
  Dated, read-only reference describing the full end-to-end flow when a user
  submits the example prompt (noir detective / robots) via the Aether UI and
  clicks Generate. This file is archival — do not update.

---

prompt: 'A noir detective story set in a city of robots.'

---

## Purpose

This document explains, with file references and example payloads, what happens
when a user enters the prompt `A noir detective story set in a city of robots.`
and clicks Generate in the UI. It is a snapshot (2025-11-08) intended for
reference and QA. Status: closed — do not modify.

## Quick summary (1-line)

User clicks Generate 

→ client `generateAndPreview` triggers `genieServiceFE` → delegates to server `POST /prompt` 

→ `genieService.generate()` orchestrates generation (read-first cache → sampleService/demo generator → `defaultModule`
assembly + persistence) → server responds with envelope 

→ client shows preview and persists locally in background.

## 1. UI: user action and immediate client behavior

- Where: `client/src/components/PromptInput.svelte` (also `client/src/App.svelte`).
- Elements: textarea `data-testid="prompt-textarea"`, button `data-testid="generate-button"`.
- Action path:
  - User types/pastes the prompt into the textarea.
  - Clicks Generate → `handleGenerateNow()` → `generateAndPreview(prompt)` in `client/src/lib/flows.js`.
  - Client validates non-empty prompt and sets UI loading state.

## 2. Client flow: generateAndPreview

- File: `client/src/lib/flows.js`.
- Behavior:
  - Calls `genieServiceFE.generate(prompt)` (front-end shim that may return a dev payload).
  - If that fails, falls back to `submitPrompt(prompt)` (POST /prompt via `client/src/lib/api.js`).
  - Wrapped in a timeout (default 10s) and sets UI loading state.
  - On response, normalizes `content` and sets `contentStore` immediately so the UI shows a preview fast.
  - Starts background persistence (`persistContent`) to `/api/prompts` but does not block the preview.
  - Calls `previewFromContent(content)` to obtain HTML for the preview pane.

## 3. Client → Server: HTTP request (submitPrompt)

- File: `client/src/lib/api.js` (function `submitPrompt`).
- Request:
  - Method: POST
  - URL: `/prompt` (dev proxy via `client/vite.config.js`)
  - Headers: `Content-Type: application/json`
  - Body JSON: { "prompt": "A noir detective story set in a city of robots." }
  - Client retries transient errors (exponential backoff + jitter) via `fetchWithRetry`.

## 4. Server: POST /prompt route

- File: `server/index.js` (two handlers present):
  - A `?dev=true` short-circuit handler that returns a deterministic dev payload and skips DB/AI.
  - Main handler validates the prompt and calls `genieService.generate(prompt)`.
  - Controller returns `res.status(201).json({ success: true, data })` where `data` comes from `genieService`.

## 5. Server: generation orchestration (genieService)

- File: `server/genieService.js`.
- Responsibilities & steps:
  - Validate prompt and save a raw copy to disk (audit) via `saveContentToFile` (non-fatal; may be awaited in test mode).
  - If persistence enabled, perform a read-first dedupe lookup using `utils/dbUtils` (Prisma shim) or fallback to legacy `crud`:
    - Normalize prompt via `utils/normalizePrompt` and search recent prompts.
    - If a prior prompt and AI result exist, return cached AI result to avoid re-generating.
  - Otherwise delegate to a generation service. In the demo code this is `sampleService.generateFromPrompt()`.
  - Optionally dispatch `actions` (via `actionsModule`) — if present, the actions module can take over.
  - Call `defaultModule.runDefault()` to build a canonical envelope and handle persistence.

## 6. Server: default pipeline (assembly + persistence)

- File: `server/defaultModule.js`.
- Responsibilities:
  - Normalize `svcOut` into `out` envelope with `data.content`, `data.aiResponse`, `data.copies`, `data.metadata`.
  - Build mocked `aiResponse` when needed (`utils/aiMockResponse`).
  - Persistence (best-effort):
    - Resolve `dbUtils` (Prisma `utils/dbUtils` preferred; fallback `crud`).
    - Attempt `dbUtils.createPrompt(prompt)` (handles dedupe/recovery on failure).
    - Attempt `dbUtils.createAIResult(promptId, toPersist)` and set `out.data.resultId` if successful.
  - Persistence behavior is controlled by flags:
    - `GENIE_PERSISTENCE_ENABLED` toggles persistence.
    - `GENIE_PERSISTENCE_AWAIT` and `NODE_ENV === 'test'` control whether the server awaits persistence before responding.
  - `runDefault()` returns `{ out, persistencePromise }` and `genieService` exposes `_lastPersistencePromise` for tests.

## 7. Server → Client response shape (typical)

HTTP 201 Created

```json
{
  "success": true,
  "data": {
    "content": {
      "title": "Prompt: A noir detective story set in a city of robots.",
      "body": "A noir detective story set in a city of robots.",
      "layout": "poem-single-column"
    },
    "aiResponse": {
      /* mock aiResponse pages & metadata */
    },
    "copies": [
      /* derived copies/pages */
    ],
    "metadata": { "model": "mock-1" },
    "promptId": 123, // optional (if persisted)
    "resultId": 456 // optional (if persisted)
  }
}
```

Note: shapes vary slightly depending on whether the generator produced `out_envelope`, `aiResponse`, `copies`, or just `content`. Client normalizes for these cases.

## 8. Client: immediate UI update and preview generation

- After normalization `generateAndPreview` does:
  - `contentStore.set(content)` so preview can show quickly.
  - Fire-and-forget background `persistContent(content)` to `/api/prompts` (`client/src/lib/api.js`) to persist client-side copy; surface non-blocking warning if it fails.
  - Call `previewFromContent(content)` which:
    - Cancels previous preview via `AbortController` to avoid races.
    - Calls `loadPreview(content)` which chooses preview path:
      - If `resultId`/`promptId` present: call `/preview?resultId=...` or `/preview?promptId=...` so server renders canonical preview from persisted content.
      - Else for small payloads: GET `/preview?content=<encoded JSON>` (fast path that returns HTML fragment).
      - For large payloads: POST `/api/preview` with JSON body and receive `{ preview }`.
    - Client extracts body/styles if a full HTML document was returned and injects styles into `document.head` to render the fragment safely.
    - `previewStore.set(htmlFragment)` and UI components render the preview.

## 9. Background persistence & caching notes

- Server persistence may run concurrently and either be awaited (test mode) or fire-and-forget depending on flags.
- `genieService` read-first lookup uses normalized prompt equality so repeated prompts may return cached results.
- Client also attempts to save generated prompt/content via `/api/prompts` in background to acquire `promptId`/`resultId` for later usage.

## 10. Error handling & edge cases (high level)

- Empty prompt: blocked on client and server (400 validation error).
- Timeouts: client `withTimeout` rejects after default 10s; UI surfaces a generation error.
- Aborted preview: treated as non-error; previous preview is retained to avoid flicker.
- Persistence failures: non-fatal — generation still returns; user may see a non-blocking warning.
- Dev helpers:
  - `POST /prompt?dev=true` returns deterministic dev payload (short-circuit).
  - Frontend `genieServiceFE` can return deterministic local payloads for fast U/X in dev.

## Files reviewed (selected)

- Client:

  - `client/src/components/PromptInput.svelte`
  - `client/src/App.svelte`
  - `client/src/lib/flows.js`
  - `client/src/lib/api.js`
  - `client/src/lib/genieServiceFE.js`
  - `client/vite.config.js` (dev proxy for `/prompt`)

- Server:
  - `server/index.js` (routes: `/prompt`, `/preview`, `/api/preview`)
  - `server/genieService.js` (generate orchestration, read-first cache, getPersistedContent)
  - `server/defaultModule.js` (build envelope, persistence)
  - `server/sampleService.js` (demo generator used in the sample flow)
  - `server/utils/*` (normalizePrompt, dbUtils, crud fallbacks)

## QA / reproducible test notes

To run a quick local smoke test you can POST the prompt to the running server (if server is running locally on :3000). Example request body: `{ "prompt": "A noir detective story set in a city of robots." }` to `POST /prompt`. The demo service returns a simple deterministic envelope from `sampleService` and the preview endpoint renders the returned content.

---

This file is a dated snapshot for reference and must remain closed to updates.
