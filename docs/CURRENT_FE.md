# Current Frontend ↔ Backend Contract and Test Service Flow

Date: 2025-10-11
Branch: aether-rewrite/client-phase2-AAA-sol1

## Purpose

This document records the current frontend ↔ backend contract, the `genieService` orchestrator responsibilities, and a concrete test/demo service flow (helloWorldService) that the team agreed should be the canonical test mechanism. It also lists required persistence behavior, suggested DB/artifact shapes for test runs, and a migration plan to remove plumbing-level `?dev=true` special-casing.

## High-level summary

- The server's `/prompt` endpoint is plumbing: it validates the request, attaches a `requestId` header, calls `genieService.generate()`, returns an immediate preview to the client, and schedules asynchronous persistence of prompt/ai_result/artifacts.
- `genieService` is the orchestrator. It selects an application service to produce content and persistIntents, normalizes the shape (content, metadata, persistInstructions), sanitizes content, attaches `requestId`, and returns the envelope to plumbing.
- Application services implement business logic. Examples in the repo:
  - `helloWorldService` — deterministic test1/demo service that returns small content and test persist intents.
  - `sampleService` — deterministic test1/demo service used to create a one-page eBook about any media type, starting with text (poem).
  - `basicService` — deterministic fallback service used when AI provider is missing.
  - `defaultService` — deterministic fallback service used when unsure as to the service to interface with.
  - `aiService` (guarded) — real AI provider integration; may be absent in dev.
  - More `xServices` to come.

## Design principle (agreed)

- `genieService` must be a pure orchestrator. All test/demo flows should be implemented as application services (helloWorldService, sampleService, test Service). Plumbing should not special-case behavior via query flags such as `?dev=true`.
- Tests and demo flows must register or hint the desired application service via the payload or `serviceAdapter` configuration. This keeps plumbing minimal and testable.

## helloWorldService: desired behavior

When a request is routed to `helloWorldService` (heuristic match or explicit service hint), the following must occur:

1. helloWorldService returns a normalized envelope with:

   - `data.content` — the generated preview content (either `title/body` or `html`)
   - `data.metadata` — must include `source: "helloWorldService"` and `test: true` (optional `userId` if provided)
   - `data.persistIntents` — an array of intent objects describing what plumbing should persist (file under `/samples`, DB test entry, etc.)

2. genieService converts `persistIntents` → `persistInstructions` and ensures `metadata.requestId` is present.

3. Plumbing (`server/index.js`) responds to the client immediately with the preview (top-level `preview` + `data` envelope) including `requestId` and `data.metadata.source`.

4. Asynchronous persistence (persistence.execute) writes artifacts atomically to the filesystem (target folder `samples` and target file `latest_prompt.txt` for helloWorldService) and inserts DB rows with `is_test = true` (or equivalent) so cleanup scripts can remove them later.

5. The UI displays the preview immediately from the returned `preview`/`data.content`. The persisted ids (ai_result_id, artifact ids) may arrive later; clients should discover them via polling/SSE by `requestId` (see integration doc for options).

## Persist intent / instruction shape (example)

Example `persistIntent` returned by an application service:

{
purpose: "sample_file",
filenameHint: "hello-<requestId>.html",
folderHint: "samples",
content: "<h1>hello world!</h1>",
encoding: "utf8",
originalIntent: { type: "file", extra: { is_test: true } }
}

genieService -> plumbing persistInstruction (suggested normalized shape):

{
purpose: "sample_file",
filename: "hello-<requestId>.html",
folder: "samples",
content: "<h1>hello world!</h1>",
encoding: "utf8",
metadata: { requestId: "...", source: "helloWorldService", is_test: true }
}

## DB shapes (suggested)

- `ai_results` (existing): add or repurpose a column `is_test BOOLEAN DEFAULT 0` or store test flag in `result.metadata.test` JSON.
- `artifacts`: include request_id and is_test flag so cleanup can find test artifacts.
- An alternative is a dedicated `test_entries` table for test metadata and mapping to artifacts.

## Cleanup script

- A script `scripts/delete_test_entries.js` should:
  - Find ai_results or test_entries where `is_test = 1` (or metadata.test === true)
  - Delete related artifact rows and filesystem files under `samples` matching artifact paths or filename patterns
  - Delete DB rows
  - Log summary and optionally require a `--confirm` flag for destructive runs in production-like environments

## Migration plan (remove `?dev=true` plumbing special-case)

1. Add `serviceHint` support and a plain `selectServiceForPayload(payload)` in `genieService`.
2. Update tests and dev harnesses to call `genieService.generate({ prompt, serviceHint: 'sample' | 'hello' })` or register test services with `serviceAdapter`.
3. Add `serviceAdapter` test registration helpers to make it easy for test suites to inject mocks.
4. Remove `POST /prompt?dev=true` branch from `server/index.js` after tests have been updated.

## Acceptance criteria

- All existing server tests pass after the refactor (no regressions).
- Tests no longer use `?dev=true`; they call the orchestrator with a `serviceHint` or register test services via the adapter.
- helloWorldService flows produce preview + persistIntents and result in a persisted file under `/samples` and an `is_test` DB row when plumbing persistence completes.

## Testing suggestions

- Unit tests for `selectServiceForPayload()` (hello heuristic, serviceHint override).
- Unit tests for persistIntent -> persistInstruction conversion.
- Integration test: POST /prompt with a payload that selects `helloWorldService`, assert immediate response preview + requestId, poll `GET /api/ai_results?request_id=<id>` and assert persisted row with `is_test=true` and presence of file under `/samples`.

## Notes and operational safeguards

- Ensure filenameHint includes requestId or timestamp to avoid collisions.
- Keep test artifacts in a restricted folder (samples) and ensure access controls are applied for production deployments.
- Use atomic file writes (tmp -> rename) to avoid partial file visibility.

## Next steps

- If this doc matches expectations I'll produce a small PR plan and the exact code snippets for `selectServiceForPayload` and the `persistIntent` → `persistInstruction` mapping. I can also draft the `scripts/delete_test_entries.js` cleanup script.

End of CURRENT_FE.md
