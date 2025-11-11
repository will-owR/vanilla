---
title: API Payload Implementation - Actionables (updated)
date: 2025-11-11
status: active
---

This document describes the "how": a prioritized list of action items for implementing, testing, and stabilizing the enhanced prompt payload on frontend & backend.

Breakdown: Immediate / Short-term / Medium-term / Long-term tasks.

## Immediate (high priority)

1. Update frontend `submitPrompt` behavior

- Goal: ensure the frontend submits the canonical payload with `mode`, `prompt`, `metadata`, and `options`.
- Files to update:
  - `client/src/lib/api.js` — `submitPrompt()` signature and body to accept a full payload or assemble it from `promptStore` and `modeStore`.
  - `client/src/lib/genieServiceFE.js` — ensure it passes the correct payload to `submitPrompt` and returns a normalized shape.
  - `client/src/App.svelte` and `client/src/components/PromptInput.svelte` — update callers to pass or build full payloads and to use metadata fields.
- Test
  - `npm run test` (client) to ensure `submitPrompt` tests are updated.
  - Add a small unit test to `client/__tests__/` to confirm `api.submitPrompt({ mode: 'demo', prompt, metadata })` sends the right JSON body via `fetch`.

2. Add unit tests for `server/validators/promptPayload.js`

- Implement tests for:
  - Missing `mode` or `prompt` -> INVALID_PAYLOAD
  - `mode === 'demo'` with missing `metadata` -> MISSING_METADATA + `fields` array
  - `mode === 'ebook'` for similar case
  - Unsupported `mode` -> INVALID_MODE
- Files to add: `server/__tests__/validators/promptPayload.test.mjs`.
- Run tests:

```bash
cd server
npm test
```

3. Ensure the `/prompt` endpoint uses validator, sets `request_id`, and returns canonical shape

- Files to review/update:
  - `server/index.js` — ensure middleware injects `request_id` and the endpoint normalizes output envelope returned by `genieService.process`.
  - Ensure `sendValidationError` includes the validation's specific error code in a predictable place (e.g., top-level `error` string + `fields`). If `sendValidationError` uses a complex error object, ensure it's well-documented and consistent.
- Tests:
  - Update `server/__tests__/prompt.controller.test.mjs` to send full payloads and assert behavior including `request_id`, `out_envelope` shape, and 400 on missing metadata.

## Short-term (next 1-2 sprints)

4. Update `genieService.process` to standardize metadata naming and merge behavior

- Ensure `genieService.process`:
  - Normalizes results returned by mode handlers: accepts both `out_envelope` and legacy `{ pages, metadata, actions }` returns.
  - Adds `generated_at` (snake_case) and `mode` to final envelope `metadata`.
  - Accepts `request_id` from `req` (or optional param) and inserts into envelope metadata.
- Tests:
  - Add unit tests for `server/genieService.*` ensuring `process()` returns canonical `out_envelope` for various mode handlers and error scenarios.

5. Standardize service handlers to return canonical shapes

- Update `sampleService`, `demoService`, `ebookService` to return `{ pages, metadata, actions }` or `out_envelope` deterministically.
- Normalize `generated_at` naming and ensure `metadata.*` items are consistent across services.
- Tests: Add tests for each service's `handle` function.

6. Update error handling shape for validation and server errors

- Decide on either a simple, flat top-level `error` string (preferred by earlier docs) OR keep the `error` object (`{ message, code, timestamp, requestId }`) used by `createErrorResponse`. If you keep the object, the `code` inside should match validator-level codes (e.g., `INVALID_PAYLOAD`).
- Implementation tasks:
  - Update `server/utils/errorHandler.js` to map `sendValidationError` to accept `code` param explicitly and include `errorCode` at top-level if needed.
  - Update all tests and docs referencing error responses to match the selected shape.

## Medium-term

7. Add schema-based validation (Zod or Joi)

- Move `server/validators/promptPayload.js` to a schema-based validator for better reproducibility and strongly typed errors.
- This improves client/server alignment; you can use the same schema to generate client validation and type definitions in the future.
- Example library choices:
  - Zod (lean, excellent TypeScript ergonomics).
  - Joi (popular / expressive).
- Tests: Ensure schema-based tests match example payloads and edge cases.

8. Standardize metadata naming conventions across the codebase.

- Migrate `generatedAt` to `generated_at` (snake_case) in all service outputs.
- Ensure `mode` is included in metadata for all responses.
- Update all tests that rely on older naming.

9. Add `request_id` and logging & E2E trace support

- Middleware: Add `req.requestId = uuidv4()` and attach it to `res.locals` for use in `genieService` and errorHandler.
- Add the `request_id` to the `out_envelope` metadata and to the error responses.

10. Update frontend UI and tests

- Update `client/src/components/MetadataSection.svelte` to validate per-mode metadata and match server validation rules. Add helpful inline messages.
- Update `client/src/App.svelte`, `PromptInput.svelte` to call `submitPrompt` with the canonical payload.
- Tests: Add frontend unit/integration tests to assert that `submitPrompt` submits the correct payload for different mode settings and that UI validation shows proper messages.

## Long-term

11. Integration tests and API docs

- Add integration tests that run a `submitPrompt` (client), assert server `out_envelope` and the preview/export flows.
- Add API docs (OpenAPI or similar) defining schema and response shapes. Include sample requests and error responses.

12. Conduct a security review

- Ensure all prompt text and metadata are sanitized and that large payloads are guarded (size limits) to avoid resource exhaustion.
- Add rate-limits and size validations at the endpoint.

## Test and verification commands

- Backend tests (server root):

```bash
cd server
npm test         # runs vitest
npm run test:ci   # runs tests with coverage
```

- Frontend tests (client root):

```bash
cd client
npm test
```

- Run dev server (makes incremental commits and manual checks easier):

```bash
# server
cd server
npm run dev

# client
cd client
npm run dev
```

## Example implementation plan (concrete steps)

1. Add `request_id` middleware to `server/index.js` above route handling.
2. Update `server/validators/promptPayload.js` to use either a schema library or to keep a robust manual validator (immediately add tests).
3. Update `/prompt` endpoint to pass `request_id` into `genieService.process(req.body, { request_id: req.requestId })` or simply `req` so the service may persist it. Return `out_envelope` plus `request_id` in metadata.
4. Update the frontend `submitPrompt` to assemble payload from stores and send the full JSON. Update tests to assert this behavior.
5. Add unit tests for the validator and integration tests for `/prompt` endpoint for `demo`, `ebook`, `basic`.
6. Update `server/utils/errorHandler.js::sendValidationError` to accept `code` param so createErrorResponse can include the validator-specific code in response as `error: "MISSING_METADATA"`.
7. Update service handlers to honor and standardize `generated_at`, and update relevant tests.

## Acceptance criteria for actionables

- All new tests pass.
- The server response matches the documented schema (out_envelope; generated_at; mode; request_id present).
- The frontend `submitPrompt` posts full payload for all modes with metadata populated and displays validation errors when appropriate.

---

Last updated: 2025-11-11
