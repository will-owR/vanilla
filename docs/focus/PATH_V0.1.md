# Path to AetherPress v0.1

## Context & Understanding

### Current State

- Core infrastructure ready
- Puppeteer integration complete and validated
- Basic CRUD operations implemented
- Health check system in place
- Component-based organization established

### Target Demo

Production of an ebook with:

- Summer poems (public domain)
- One poem per page
- Beautiful descriptive background images
- Professional PDF output

## Agreements & Decisions

### Scope Definition

1. **IN Scope v0.1**

   - Template-based HTML generation
   - Background image handling
   - Preview functionality
   - PDF export via Puppeteer
   - Basic error handling
   - Simple JSON input structure

2. **OUT of Scope v0.1**
   - AI integration
   - Complex user overrides
   - Advanced data persistence
   - Version tracking
   - Undo/redo functionality

### Technical Decisions

1. **Data Flow**

   ```
   JSON Input → HTML Template → Preview → PDF Export
   ```

2. **Data Structure**

   ```json
   {
     "poems": [
       {
         "title": "Summer Morning",
         "author": "Public Domain",
         "content": "poem text here",
         "background": "summer-morning.jpg"
       }
     ]
   }
   ```

3. **Component Responsibilities**
   - **Backend**: Template engine, PDF generation
   - **Frontend**: Preview, export trigger
   - **Shared**: Types, utilities

## Action Plan

### Phase 1: Foundation (2 days)

1. **Template System**

   - [x] Create basic HTML template
   - [x] Set up CSS for poem layout
   - [x] Implement background image handling
   - [x] Add page break logic

     (Note: foundation tasks implemented in `server/ebook.js` and `server/samples/images/`.)

2. **Preview Component**
   - [ ] Add preview route
   - [ ] Implement preview component
   - [ ] Set up real-time updates

### Phase 2: Core Features (2-3 days)

1. **PDF Generation**

   - [x] Set up export route
   - [x] Implement Puppeteer workflow
   - [x] Add error handling
   - [x] Validate output quality

     (Note: export route and Puppeteer workflow implemented; smoke tests and `server/scripts/smoke-export.sh` added.)

2. **Frontend Integration**
   - [x] Add export trigger
   - [x] Implement download handling
   - [x] Add loading states
   - [x] Basic error display

### Phase 3: Polish (1-2 days)

1. **Quality Assurance**

   - [ ] Test with various poems
   - [ ] Validate page layouts
   - [ ] Check image handling

     - [ ] Verify PDF quality

     (Note: basic smoke test validates a non-empty PDF is produced; further PDF quality checks (fonts, DPI) are TODO.)

2. **User Experience**
   - [ ] Add progress indicators
   - [ ] Improve error messages
   - [ ] Enhance preview interactions
   - [ ] Polish visual feedback

### Phase 4: Documentation (1 day)

1. **User Guide**

   - [ ] Document JSON structure
   - [ ] Add usage examples
   - [ ] Include sample poems

2. **Technical Documentation**

   - [ ] Update API documentation
   - [ ] Document template system
   - [ ] Add setup instructions

     (Note: `.devcontainer/README.md` added and API route `/api/export/book` documented.)

   ***

   ## Implemented summary (added during break)

   - `server/ebook.js`: HTML template generator for A4 eBooks (supports per-poem background SVGs).
   - `server/samples/poems.json`: canonical sample poems used by smoke tests.
   - `server/samples/images/*.svg`: decorative SVG backgrounds.
   - `/api/export/book`: POST endpoint that returns a generated A4 PDF using the running Puppeteer instance.
   - `server/scripts/smoke-export.sh`: script that POSTs the sample poems to `/api/export/book` and saves the response to a file (default: `/workspaces/vanilla/samples/ebook.pdf`).
   - `server/scripts/extract-pdf-text.js`: Node script that extracts text from a PDF for automated verification (used by smoke/CI).
   - `server/__tests__/export_text.test.mjs`: ESM Vitest integration test that posts to `/api/export/book`, asserts PDF magic bytes, and verifies extracted text contains a sample poem title.
   - `.devcontainer/README.md`: devcontainer summary and assessments added.

   TODO (explicit): add a small check to `server/scripts/smoke-export.sh` that validates the saved file is a PDF by checking the magic bytes (PDF files start with `%PDF-`) before declaring success. Currently the script declares success based on HTTP status only.

   Primary TODOs (next):

   - Replace the temp file location used in tests with a unique OS temp path (use `os.tmpdir()` and `fs.mkdtemp`) to avoid collisions and allow parallel test runs.
   - Add the export test to CI (GitHub Actions) to run on pushes and pull requests. Create a lightweight workflow that starts the server, runs `npm --prefix server run verify-export`, and fails the job on non-zero exit.
   - Convert the extraction script to a native, lightweight implementation using `pdfjs-dist` directly (avoid `pdf-parse` which has debug-mode side effects). This will reduce reliance on packages that execute code on import and make tests more deterministic.

## Implementation Strategy

### Incremental Steps

1. Start with single poem template
2. Add multi-poem support
3. Implement background images
4. Add preview functionality
5. Integrate PDF export
6. Polish and refine

### Testing Points

- After template creation
- After preview implementation
- After PDF generation
- After user experience enhancements

### Quality Gates

1. Template renders correctly
2. Preview matches specifications
3. PDF output meets quality standards
4. Error handling works reliably

## Success Criteria

1. Can process JSON input of poems
2. Generates professional-quality PDF
3. Each poem on separate page
4. Background images render correctly
5. Preview matches final output
6. Error handling is robust
7. Performance is acceptable

## Timeline

- Total: 5-8 days
- Milestone 1 (Foundation): Day 2
- Milestone 2 (Core Features): Day 5
- Milestone 3 (Polish): Day 7
- Milestone 4 (Documentation): Day 8

## Next Action

Begin with Phase 1: Foundation

1. Create HTML template structure
2. Set up basic styling
3. Implement initial preview route
