---
title: Enhanced API Payload Implementation (updated)
date: 2025-11-11
status: active
---

## Purpose

This updated implementation doc focuses on the "what": the shape, contracts, and system-level invariants needed to support the enhanced prompt payload across frontend and backend systems.

The goal is to: accept a metadata-rich prompt payload and route it to the correct service handler (demo, ebook, basic), return a standardized response envelope, validate input above, and preserve compatibility where practical.

## Summary: What needs implementing (nature)

- A canonical payload that supports multiple modes and structured metadata.
- Server-side validation and canonical error codes for failing requests (e.g., `INVALID_PAYLOAD`, `INVALID_MODE`, `MISSING_METADATA`).
- Mode-based routing in the `genieService` and consistent service contract for mode handlers.
- Standardized response envelope and metadata conventions across all services.
- Stable frontend contract for submitting payloads including metadata and options.
- Observability and traceability: consistent `generated_at` timestamp and `request_id` (or `trace_id`) in responses.
- Clear tests validating payload and error behavior, and frontend integration tests that exercise the updated flow.

## API Payload (canonical shape)

POST /prompt

Request JSON (canonical):

```json
{
  "mode": "basic|demo|ebook",
  "prompt": "...",
  "metadata": {
    "title": "...",
    "author": "...",
    "pages": 123
  },
  "options": {
    "seed": 42
  }
}
```

Notes:

- `mode` is required. Use `basic` as explicit default if omission is considered a breaking change; otherwise the validator can treat missing `mode` as `INVALID_PAYLOAD`.
- `prompt` is required and must be a non-empty string.
- `metadata` is optional with mode-specific required fields (demo/ebook require title, author, pages).
- `options` is a future-proof extension point.

## Server: What the endpoint must do

- Validate payload using a centralized validator module (`server/validators/promptPayload.js`) that returns structured validation results: `{ valid, error, message, fields? }` where `error` is one of `INVALID_PAYLOAD`, `INVALID_MODE`, `MISSING_METADATA`.
- Return a 400 with the returned error code in a deterministic, documented shape.
- Route payload to `genieService.process(payload)` which dispatches to a mode-specific handler.
- Add a `request_id` to responses (preferably generated early in middleware and passed through). Add `generated_at` (snake_case) and `mode` to the response metadata.
- Normalize service outputs (see service contract below) and build the final `out_envelope`.

## Service contract (handler interface)

Mode services (sampleService, demoService, ebookService) should implement:

- `async handle(payload)` — accepts `{ mode, prompt, metadata = {}, options = {} }` and returns an object compatible with the canonical `out_envelope`.

The canonical service return shape can be any of:

1. { out_envelope: { pages, metadata, actions } } — preferred
2. { pages, metadata, actions } — legacy convenience (the top-level `genieService` must normalize this)

`pages` must be an array with each page object following a minimal contract:

- id (unique string within the envelope),
- title (string),
- blocks: array of { type: "text" | "image" | ..., content: string }

`metadata` should be a flat object (no circular refs) and should include `mode` and `generated_at`.

`actions` is an object representing optional post-generation actions (e.g. `can_export`, `can_preview`).

## Response Shape

Successful (201):

```json
{
  "out_envelope": {
    "pages": [
      {
        "id": "p1",
        "title": "...",
        "blocks": [{ "type": "text", "content": "..." }]
      }
    ],
    "metadata": {
      "mode": "demo",
      "generated_at": "2025-11-11T...",
      "title": "...",
      "author": "...",
      "pages": 10
    },
    "actions": {
      "can_export": true,
      "can_preview": true
    }
  }
}
```

Error (400): prefer a simple, stable schema that maps to documented codes. Example validator error:

```json
{
  "error": "INVALID_PAYLOAD",
  "message": "payload must include mode and prompt",
  "fields": ["mode", "prompt"]
}
```

For processing errors (500):

```json
{
  "error": "GENERATION_ERROR",
  "message": "Human readable message"
}
```

Notes on current implementation: `server/utils/errorHandler.js` uses a nested object (`{ error: { message, code, ... } }`) while the docs expect a simple code string at top-level. Either update the `sendValidationError` wrapper to include a top-level `error` string or update docs to state the returned `error` will be an object with `code`.

## Metadata normalization and naming

- Use `generated_at` (snake_case) across backend JSON responses (consistent with other endpoints). Update service metadata to align (e.g., `sampleService` currently returns `generatedAt` — normalize to `generated_at`).
- Keep `mode` as a metadata field in every response for clarity.
- Consider `request_id` in the envelope for tracing; prefer `request_id` as `uuidv4` string added by the endpoint middleware.

## Validation policy

- Server-side validation is authoritative; client-side validation should mirror server rules.
- Mode-specific validation:
  - `demo` & `ebook`: require `metadata.title` (string), `metadata.author` (string), and `metadata.pages` (positive integer).
  - `basic`: only `prompt` (string) required.

## Backwards-compatibility

- If your app still supports legacy `genieService.generate(prompt)` and old endpoint expectations (`success/data`), maintain a compatibility layer in the endpoint or `genieService.process` that detects old usage and returns the expected legacy shape for older clients, while preferring canonical envelope for new clients.

## Traceability and observability

- Add a middleware that sets `req.requestId` (uuidv4) at top of request and include it in logs and `out_envelope` metadata.
- Ensure `generated_at` is ISO8601.

## Acceptance Criteria (implementation level)

1. The `/prompt` endpoint accepts the canonical payload and returns a normalized `out_envelope` as described.
2. Each mode validates mode-specific metadata and returns `400` with an explicit `error` code and `fields` if missing.
3. Service handlers accept the full payload, generate pages, and return consistent metadata and actions keys.
4. The frontend calls the endpoint using the canonical payload in normal flows (e.g., `submitPrompt({ mode, prompt, metadata, options })`).
5. The system emits a `request_id` and `generated_at` in every successful `out_envelope`.

## Notes and rationale

- The primary focus is consistency and a single standard contract. The validator must be robust and tests should exercise both valid and invalid payloads.
- Future work: schema validation via Zod/Joi and stricter metadata typing to reduce integration errors.

---

Last updated: 2025-11-11
