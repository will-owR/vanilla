## genieService → sampleService — UPDATE v00

**Important**  The change, though important, is relatively minor - its implementation is trivial.

**Remember to:** a minimal unit test and an integration smoke test

Policy (one line): genieService will forward a single, versioned JSON envelope of the shape { in_envelope: {...}, out_envelope: {...} }; legacy `{content,copies,pages,metadata}` is no longer supported and must be expunged immediately.

Recap — contract and flow (succinct)

- Envelope shape: { in_envelope: {...}, out_envelope: {...} } — include a small version and optional meta in the envelope (e.g., { version: 1, meta: {timestamp} }).

- Call flow:

  1. `genieService` builds an immutable `in_envelope` (canonical input), including prompt and any contextual options.
  2. `genieService` calls the business service with the full envelope: { in_envelope, out_envelope: {} }.
  3. `sampleService` (or other worker) reads `in_envelope` and only populates `out_envelope` with generated fields (pages, html, copies, metadata, refs). It MUST NOT mutate `in_envelope`.
  4. Worker returns the envelope; `genieService` validates version and a small whitelist of allowed `out_envelope` fields.
  5. On success `genieService` merges `out_envelope` into persisted aiResult (creates/updates prompt/result rows), sets status (pending/ok/failed), and returns identifiers (promptId/resultId) and/or the merged envelope to the caller.

- Ownership & constraints:

  - `in_envelope` is owned by `genieService` and treated as immutable by workers.
  - Workers may only populate `out_envelope`; enforce schema/versioning and a small field whitelist.
  - Large binary assets must not be inlined — use references (S3/OBJ refs) in `out_envelope`.
  - Enforce envelope size limits; reject oversized envelopes early.

- Persistence & flags:

  - `genieService` controls persistence (dbUtils / legacy crud fallback) and may write prompt + aiResult after successful generation.
  - Respect existing flags: `GENIE_PERSISTENCE_ENABLED`, `GENIE_PERSISTENCE_AWAIT` (tests), and `USE_PRISMA_IN_TEST`.
  - Persistence is best-effort; in normal operation it is fire-and-forget; tests may await persistence via an exposed promise hook.

- Logging & tracing:

  - Always include promptId/resultId in logs and tracing spans.
  - Record generation status and timestamps (requestedAt, startedAt, completedAt/failedAt).

- Validation & failure modes:

  - Validate envelope version and whitelist on return; if `out_envelope` contains unknown or disallowed fields, mark result failed and surface concise error details.
  - If worker throws or returns invalid envelope, set aiResult status=failed and persist error metadata where possible.

- Tests to add (minimum):
  - Unit: `generate()` returns a promptId immediately (when persistence-await enabled) and rejects unsupported envelope versions.
  - Integration: full pipeline smoke — prompt → envelope → sampleService → pdfGenerator renders → persisted result and non-empty PDF buffer.
  - Failure: worker error produces aiResult with status=failed and logged error metadata.

Notes

- This document is the authoritative recap for the new envelope contract (v00). Do not accept or implement legacy `{content,copies,pages,metadata}` shapes — they are explicitly removed from the supported surface.

Reference

- Existing code to map from: `server/genieService.js`, `server/sampleService.js`.
