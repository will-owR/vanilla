# CURRENT_FE v0-1 — dv02 (Desired / Pending)

Date: 2025-10-15
Branch: aether-rewrite/client-phase2-AAA-sol1-95

Architecture Principles (must be followed by dv02 implementations)

1. **Always-Working Frontend First**

   - Consistent, working state
   - Independent component testing
   - Clear display/logic separation
   - Predictable data flow

2. **"Dumb" Preview Component**
   - Display-only responsibility
   - Store-driven updates
   - Clean business logic separation

These principles define what is missing and guide the pending work described below.

---

Note: the preview update failure observed in tests is a functional disalignment (client expectations vs current behavior), not a pure runtime bug. The goal of dv02 is to record what must change so the frontend and backend are aligned with the Architecture Principles.

## Key gaps and desired changes (dv02)

1. Stabilize preview update behavior to match "Always-Working Frontend First":

   - Ensure `previewStore` updates always result in visible changes in `PreviewWindow` and that the `data-preview-ready` attribute is toggled consistently.
   - Convert race-prone client patterns into store-driven updates with clear load states (loading / ready / failed) and add unit tests for those states.

2. Make the preview component truly "dumb":

   - Remove business logic from `PreviewWindow` and ensure it only renders state from `previewStore`.
   - Move any formatting or sanitization decisions to server-side or renderer modules; client renders pure, sanitized HTML or safe plaintext.

3. Replace `?dev=true` with explicit `serviceHint` pass-through and gate access:

   - Accept `serviceHint` in `POST /prompt` body and pass it to `genieService.generate(payload)`.
   - Validate against a whitelist and restrict usage via an environment flag in production.

4. Add discoverability for persisted results:

   - Provide a direct mapping API (example: `GET /api/ai_results?requestId=<id>` or `GET /api/by-request/<requestId>`) so clients can poll by requestId.

5. Normalize persistence contract names and canonicalize sanitization responsibility:

   - Choose one canonical name (`persistInstructions`) and update docs and code.
   - Decide whether application services must return sanitized HTML or if final sanitization occurs in plumbing. Document and test the contract.

6. Improve persistence guarantees (optional / medium):

   - Add DB transactions, atomic tmp->rename file writes, and compensation logic to bring stronger durability guarantees to export artifacts.

7. Stabilize tests and E2E harnesses:

   - Harden Playwright setup against component loading order and asynchronous store updates.
   - Add focused unit tests that assert `previewStore` state transitions and that the `PreviewWindow` renders the expected DOM attributes and content.

8. Streaming / incremental preview (future):
   - If incremental UX is desired, design SSE/fetch-stream endpoints and plumbing helpers and make application services able to emit chunks.

---

## Suggested short checklist (practical next steps)

1. Add explicit `serviceHint` pass-through (server + update tests) and deprecate `?dev=true`.
2. Audit and remove any presentation/business logic from `PreviewWindow`; make it store-driven and display-only.
3. Add unit tests for `previewStore` that assert transitions (loading → ready → failed) and that DOM attributes like `data-preview-ready` reflect state.
4. Implement `GET /api/ai_results?requestId=<id>` to allow clients to discover persisted artifacts by requestId.
5. Canonicalize `persistInstructions` naming and update `genieService` and `persistence.execute()` accordingly.
6. Harden Playwright E2E harness to reliably exercise the store-driven preview flow and convert the current failing E2E into a green test.

---

## Example: `serviceHint` pass-through (recommended)

Server-side suggestion (conceptual):

```js
// inside POST /prompt handler
const { prompt, serviceHint } = req.body || {};
const geniePayload = { prompt, requestId: req.requestId };
if (serviceHint) geniePayload.serviceHint = serviceHint;
const genieResult = await genieService.generate(geniePayload);
```

`genieService.generate(payload)` should prefer an explicit `serviceHint` when present and validate it against known service keys.

---

## Acceptance criteria (dv02)

- Preview updates are deterministic and driven by `previewStore` state transitions.
- `PreviewWindow` contains no business logic and only renders store state.
- Tests exist (unit + E2E) that reproduce the previous disalignment and now pass.
- `serviceHint` is supported in tests, `?dev=true` is deprecated, and persisted results are discoverable via `requestId`.

---

If you'd like, I will now create the minimal `serviceHint` server change and a unit test wiring `previewStore` → `PreviewWindow` behavior, or I can just commit these doc files first. Which do you want next?
