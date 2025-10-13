# E2E smoke test: generate-and-verify.spec.mjs

## Summary of changes

- Added robust wait hooks to the Playwright script to ensure the client UI is fully hydrated before interacting.
- Instrumented the page to capture console logs and page errors (mirrors page logs to stdout).
- Increased preview detection robustness by checking debug globals (`window.__preview_html_snippet`, `window.__LAST_PREVIEW_HTML`) and the preview DOM (`[data-testid="preview-content"]`) for the expected snippet `E2E smoke`.
- Increased retry attempts and preview wait timeout (3 attempts, 60s per attempt).
- Added artifact capture on failure: console log (e2e-console.log) and, in later iterations, snapshot hooks to save preview DOM/text and debug globals to `test-artifacts/` for offline inspection.

## What happened when tests re-ran

- The test was executed multiple times while iteratively hardening detection and logging.
- The client UI was reachable and hydrated (the test detected and waited for the generate button and textarea).
- The client emitted detailed debug logs. However, prompt submission to the server received HTTP 429 (Too Many Requests) responses during several attempts. The client retries up to its configured retry limit and then surfaces an error state.
- Because prompt submission was rate-limited (429), the generation flow failed and no successful server-generated preview was available for the test to detect. The test therefore timed out waiting for the expected preview snippet and wrote diagnostic artifacts:
  - `test-artifacts/e2e-console.log` — full page console and error logs (contains the 429s and Vite websocket messages).
  - (Note: earlier fetch-only smoke script, which calls `/preview` directly, succeeded and saved `client/test-artifacts/preview-fetched.html`; this verifies the server preview endpoint responds when called directly.)

## Key observations from the logs

- Repeated lines showing: "API Response: 429 from /prompt" — indicates server-side rate limiting or an upstream service denial during the prompt submission step.
- Vite websocket connection failures were logged (WebSocket closed / handshake 302) — informational for dev server hot-reload, not the primary cause for preview failure.
- The preview subsystem (GET /preview) responded with 200 and the client set `previewStore` in separate flows (evidence that preview endpoint itself is functioning when content is provided); but the main generate flow failed at prompt submission.

## Proposed concrete next steps (pick one)

1. Add a deterministic UI fallback to the E2E script (recommended)

   - Detect prompt submission failure (429 or `uiState` in error) and, in that case, click the dev `Force local preview` button (`[data-testid="force-local-preview"]`) to populate the preview pane locally.
   - This yields a stable UI smoke test that validates frontend behavior without depending on server-side generation capacity.
   - I can implement this now and re-run the test; artifacts and console logs will be captured for later investigation.

2. Keep testing the server path but increase backoff/retry and/or run the test after the rate-limit window resets

   - This keeps the E2E flow faithful to production generation but will be flaky until rate-limiting is resolved (or the server capacity is increased).

3. Investigate and mitigate server-side 429s
   - Check server logs and upstream services (rate limiter, auth, or external API quotas). Fix or increase limits.
   - Once server-side rate limits are mitigated, re-run the Playwright test as-is to validate the real end-to-end path.

## Commit & push

This file was created and will be committed alongside the existing improvements to `generate-and-verify.spec.mjs`. The branch currently in use is `AE-devolve/01-skip-puppeteer-temp`.

If you'd like, I can implement option (1) (add a fallback click of `force-local-preview`) now and push the patch, then re-run the test and report results. Choose that or another option and I'll continue.

---

Generated: 2025-09-23
