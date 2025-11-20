## genieService — current (live) implementation

Short: `genieService` is the orchestrator. It contains the orchestration and generation guidance (pre-programmed logic) and delegates the actual content generation work to pure business services (e.g., `sampleService`) and to utilities (persistence, file I/O, pdfGenerator).

How it calls services

- `genieService.generate(prompt)` constructs/normalizes the prompt and calls the service API directly:
  - For the default path it calls `sampleService.generateFromPrompt(prompt)` (awaits the result).
  - It expects the service to return a canonical envelope or legacy-compatible fields (`envelope` / `content` / `copies` / `pages` / `metadata`).

Who provides the guidance

- Guidance is pre-programmed inside `genieService` (not supplied by services):
  - `genieService` builds a richer `aiResponse` via `buildMockAiResponse(prompt, opts)` and then prefers/merges canonical content returned by the service.
  - Services (like `sampleService`) are pure workers: they return canonical output (envelope) and do not control orchestration.

What `genieService` does with service output

- Normalizes/ensures fields (content.layout, metadata).
- Builds `out` envelope: { success: true, data: { content, aiResponse, copies, metadata } }.
- Prefers explicit pages/copies provided by service; otherwise wraps service content into `aiResponse.pages`.

Persistence & side effects

- Persistence is best-effort and configurable by env flags:
  - `GENIE_PERSISTENCE_ENABLED` (on/off), `GENIE_PERSISTENCE_AWAIT` (test-only await), and `USE_PRISMA_IN_TEST`.
  - Persists prompts and AI results via `dbUtils` (Prisma shim) or legacy `crud` fallback.
  - Also saves raw prompt to disk via `saveContentToFile` (non-blocking except when AWAIT_PERSISTENCE=true).
  - Persistence happens inside `genieService` after generation; calls are fire-and-forget in normal mode.

Test hooks & extensibility

- `genieService` supports injected mocks for testing:
  - `_setSampleService()` to inject a mock service.
  - `_setDbUtils()` to inject a mock persistence layer.
  - Exposes `_lastPersistencePromise` when persistence is awaited in tests.

Orchestration contract (flow, succinct)

1. Accept prompt string; quick audit write to file.
2. Optional read-only lookup for prior persisted results (dedupe/read-first).
3. Call business service: `sampleService.generateFromPrompt(prompt)`.
4. Normalize and merge returned envelope/fields into an `out` envelope and `aiResponse` (pre-programmed by genie).
5. Attempt persistence (prompt + AI result) asynchronously or synchronously (tests).
6. Return normalized `out` envelope to caller.

JSON shapes (examples)

- What `genieService` passes today (simple):
  {"prompt":"Write a short poem about autumn"}

- What `sampleService` returns (canonical envelope form used by repo):
  {
  "envelope":{
  "version":1,
  "metadata":{"model":"sample-v1"},
  "pages":[ {"id":"p1","title":"Prompt: Write a short poem","blocks":[{"type":"text","content":"Write a short poem about autumn"}]} ]
  },
  "metadata":{"generatedAt":"2025-11-05T...Z"}
  }

- ❎ Legacy-compatible shape `genieService` also consumes and produces:
  {
  "content": {"title":"...","body":"...","layout":"..."},
  "copies": [...],
  "pages": [...],
  "metadata": {...}
  }
  ``Means genieService still accepts and returns the older, simpler result format — an object with content (title/body/layout), copies, pages and metadata — so legacy callers/tests keep working; genie normalizes/merges that shape into its newer envelope/aiResponse.``

  ```We are not supporting the above.  Why?  We are just starting the build, though it's been a seven month treck; we've yet to produce a prototype; why waste time supporting stuff that does not meet spec - only to have 'tests' pass?```

Notes / implications

- Orchestration logic (prompt normalization, aiResponse construction, persistence policy) lives in `genieService` — services remain pure and focused on generation output.
- This makes `genieService` the single place to change orchestration behavior (retries, persistence, conversion to PDF-ready HTML), and keeps services simple and testable.

References

- Implementation entrypoints: `server/genieService.js`, `server/sampleService.js`.
