# JSON examples for the request and response

Suggested: WED (11/5/2025)

Recap: In the current code, genieService calls sampleService.generateFromPrompt(prompt) passing the prompt string (and optionally opts). sampleService returns a canonical envelope with pages and metadata.

## Implemenation upgrade

Send {"in_envelope": {...}, "out_envelope": {}} where in_envelope is the canonical input (immutable) and out_envelope contains the generator’s additions/augments.

Pros (very short)

 - Clear ownership/immutability of input.
 - Easy provenance and diffs (in vs out).
 - Low implementation cost.

Cons (very short)

 - Needs schema/versioning + validation.
 - Avoid large inlined assets (use refs).

Recommendation — one line

Adopt this pattern, enforce a small whitelist and version on the envelope, and require sampleService to only populate out_envelope.

## Implemenation plan

Succinct implementation plan:

Schema

 - Define small versioned envelope: { version, in_envelope:{prompt,...}, out_envelope:{}, meta:{}}.

genieService (caller)

 - Build immutable in_envelope.
 - Create prompt + placeholder aiResult (status: pending) and set resultId.
 - Call sampleService with { in_envelope, out_envelope: {} }.

sampleService (worker)

 - Read in_envelope, populate out_envelope (add html/pages/metadata), do not mutate in_envelope.
 - Return full { in_envelope, out_envelope } (or only out_envelope + version tag).

genieService (merge)

 - Validate version and out_envelope whitelist.
 - Merge out_envelope into persisted aiResult (update), set status success/failed.
 - Return envelope with promptId/resultId and merged data.

Constraints & infra

 - Enforce small size limits; stream large assets via refs (S3).
 - Use status field (pending/ok/failed) and timestamps.
 - Add logging/tracing (resultId in logs).

Tests
 - Unit: call generate -> assert resultId exists immediately; out_envelope applied on update.
 - Integration: sampleService returns html -> pdfGenerator accepts html and returns Buffer.
 - Failure: simulate sampleService error -> aiResult marked failed.

A. Rollout (xxx)

 - Feature flag (GENIE_PERSISTENCE_ENABLED) fallbackable.
 - Backfill: keep read-path tolerant (existing getPersistedContent fallback).

A. Better approach 

 - Ship a single, authoritative prototype implementation of the new flow (persist‑before‑generate + in/out envelope).
 - Add focused unit and integration tests (resultId appears immediately; out_envelope merges and PDF render).
 - Validate in staging with real calls and tracing, iterate on any contract issues. 

That’s it.
---