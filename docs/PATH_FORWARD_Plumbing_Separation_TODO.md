2025-10-11T00:00:00Z
Branch: aether-rewrite/client-phase2-AAA-sol1

# PATH_FORWARD: Plumbing Separation — Remaining Todos (Open)

Link to base assessment: PATH_FORWARD_Plumbing_Separation.md

This document captures the remaining open tasks called out by `PATH_FORWARD_Plumbing_Separation.md`. When each item is implemented, tested, and verified, update `docs/reference/PLUMBING_SEPARATION_REFERENCE.md` (add date and short note) and mark the todo as closed in this file.

Open todos

1. Stabilize and document `requestId` contract (open)

   - Ensure all generation and preview/export handlers consistently include `X-Request-Id` header and `response.body.metadata.requestId` (or equivalent) and that they match.
   - Add an integration test that calls the endpoints and asserts header/body parity for `/prompt`, `/genie`, `/preview`, and export endpoints where applicable.
   - Estimated effort: 0.5–1.5 hours.

     Breakdown:

     - Add contract test for one endpoint and verify header/body parity: 0.25–0.5h
     - Extend test to remaining endpoints and tidy assertions: 0.25–1.0h

2. Expand error boundary unit tests (open)

   - Add unit tests that assert `TransportError` and `ServiceError` shapes and ensure `requestId` is included in structured error payloads returned to clients.
   - Ensure error middleware test coverage includes cases where headers are already sent and where logging failures are ignored safely.
   - Estimated effort: 2–3 hours.

     Breakdown:

     - Unit tests for `TransportError`/`ServiceError` shapes: 0.5–1.0h
     - Tests for error middleware header-sent paths and logging fallbacks: 1.0–2.0h

3. Design and prototype streaming / incremental preview (open)

   - If the UI needs partial updates, implement a streaming mode (SSE, fetch stream, or websocket) for generation endpoints (e.g., `/prompt?stream=1` or `/prompt/stream`).
   - Add an http plumbing helper for streaming/async iterable consumption and a small frontend consumer that appends chunks to `previewStore`.
   - Estimated effort: 6–12 hours (spike + prototype).

     Breakdown (recommended spike + prototype):

     - Design spike (trade-offs SSE vs fetch streams vs websockets): 1–2h
     - Implement server SSE/fetch-stream prototype endpoint: 2–4h
     - Implement a minimal frontend consumer + plumbing helper: 2–4h
     - Iterate and add basic tests / integration check: 1–2h

4. Finalize documentation and CI enforcement for sanitization and persistence (open)

   - Update project README, `docs/reference/PLUMBING_SEPARATION_REFERENCE.md`, and `PATH_FORWARD_Plumbing_Separation.md` with the finalized sanitizer policy (server-side sanitization behavior and the location of the sanitizer).
   - Add CI checks to run sanitizer and persistence tests (fail CI on regressions).
   - Estimated effort: 2–4 hours.

     Breakdown:

     - Update documentation (README + reference doc): 0.5–1h
     - Add CI job / test runner entries to execute sanitizer + persistence tests: 1–2h
     - Validate CI runs and adjust flaky tests: 0.5–1h

5. Confirm export/preview parity checks (low priority, open)

   - Add a small test that ensures `previewRenderer` and the export pipeline render the same core content for a canonical input (sanitization + images + page metadata).
   - Estimated effort: 1–2 hours.

     Breakdown:

     - Add a single canonical input test and assert preview vs export output equality: 1–1.5h
     - Tidy assets and flakiness fixes if needed: 0–0.5h

6. (Optional) Add `requestId` to persisted DB records if not already present (open)

   - Ensure artifact rows and ai_results are consistently annotated with the requestId for traceability. Add tests asserting `artifacts.request_id` matches `X-Request-Id` returned to client.
   - Estimated effort: 0.5–1 hour.

     Breakdown:

     - DB schema check + migration (if needed) and update persistence to include request_id: 0.25–0.5h
     - Add tests to assert DB rows contain the requestId: 0.25–0.5h

Note: When you implement a todo above, update `docs/reference/PLUMBING_SEPARATION_REFERENCE.md` with a brief note (datetime + branch + what changed) and mark the todo here as completed.
