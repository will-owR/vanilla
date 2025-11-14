# Bug Report: Demo Mode PDF Generation Only Showing 5 Pages

**Date**: November 14, 2025  
**Status**: Under Investigation  
**Priority**: High  
**Assignee**: Development Team

---

## Problem Statement

User reports that demo mode PDF generation produces only 5 content pages instead of the expected 9-page structure:

- Expected: Cover (i) → Copyright (ii) → TOC (iii) → Content (5-9) → Epilogue (10)
- Actual: Only 5 content pages shown, no cover/copyright/TOC/epilogue

User stated: _"The end-product is just a fancier 'basic' mode result, as there is no TOC, no epilogue and no cover page. What I get: Five (5) pages, properly numbered, as follows `Section 3: Content for page 3...`"_

---

## Investigation Progress

### Code Flow Verified ✓

1. **genieService.process()** → Routes to demoService for mode: 'demo' ✓
2. **demoService.handle()** → Generates 5 content pages + epilogue ✓
3. **exportService.generate()** → Detects demo mode, routes to pdfStructureBuilder ✓
4. **pdfStructureBuilder.generatePDF()** → Builds complete 9-page HTML structure ✓
5. **pdfGenerator.generatePdfBuffer()** → Receives full HTML, detects <!DOCTYPE, uses as-is ✓

### HTML Structure Verified ✓

- Generated HTML contains all 9 page divs:
  - `<div class="page cover-page">` (i)
  - `<div class="page copyright-page">` (ii)
  - `<div class="page toc-page">` (iii)
  - 5x `<div class="page content-page">` (5-9)
  - `<div class="page epilogue-page">` (10)
- CSS includes `page-break-after: always` on `.page` class
- HTML is properly formatted and complete

### PDF Generation Status ✓

- PDF files ARE being generated
- PDF files DO contain 9 pages (verified by parsing `/Count` objects in PDF)
- Puppeteer DOES respect CSS `page-break-after: always`
- All 9 pages are present in generated PDF

### Potential Remaining Issues

1. **Debugging Logging Still Active**: Debug logging was added to:

   - `/workspaces/vanilla/server/debug-routing.js`
   - `/workspaces/vanilla/server/exportService.js` (routing detection)
   - `/workspaces/vanilla/server/utils/pdfStructureBuilder.js` (HTML building)

   These should be cleaned up/removed.

2. **User Testing Needs Verification**:

   - User may be testing with older generated PDF
   - User may not have latest code changes
   - Need end-to-end API test with fresh request

3. **Possible Code Path Issues**:
   - Check if demo mode is being triggered correctly in genieService
   - Verify exportService is actually routing to pdfStructureBuilder
   - Confirm pdfStructureBuilder is being called with demo mode envelopes

---

## Code Changes Made

### pdfGenerator.js (Line ~120)

Added logic to detect full HTML documents and use them as-is:

```javascript
} else if (body && String(body).trim().toLowerCase().startsWith("<!doctype")) {
  // If body already contains a full HTML document (e.g., from pdfStructureBuilder),
  // use it as-is without wrapping
  contentHtml = body;
} else {
```

### pdfStructureBuilder.js (Line ~43)

Removed envelope parameter when calling pdfGenerator to prevent it from rebuilding HTML:

```javascript
// envelope is intentionally NOT passed here
const pdfBuffer = await pdfGenerator.generatePdfBuffer({
  title: metadata.title || "Demo Presentation",
  body: html,
  validate: options.validate || false,
  browser: options.browser,
  // envelope is intentionally NOT passed here
});
```

### exportService.js (Line ~34)

Added debug routing detection (should be removed):

```javascript
if (mode === "demo") {
  console.log(
    "DEBUG: exportService routing to pdfStructureBuilder for demo mode"
  );
  // ... code
}
```

---

## Next Steps to Resolve

1. **Remove Debug Logging**:

   - Clean up console.log statements in exportService.js, pdfStructureBuilder.js, debug files
   - Verify code is production-ready

2. **End-to-End API Test**:

   - Test complete flow: POST /prompt with mode='demo' → GET /api/export/download
   - Verify PDF has 9 pages with all components
   - Inspect actual PDF output visually

3. **Verify User Testing**:

   - Confirm user is testing with latest code
   - Provide fresh test case with known input
   - Request visual confirmation of PDF structure

4. **If Still Failing**:
   - Check browser console for errors in genieService routing
   - Add temporary logging to genieService.process() to confirm mode
   - Trace envelope.metadata.mode through entire pipeline
   - Check if demo mode envelope has epilogue attached

---

## Test Commands

To verify the fix:

```bash
# Run the full workflow test
npm --prefix server test -- demo-full-workflow

# Or manually test with node:
cd /workspaces/vanilla/server
node -e "
const genieService = require('./genieService.js');
const exportService = require('./exportService.js');

(async () => {
  const result = await genieService.process({
    mode: 'demo',
    prompt: 'Atmosphere: A Love Story',
    metadata: {
      title: 'Atmosphere: A Love Story',
      author: 'Jenkins Reid, Taylor',
      pages: 5,
      theme: 'dark'
    }
  });

  const pdf = await exportService.generate(result.out_envelope);
  console.log('PDF generated:', pdf.buffer.length, 'bytes');
  // Check /Count in PDF to verify page count
})();
"
```

---

## Files Involved

- `/workspaces/vanilla/server/genieService.js` - Mode routing (line ~290: process method)
- `/workspaces/vanilla/server/exportService.js` - Route to pdfStructureBuilder
- `/workspaces/vanilla/server/utils/pdfStructureBuilder.js` - HTML generation, page assembly
- `/workspaces/vanilla/server/pdfGenerator.js` - Puppeteer PDF rendering
- `/workspaces/vanilla/server/utils/themeEngine.js` - Theme styling
- `/workspaces/vanilla/server/utils/epilogueGenerator.js` - Epilogue content
- `/workspaces/vanilla/server/demoService.js` - Demo content generation

---

## Related Documentation

- `/workspaces/vanilla/docs/design/DEMO_MODE_REFERENCE_ARCHITECTURE.md` - Design specification
- `/workspaces/vanilla/docs/design/MODULARITY_BREAKDOWN.md` - Phase A implementation plan

---

## Investigation Notes

- Puppeteer DOES respect CSS page-break-after rules when set on `.page` class with `page-break-after: always`
- Test with 10 simple divs creates valid 8-10 page PDF depending on content
- Demo PDF generated in tests shows `/Count 9` in PDF object stream = 9 pages
- HTML wrapping issue was fixed by checking for <!DOCTYPE in body
- The code architecture appears correct - issue may be in testing/verification
