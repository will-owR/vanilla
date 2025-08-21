# Chat history snapshot — AetherPress PATH_V0.1

Date: 2025-08-21
Branch: AE/path-v01B

## Recommended next steps (mapped to PATH_V0.1)

### Convert PDF text extraction to pdfjs-dist everywhere (priority: high)

Why: removes fragile pdf-parse import side-effects and makes parsing deterministic for CI.

- Action: grep for pdf-parse usages, replace with pdfjs-dist based implementation already in extract-pdf-text.js where possible, add a unit test verifying text extraction.

### Add PDF quality assertions (fonts embedded, DPI, page count) to server-side test harness (priority: medium)

Why: ensures output quality beyond "is a PDF".

- Action: extend run_export_test_inproc.js and export_text.test.js to assert number of pages and presence of expected text, and optionally use pdf-lib or pdfjs-dist to check fonts.

### Harden UI e2e (priority: medium)

Why: full Generate → Preview flow is flaky in headless CI.

- Action A (preferred): keep deterministic store-driven tests (already added) for fast CI, and add a UI-only headless test with increased timeouts and retries.
- Action B: if UI flow is essential, instrument client to expose a test-only hook or endpoint to force preview state for E2E.

### Add client tests to main CI matrix and collect artifacts on failure (priority: low → now done)

Already added client-tests job to verify-export.yml.

- Next: add artifact collection (snapshots/coverage) when client tests fail.

### CI performance and ergonomics

- Add caching keys per workspace, run client and server jobs in parallel unless order is required, add badges to README.

## Updated Action Plan and Timeline (2025-08-21)

### Day 1 (Today + Tomorrow): Core Technical Improvements

1. PDF Processing Enhancement (4-5 hours)

   - [ ] Convert remaining pdf-parse uses to pdfjs-dist
   - [ ] Add comprehensive unit tests for text extraction
   - [ ] Implement PDF quality assertions (fonts, DPI, page count)

2. Preview Component Implementation (4-5 hours)
   - [ ] Build basic preview component
   - [ ] Implement real-time preview updates
   - [ ] Add loading states and error handling

### Day 2: Testing and UI Polish

1. E2E Testing Enhancement (3-4 hours)

   - [ ] Implement UI-focused headless test for Generate → Preview flow
   - [ ] Add increased timeouts and retry logic for CI
   - [ ] Document test scenarios and setup requirements

2. User Experience Polish (4-5 hours)
   - [ ] Enhance error messages and display
   - [ ] Improve preview interactions
   - [ ] Add progress indicators
   - [ ] Polish visual feedback

### Day 3: Documentation and Final QA

1. Documentation Updates (3-4 hours)

   - [ ] Update API documentation
   - [ ] Document template system
   - [ ] Add usage examples with sample poems
   - [ ] Update setup instructions

2. Quality Assurance (4-5 hours)
   - [ ] Test with various poem formats
   - [ ] Validate page layouts
   - [ ] Verify image handling
   - [ ] Final PDF quality checks

### CI/CD Tasks (Parallel)

- [ ] Add artifact collection for client test failures
- [ ] Implement workspace-specific caching
- [ ] Add CI status badges to README
- [ ] Create draft PR with comprehensive changes summary

## Success Criteria for v0.1 Completion

1. All PDF processing uses pdfjs-dist with reliable text extraction
2. Preview component works reliably with real-time updates
3. E2E tests pass consistently in CI
4. Documentation is complete and accurate
5. All quality checks pass (PDF output, layout, images)

## Notes

- Tasks are organized for parallel execution where possible
- Preview component work can begin while PDF processing is being enhanced
- Documentation should be updated as features are completed
- Regular commits with descriptive messages for better tracking

---

## Selected actionables for the next 3 hours (2025-08-21)

Goal: reduce CI/test fragility and validate preview → export fast-path.

Owner: Backend (primary) + Frontend (support)

Tasks (3-hour window):

1. Stabilize PDF extraction (Backend — 75m)

   - Replace in-process `pdf-parse` usage in tests with a subprocess call to `node server/scripts/extract-pdf-text.js <pdf>` or convert the test to use `pdfjs-dist` directly.
   - Update one representative test (e.g., `shared/__tests__/pdfExport.test.ts`) to stop importing `pdf-parse` and instead call the extractor script and assert expected text.

2. Verify preview endpoint + minimal preview render (Frontend+Backend — 65m)

   - From the repo root, POST a small sample JSON to `/api/preview` and confirm the HTML includes a known poem title.
   - If client preview UI is missing required props, add a minimal skeleton to `client/src/components/PreviewWindow.svelte` that can display server HTML for now.

3. Quick export smoke and artifact verification (Any — 20m)
   - Run `server/scripts/smoke-export.sh` and validate the produced file starts with `%PDF-` and contains expected text when passed through `server/scripts/extract-pdf-text.js`.

Quick commands to run locally (optional)

```bash
# Extract sample text from the canonical sample PDF
node server/scripts/extract-pdf-text.js server/samples/ebook.pdf

# Run the smoke export (writes a temp file and validates magic bytes)
bash server/scripts/smoke-export.sh

# POST a sample payload to preview
curl -s -H 'Content-Type: application/json' -d @server/samples/poems.json http://localhost:3000/api/preview | head -n 40
```

Progress update will be added to this file after completing the sprint tasks.

If you want the full raw chat transcript included instead of this summary, tell me and I will append the full transcript to this file and push the update.
