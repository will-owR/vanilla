---
title: API Payload Actionables — Merged (Frontend + Backend)
date: 2025-11-11
status: active

**Note:** This converges the work of API_payload_actionables_PHASE2-FRONTEND.md and API_payload_actionables-updated.md into a single implementation guide for both frontend and backend teams.
---

## Implementation Branch

All implementation work should be done in a dedicated feature branch:

```bash
git checkout -b feature/enhance-prompt-payload-frontend
```

## Purpose

This document merges the frontend Phase 2 actionables with the system-level backend actionables to enable the fastest, lowest-error implementation of the enhanced prompt payload across the app.

## Scope

- Frontend: assemble, validate, submit payload; parse responses; update components and tests.
- Backend: validation contract, error format, out_envelope canonical shape, request tracing, and tests required for frontend integration.
- CI and docs: tests and verification steps.

Quick decision: make the frontend doc the primary implementation guide for the UI work, and adopt key backend requirements (error format, request_id, out_envelope shape) from the updated actionables so the frontend and backend align.

## Immediate (highest priority — frontend + essential server expectations)

1. Frontend: update `submitPrompt()` to build the canonical payload

- Files to edit (client):
  - `client/src/lib/api.js` (submitPrompt)
  - `client/src/lib/genieServiceFE.js` (delegate calls)
  - `client/src/App.svelte`, `PromptInput.svelte` (call sites)
  - `client/src/components/MetadataSection.svelte` (verify validation UX)

2. Frontend: validation & parsing

- Client-side validation should mirror server rules (fail fast, show errors). The server is the source-of-truth for server-side checks and will enforce the canonical contract.
- The frontend must parse the canonical server response shape only: `{ out_envelope: { pages, metadata, actions } }`.
- For server errors, the frontend must parse the canonical validation error shape: `{ error: "ERROR_CODE", message: "Human readable message", fields?: ["field1", ...] }` and show appropriate user messages.

3. Backend minimal requirements (must be implemented before/with frontend PR):

- `/prompt` endpoint must validate payload using `server/validators/promptPayload.js`
- `400` validation errors should include either (a) top-level `error` string code (e.g., `INVALID_PAYLOAD`), or (b) nested `error.code`. Frontend expects `fields` for `MISSING_METADATA`.
- `genieService.process` must return canonical shape:
  ```json
  { "out_envelope": { "pages": [...], "metadata": {...}, "actions": {...} } }
  ```
- Add `generated_at` (snake_case) to all metadata, and `mode`. Optionally include `request_id`.

4. Coordination checklist — small & fast integration reduces errors

- Backend PRs before merging frontend PRs:
  - A validator PR that enforces payload contract + tests.
  - GenieService change returning canonical `out_envelope` (`generated_at` + `mode` + optionally `request_id`).
  - (Optional) Error handler change clarifying `error` shape.
- Plan: merge small backend PRs first, then frontend updates, then full integration test.

## Frontend code examples: assemble payload & canonical parsing

-- Minimal `submitPrompt()` (canonical parsing only):

```javascript
// client/src/lib/api.js
import { get } from "svelte/store";
import { promptStore } from "../stores/promptStore.js";
import { modeStore } from "../stores/modeStore.js";

export async function submitPrompt(payloadOrPrompt) {
  // If payloadOrPrompt is an object, assume full payload; if string, use stores
  const ps = get(promptStore);
  const ms = get(modeStore);

  const payload =
    typeof payloadOrPrompt === "object" && payloadOrPrompt !== null
      ? payloadOrPrompt
      : {
          mode: ms.current || ps.mode || "basic",
          prompt:
            typeof payloadOrPrompt === "string" ? payloadOrPrompt : ps.prompt,
          metadata: ps.metadata || {},
          options: ps.options || {},
        };

  // Basic client-side validation (mirror server checks for UX)
  if (!payload || !payload.prompt || !String(payload.prompt).trim()) {
    throw {
      type: "validation",
      code: "INVALID_PAYLOAD",
      message: "Prompt is required",
    };
  }

  if (payload.mode === "demo" || payload.mode === "ebook") {
    const { title, author, pages } = payload.metadata || {};
    const missing = [];
    if (!title) missing.push("title");
    if (!author) missing.push("author");
    if (!pages) missing.push("pages");
    if (missing.length) {
      throw {
        type: "validation",
        code: "MISSING_METADATA",
        message: "Missing metadata",
        fields: missing,
      };
    }
  }

  const res = await fetch("/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Parse the canonical server response
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const code = json?.error || "UNKNOWN_ERROR";
    const message = json?.message || `HTTP ${res.status}`;
    const fields = json?.fields || undefined;
    throw { type: "server", code, message, fields };
  }

  // Expect canonical envelope only
  const envelope = json?.out_envelope;
  if (!envelope || !Array.isArray(envelope.pages)) {
    throw {
      type: "server",
      code: "INVALID_RESPONSE",
      message: "Server response missing canonical out_envelope.pages",
    };
  }

  const pages = envelope.pages;
  const metadata = envelope.metadata || {};

  // Ensure canonical metadata fields exist
  if (!metadata.generated_at || !metadata.mode) {
    throw {
      type: "server",
      code: "INVALID_RESPONSE",
      message:
        "Server response metadata missing required fields: generated_at and mode",
    };
  }

  return { pages, metadata, actions: envelope.actions || {} };
}
```

## Server error shape expectations (explicit, small section) — frontend dev checklist

Front-end code must parse the canonical server error shape only:

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "fields": ["field1"]
}
```

Update `server/utils/errorHandler.js` to ensure validation errors return the validator-specific code as the top-level `error` string and `fields` (for missing metadata) under `fields`.

## Server expectations for the canonical envelope and metadata

- Each service handler must return either `{ out_envelope: { pages, metadata, actions }, metadata? }` or `{ pages, metadata, actions }`.
- `genieService.process` will normalize both shapes to the canonical `out_envelope` shape.
- `metadata` must include `generated_at` (snake_case) and `mode`.
- Add `request_id` to `out_envelope.metadata` if present in the request.

## Tests & quick verification (CI & local smoke tests)

- Backend tests (server):

  - `server/__tests__/validators/promptPayload.test.mjs` — validator unit tests.
  - `server/__tests__/prompt.controller.test.mjs` — update to call `/prompt` with full payloads and to assert `out_envelope` and `400` errors.
  - `server/__tests__/genieService.*` — assert `out_envelope` normalized from handler returns.

- Frontend tests (client):
  - Unit tests for `client/src/lib/api.js::submitPrompt` verifying payload JSON and error handling.
  - UI tests for `MetadataSection.svelte` validation and integration tests using `std` shapes.

## Commands

- Run server tests:

```bash
cd server
npm test
```

- Run client tests:

```bash
cd client
npm test
```

- Quick manual smoke test (dev):

```bash
# server
cd server; npm run dev
# client
cd client; npm run dev
# open browser and try generating a demo payload or use curl
curl -X POST http://localhost:3000/prompt -H "Content-Type: application/json" -d '{"mode":"demo","prompt":"Hello","metadata":{"title":"T","author":"A","pages":3}}'
```

## Implementation Order (merge of both docs, prioritized for minimum errors)

1. Backend validation: ensure `server/validators/promptPayload.js` is fully implemented and covered by unit tests.
2. Backend `genieService.process` update: return canonical `out_envelope` including `generated_at`, `mode`, and optional `request_id`.
3. Endpoint & error handler: modify `server/index.js` to include `request_id` and update `sendValidationError` to return validator `error` code top-level or documented nested object; add tests.
4. Frontend `submitPrompt()` update and unit tests (client).
5. UI components update to handle new `out_envelope` shape and update tests.
6. Integration tests end-to-end and docs updates (OpenAPI or README sections).

## Implementation guidance / risk mitigation

- Keep changes small and verifiable. Merge backend changes that establish the API contract first — so frontend work uses stable interface.
  -- Do not implement fallbacks for legacy shapes. The frontend must support the canonical contract only and should provide clear errors if the server returns a non-canonical shape.
- Add tests quickly for invalid and valid `demo` mode payloads to find integration gaps early.
- If time permits, adopt schema validation (Zod/Joi) for `promptPayload`, and optionally export the schema for the frontend.

## Appendix — Quick snippets

-- Payload building: see `submitPrompt()` snippet above (canonical payload expected).

- Error parsing snippet (from `submitPrompt`) — keep this in `client/src/lib/api.js` for robustness.

---

## Concluding note

This merged, prioritized doc provides component-level guidance for frontend work, plus essential server-side expectations and tests that must be present for low-error integration. Implementers should use the Phase 2 doc as the main frontend checklist and use the backend acceptance criteria and tests from the updated doc to keep the contract stable.

Last updated: 2025-11-11
