# service_sampleService — Final design (refined)

Last updated: November 1, 2025

## Purpose

Provide a concise, implementable design that enforces separation of responsibilities and specifies the contracts for generation, user edits, and export.

**Note:** Legacy input shapes are no longer supported. Clients and tests MUST provide the canonical Envelope shape (see "Canonical envelope" below). The legacy migration documents (`TESTS_legacy.md` in the module `__tests__` folders and `WORKFLOWS_legacy.md`) are retained for historical reference only; they should be updated to remove legacy-path guidance and to describe canonical-only tests and CI jobs.

### Principles

- Orchestrator-only: `genieService` coordinates selection, normalization, validation, persistence orchestration and export orchestration. It must not implement business rules for content composition.
- Services-only business logic: `sampleService`, `demoService`, `ebookService` are responsible for generating content (the business model), not for I/O or persistence.
- Plumbing-only I/O: `pdfGenerator`, DB/file utils, and similar modules perform side-effects (write file, persist to DB, generate PDF). They are invoked by `genieService` or background jobs but contain no content business logic.

### Separation of responsibilities (one line each)

- genieService: orchestrate and normalize. Input routing, calling services, calling persistence helper, calling pdf generator, returning results.
- Services (sample/demo/ebook): produce canonical envelopes; pure functions that return content (no file/DB writes by default).
- Plumbing: persist envelopes, write files, produce PDFs, and other side-effecting operations.

### Canonical envelope (single source-of-truth)

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

### Contracts (succinct)

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

### Errors & Validation

- Validation: use compact validation objects { ok, errors[], warnings[] } returned alongside successful exports. Invalid payloads return 4xx with details. Server failures return 5xx.
- Errors: structured error object { status, code?, message, details? }.

### Enforcement points (where to implement)

- Controller boundaries (`server/index.js`) — accept legacy shapes; call normalizer helper; forward explicit parameters (`resultId`, `content`, `prompt`).
- `genieService.generate()` — call service, assert canonical envelope returned.
- `genieService.export()` — canonicalize input, call persistence helper if needed, call `pdfGenerator`, return buffer + validation.
- Services — must return envelopes only; move any current file/DB writes out of services into plumbing.
- `pdfGenerator` — accept canonical envelope only; perform PDF creation and (optionally) validation.

### Migration plan & quick to-dos (estimates) [???]

1. Add `server/utils/normalizeToPages.js`: normalize legacy shapes -> canonical envelope. Test: 1.5–2.5h
2. Move side-effecting saves out of services (e.g., `sampleService` file save) into plumbing; add persistence helper and call from `genieService`: 1.0–2.0h
3. Wire normalizer into `genieService.export()` and controllers; add unit tests exercising legacy -> normalize -> mock export: 1.5–3.0h
4. Add compact JSON Schema for Envelope and integrate in tests: 1.0–2.0h

### Examples (minimal)

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

### Acceptance criteria for final design

- `genieService` must orchestrate only; services must be pure content producers; plumbing must perform all side-effects.
- A single normalizer exists and is used by all entry points before validation/export.
- Tests cover legacy inputs and the canonical flow using the mock PDF implementation in CI. [???]

### System Architecture (Final Implementation)

```ascii
┌─────────────┐         ┌───────────────────────────────────────┐
│   Client    │         │              Controller               │
│  Frontend   │◄─────►  │         (server/index.js)             │
└─────────────┘         └───────────────┬───────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────┐
│                       genieService                           │
│                                                              │
│  ┌─────────────┐      ┌─────────────┐    ┌─────────────┐     │
│  │ Normalizer  │      │ Validator   │    │ Orchestrator│     │
│  └─────┬───────┘      └──────┬──────┘    └─────┬───────┘     │
└────────┼─────────────────────┼─────────────────┼─────────────┘
         │                     │                 │
         ▼                     ▼                 ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│    Services    │   │    Plumbing    │   │   Persistence  │
│                │   │                │   │                │
│ ┌──────────┐   │   │ │PDF Gen   │   │   │ │DB Utils  │   │
│ │sample    │   │   │ │PDF Gen   │   │   │ │DB Utils  │   │
│ └──────────┘   │   │ └──────────┘   │   │ └──────────┘   │
│ ┌──────────┐   │   │ ┌──────────┐   │   │ ┌──────────┐   │
│ │demo      │   │   │ │File Utils│   │   │ │Envelope  │   │
│ └──────────┘   │   │ └──────────┘   │   │ │Store     │   │
│ ┌──────────┐   │   │                │   │ └──────────┘   │
│ │ebook     │   │   │                │   │                │
│ └──────────┘   │   │                │   │                │
└───────┬────────┘   └───────┬────────┘   └────────┬───────┘
        │                    │                     │
        └────────────────────┼─────────────────────┘
                             │
                             ▼
                    Pure Data Flow Only
                   (Canonical Envelopes)
```

Key Data Flow Properties:

- Services produce pure content (Envelopes)
- genieService handles all orchestration
- Plumbing modules handle all side-effects
- All data normalized before processing
- One-way dependencies (no circular)
- Clear separation of concerns

## REFERENCE

Concise findings and supporting artifacts for implementers and agents.

- Findings:

  - The codebase must accept only the canonical Envelope at runtime; legacy shapes are deprecated and removed (policy).
  - Many tests, mocks, and CI workflows still contain legacy-shaped fixtures (e.g., `{ title, body }`) and must be updated to canonical fixtures.
  - Priority targets are server export/preview tests, `server/index.js` controller entry points, `genieService`, `server/test-utils/pdfMock.js`, and client preview/test scripts.

- Supporting artifacts (created/updated):

  - `docs/design/service_sampleService-final.md` (this file) — canonical-only policy and migration plan.
  - `client/__tests__/TESTS_legacy.md`, `shared/__tests__/TESTS_legacy.md`, `server/__tests__/TESTS_legacy.md` — historical migration notes and prioritized test lists.
  - `.github/workflows/WORKFLOWS_legacy.md`, `.github/workflows/WORKFLOWS-revised.md` — workflow audits and suggested CI changes.
  - PR branch: `feat/genie/ci-concurrency` → merged into `aetherV0/anew-default-basic` (documentation changes pushed/merged).

- High-priority files to update (representative):

  - `server/index.js`, `server/genieService.js`, `server/sampleService.js`, `server/worker.js`
  - `server/__tests__/*` (export, preview, integration tests referencing legacy payloads)
  - `server/test-utils/pdfMock.js` (update to accept canonical envelope fixtures)
  - `client/__tests__/*` and smoke scripts that post legacy-shaped payloads

- Quick agent reminders:
  - Provide canonical Envelope fixtures under `server/__tests__/fixtures/` (or `shared/test-utils/fixtures/`) and replace legacy fixtures first in the highest-priority tests.
  - Add `server/utils/normalizeToPages.js` and wire it to controllers as a temporary adapter only if a short transition is absolutely needed; otherwise update tests/code to canonical fixtures and add strict validation at controller boundaries.
  - Use `PDF_GENERATOR_IMPL=mock` in CI while converting tests to avoid heavy integration runs.

## Implementation gaps & how to accommodate (concise)

What is not happening today

- sampleService is the authoritative producer of content but it does NOT currently declare intent/actions for downstream steps. It returns an envelope (pages/metadata) only — no explicit `{ actions: [...] }` signal.
- genieService takes the initiative for persistence/export decisions (read-first lookup and best-effort persistence) instead of reliably following a service-declared intent. In short: orchestration is proactive; service intent is not explicit.
- There is no single `server/utils/normalizeToPages.js` normalizer or a dedicated `server/utils/persistence.js` helper extracted from `genieService` — normalization and persistence exist but are implemented inline and partly duplicated across controllers and `genieService`.

How to accommodate this (minimal, backward-compatible steps)

1. Add a lightweight actions protocol (recommended)

- Service return shape: { envelope, metadata?, actions?: [{ type: 'print'|'persist'|'forward', opts?: {} }] }
- `sampleService` should include an action when it expects plumbing to run (for example a `print` action to request writing a preview file).
- `genieService.generate()` should inspect and honor `result.actions` (execute via `saveContentToFile`, persistence helper, or pdfGenerator), running actions in try/catch and keeping them non-fatal (preserve returned content even if an action fails). Expose a test hook similar to `_lastPersistencePromise` for deterministic tests.

2. Centralize normalization and persistence

- Implement `server/utils/normalizeToPages.js` and call it from `genieService` and controller entry points so all inputs are canonicalized consistently.
- Extract persistence logic into `server/utils/persistence.js` (thin wrapper over `dbUtils`/`crud`) and call it from `genieService` instead of inlining DB writes.

3. Backwards-compatible runtime behavior

- If `actions` is absent, preserve current behaviour (genieService continues to attempt best-effort persistence/export). This keeps the change non-breaking.
- Use `PDF_GENERATOR_IMPL=mock` in CI while converting tests/fixtures to the canonical envelope.

Acceptance criteria (short)

- `sampleService` can optionally return `actions` and `genieService` will execute them (logged, non-fatal) and expose a test hook for completion.
- A single normalizer is used by controllers and `genieService` so downstream plumbing always receives canonical envelopes.
- Persistence helper centralizes DB writes and is invoked only by `genieService`.

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
