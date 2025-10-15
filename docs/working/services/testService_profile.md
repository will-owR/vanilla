# testService — Service Profile

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

- The orchestrator (`genieService.generate()`) will route to `testService` when either:
  - The incoming payload contains `serviceHint: "testService"`, or
  - In legacy checks, when `prompt === "test-preview"` (the code includes this pattern in example/specs).

## Sample invocation

POST /api/generate

Request body:

```
{
  "prompt": "any prompt text",
  "serviceHint": "testService"
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
