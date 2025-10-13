# GEN-VER.SPEC — Generate & Verify (E2E) Run Log

Small plan (prepared for immediate action):

- We'll start with (#1) because this will produce `test-artifacts/preview-fetched-from-e2e.html` and `test-artifacts/e2e-console.log` when the full server-driven flow succeeds. If the server path fails, we'll fall back to deterministic checks.

Immediate / deterministic (what we'll do first)

- Re-run the hardened Playwright e2e script locally or inside the devcontainer.
  - Why: validate the local `force-local-preview` fallback works and confirm artifact generation.
  - How: start the dev environment (client on 5173, server on 3000). Then run the e2e script (it uses Playwright; dependencies must be installed). The Playwright script will click Generate, wait for the preview debug hooks or preview DOM to contain the expected snippet, and then call `client/scripts/fetch-preview-wait.cjs` to persist the HTML to `test-artifacts/preview-fetched-from-e2e.html` and write `test-artifacts/e2e-console.log`.

Short (fast, low-risk verifications)

- Add a targeted Vitest + @testing-library/svelte integration test that mounts `PreviewWindow.svelte`, sets `previewStore.set("<h2>Title</h2><div>Body</div>")`, and asserts:
  - `document.body` temporarily receives `data-preview-ready` and `data-preview-timestamp` (or `window.__preview_updated_ts` updates)
  - `[data-testid="preview-content"]` contains the HTML/text
- Why: makes it easy to test the DOM update contract without running Playwright. This addresses the acceptance criteria in `CLIENT_E2E_FLOW` and gives fast feedback in CI.

Short (server health isolation)

- Use the existing `npm --prefix client run smoke:fetch-preview` script (which wraps `client/scripts/fetch-preview-wait.cjs`) as a compact smoke check for the server preview endpoint. Run this against a local server instance to confirm `/preview` responds with HTML for a sample payload.

Medium (stabilize CI determinism)

- If server-side flakiness (rate limits / external API quotas) continues to be an issue, add a test-only determinism path to the server: e.g., when `USE_TEST_PREVIEW=true` or `?testTemplate=true` is present, `/preview` returns a deterministic sample HTML for the provided content. The e2e script can detect this mode and assert the sample HTML was loaded.

Investigate (if preview generation repeatedly fails)

- Check server logs (e.g., `server/logs/` and `server` stdout) for repeated 429s originating from `/prompt` handler or upstream Gemini/AI calls. For immediate testing, set `USE_REAL_AI=false` to avoid external API rate limits or mock the AI services.

Optional cross-check

- Add a two-step smoke test that POSTs a simple `{ title, body }` to `/preview?content=` (or GET /preview?content=) and asserts the returned HTML contains the title and body, then mount `PreviewWindow` (or set `previewStore`) and assert the rendering matches. This cross-checks server and client templates.

Run log (observed in the last run):

- Expected artifacts on success:

  - `test-artifacts/preview-fetched-from-e2e.html` (server-provided HTML)
  - `test-artifacts/e2e-console.log` (page console + pageerror logs)

- Observed result (this run):

  - The Playwright runner reached the UI and attempted generation. The script captured page console logs and wrote `test-artifacts/e2e-console.log` successfully.
  - The backend-powered preview did not appear in the UI within the configured attempts. Because of this, the fetch script did not save `preview-fetched-from-e2e.html`.
  - The test attempted the deterministic fallback (clicking the dev-only `Force local preview` button). The fallback either did not produce a stable preview within the short fallback timeout or the DOM update was not captured by the script prior to test exit.

Assessment / likely causes:

- Server prompt submission experienced transient failure (observed 429 responses in earlier runs). Without a successful prompt/result write, `/preview` had nothing to render for the requested resultId/promptId and the UI never received server-rendered HTML.
- The `Force local preview` path depends on client-side stores and the UI being fully hydrated. Under headless timing conditions or missing dev-only controls, the fallback may not populate the preview pane as expected.

Immediate next actions (concrete):

1. Re-run the Playwright e2e with the dev environment up and collect artifacts (`test-artifacts/preview-fetched-from-e2e.html` and `test-artifacts/e2e-console.log`). If the HTML is not produced, preserve the console log and server logs for diagnosis.
2. Add and run the targeted Vitest integration test (mount `PreviewWindow`, set `previewStore`, assert DOM hooks and debug globals). This is implemented as `client/__tests__/preview-hooks.integration.test.js` and provides fast confidence in the client contract.
3. If server-side 429s persist, set `USE_REAL_AI=false` or mock external AI calls for deterministic local testing; investigate server logs and upstream quotas for root cause.

This document records the run result and the planned deterministic checks to follow.

Generated: 2025-09-25
