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

2. Frontend: defensive validation & parsing

- Client-side validation should mirror server rules (fail fast, show errors). Keep server as the source-of-truth for checks.
- Frontend should defensively parse server responses, accepting either:
  - Legacy shape: `{ success: true, data: { content, copies, metadata, ... } }`
  - Canonical shape: `{ out_envelope: { pages, metadata, actions } }`
- For server errors, parse both shapes:
  - Top-level `error: "INVALID_PAYLOAD"` or nested `error: { code: "VALIDATION_ERROR", ... }`.

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

## Frontend code examples: assemble payload & robust parsing

- Minimal `submitPrompt()` (defensive and backwards compatible):

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

  // Parse server response robustly
  const json = await res.json().catch(() => null);

  // error shapes: legacy string or nested object
  if (!res.ok) {
    const code = json?.error || json?.error?.code || "UNKNOWN_ERROR";
    const message =
      json?.message || json?.error?.message || `HTTP ${res.status}`;
    const fields = json?.fields || json?.error?.fields || undefined;
    throw { type: "server", code, message, fields };
  }

  // success: canonical or legacy shapes
  const envelope = json?.out_envelope || json?.data || json;
  // Envelope may contain pages or content/copies; normalize to pages
  const pages =
    envelope?.pages ||
    (envelope?.content
      ? [
          {
            title: envelope.content.title,
            blocks: [{ type: "text", content: envelope.content.body }],
          },
        ]
      : envelope?.copies || []);

  const metadata = envelope?.metadata || envelope?.meta || {};
  // Some services use generatedAt; support both
  metadata.generated_at =
    metadata.generated_at || metadata.generatedAt || new Date().toISOString();

  return { pages, metadata, actions: envelope?.actions || {} };
}
```

## Server error shape expectations (explicit, small section) — frontend dev checklist

Front-end code should be tolerant to either:

- Legacy error: `{ error: "INVALID_PAYLOAD", message: "payload missing" }`, or
- Full error object: `{ error: { message: "...", code: "VALIDATION_ERROR", status: 400, fields: ['title'] } }`.

Prefer to negotiate a consistent server shape early (recommended: top-level `error` string with `fields` and `requestId` where applicable) — update `server/utils/errorHandler.js` to include the validator's code as `error` or `error.code`.

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
4. Frontend `submitPrompt()` update and unit tests (client), along with defensive parsing.
5. UI components update to handle new `out_envelope` shape and update tests.
6. Integration tests end-to-end and docs updates (OpenAPI or README sections).

## Implementation guidance / risk mitigation

- Keep changes small and verifiable. Merge backend changes that establish the API contract first — so frontend work uses stable interface.
- Use defensive parsing in the frontend for the transition: accept both legacy and canonical shapes.
- Add tests quickly for invalid and valid `demo` mode payloads to find integration gaps early.
- If time permits, adopt schema validation (Zod/Joi) for `promptPayload`, and optionally export the schema for the frontend.

## Appendix — Quick snippets

- Defensive payload building: see `submitPrompt()` snippet above.
- Error parsing snippet (from `submitPrompt`) — keep this in `client/src/lib/api.js` for robustness.

---

## Concluding note

This merged, prioritized doc provides component-level guidance for frontend work, plus essential server-side expectations and tests that must be present for low-error integration. Implementers should use the Phase 2 doc as the main frontend checklist and use the backend acceptance criteria and tests from the updated doc to keep the contract stable.

Last updated: 2025-11-11
