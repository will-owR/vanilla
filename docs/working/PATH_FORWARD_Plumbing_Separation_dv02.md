```markdown
# PATH_FORWARD: Plumbing vs Application Service Separation — dv02

Date: 2025-10-06
Branch: aether-rewrite/client-phase2-AAA

This dv02 document captures the outstanding gaps, risks, prioritized recommendations, and suggested next steps that remain after the V1 implementation work.

---

## Important gaps & risks (still relevant)

- HTML sanitization / XSS risk

  - While server-side sanitization exists in the new renderer, ensure the sanitizer contract is well-documented and tested for edge cases (embedded scripts, event handlers, data URIs). Confirm it is applied consistently across preview and export flows.

- Presentation code inside transport layer

  - Move any remaining presentation logic out of `server/index.js` and into `server/previewRenderer.js` or an application service responsible for shaping content.

- No streaming / partial preview support

  - Backend plumbing currently returns full responses. Design and add streaming support (SSE, fetch streams, or websockets) if incremental UI is desired. Ensure application services can emit chunks and that plumbing supports async iterables or onChunk callbacks.

- Sanitization responsibility clarity

  - Decide and document where sanitization happens (server-side render vs client-side) and make this part of the API contract.

- Presentation vs export duplication

  - Ensure `previewRenderer.js` is used by both preview and export flows to avoid drift between client preview and PDFs/exports.

---

## Prioritized recommendations (remaining)

1. (High) Stabilize and document the sanitizer behavior and the server contract: "server returns sanitized, display-ready HTML" or "server returns plain text". Add unit tests for sanitizer edge cases.

2. (Medium) Stabilize the `requestId` contract across handlers and consumers. Ensure `X-Request-Id` header and `metadata.requestId` are present and tested in all generation and export endpoints.

3. (Medium) Design and implement streaming/incremental preview endpoints and plumbing helpers. Add a minimal frontend consumer helper for the UI to append preview chunks.

4. (Medium) Expand error boundary coverage and ensure errors include `requestId` in structured error payloads; add unit tests verifying the shapes.

5. (Low) Add CI enforcement to verify sanitizer unit tests and persistence executor tests run and pass. Add lint rules to prevent application services from writing files directly.

6. (Optional) Add `requestId` to persisted DB records for traceability.

---

## Suggested short checklist to implement next (Phase A)

1. Confirm `server/previewRenderer.js` API: `renderPreview(content)` returns sanitized HTML and export-safe variants. Add unit tests for edge cases (scripts, on\* attributes, data URIs).
2. Audit `server/index.js` to remove any leftover inline templating or presentation logic that wasn't moved; ensure all consumers use the renderer for both preview and export.
3. Add `requestId` generation in any remaining handlers and assert header/body parity in tests for `/prompt`, `/genie`, and export endpoints.
4. Design streaming API (SSE or chunked fetch) and implement a plumbing helper that application services can call to emit chunks; add a simple frontend helper to consume and append to `previewStore`.
5. Add CI checks and negative persistence tests if not already present.

---

## Outstanding work (what remains — revised)

1. Stabilize and document the `requestId` contract across handlers and consumers (short):

   - Ensure all generation and preview/export handlers consistently include `requestId` in the HTTP response header (`X-Request-Id`) and, where chosen, in the JSON `metadata` object. Tests should assert both header and metadata as part of the contract so clients can rely on either/both places.

2. Robust error boundary coverage (short → medium):

   - Expand unit tests for `TransportError`/`ServiceError` shapes and ensure `requestId` is present in every structured error payload returned to clients. Remove any remaining ad-hoc debug logging used during test development.

3. Streaming / incremental preview design (medium):

   - If incremental preview UI is desired, design a streaming mode (SSE or fetch streams) and add plumbing helpers and a frontend consumer that appends to `previewStore`. This is a larger change and can be scoped as a separate sprint.

4. Documentation and CI additions (short):

   - Update README and the `PATH_FORWARD` docs with the finalized sanitizer behavior (server-side sanitization) and the intent→instruction contract.
   - Add CI checks that enforce: sanitization unit tests, persistence executor tests, and lint rules for not writing files from application services.

5. Negative test for persistence safety (small, immediate):
   - Add a focused test asserting that `persistence.execute` rejects intents whose `folderHint` or `filenameHint` would resolve outside the allowed base directory (for example, `folderHint: "../../etc"`). This guards against accidental path traversal via malicious or buggy intents.

---

_Generated from `docs/working/PATH_FORWARD_Plumbing_Separation.md` — contents focused on remaining work and action items._
```
