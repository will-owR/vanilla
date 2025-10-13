# CLIENT_E2E_FLOW — End-to-end application flow

This document captures the end-to-end flow from frontend prompt entry through backend processing, preview generation, and frontend preview update. Use this as the canonical sequence for client E2E tests and for understanding how the preview pane is populated.

## High-level concise flow (bulletized):

- User enters a prompt into the UI (`PromptInput.svelte`) and clicks Generate.
- Frontend calls `generateAndPreview(prompt)` in `client/src/lib/flows.js`.
- `generateAndPreview` invokes the genie front-end service (or falls back to `submitPrompt`) to produce a normalized `content` object:
  - minimal shape: `{ title: string, body: string, layout?: string, background?: string, promptId?: number, resultId?: number }`.
- Frontend immediately sets `contentStore.set(content)` so the UI can show a fallback/local preview and remain responsive.
- `generateAndPreview` persists content in the background (`persistContent`) which may return `promptId`/`resultId`.
- Frontend triggers `previewFromContent(content)` which:
  - cancels any in-flight preview request (via AbortController)
  - calls `loadPreview(content)` which attempts (in order):
    - `GET /preview?resultId=<id>` (if `resultId` present)
    - `GET /preview?promptId=<id>` (if `promptId` present)
    - for small payloads: `GET /preview?content=<urlencoded JSON>`
    - for large payloads: `POST /api/preview` with JSON `{ content }` (returns `{ preview }`)
  - on success `previewFromContent` sets `previewStore.set(html)` and updates `uiStateStore` to success.

## Detailed backend processing notes:

- `POST /prompt` (server): accepts `{ prompt }`, calls AI or local generator to produce `content`, stores prompt and AI result in the DB, and returns an envelope that may include `content`, `promptId`, and `resultId`.
- `GET /preview` (server): supports `?content=<json>`, `?resultId=`, and `?promptId=` query forms. Validates `title` and `body` then returns server-rendered HTML using `previewTemplate(content)`.
- `POST /api/preview` (server): accepts JSON body with content and returns `{ preview: "<html>" }` — used for large payloads or when POST is preferred.

### Client rendering & hooks:

- `previewStore` holds the raw HTML string returned by the server (or client fallback HTML).
- `PreviewWindow.svelte` injects the HTML into the DOM via Svelte's {@html $previewStore} inside `<div data-testid="preview-content">`.
- Test/automation hooks that are set on preview updates:
  - `data-testid="preview-content"` contains the injected HTML
  - Temporary attributes set for automation: `data-preview-ready`, `data-preview-timestamp` on the preview element and `document.body` (briefly)
  - Global dev hooks: `window.__LAST_PREVIEW_HTML`, `window.__preview_updated_ts`, `window.__preview_html_snippet`

### Cancellation, timeouts, and retries:

- The client `fetchWithRetry` wrapper implements retries with exponential backoff for transient status codes (e.g., 500, 503, 429). `loadPreview` uses `AbortController` and `previewFromContent` wraps calls with a timeout (default 10s).
- Aborted preview requests are treated as non-errors so UI does not flash unexpected error messages when a new preview request supersedes an older one.

### Acceptance criteria for automated verification (smoke test):

1. POST or GET `/preview` with a sample payload `{ title, body }` returns HTML containing `title` and `body` text.
2. Client `PreviewWindow` updates `previewStore` and the DOM element `[data-testid="preview-content"]` contains the server-rendered HTML.
3. The test can rely on `window.__preview_updated_ts` or `data-preview-ready` to detect the update reliably.

Use this document to construct deterministic client tests that exercise the prompt→preview→DOM update cycle.

### Smoke check (quick verification)

- There's a small helper script at `client/scripts/fetch-preview-wait.cjs` that will call the backend preview endpoints and save the returned HTML to `client/test-artifacts/preview-fetched.html` after the returned HTML contains a sample title.
- Example manual run (from repo root):

```bash
node client/scripts/fetch-preview-wait.cjs --url http://localhost:3000 --out client/test-artifacts/preview-fetched.html --retries 6 --interval 1500
```

- The project also exposes an npm script `smoke:fetch-preview` from `client/package.json` which wraps the fetch script with sane defaults. Use it from `client/`:

```bash
npm --prefix client run smoke:fetch-preview
```

### Automated E2E harness

- A lightweight Playwright test (`client/tests/e2e/generate-and-verify.spec.mjs`) can drive the client UI to click Generate and then run the fetch script to verify the preview HTML is produced and saved. This provides a simple, reproducible smoke that ties the UI click to the final preview artifact.
