# QA Testing Issues - Investigation Focus

**Date**: December 5, 2025  
**Status**: Investigation prioritized based on code review  
**Branch**: `feat/B_Frontend_option2`  
**Scope**: Focus on Stage 1 batch optimization (3-20 pages) only

---

## Implementation Landscape (Stage 1 ONLY)

### In Scope - What We Support
- **Server**: `server/batchOptimization/` directory
  - `BatchOptimizationService.js` - Core orchestrator
  - `ebookServiceAdapter.js` - Integration with ebookService
  - `RateLimiter.js`, `GenerationMetrics.js`, `ContentExtractors.js`, `PromptTemplates.js` - Support modules
  - `index.js` - Module exports
- **Testing**: `server/__tests__/batchOptimization.test.js` - 25/25 unit tests passing
- **Ebook Range**: 3-20 pages (extended to 25 to handle metadata chapters)

### Out of Scope - Legacy Code (DO NOT PATCH)
- **Server**: `server/batchChapterProcessing/` directory (legacy)
  - Applies to 2-page and under, 21-page and over ebooks
  - Old batch processing pipeline
  - Not part of Stage 1 fix validation

---

## Critical Issues Identified

### Issue 1: Export Payload Too Large (BLOCKING)

**Status**: ❌ **CRITICAL - BLOCKS ALL EXPORTS >~5 PAGES**

**Symptom**:
- Test 2 (10-page) failed with PayloadTooLargeError at POST /export
- HTML payload 102.6 KB exceeded limit

**Root Cause Located**:
- File: `server/index.js` line 383
- Code: `app.use(express.json());`
- Problem: No limit specified → uses Express default of **100KB**
- Test 2 payload: **102.6 KB** (exceeds default by 2.6 KB)

**Fix Required**:
```javascript
// Current (line 383):
app.use(express.json());

// Should be:
app.use(express.json({ limit: '50mb' })); // Or appropriate size
```

**Impact**: Once fixed, Test 2 PDF export should succeed, allowing PDF validation

---

### Issue 2: "undefinedundefined" Text Still Present

**Status**: ⚠️ **HIGH PRIORITY - USER-FACING GARBAGE TEXT**

**Symptom**:
- Frontend refresh shows "undefinedundefined" text in rendered ebook (Test 2)
- Indicates sanitization not fully effective

**Sanitization Implementation Found**:
- **Location 1**: `server/batchOptimization/BatchOptimizationService.js`
  - Method: `_parseBatchResponse()` (lines 420-550+)
  - Parses batch response into individual pages
  - Converts response text to string: `String(response)`
  - No explicit sanitization at this level

- **Location 2**: `server/batchOptimization/ebookServiceAdapter.js`
  - Method: `sanitizeChapter()` (lines 18-41)
  - Removes undefined fields from chapter objects
  - Ensures all text fields have valid defaults
  - Applied to all chapters after assembly

**Investigation Path**:
1. Check if `_parseBatchResponse()` in BatchOptimizationService properly extracts page content
2. Verify all page strings returned are valid (no undefined values being stringified)
3. Confirm `sanitizeChapter()` in ebookServiceAdapter is removing all undefined fields
4. Trace the flow: BatchOptimizationService pages → ebookServiceAdapter sanitization → final output

**Possible Root Causes**:
- Page content extraction from batch response returning undefined
- Undefined values being converted to string "undefined"
- Sanitization not catching all text field variations
- Page splitting logic in `_parseBatchResponse()` failing to extract content

---

### Issue 3: Model Query Counter Not Incrementing

**Status**: ⚠️ **MEDIUM PRIORITY - COSMETIC/TRACKING ISSUE**

**Symptom**:
- All batch API calls logged as "Call 1" instead of incrementing
- Test 1: 3 batch calls all show `[QUOTA] Call 1`
- Test 2: 4 batch calls all show `[QUOTA] Call 1`

**Investigation Path**:
1. Check how QUOTA counter is initialized in batch generation
2. Verify counter incremented between API calls
3. Likely issue: Counter state not persisting across batch iterations
4. Check `aiService.generateContentWithRotation()` call counter logic

**Where to Look**:
- `server/batchOptimization/BatchOptimizationService.js` calls `aiService.generateContentWithRotation()`
- Need to verify how callIndex parameter affects quota tracking

---

## Investigation Priority Order

### Priority 1: Fix Export Payload Size (UNBLOCK TESTING)
- **File to change**: `server/index.js` line 383
- **Change**: Add limit parameter to express.json()
- **Expected outcome**: Test 2 PDF export succeeds
- **Effort**: 1-2 minutes
- **Blocker for**: All subsequent validation

### Priority 2: Debug "undefinedundefined" Persistence
- **Files to investigate**: 
  - `server/batchOptimization/BatchOptimizationService.js` (`_parseBatchResponse()`)
  - `server/batchOptimization/ebookServiceAdapter.js` (`sanitizeChapter()`)
- **Debug approach**: Add logging to trace page content extraction and sanitization
- **Expected outcome**: Identify where undefined values are being generated or not sanitized
- **Effort**: 30-60 minutes

### Priority 3: Understand Batch Generation Flow
- **File to review**: `server/batchOptimization/BatchOptimizationService.js`
- **Focus**: Verify all text fields properly propagate from generation to output
- **Related to**: Issue 3 (QUOTA counter) and Issue 2 ("undefinedundefined")
- **Effort**: 20-30 minutes (understanding code flow)

### Priority 4: Fix QUOTA Counter (if needed)
- **Impact**: Cosmetic - doesn't affect functionality, only monitoring
- **Can defer**: After Issues 1-2 are resolved
- **Effort**: 15-30 minutes once root cause identified

---

## Next Steps

1. **Immediate**: Fix export payload limit in `server/index.js`
2. **Re-run Test 2**: Verify PDF export succeeds with increased limit
3. **Debug Issue 2**: Add logging to trace "undefinedundefined" origin
4. **Validate Stage 1**: Confirm chapters 2, 5, 8 no longer empty/garbage
5. **Run Test 3 (20-page)**: Validate fix works across ebook size range
6. **Document results**: Update QA tracking document

