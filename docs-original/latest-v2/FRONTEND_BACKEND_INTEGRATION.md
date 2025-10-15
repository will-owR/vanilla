# Frontend ↔ Backend Integration: Design, Assessment, and Actionables

Date: 2025-10-11
Branch: aether-rewrite/client-phase2-AAA-sol1

**Note:** The plumbing separation work (server-side plumbing vs application services) remains a higher priority for system correctness and traceability than optional frontend push/streaming features. The frontend integration doc below is a complement; address plumbing gaps first.

## Purpose

Capture the current integration design between the frontend and the server (plumbing vs application services separation), assess the current status, compare with the earlier PATH_FORWARD intent, and provide a concrete set of design decisions and actionables for frontend integration and incremental improvements.

## Summary of current behavior (short)

- The server's `/prompt` endpoint returns a preview immediately and schedules persistence (prompt row, `ai_result`, artifacts) asynchronously after the response.
- The server attaches a `requestId` (plumbing-level) to the request/response and stores it with persisted rows (ai_results, artifacts) for later correlation.
- The server provides `GET /preview` for rendering sanitized HTML (content passed as JSON or loaded by resultId/promptId).
- Persistence is atomic at file-write level via a tmp->rename and artifacts are recorded in the `artifacts` table.

## What this means for a frontend

- The UI should show the returned preview immediately for good perceived latency.
- The UI must not assume persistence (promptId/resultId) is present in the immediate response; it must instead either poll or subscribe to notifications for persistence completion.
- The `requestId` is the primary correlation handle for finding final persisted rows.

## Current status: how frontend would connect today

- POST /prompt
  - Send: { prompt: string, selections?: object }
  - Receive: { success, requestId, preview, data }
  - Note: data.promptId/data.resultId may be missing.
- Query for final result (options):
  - Poll GET /api/ai_results?request_id=<requestId> (or search by promptId/resultId when present)
  - Use GET /preview?resultId=<id> to fetch sanitized HTML when ai_result id known

## Assessment: Does it work? Is it robust?

Works: Yes

- The contract allows the frontend to display immediate previews.
- `requestId` provides a stable correlation key for later lookup.
  Robustness: Medium
- Polling is required today (no built-in push mechanism). Polling works but is less efficient and has latency.
- Tests in the repo demonstrate the current server correctness but required test changes to account for async persistence — meaning consumers/tests must be careful.
- The server already handles sanitization and safe persistence.

## Comparison to earlier PATH_FORWARD design

Earlier doc goals (excerpted):

- Separate plumbing from application services so plumbing remains minimal and orchestrates persistence, request correlation and UI-friendly quick responses.
- Have a server-side sanitizer and preview renderer to minimize client-side parsing work.

How the current code aligns:

- Alignment: The server already performs the plumbing responsibilities: requestId propagation, immediate preview, and deferred atomic persistence.
- Gaps vs earlier aspirational targets:
  - No push/notification mechanism (SSE/WebSocket) implemented for finalization events.
  - Tests assumed synchronous persistence initially (fixed by making tests robust) — callout that the contract should be documented.

## Design: recommended frontend integration approach

1. Minimal/compatible approach (recommended first step)

   - Client POST /prompt, read `requestId`.
   - Render returned `preview` immediately.
   - Start a short-poll loop (250-500ms interval) for up to N seconds to query for persisted ai_result via `/api/ai_results?request_id=<requestId>` or an endpoint like `/api/ai_results/latest?requestId=`.
   - When an ai_result is found, fetch `/preview?resultId=<id>` and update UI and artifacts list.
   - If not found within timeout, surface a user-friendly message: "Saved, but processing may be delayed. We'll try again later."

2. Improved approach (SSE or WebSocket)

   - Implement an SSE endpoint on the server to emit events when the async persistence completes (e.g., `ai_result.created` containing ai_result_id and requestId).
   - Client subscribes to SSE (optionally with a token or user-scoped subscription), and the server emits a one-time event.
   - Client fetches the persisted result on event and updates UI.

3. Streaming/real-time previews (advanced)
   - Stream partial outputs as the application service (AI) produces them; server merges and emits progressive preview updates to the client (requires changes to application service and plumbing to support streaming envelopes).

## API contract additions to consider

- GET /api/ai_results?request_id=<id>
  - Returns ai_result rows filtered by request_id; useful for poll-based discovery.
- GET /api/ai_results/latest?request_id=<id>
  - Returns latest ai_result for requestId.
- SSE endpoint: GET /events?subscribeKey=... (or /events?requestId=...)
  - Emits events: `ai_result.created` { id, requestId, promptId }

## Frontend helper / SDK (small)

- `createPrompt(prompt, { onPreview, onPersisted, onError, timeout, pollInterval })`
  - Returns a `handle` with `cancel()` and `waitForResult()`.
- Internals:
  - POST /prompt
  - Extract requestId from response body or `X-Request-Id` header
  - Call onPreview(preview)
  - Try to subscribe to SSE for event keyed by requestId; fallback to polling if SSE unavailable.
  - When result arrives, call onPersisted(result)

## Actionables (concrete steps, no code changes) — prioritized

Short-term (1-2 days)

- Document the async contract clearly in `docs/PATH_FORWARD_Plumbing_Separation_TODO.md` and this new doc (done here) so tests and new engineers know to poll/subscribe, and not to assume immediate persistence. (I'll update the TODO doc with a short summary if you want.)
- Create a tiny frontend helper (copy-paste JS) that implements POST->preview->polling fallback. Provide example usage in the UI.
- Add unit tests for the helper (mock server) verifying preview and persistence transitions.

Medium-term (2-4 days)

- Add the optional `GET /api/ai_results/latest?request_id=` endpoint for simpler polling (server-side change).
- Add SSE endpoint and server logic to emit `ai_result.created` when persistence completes. Add a feature flag to elect SSE.
- Update the frontend helper to try SSE first, fallback to polling.

Long-term (4-14 days)

- Implement streaming preview support: define a streaming envelope format for partial content from application services and plumbing to client (requires wider design).
- Implement signed artifact URLs and access controls for artifact downloads if results are user-restricted.
- Add monitoring + traces for latency from requestId to persisted event.

## Testing & observability

- Add contract tests ensuring POST /prompt returns `requestId` and preview, and that final persisted ai_result contains `request_id`.
- Add e2e tests that simulate delayed persistence so the frontend logic (polling/SSE) is exercised.
- Add logs + metrics for persistence durations (requestId -> ai_result.created time) to surface slow processing.

## Risks & mitigations

- Race conditions where frontend assumes persisted rows too early: mitigate with robust polling/fallback and clear UX messaging.
- Long-lived SSE connections in some clients/proxies: provide polling fallback and document the fallback.

## Appendix: sample client helper pseudocode (copy/paste friendly)

- See the brainstorming notes in the earlier design conversation (I can provide a precise JS hook or SDK file on request). This doc intentionally contains high-level pseudocode; tell me if you want a concrete implementation.

## Status of tasks created from this doc

- Create doc: done (this file)
- Update PATH_FORWARD TODO doc: not done (can add a short summary linking to this doc)
- Create frontend helper: not done (I can draft it if you want)

End of doc

## ADDENDUM — Risks, Deficiencies, and Actionable Recommendations

Concrete risks and deficiencies (short)

- Missing persisted-result discovery: the client often never learns `promptId` or `resultId` when the server persists asynchronously. This prevents showing saved artifacts or enabling "download"/history workflows.
- No correlation usage: the client does not surface `requestId` to telemetry or UI. This makes support/troubleshooting and log correlation harder.
- No server-push support: absent SSE/WS the client must poll (if implemented later), which can add latency and overhead.
- UX ambiguity: there is no explicit "saved / persisted" state in the UI; users may not understand whether their generated preview is stored.

Actionable recommendations (concrete)

1. Return and expose `requestId` in the client response (client-side change only)

- Implementation: In `client-v2/src/lib/promptStore.js`, capture `json.requestId` or `res.headers.get('x-request-id')` and return it from `submitPrompt()` along with `html` and `persisted`.
- Benefit: lightweight, immediate correlation handle for telemetry and polling.
- Effort: ~0.5 day.

2. Add a poller helper in `client-v2` to discover persisted ai_result rows by requestId

- Implementation: `waitForAiResult(requestId, {interval=300, timeout=8000})` that calls `/api/ai_results?request_id=` until a row is found or timeout.
- Use: optional in UI flows that need artifact/result discovery.
- Effort: ~0.5–1 day.

3. Small UX improvement: show "Saving..." indicator when artifacts are expected

- Implementation: Preview component shows a subtle saving state while polling/subscribed for persisted result.
- Effort: ~0.5 day.

4. Server: add optional SSE endpoint and a `latest` ai_results endpoint (medium-term)

- SSE: server emits `ai_result.created` { id, requestId, promptId } on persistence completion.
- latest endpoint: `GET /api/ai_results/latest?request_id=<id>` returns the latest ai_result or 204 when none.
- Client: try SSE first, fallback to polling.
- Effort: server ~1-2 days; client ~0.5–1 day.

5. Tests & observability

- Add unit tests for `promptStore.submitPrompt()` to assert `requestId` extraction and persisted handling.
- Add e2e test that uses a simulated delayed persistence server response to validate polling/SSE flows.
- Add telemetry hooks to record `requestId` and latency from request to persistence.
- Effort: ~1–2 days.

## HISTORY — focused analysis, comparison to new design, and snippets

What we examined (original focused analysis)

- `client-v2/src/lib/promptStore.js` — single place where the client submits prompts; it posts to `/prompt`, extracts preview HTML from several shapes, sets `previewStore`, and returns `persisted` if present.
- The client currently: shows immediate preview; does not use `requestId`; does not poll or subscribe for persisted results.

How this compared to the new design recommendations

- Alignment: The client implements the essential "immediate preview" experience recommended (fast UX, server-sanitized HTML rendered by the UI).
- Differences: The new design recommends using `requestId` for correlation and either polling or SSE for finalization. The current client lacks both.

Concrete snippets (small, copyable) used during analysis

- How to extract `requestId` from the response (client-side):

```javascript
// after await fetch and json parse in promptStore.submitPrompt
const requestId =
  json.requestId ||
  res.headers.get("x-request-id") ||
  (json && json.data && json.data.metadata && json.data.metadata.requestId);
// return or expose requestId to caller
return { success: true, html, persisted, requestId };
```

- Poller helper pseudocode:

```javascript
async function waitForAiResult(
  requestId,
  { interval = 300, timeout = 8000 } = {}
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const r = await fetch(
      `/api/ai_results?request_id=${encodeURIComponent(requestId)}`
    );
    if (!r.ok) {
      await new Promise((r) => setTimeout(r, interval));
      continue;
    }
    const json = await r.json();
    // assume payload shape { success: true, data: [ ... ] }
    if (json && Array.isArray(json.data) && json.data.length)
      return json.data[0];
    await new Promise((r) => setTimeout(r, interval));
  }
  return null;
}
```

Why these snippets matter

- They are small, non-invasive changes that make the client-frontend robust to the server's asynchronous persistence pattern without requiring immediate server changes.

— end HISTORY
