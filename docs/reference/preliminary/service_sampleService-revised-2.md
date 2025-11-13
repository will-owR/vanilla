# service_sampleService — Minimal final plan

Last updated: October 30, 2025
RE: service_sampleService-revised.md
RE: service_sampeService.md

## Recap

- Current state: `sampleService` produces deterministic content (title/body and copies). `genieService` orchestrates generation, best-effort persistence, and provides `getPersistedContent`. `pdfGenerator.js` exists and can produce PDF buffers (supports a mock mode for CI). The missing piece is a user-triggered export flow that produces a downloadable PDF.
- Goal: deliver the minimal end-to-end workflow (UI -> POST /prompt -> preview -> user-initiated export -> downloadable PDF) quickly, safely, and in a way that allows services to be iteratively improved: `sampleService` (current demo) -> `demoService` (richer multi-page output) -> `ebookService` (production-grade exports).

Time is of the essence. This plan intentionally limits scope to what is required to complete the workflow now, while leaving clear extension points for the next services.

## Short incremental plan (minimal, 48–72h cadence)

1. Define and commit the service contract (15–45 minutes)

   - Document the minimal stable contract all generation services must implement:
     - `async generate(prompt: string) -> { content: { title, body, layout?, metadata? }, copies?: Array<content>, metadata?: any }`
     - Error shape: throw Error with `.status` for HTTP mapping.
   - Purpose: make it trivial to swap services without controller changes.

2. Implement `genieService.export()` (2–4 hours)

   - API: `async export({ prompt?, promptId?, resultId?, validate=false }) -> { buffer: Buffer, validation?: { ok, errors[], warnings[] }, metadata? }`.
   - Behavior: prefer persisted canonical content via `getPersistedContent` if `promptId`/`resultId` provided; otherwise call `generate(prompt)` on the selected service. Call `pdfGenerator.generatePdfBuffer({ title, body, validate })` and return buffer and optional validation.

3. Add controller endpoint `POST /export` (1–2 hours)

   - Accepts JSON body with one of: `{ prompt }`, `{ promptId }`, `{ resultId }`, or `{ content }`.
   - Validates input, calls `genieService.export(...)`, streams PDF back with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="export.pdf"`.
   - Support query param or env flag to request validation (e.g., `?validate=1`).

4. Add smoke tests + CI-safe mocks (1–3 hours)

   - Use `PDF_GENERATOR_IMPL=mock` or `SKIP_PUPPETEER=true` in CI to avoid Puppeteer installation issues.
   - Smoke test: POST `/export` with `prompt` (mock PDF) and assert response is a buffer and validation (if requested) passes or returns expected warnings.

5. Scaffold `demoService` (4–8 hours, parallel)

   - Implement `server/demoService.js` that produces richer multi-page content (calls `ebook` renderer or templates), conforming to the `generate` contract. Keep `sampleService` unchanged as a minimal demo.
   - Use a config flag or `serviceAdapter` to flip which service `genieService` delegates to for manual testing.

6. Document `ebookService` requirements and migration checklist (1–2 hours)
   - Capture features (layout, fonts, images, storage, job queuing) and rollout steps to switch services in production.

## Why this scales

- Single stable contract: All services only need to implement `generate(prompt)`. `genieService` orchestrates selection and export. That isolates UI and controller code from changing service implementations.
- Centralizing export orchestration in `genieService` keeps persistence, content selection, and export-related logic in one place so future features (background jobs, storage, retries) are added once and benefit all services.
- Phased approach: keep `sampleService` minimal (fast to maintain and test), introduce `demoService` for closer-to-real exports, then replace with `ebookService` when production requirements are defined.

## Actionables (short, prioritized) and success criteria

1. Commit service contract doc to `docs/design/service_sampleService-final.md` (this file).

   - Success: document exists in repo and referenced in `docs/services_ref` or README.

2. Implement `genieService.export()` and unit tests.

   - Success criteria:
     - `genieService.export` returns `{ buffer }` when given `{ prompt }` and does not throw.
     - When passed `{ promptId }` or `{ resultId }` that maps to persisted content, export uses persisted content.

3. Add `POST /export` endpoint and smoke test.

   - Success criteria:
     - POST `/export` with `{ prompt: 'x' }` returns 200 and `Content-Type: application/pdf` and a non-trivial buffer (>1KB).
     - CI smoke test runs in mock PDF mode and passes reliably.

4. Scaffold `demoService` and flip test.

   - Success criteria:
     - `demoService.generate()` returns multi-page `aiResponse` pages or `copies` and `genieService.generate` respects it.
     - `POST /export` with `genieService` delegated to `demoService` returns a PDF that contains multiple pages (mock validation or pageCount >1 in validation object).

5. Document `ebookService` roadmap and migration checklist.
   - Success criteria: a one-page plan exists listing infra needs (queue, storage), data migration and safety checks.

## Time sensitivity and constraints

- This scope is deliberately minimal to deliver an end-to-end export quickly. Do not add background jobs, external storage, or heavy infra in the first pass — those are follow-ups.
- Puppeteer is heavy; use `PDF_GENERATOR_IMPL=mock` in CI and provide env flags for `PUPPETEER_EXECUTABLE_PATH` and `SKIP_PUPPETEER` so CI/devs can run tests without installing Chrome.

## Next steps (I can take them)

I can implement the minimal flow now: add `genieService.export`, `POST /export`, smoke test (mock PDF), and a `demoService` scaffold. Estimated effort: 6–12 hours. Tell me to proceed and I will apply the changes and run the smoke tests.

## Implementation we will perform (documented before code)

This section records exactly what will be implemented next. The goal is to keep the orchestrator (`genieService`) as the single place that owns content selection, persistence lookups, and export orchestration. The HTTP controllers are plumbing only.

Planned code changes (applied only after this document is committed):

- Add `genieService.export({ prompt?, promptId?, resultId?, content?, validate? })`

  - Behavior: prefer persisted canonical content (when IDs provided via `getPersistedContent`), otherwise call the active generation service (`sampleService` or `demoService`) to produce canonical content. Use `pdfGenerator.generatePdfBuffer({ title, body, validate })`. Return `{ buffer, validation? }` or throw errors for upstream mapping.

- Update `POST /export` controller in `server/index.js` to delegate to `genieService.export` (controller validates the request, maps errors to 400/422/503 as appropriate, and streams the returned PDF buffer to the client). Controller remains plumbing only.

- Add a `demoService` scaffold (`server/demoService.js`) implementing the same `generateFromPrompt` contract and capable of multi-page output.

- Add a smoke runner `server/scripts/run_smoke_export.js` and unit test(s) that exercise `genieService.export` in mock PDF mode (CI-friendly: `PDF_GENERATOR_IMPL=mock` / `SKIP_PUPPETEER=true`).

- Document frontend contract: the UI should send `{ resultId }` when available (preferred), or `{ content: { title, body } }` or `{ prompt }` as fallback. Frontend handles 200 (PDF binary), 422 (validation), and 5xx (retryable) responses.

Success criteria for this implementation pass (what I'll verify automatically):

- `genieService.export` returns a non-empty Buffer for a sample prompt when run with `PDF_GENERATOR_IMPL=mock`.
- The smoke runner completes with exit code 0 and prints buffer length and validation output.
- The updated `POST /export` controller delegates to `genieService.export` (tests verify the plumbing behavior by calling the controller in mock mode).

Once you confirm this doc, I will apply the code changes and run the smoke verification in mock mode. Please confirm and I will proceed.

---

End of plan.

## Canonical generated-content contract (one paragraph)

When a generation service returns content to the frontend for preview and editing, it MUST present the document as an ordered pages array `pages` (length ≥ 1) where each page is an object: { title: string, body: string, layout?: string, metadata?: object }. The UI MUST treat a single-page result as `pages = [page]` (normalize if needed). Each page requires a non-empty `title` and a `body` suitable for display and editing; `body` MAY be HTML (preferred) or plain text (the UI should escape/convert plain text for safe editing). The response SHOULD include identifiers (promptId and/or resultId) and optional top-level metadata { model?, version?, pageCount? } for traceability. The pages array is the canonical, editable representation and MUST be trivially convertible by the orchestrator into the export `pages[]` model (no ad-hoc unstructured blobs). If the shape is invalid, the service should return a clear validation error describing the missing fields.

> **MIGRATION NOTE (DRAFT):** To migrate from the current { content, copies, metadata } outputs to the aspirational `pages[]` contract, add a small, centralized adapter (for example `server/utils/normalizeToPages`) and call it from `genieService.generate`/`genieService.export` and the preview controller. Mapping rules: if `copies` exists, set `pages = copies.map(c => ({ title: c.title, body: c.body, layout: c.layout, metadata: c.metadata }))`; otherwise set `pages = [{ ...content }]`. Preserve `promptId`, `resultId` and top-level `metadata` by copying them into the export envelope (e.g., `envelope.metadata.persistence = { promptId, resultId }`). Validate `pages.length >= 1` and that every page has non-empty `title` and `body`, returning a clear 400 diagnostics object for failures. Implement this adapter as backward-compatible (accept both legacy and `pages` shapes, prefer persisted `pages` when present) and add a small unit test that asserts normalization for the key cases (single content, copies array, invalid shapes).

### Canonical export contract (one paragraph)

The canonical export contract accepts content as one or more ordered pages: the top-level payload SHOULD contain a single field `pages` which is an Array<Page> with length >= 1, where Page = { title: string, body: string, layout?: string, metadata?: object }; the `body` is expected to be HTML (the orchestrator will escape and wrap plain text if provided), page order in the array defines document sequence, and single‑page documents may alternatively be submitted as a lone Page object (the orchestrator MUST normalize it to `pages = [page]`); the export implementation MUST validate that `pages.length >= 1` and that every Page has non-empty `title` and `body`, returning a 400 validation error with a short diagnostics object if this fails; for PDF generation the orchestrator SHOULD render `pages[]` into a single multi‑page HTML document (using page‑break markers) or render per‑page and concatenate—either approach is acceptable as long as the page order and count are preserved.

**Important!**

The two earlier contracts are aligned in intent, but they need one small operational bridge to be fully consistent.

Key points (succinct):

- Intent match: both require a normalized pages[] representation (pages.length >= 1; each page has non-empty title and body, optional layout/metadata) and preserve traceability metadata — so the generated-content contract cleanly “feeds” the export contract.

- Minor difference called out in the doc: export prefers HTML body while generated content may be HTML or plain text. The orchestrator/exporter must escape/convert plain text before rendering (document already notes this).

- Practical gap (why we added the migration note): existing generators currently emit { content, copies } (legacy shape). To make the contracts operationally identical you must normalize legacy outputs into pages[] before export.

- Recommended immediate step: run a single adapter (e.g., normalizeToPages) in genieService.generate/genieService.export and in preview endpoints so all callers see the canonical pages[] shape and validation is enforced in one place.

### Canonical edit contract (one paragraph)

When a client submits edits, the edit endpoint MUST accept the canonical payload shape (top-level `pages: Array<Page>` or a single Page which will be normalized) and persist the normalized result as the new canonical content; the service MUST validate each Page (non-empty `title` and `body`) and return an acknowledgement object `{ ok: true, promptId?, resultId?, editId?, metadata: { persistedAt, editor?, version? }, content: { pages } }` on success or a 400 diagnostics object listing field-level validation errors on failure. Edits must be applied atomically and idempotently (clients may retry using `editId`), include minimal audit metadata (timestamp, editor id or session), and surface conflict or concurrency errors (409) when a concurrent persistent change blocks the edit; the service should expose a read-after-write `resultId` and `version` so callers can reliably reference the persisted canonical content for subsequent preview or export.

## ADDENDUM: Format and Flow Patterns in Export Process

During implementation review, two critical orchestration concerns were identified:

1. Incorrect flow patterns for content editing and export
2. Format handling in `genieService.export()`

### Flow - No editing happens (Current)

```
Frontend -> genieService -> export utility (plumbing)
```

Implementation detail:

```
Frontend -> genieService (to export) -> plumbing (pdfGenerator)
```

In this current flow, genieService's role is to:

1. Resolve content (from IDs, storage, or direct content)
2. Validate and adapt format for the plumbing layer
3. Delegate to pdfGenerator with properly formatted content

#### Flow - Document Edited (Future)

```
Frontend -> genieService -> Service (e.g., sampleService) -> genieService -> export utility (plumbing)
```

Implementation detail:

```
Frontend -> genieService (to service) -> Service (sampleService) -> acknowledges changes -> genieService (to export) -> plumbing (pdfGenerator)
```

In this future flow, genieService's expanded role will:

1. Receive initial request
2. Delegate to appropriate service for edit acknowledgment
3. Handle format adaptation after edits
4. Manage final export through plumbing layer

### Format Issue

Frontend sends:

```javascript
{
  title: string,
  body: string
}
```

Backend contract expects:

```javascript
{
  content: { title, body, layout?, metadata? }
}
// OR
{ prompt: string }
// OR
{ promptId: string }
// OR
{ resultId: string }
```

The current implementation attempts format adaptation through an overloaded `prompt` parameter:

```javascript
async export({ prompt, promptId, resultId, validate = false }) {
  // ...
  if (!contentObj && prompt && typeof prompt === "object") {
    contentObj = prompt;  // Implicit adaptation
  }
  // ...
}
```

This approach has several issues:

1. Unclear parameter naming (`prompt` handling both string prompts and content objects)
2. Implicit format adaptation that's not obvious to callers
3. Mixed responsibilities in parameter handling
4. Lack of clear documentation about supported formats

#### Improved Implementation

The orchestrator should explicitly handle format adaptation:

```javascript
async export({ prompt, promptId, resultId, content, validate = false } = {}) {
  try {
    let contentObj = null;

    // Priority 1: Use persisted content when IDs provided
    if (promptId || resultId) {
      const persisted = await genieService.getPersistedContent({
        promptId,
        resultId,
      });
      if (persisted && persisted.content) {
        contentObj = persisted.content && persisted.content.content
          ? persisted.content.content
          : persisted.content;
      }
    }

    // Priority 2: Accept direct content object
    if (!contentObj && content) {
      contentObj = content;
    }

    // Priority 3: Legacy support for content via prompt parameter
    if (!contentObj && prompt && typeof prompt === "object") {
      contentObj = prompt;
    }

    // Priority 4: Generate from prompt text
    if (!contentObj && prompt && typeof prompt === "string") {
      const genResult = await genieService.generate(prompt);
      if (genResult && genResult.data && genResult.data.content)
        contentObj = genResult.data.content;
      else if (genResult && genResult.content)
        contentObj = genResult.content;
    }
    // ...
```

### Benefits of Improved Implementation

1. **Clear Priority Order**: Explicit handling of different input formats with clear precedence
2. **Format Flexibility**: Accepts both frontend and backend formats without requiring frontend changes
3. **Maintainable Design**: Separate parameters for different content sources
4. **Better Documentation**: Clear documentation of supported formats
5. **Backward Compatibility**: Maintains support for existing code while providing better structure

### Why This Matters

As the orchestrator, `genieService` should:

1. Shield other services from format differences
2. Handle format adaptation internally
3. Maintain a clear contract with both frontend and backend services
4. Provide flexibility in how content is provided
5. Make format handling explicit and documented

This improvement aligns with the service's role as an orchestrator while making the codebase more maintainable and format-handling more explicit.
