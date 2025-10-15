# testService — Service Profile

Date: 2025-10-15
Branch: aether-rewrite/client-phase2-P1
File: `server/testService.js`

## Purpose

testService is a deterministic, minimal application service used for integration and end-to-end testing. Its role is to provide predictable content so the full request→orchestrator→service→store→UI flow can be exercised without relying on external AI providers or non-deterministic behavior.

## Behavior

- Accepts an object payload with at least `{ prompt }`. The `prompt` value is ignored for content generation; it exists to match the standard service signature.
- Accepts an optional `requestId` in the payload and echoes it back in `metadata.requestId` for traceability.
- Returns a synchronous-styled Promise resolving to an object with `content`, `metadata`, and `persistIntents`:
  - `content`: { title, body, html } where `html` contains display-ready HTML (a small fragment showing the service is active and the requestId).
  - `metadata`: includes `service: "testService"`, `timestamp`, and `requestId`.
  - `persistIntents`: an empty array (the service does not request persistence by default).

## Trigger

- The orchestrator (`genieService.generate()`) will route to `testService` in one of two ways:
  - Explicit test selection: the incoming payload contains `serviceHint: "testService"` (explicitly request the test stub).
  - Legacy/default routing: the incoming payload has `prompt === "test-preview"` AND the request's selection/defaults remain unchanged. Concretely this means the client should send the same default selection values used by the UI (for current test harnesses these are: `content-type: 0`, `media-type: 0`, `page: 1`). When both conditions (prompt and defaults) match, the orchestrator will choose `testService`.

## Sample invocation

POST /api/generate

Request body examples:

1. Explicit `serviceHint` (recommended for tests):

```
{
  "prompt": "any prompt text",
  "serviceHint": "testService"
}
```

2. Legacy/default-trigger (prompt + defaults must match):

```
{
  "prompt": "test-preview",
  "selections": {
    "content-type": 0,
    "media-type": 0,
    "page": 1
  }
}
```

Expected response snippet (success):

```
{
  "success": true,
  "requestId": "<uuid>",
  "preview": "<h2>Test Service Active</h2>...",
  "data": {
    "content": {
      "title": "Test Service Response",
      "body": "<h2>Test Service Active</h2>...",
      "html": "<h2>Test Service Active</h2>..."
    },
    "metadata": {
      "service": "testService",
      "timestamp": "...",
      "requestId": "<same uuid>"
    },
    "persistInstructions": []
  }
}
```

## Notes and use-cases

- testService is intended for automated tests (unit/integration/E2E) to exercise the plumbing and UI update paths deterministically.
- Because it returns `persistIntents: []`, it avoids creating file artifacts during tests and reduces cleanup complexity.
- If future tests require persisted artifacts, a variant of this service can be added (e.g., `testServicePersist`) that emits `persistIntents` with safe `folderHint` and `filenameHint` values that the persistence executor will accept in test mode.

## Maintenance

- Keep the service deterministic and dependency-free. Do not add network calls or expensive computations.
- Document any changes to the output shape here so tests and orchestration code remain compatible.

## Pending NEW Additional Service

Recap (short):

- testService will emit intent objects (for example, a `persistIntent`) describing additional actions that should be taken with the generated content (save to file, store to DB, cache, etc.).
- testService does NOT perform those actions itself — it only requests them. The orchestrator (`genieService`) and plumbing (`persistence.execute`, `crud`, or cache layer) perform the actual work.
- For the first additional capability we will support: "save a receipt copy to file" — the agreed runtime contract is:
  - testService emits a single `persistIntent` with `folderHint: "samples"` and a safe `filenameHint` (timestamped, e.g. `test-YYYYMMDD-HHMMSS.html`) plus the HTML content.
  - `genieService` converts intents into `persistInstructions`, calls the persistence layer synchronously before returning the HTTP response, and attaches the persistence result (`data.persisted`) to the envelope.
  - The persistence layer writes atomically under the `samples/` directory and returns the saved path(s) for recording; the handler may then create DB artifact rows tied to the `requestId`.
  - Persistence failures in this test-mode should surface as request errors so tests fail fast.

I will not change code yet — this text documents the plan. Say "go" when you want me to implement these changes in code and add tests.
