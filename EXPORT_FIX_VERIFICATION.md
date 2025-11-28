# Export Content Gap - Fix Verification

**Date:** November 28, 2025  
**Issue Reference:** [Issue #6 - Export Content Gap](docs/ISSUES.md#issue-6-export-content-gap)  
**Related Bug Document:** [ISSUES_To_V0.1.md - Step 6: Export Endpoint Content Gap](docs/ISSUES_To_V0.1.md)

## Problem Identified

The backend round-trip test revealed that ID-based export was failing with "404: Result not found" while direct export was working correctly. This validated the Issue #6 discovery: export endpoint doesn't recognize eBook data format.

**Root Cause:**

- `exportContent()` method was using `this.getPersistedContent({resultId})`
- `getPersistedContent()` expects a legacy data structure with `.content` field
- But eBook envelopes are stored with `{pages, html, metadata, actions}` structure in the outEnvelope field
- This mismatch caused persistence lookups to fail

## Solution Applied

### File: `/server/genieService.js` (Lines 1109-1190)

**BEFORE (Broken - Using Wrong Retrieval Method):**

```javascript
// CASE 1: resultId provided
const persisted = await this.getPersistedContent({ resultId: packet.resultId });
if (!persisted || !persisted.content) throw new Error("Result not found");
const content = persisted.content; // ← Wrong structure for eBooks
```

**AFTER (Fixed - Using Correct Retrieval and Structure):**

```javascript
// CASE 1: resultId provided
const { getResultById } = require("./utils/resultDb");
const result = await getResultById(packet.resultId);
if (!result) throw new Error("Result not found");

// Extract from outEnvelope structure: {pages, html, metadata}
const outEnvelope = result.outEnvelope || result;
title = outEnvelope.metadata?.title || outEnvelope.title || "Export";
body = outEnvelope.html || null;
```

## Key Changes

1. **Import Correction**: Now uses `getResultById()` from resultDb directly
2. **Structure Access**: Accesses `result.outEnvelope` (correct stored structure)
3. **Field Extraction**:
   - Title from: `outEnvelope.metadata?.title` (not persisted.content.title)
   - HTML from: `outEnvelope.html` (not persisted.content.html)
4. **Fallback Logic**: Gracefully handles both structures with `result.outEnvelope || result`

## Data Flow Now Correct

```
Backend generates eBook:
  → Stored as: result.outEnvelope = {pages, html, metadata, actions}

Export by ID called:
  ✅ CASE 1: resultId → getResultById() → result.outEnvelope → normalize to {title, body}
  ✅ CASE 2: Direct {html, metadata} → normalize to {title, body}
  ✅ CASE 3: Legacy {title, body} → pass through unchanged

All normalize to {title, body} → pdfGenerator → PDF buffer
```

## Expected Test Results After Fix

Run: `node scripts/test-export-roundtrip.js`

**Previously (Before Fix):**

- ❌ Direct export: ✅ 25,665 bytes PDF (working)
- ❌ ID export: ❌ 404 "Result not found" then ❌ 500 "pdfBuffer undefined" (broken)

**After Fix - ACTUAL RESULTS (November 28, 2025 - 18:00 UTC):**

- ✅ Direct export: ✅ 24,444 bytes PDF (working)
- ✅ ID export: ✅ 117,110 bytes PDF (now working with full content)
- ✅ Exit code: **0** (all tests pass)
- ✅ Validation: Both PDFs valid and contain full generated content

**Test Summary:**

```
═══════════════════════════════════════════════════════════════
✅ ALL TESTS PASSED
═══════════════════════════════════════════════════════════════

📝 STEP 1: Generating eBook...
   ✅ Generated 5 chapters (33,153 bytes HTML)
   ✅ Title: "The First Whisper"

📥 STEP 2A: Exporting via direct content {pages, html, metadata}...
   ✅ PDF generated: 24,444 bytes

📥 STEP 2B: Exporting via persisted ID {resultId}...
   ✅ PDF generated: 117,110 bytes

✅ VALIDATION
   ✅ Both PDFs generated and valid
   ✅ Both contain full generated content
   ✅ Backend orchestrator works for both methods
```

## Root Causes Fixed

**Primary Issue:** pdfGenerator returning object instead of buffer

- When `validate: true` passed to generatePdfBuffer(), returns `{ buffer, validation }`
- Fix: Extract `.buffer` property from result object before returning

**Secondary Issue:** Data structure mismatch in ID-based lookup

- Was using `getPersistedContent()` (legacy method) expecting `.content` field
- Actual storage: `result.outEnvelope` with `{pages, html, metadata}` structure
- Fix: Use `getResultById()` directly and access correct structure

**Tertiary Issue:** outEnvelope could be stringified

- Added defensive JSON parsing: `if (typeof outEnvelope === "string")`
- Ensures compatibility with both object and stringified JSON

## To Validate

1. ✅ Backend server running: npm run dev
2. ✅ Round-trip test passed: node scripts/test-export-roundtrip.js (Exit code: 0)
3. ✅ Both export methods produce valid PDFs with full generated content

## Files Modified

- ✅ `/server/genieService.js` - exportContent() method (3 fixes):

  - CASE 1: Use `getResultById()` instead of `getPersistedContent()`
  - Data extraction: Parse JSON if needed, access `result.outEnvelope`
  - pdfGenerator handling: Extract `.buffer` from validation object

- ✅ `/server/index.js` - POST /api/export endpoint:
  - Added validation to check if pdfBuffer is actually a Buffer instance
  - Improved error logging with stack traces

## Status

🟢 **IMPLEMENTATION COMPLETE & TESTED**

- Issue #6 (Export Content Gap) RESOLVED
- Both export methods validated working
- Backend can export what it generates
- Ready for browser testing and documentation updates
