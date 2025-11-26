## service_sampleService — Final design (refined)

Last updated: November 1, 2025

## Purpose

Provide a concise, implementable design that enforces separation of responsibilities and specifies the contracts for generation, user edits, and export.

## Principles

- Orchestrator-only: `genieService` coordinates selection, normalization, validation, persistence orchestration and export orchestration. It must not implement business rules for content composition.
- Services-only business logic: `sampleService`, `demoService`, `ebookService` are responsible for generating content (the business model), not for I/O or persistence.
- Plumbing-only I/O: `pdfGenerator`, DB/file utils, and similar modules perform side-effects (write file, persist to DB, generate PDF). They are invoked by `genieService` or background jobs but contain no content business logic.

## Separation of responsibilities (one line each)

- genieService: orchestrate and normalize. Input routing, calling services, calling persistence helper, calling pdf generator, returning results.
- Services (sample/demo/ebook): produce canonical envelopes; pure functions that return content (no file/DB writes by default).
- Plumbing: persist envelopes, write files, produce PDFs, and other side-effecting operations.

## Canonical envelope (single source-of-truth)

All generated and edited content MUST be represented as the canonical envelope before persistence or export:

Envelope {
id?: string, // assigned when persisted
version?: number, // incremented on each accepted edit
metadata?: object, // model, author, timestamps, locale, etc.
pages: Array<Page>
}

Page {
id?: string,
title?: string,
blocks: Array<Block>,
layout?: object
}

Block { type: 'text'|'html'|'image'|'embed'|'raw', content: string|object, metadata?: object }

## Contracts (succinct)

1. Generation contract (services)

- Function: async generate(prompt: string | object) -> { envelope: Envelope, metadata?: object }
- Input: free-form prompt or structured parameters
- Output: canonical Envelope (pages[]). Services must not persist or write files.
- Errors: throw { status, code?, message, details? }

2. Edit contract (services + orchestrator)

- User edits are applied by service business logic or client-side edits then acknowledged by service.
- Function: async applyEdit({ resultId, edit, baseVersion? }) -> { envelope: Envelope, persisted: { id, version } }
- Requirements: edits produce a new canonical Envelope; conflicts detected by comparing versions; service returns merged/accepted envelope but persistence happens in orchestrator (see below).

3. Export contract (orchestrator + plumbing)

- API: async export({ resultId?, content?, prompt?, validate=false }) -> { buffer: Buffer, validation?: { ok, errors[], warnings[] }, metadata? }
- Precedence: if resultId -> fetch persisted envelope; else if content -> normalize; else if prompt (string) -> call generate(prompt) and normalize.
- Normalization: ALL inputs are normalized to the canonical Envelope before validation or pdf creation.
- Side-effects: persistence (writes) must be centralized: `genieService` calls a single persistence helper in plumbing to write envelopes and obtain `id`/`version`.
- PDF creation: `genieService` calls `pdfGenerator.generatePdfBuffer(canonicalEnvelope, { validate })` and returns results.

## Errors & Validation

- Validation: use compact validation objects { ok, errors[], warnings[] } returned alongside successful exports. Invalid payloads return 4xx with details. Server failures return 5xx.
- Errors: structured error object { status, code?, message, details? }.

## Enforcement points (where to implement)

- Controller boundaries (`server/index.js`) — accept legacy shapes; call normalizer helper; forward explicit parameters (`resultId`, `content`, `prompt`).
- `genieService.generate()` — call service, assert canonical envelope returned.
- `genieService.export()` — canonicalize input, call persistence helper if needed, call `pdfGenerator`, return buffer + validation.
- Services — must return envelopes only; move any current file/DB writes out of services into plumbing.
- `pdfGenerator` — accept canonical envelope only; perform PDF creation and (optionally) validation.

## Migration plan & quick to-dos (estimates) [???]

1. Add `server/utils/normalizeToPages.js`: normalize legacy shapes -> canonical envelope. Test: 1.5–2.5h
2. Move side-effecting saves out of services (e.g., `sampleService` file save) into plumbing; add persistence helper and call from `genieService`: 1.0–2.0h
3. Wire normalizer into `genieService.export()` and controllers; add unit tests exercising legacy -> normalize -> mock export: 1.5–3.0h
4. Add compact JSON Schema for Envelope and integrate in tests: 1.0–2.0h

## Examples (minimal)

1. Generated envelope

```json
{
  "id": "r_1",
  "version": 1,
  "metadata": { "model": "sample-v1" },
  "pages": [
    {
      "id": "p1",
      "title": "Hi",
      "blocks": [{ "type": "text", "content": "Hello" }]
    }
  ]
}
```

2. Export request (preferred)

```json
{ "resultId": "r_1", "validate": true }
```

## Acceptance criteria for final design

- `genieService` must orchestrate only; services must be pure content producers; plumbing must perform all side-effects.
- A single normalizer exists and is used by all entry points before validation/export.
- Tests cover legacy inputs and the canonical flow using the mock PDF implementation in CI.

## ADDENDUM: Format and Flow Patterns in Export Process

(Preserved for historical context; see above sections for the final, authoritative design.)

### Walk-through Example

Let's do a walk-through: A user enters the prompt `A noir detective story set in a city of robots.` and hits 'Generate.' What should happen per the (updated) final document? Be succinct and to the point.

**Recap — succinct, concrete flow and responsibilities**

Intent: sampleService composes business content (enough for three pages). It must NOT perform persistent I/O itself; instead it requests that the orchestrator (genieService) perform any printing/storage/export plumbing. GenieService coordinates persistence, printing-to-file, and PDF export.

Sequence (short)

- Frontend → controller: POST /generate { prompt }.
- Controller → genieService.generate(prompt).
- genieService → sampleService.generate(prompt).
- sampleService returns a canonical Envelope (pages[] with three pages) and optionally signals “please print this preview to file” (a flag or explicit call result).
  Important: sampleService only produces content; it must not write files or DB records.
- genieService normalizes/validates the Envelope, then:
  Calls plumbing persistence helper to persist the Envelope → obtains id/version.
  If printing was requested, calls plumbing print helper to write preview to file (plumbing does the write).
- GenieService returns the persisted Envelope + metadata/validation to controller → frontend shows preview (uses resultId for later actions).
- When user requests export, frontend → controller: POST /export { resultId }.
- Controller → genieService.export({ resultId }):
  genieService fetches persisted canonical Envelope (id/version), validates if requested, calls pdfGenerator.generatePdfBuffer(envelope), and returns the PDF buffer to the controller which streams it to the client.

Key invariants (one-liners)

- Services = business logic (generate/compose content, return Envelope).
- GenieService = orchestrator (routing, normalization, validation, persistent-write orchestration, invoking plumbing).
- Plumbing = side-effects only (DB writes, file writes, PDF generation).
- sampleService may request printing, but actual write must be executed by plumbing via genieService.

#### Actionables

Below are the prioritized, concrete actionables required to make the Walk-through real. Each item lists the goal, files to change, a rough estimate (dev-hours), and a clear acceptance test.

1. Add normalizer: `server/utils/normalizeToPages.js` — 1.5–2.5h

- Goal: convert legacy shapes (`{ title, body }`, `{ content, copies }`, prompt-object) into the canonical Envelope `{ id?, version?, metadata?, pages: [...] }`.
- Files: add `server/utils/normalizeToPages.js`; call it from `server/genieService.js` (generate/export) and controller entry points in `server/index.js`.
- Acceptance: unit tests show legacy sampleService output and `{ title, body }` inputs map to the canonical Envelope with pages[].

2. Remove side-effects from `sampleService` — 0.5–1.0h

- Goal: make `server/sampleService.js` pure: return content/copies (and optional `actions` signal) and stop calling `saveContentToFile` directly.
- Files: `server/sampleService.js` (remove file I/O); add optional `actions` return field.
- Acceptance: tests assert `sampleService.generateFromPrompt` performs no file writes and returns canonicalizable output.

3. Implement an action-signal protocol (small API) — 0.5–1.0h

- Goal: services can request plumbing operations without executing them. Example: `{ envelope, actions: [{ type: 'print', opts:{ path } }] }`.
- Files: small change in `sampleService` return shape; `server/genieService.js` to interpret `actions` and call plumbing helpers (e.g., `saveContentToFile`).
- Acceptance: when `actions` includes `print`, `genieService` calls the plumbing print helper and returns preview metadata to client.

4. Centralize persistence helper and clarify sync vs async persistence — 1.0–2.0h

- Goal: create `server/utils/persistence.js` that wraps dbUtils/createAIResult and createPrompt; `genieService` uses this helper for all writes and honors `GENIE_PERSISTENCE_AWAIT`.
- Files: new `server/utils/persistence.js`, refactor `server/genieService.js` persistence logic to call it.
- Acceptance: `genieService.generate()` obtains `promptId`/`resultId` from helper; tests exercise both awaited and background persistence modes.

5. Require canonical Envelope for PDF export and wire normalizer into export path — 1.0–2.0h

- Goal: `genieService.export()` must normalize inputs via `normalizeToPages`, fetch persisted envelope for `resultId`, then call `pdfGenerator.generatePdfBuffer(canonicalEnvelope, { validate })`.
- Files: `server/genieService.js` (export path); `server/pdfGenerator.js` to only accept canonical envelopes (or already-normalized `{ title, pages }`).
- Acceptance: POST `/export` with `{ resultId }` returns a PDF buffer (mock mode) and POST `/export` with `{ title, body }` is normalized and exported.

Helpful test/CI notes

- Use `PDF_GENERATOR_IMPL=mock` and `SKIP_PUPPETEER=true` for CI-friendly runs.
- Add Vitest cases: normalizer unit tests; `genieService.generate()` end-to-end in mock persistence mode; export with `resultId` using mock PDF generator.

Minimal API suggestion for service → orchestrator signaling

- Service return: `{ envelope, actions?: [{ type: 'print'|'persist', opts?: {...} }] }`.
- `genieService` interprets actions and invokes plumbing helpers. Services never perform I/O directly.

#### To-dos and estimates (final ADDENDUM)

[SAT 1st Nov 2025, 1:35PM]

Short prioritized tasks to complete the migration to explicit normalization and safer exports. Estimates are developer-hours and assume familiarity with the codebase and existing test utilities.

1. Implement a single normalizer (server/utils/normalizeToPages.js) — 1.5–2.5h

- Purpose: convert legacy shapes ({ title, body }, { content, copies }, prompt-object) into the canonical envelope.
- Acceptance: unit tests show legacy input -> canonical envelope.

2. Wire normalizer into `genieService.export()` and preview/edit controllers — 1.0–2.0h

- Purpose: ensure all export paths call the normalizer and validate the canonical envelope before calling `pdfGenerator`.
- Acceptance: `genieService.export()` unit test demonstrates normalization + mock export path.

3. Add compact JSON Schema for canonical envelope + validation helpers — 1.0–2.0h

- Purpose: formalize shape and provide machine-checkable validation in tests and at runtime (optional in dev mode only).
- Acceptance: schema file added under `server/schemas/` and tests that validate examples pass/fail as expected.

4. Tests: legacy -> normalize -> mock export; id/version conflict tests — 1.5–3.0h

- Purpose: ensure backward compatibility and deterministic export when `resultId` is used.
- Acceptance: Vitest suite includes at least 3 focused tests and they pass in mock PDF CI mode.

5. Documentation + deprecation notice for legacy shapes — 0.5–1.0h

- Purpose: update README/design doc and add brief deprecation guidance for frontend teams.
- Acceptance: `docs/design/service_sampleService-final.md` updated (this file) and an entry in `docs/` or README.

Notes

- Keep `PDF_GENERATOR_IMPL=mock` available in CI while iterating.
- Prefer a small, backwards-compatible rollout: normalize at server boundary and log deprecation warnings before removing legacy implicit behavior.
