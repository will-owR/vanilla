# Persist-before-generate, renderable HTML contract, and preview separation

Suggested: WED 11/5/2025
Implemented: To-be-determined

Summary

- Three focused changes to improve reliability and clarity: 
(1) persist a placeholder result before generation so runs are trackable, 
(2) require or convert service output into finalized renderable HTML/assets for the PDF renderer, and 
(3) keep preview endpoints lightweight and separate from full PDF generation/validation.

## Persist early

1. Persist early — create a result record/resultId before generation

Need

- `genieService.generate()` currently persists only after generation completes, so there is no stable run identifier during work. This makes tracking, retrying, and cross-process coordination harder.

Benefit

- Immediate run tracking (resultId) for UI, logs, and background workers.
- Clear status transitions (pending → success/failure) for observability and retries.
- Better coordination for incremental uploads, asset processing, or crash recovery.

Minimal concept snippet

```javascript
// create prompt and placeholder AI-result first (status: pending)
const p = await dbUtils.createPrompt(String(prompt));
const placeholder = await dbUtils.createAIResult(p.id, {
  content: { title: "", body: "" },
  status: "pending",
  metadata: {},
});
out.data.promptId = p.id;
out.data.resultId = placeholder.id;

// run generation
const result = await sampleService.generateFromPrompt(prompt);

// update persisted result with real payload + status
await dbUtils.updateAIResult(placeholder.id, { result, status: "ok" });
```

Notes

- Use a `status` field (pending/failed/success). Keep existing dedupe/recovery logic for `createPrompt` (the repo already contains that pattern).
- If DB API lacks update, append a new row and record latest id; prefer update when available.

## pdfGenerator consumes finalized HTML/assets

2. pdfGenerator consumes finalized HTML/assets (not raw prompt)

Need

- PDF rendering must work from deterministic, renderable input: final HTML plus any assets (CSS, images). Passing only the raw prompt or a partial envelope leads to ambiguity and rendering errors.

Benefit

- Deterministic PDF output and simpler validation.
- Clear separation of responsibilities: sampleService (or genieService) prepares HTML, pdfGenerator renders and validates.

Minimal contract

- sampleService should return either:

  - `html` (string) and optional `assets: [{path, buffer|url}]`, or
  - `envelope.pages = [{ title, body, layout, html?, assets? }]`

- pdfGenerator API shape (conceptual):

```javascript
pdfGenerator.generatePdfBuffer({
  title,
  body,
  html,
  envelope,
  assets,
  validate,
});
```

Notes

- If sampleService returns structured `content` (title/body/layout) the `genieService` can convert that to final HTML, but it's cleaner if sampleService supplies `html` when possible.

## Make preview path separate and lightweight

3. Preview path should be separate and lightweight

Need

- Previewing while authoring needs fast HTML/JSON responses; running full PDF generation/validation for preview is slow and brittle.

Benefit

- Faster UX, fewer wasted renders, and clearer API semantics (preview vs export).

Minimal API guidance

- `POST /preview` -> returns `{ html, envelope, assets?, metadata }` (no PDF generation/validation).
- `POST /export` -> accepts `envelope | prompt | promptId | resultId` and triggers PDF render+validation.

Risks & mitigations (brief)

- Placeholder duplication: avoid by dedupe on prompt and recovery logic already present; use `status` to identify in-flight runs.
- Incomplete records after crashes: handle with `status` + cleanup/monitoring; UI can display "in progress".
- Tests depending on old timing: preserve test hooks (`AWAIT_PERSISTENCE`) or update tests to expect earlier `resultId`.

Recommended one-line action

- Update `genieService.generate()` to create `prompt` and a placeholder `aiResult` (status=pending) before calling `sampleService.generateFromPrompt()`, require/convert sampleService output to finalized HTML/assets for `pdfGenerator`, and ensure `/preview` returns renderable HTML without running full PDF validation.

Next steps (suggested)

- Add a tiny unit test asserting placeholder `resultId` exists immediately after calling `genieService.generate()` when `AWAIT_PERSISTENCE`/test mode is enabled.
- Add a short integration test that passes `html` to `pdfGenerator.generatePdfBuffer()` and asserts a Buffer is returned.

---

File ready to drop at: `docs/design/update/persist-render-preview.md`
