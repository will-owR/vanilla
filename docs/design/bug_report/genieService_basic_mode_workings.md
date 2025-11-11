---
title: genieService Basic Mode — Workings
date: 2025-11-11
status: draft
---

## Purpose

Describe, in detail, the request/response contract and internal routing logic when `genieService.process` receives an enhanced payload with `mode: 'basic'`. This document captures the current implementation behavior and serves as a reference for a future bug report that tests or updates this behavior.

## Summary

When a client posts a payload to `/prompt` with `mode: 'basic'`, the request is validated, routed to `genieService.process`, which dispatches to `sampleService.handle(payload)`. The returned shape from `sampleService` is normalized by `genieService.process` into the canonical `out_envelope` and returned to the client as JSON (HTTP 201).

## Request shape (canonical)

POST /prompt

```json
{
  "mode": "basic",
  "prompt": "...",
  "metadata": {
    "title": "...",
    "author": "..."
  },
  "options": {}
}
```

- `mode` is required and must be one of: `basic`, `demo`, `ebook`.
- `prompt` is required and must be a non-empty string.
- `metadata` optional for `basic` mode; for `demo`/`ebook` it may be required.

## Internal Flow (step-by-step)

1. Endpoint handler (`server/index.js`)

   - Receives the POST to `/prompt`.
   - Validates the payload using `validatePayload(req.body)` (from `server/validators/promptPayload.js`). For `basic` mode, only `mode` and `prompt` are required.
   - If validation fails, respond 400 with a validation error (`INVALID_PAYLOAD` or `INVALID_MODE`), e.g.:
     ```json
     {
       "error": "INVALID_PAYLOAD",
       "message": "payload must include mode and prompt"
     }
     ```
   - If validation passes, the handler calls `genieService.process(req.body)`.

2. `genieService.process(payload)`

   - `payload` contains: `mode`, `prompt`, `metadata`, `options`.
   - Mode switch:
     ```javascript
     switch (mode) {
       case "demo":
         result = await demoService.handle(payload);
         break;
       case "ebook":
         result = await ebookService.handle(payload);
         break;
       case "basic":
       default:
         result = await sampleService.handle(payload);
     }
     ```
   - `sampleService.handle(payload)` returns an object shaped as `{ pages, metadata, actions }`.
   - `genieService.process` then normalizes the returned object into the canonical envelope and augments metadata:
     - `out_envelope.pages = result.pages || []`
     - `out_envelope.metadata = { ...payload.metadata, ...result.metadata, generated_at: new Date().toISOString(), mode: mode }`
     - `out_envelope.actions = result.actions || {}`
   - Important: Precedence when merging `metadata` is `result.metadata` overrides `payload.metadata` (because it is spread last in `{ ...payload, ...result }`). This means generated or computed metadata (from the generator) takes precedence over what the client sent when the same key exists.
   - Finally, `genieService.process` returns an object shaped as `{ out_envelope: { pages, metadata, actions } }`.

3. Endpoint (final response)
   - The `/prompt` handler returns HTTP 201 with the `out_envelope` JSON:
     ```json
     {
       "out_envelope": {
         "pages": [ { "id": "p1", "title":"...", "blocks": [ { "type": "text", "content": "..." } ] } ],
         "metadata": {
           "generated_at": "2025-11-11T...",
           "mode": "basic",
           ...additional metadata
         },
         "actions": { "can_export": true, "can_preview": true }
       }
     }
     ```

## Error Handling

- Validation errors -> HTTP 400 with `INVALID_PAYLOAD`, `INVALID_MODE`, or `MISSING_METADATA` (for `demo`/`ebook`).
- Generation errors (e.g., `sampleService` failed) -> HTTP 500 with `GENERATION_ERROR`.
- If `genieService.process` returns a non-canonical shape or missing pages, treat as server error and return `500`/`INVALID_RESPONSE` to avoid undefined behavior on the client.

## Example (end-to-end): basic mode

Request:

```bash
curl -X POST http://localhost:3000/prompt -H "Content-Type: application/json" -d '\
{"mode":"basic","prompt":"Compose a short haiku about rain","metadata":{},"options":{}}'
```

Successful Response (HTTP 201):

```json
{
  "out_envelope": {
    "pages": [
      {
        "id": "p1",
        "title": "Haiku on Rain",
        "blocks": [
          {
            "type": "text",
            "content": "Gentle rain whispers\nSoft ripples on the rooftop\nNight breathes into dawn"
          }
        ]
      }
    ],
    "metadata": {
      "generated_at": "2025-11-11T...Z",
      "mode": "basic",
      "model": "sample-v1"
    },
    "actions": { "can_export": true, "can_preview": true }
  }
}
```

## Edge Cases & Notes

- Precedence of metadata keys: `result.metadata` overrides `payload.metadata` on the same keys.
- Empty pages: If the `sampleService` returns an empty `pages` array, the endpoint still returns the envelope; it's up to the frontend to decide to display an error or fallback content.
- `generated_at`: must be ISO8601 and present in all success responses.
- `mode`: always included in `out_envelope.metadata`.
- `request_id` (optional): If the endpoint/middleware assigns a `request_id`, include it in `out_envelope.metadata` for traceability.

## Responsibilities and clean separation of concerns

- genieService: orchestration layer. Responsibilities should be:

  - Validation coordination (via `validators/promptPayload.js`)
  - Mode-based routing to the appropriate handler (sample/demo/ebook)
  - Normalizing returned shapes into the canonical `out_envelope`
  - Persistence, logging, and running any declared `actions` (via `actionsModule`)
  - Not perform content generation or business logic itself (no direct AI text generation inside the orchestrator)

- sampleService / demoService / ebookService: business logic layer for the mode. Responsibilities include:
  - Accept the full payload and implement generation rules (title derivation, page counts, layout choices)
  - Return canonical shapes `{ pages, metadata, actions }` and do not perform normalization nor persistence
  - Use injected utility services (e.g., `aiService`, `imageGenerator`) for the heavy lifting
  - Keep output deterministic and unit-testable

This separation avoids the orchestrator becoming a 'mish-mash' of business logic and keeps single responsibility across modules.

## Suggestion: `sampleService.handle` contract and implementation pattern

`sampleService.handle(payload)` should be the only place that interprets the prompt as content and decides how to generate pages for the 'basic' mode. We recommend a simple, documented contract:

Input:

```js
{
  mode, // 'basic'
    prompt, // user prompt string
    metadata, // optional object
    options; // optional options like pages or style
}
```

Output:

```js
{
  pages: [
    {
      id: 'p1',
      title: 'Derived page title',
      blocks: [{ type: 'text', content: '...' }]
    }
  ],
  metadata: { model: 'sample-v1', ... },
  actions: { can_export: true }
}
```

Suggested pseudocode example for `sampleService.handle`:

```js
async function handle(payload) {
  const { prompt, metadata = {}, options = {} } = payload;
  // 1. Decide number of pages (from metadata.pages || options.pages || default 3)
  const pagesCount = parseInt(metadata.pages || options.pages || 3, 10);

  // 2. Derive title from prompt, e.g., take first sentence or first 6 words
  const title = deriveTitleFromPrompt(prompt);

  // 3. Create pages by splitting or calling `aiService` for each page content
  const pages = await Promise.all(
    Array.from({ length: pagesCount }).map((_, i) => {
      const body = generateBodyForPage(prompt, i, options);
      return {
        id: `p${i + 1}`,
        title: `${title} — Part ${i + 1}`,
        blocks: [{ type: "text", content: body }],
      };
    })
  );

  return {
    pages,
    metadata: { model: "sample-v1", pages: pages.length },
    actions: { can_export: true, can_preview: true },
  };
}
```

Notes:

- `deriveTitleFromPrompt` can be simple or use `aiService` to extract a subject for better title quality.
- `generateBodyForPage` can be a call to `aiService` or a templated split of a provided content body.

## Dependency injection and helper services

Services should not import or rely on `genieService` as a utility (to avoid circular dependencies). Instead:

- Extract `aiService` or `imageGenerator` as independent utilities accessible to `sampleService`, `demoService`, or `ebookService`.
- For testing, inject mocks into service constructors or `handle` via parameters.

Example DI pattern:

```js
const sampleService = createSampleService({ aiService, imageService });
module.exports = sampleService;
```

This pattern keeps services testable and avoids the orchestrator being used as a general-purpose library.

## Suggested refactor for genieService

1. Make `genieService.process` strictly do routing & normalization.
2. Remove any content-generation code from `genieService`.
3. Ensure `genieService.process` receives a `payload` and an optional `context` for `request_id`; call `handle(payload)` on the right service; only re-wrap returned shapes in `out_envelope` and persist/trace.
4. If a service needs utilities (aiService), provide them via DI at service creation time, not via `genieService` calls.

## Migration & Tests (Refactor verification)

- Unit tests for `sampleService.handle` should confirm:

  - Given a prompt and no explicit pages, it returns 3 pages
  - Given `metadata.pages: n`, it returns `n` pages
  - Titles are derived correctly from the prompt
  - It returns the canonical `{ pages, metadata, actions }` shape

- Unit tests for `genieService.process`:
  - It calls the correct service based on `payload.mode` (basic->sampleService)
  - It normalizes any returned object to the canonical `out_envelope` shape
  - It adds `generated_at` and `mode` to `out_envelope.metadata`
  - It persists or delegates to `actionsModule` when `actions` provided

## Acceptance & Rolling Forward

Once `sampleService` is the authoritative implementation for content generation

- `genieService` should only normalize outputs and provide orchestration. Tests should ensure no business logic is in `genieService`.

If any current code in `genieService` is performing text generation or content splitting, we should push that into `sampleService` and add regression tests.

## Small migration tasks (order)

1. Add `sampleService.handle` unit tests and confirm existing `genieService.process` calls it.
2. If `genieService` contains generation logic, refactor it into `sampleService` (move function and replace call) with small iterations and tests.
3. Ensure `genieService.process` enforces canonical `out_envelope` (100% of calls return that shape)
4. Update front-end to only expect canonical shape (already done); update tests accordingly.
5. Remove legacy code paths once all tests pass.

## Final note

This approach clarifies the separation of concerns and prevents the orchestrator (`genieService`) from becoming a mixed bag of logic. The `sampleService` is the right place for the business rules that interpret a prompt as a 'book' and create `pages` accordingly. This design also makes unit testing and future refactorings much safer.

## Tests to add (suggested)

1. Unit tests (genieService):

- When `payload.mode === 'basic'`, `genieService.process` should call `sampleService.handle` with the same payload and return a canonical `out_envelope` shape where `metadata` includes the `mode` and `generated_at` and merges inbound payload metadata.
- Simulate `sampleService.handle` throwing an error; assert the `genieService.process` rethrows or returns a predictable error (and the endpoint returns 500).

2. Integration tests (endpoint):

- POST /prompt with `mode: 'basic'` (valid payload) -> return 201 with `out_envelope` and `metadata.generated_at` & `metadata.mode` present.
- POST /prompt with missing `prompt` -> 400 `INVALID_PAYLOAD`.
- POST /prompt with `mode` set to `basic` but `sampleService` returns empty pages -> 201 with `pages: []`.

3. Frontend tests:

- Mock server to return canonical `out_envelope` -> confirm `genieServiceFE.generate` and submit flows produce UI preview content and contentStore update.

## Acceptance Criteria (for the document and for implementation verification)

- All unit and integration tests described above pass.
- Endpoint `/prompt` returns canonical `out_envelope` in `basic` mode consistently.
- Metadata `generated_at` and `mode` are present and the `result.metadata` overrides `payload.metadata` when keys overlap.
- The server returns proper 400 validation codes and 500 generation errors used above.

## Notes for the future bug report

- If the `basic` mode flow fails to set `metadata.generated_at` or `mode` — document the failing request and the observed response; add the test demonstrating the bug.
- If `sampleService` returns unexpected shapes causing UI errors, document the failing server response and add a test that asserts canonicalization in `genieService`.

---

Last updated: 2025-11-11
