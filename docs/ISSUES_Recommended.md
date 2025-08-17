## ISSUES_Recommended — Next recommended steps

Modus operandi:
We are not starting from scratch: prior to update or edit — assess what's already implemented; describe how the new implementation fits; get prior approval; then begin updating.

This document lists the next recommended steps, acceptance/verification criteria, priority, and a simple checkbox mechanism you and I will use as items are implemented and verified.

How this file is used:

- Each item includes: short description, verification steps, priority (P1/P2), and owner.
- When I implement and verify an item, I'll mark the checkbox and add a short verification note below the item.

Checklist

1. [x] Create `.env.example` with required environment variables and guidance

   - Priority: P1
   - Owner: me (created)
   - Verification: `./.env.example` exists and contains keys: POSTGRES*\*, GEMINI*\*, CHROME_PATH, PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
   - Notes: Created and verified on 2025-08-17; file present at `/.env.example`.

2. [ ] Verify `server` `/health` and readiness behaviour

   - Priority: P1
   - Owner: you/me (I can run checks or provide commands)
   - Verification: `GET /health` returns `200` when services are up in devcontainer; otherwise returns structured 503 during startup.

3. [ ] Puppeteer smoke test in devcontainer

   - Priority: P1
   - Owner: me (run inside devcontainer) or you if running locally
   - Verification: small script successfully launches Chrome via `CHROME_PATH` and renders a page to PDF or plain check; exit code 0.

4. [ ] Confirm devcontainer `postCreateCommand` completes (install dependencies)

   - Priority: P2
   - Owner: me / contributor who opens Codespace
   - Verification: `cd client && npm run dev` and `cd server && npm run dev` succeed in container and forwarded ports open.

5. [ ] Run client & server tests (Vitest/Jest) and fix failures

   - Priority: P1
   - Owner: me
   - Verification: `npm test` in `client/`, `server/`, and `shared/` pass on CI or devcontainer.

6. [ ] Replace GET `/preview` query-JSON with POST for large payloads (refactor client usage)

   - Priority: P2
   - Owner: me
   - Verification: client `endpoints.preview` uses POST and preview route accepts JSON body; tests updated accordingly.

7. [ ] Add an integration test covering core loop: prompt → preview → export

   - Priority: P1
   - Owner: me
   - Verification: Integration test runs in CI (or locally) and validates full flow with small sample data and cleans up artifacts.

8. [ ] Add CI job to run tests and the integration smoke test (optional gated job for Puppeteer)
   - Priority: P2
   - Owner: me / repo maintainer
   - Verification: GitHub Actions or similar runs tests and reports status on PRs.

How to check items off

- I'll update this file to mark items done as I complete and verify them. Each checked item will include a one-line verification note and timestamp.

Change log (most recent at top)

- [TODO] File created; `.env.example` will be added now and the first item verified.
- [INFO] API docs added at `docs/API_ENDPOINTS.md` on 2025-08-17.
