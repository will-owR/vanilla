```markdown
# exercise_2 — Prompt → generate → preview (plumbing-separated)

Date: 2025-10-17 @10:00 AM
Branch: aether_V0-1

## Goal

Same as exercise_1: build a minimal, testable flow that demonstrates how a frontend prompt triggers a backend generation process which selects content from `data/content/` and the frontend preview updates without manual reload.

Bottom line for users: there should be no discernible difference in outcome between `exercise_1` and `exercise_2`. Both exercises must produce the same preview behavior and visible results in the UI.

## High-level actors (plumbing-separated)

- Frontend: single-page form with a `prompt` input, `Generate` button, and `preview` area.
- Frontend plumbing + orchestrator: `maestro_Service` and `client/plumbing/PreviewService` handle envelope composition, network transport and display orchestration.
- Backend: receives envelope, hands to `genieService` via `server/plumbing/` adapters, `sampleService` performs generation work.
- Data: `data/content/` contains sample content files; backend reads and forwards one as the generated preview.

## Big-picture flow (user-visible)

1. User enters text in `prompt` and clicks `Generate`.
2. Frontend sends a request and receives a preview payload in the same shape as `exercise_1`:
   {
   sessionId, // optional
   version: number,
   html: "<div>...rendered content...</div>",
   meta: { sourceFile, generatedAt }
   }
3. Frontend renders `preview.innerHTML = payload.html` (or uses a safe renderer).

The plumbing separation introduced in `exercise_2` is internal and invisible to the user: the envelope, registry, and transport handoffs occur behind the scenes. The UI contract and acceptance criteria remain identical to `exercise_1`.

## Routing and contract guarantees (short)

- The system uses a small envelope shape (sessionId, correlationId, recipientService, payload, meta). For this exercise the frontend and backend adapters preserve the payload shape returned to the UI: `{ sessionId, version, html, meta }`.
- The orchestrators (maestro_Service and genieService) and plumbing adapters must preserve `meta.sourceFile` and `correlationId` so tests can assert equality with `exercise_1` behavior.

## Acceptance criteria (same as exercise_1)

1. A user types into `prompt`, clicks `Generate`, and the preview area updates with content selected from `data/content/` without a page reload.
2. The returned payload includes a `meta.sourceFile` pointing to which file was used.
3. Implementation is small, readable, and easy to run (dev: node server; static client file or served by server).

## Reconciled plumbing notes (summary)

- Message envelope (kept internal) ensures recipient metadata and correlationId travel across plumbing boundaries.
- A minimal service registry (config-driven) allows orchestrators to determine whether to route locally or to request plumbing to forward across the boundary.
- Transport adapters are HTTP POST for the synchronous demo; plumbing retries and timeouts are handled in plumbing adapters and are invisible to the UI when successful.

## Tests (suggested)

- Unit: `server/app/generate.js` — given a payload, returns canonical payload and a version number (Date.now()-based or incremented). This must match `exercise_1` behavior.
- Integration: simulate an envelope through client plumbing -> server plumbing -> sampleService -> response path, assert the final payload shape matches `exercise_1` contract and `meta.sourceFile` is present.

## Bottom line (user-facing)

There must be no discernible difference between `exercise_1` and `exercise_2` outcomes. The plumbing separation is an internal refactor to improve testability and routing flexibility; for users the prompt → Generate → preview result appears and behaves exactly the same.
```
