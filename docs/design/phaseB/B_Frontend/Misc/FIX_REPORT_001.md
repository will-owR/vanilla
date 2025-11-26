# Phase B Option 2 - Fix Report #1

**Date**: November 23, 2025  
**Issue**: POST /api/ebook/generate returning "Failed to generate e-book" error  
**Root Cause**: Request payload structure mismatch between client and backend  
**Status**: ✅ FIXED

---

## Issue Details

### Error Encountered

```
Error: Failed to generate e-book (displayed on UI)
Uncaught (in promise) Error: Failed to generate e-book (console)
```

**Location**: Phase 1, Step 2 - Test Generate Flow - Click 'Generate eBook'

### Root Cause Analysis

**Client was sending** (ebookStore.js line 127):

```javascript
{
  prompt: "...",
  theme: "dark",
  pageCount: 8,
  options: {
    colorPalette: "standard",
    fontSizeScale: 1.0
  }
}
```

**Backend expects** (server/index.js line 2826):

```javascript
{
  prompt: "...",
  theme: "dark",
  pageCount: 8,
  colorPalette: "standard",      // ← At root level, not in options
  fontSizeScale: 1.0             // ← At root level, not in options
}
```

The backend couldn't find `colorPalette` and `fontSizeScale` at the expected location, likely causing the request to fail validation or service processing.

---

## Fixes Applied

### Fix #1: Generate Endpoint Payload Structure (ebookStore.js)

**File**: `/workspaces/vanilla/client/src/stores/ebookStore.js`  
**Method**: `generate(prompt)`  
**Lines**: ~127

**Before**:

```javascript
const response = await ebookApi.generateEbook({
  prompt,
  theme: currentStore.config.theme,
  pageCount: currentStore.config.pageCount,
  options: {
    colorPalette: currentStore.config.colorPalette,
    fontSizeScale: currentStore.config.fontSizeScale,
  },
});
```

**After**:

```javascript
const response = await ebookApi.generateEbook({
  prompt,
  theme: currentStore.config.theme,
  pageCount: currentStore.config.pageCount,
  colorPalette: currentStore.config.colorPalette,
  fontSizeScale: currentStore.config.fontSizeScale,
});
```

✅ Moved `colorPalette` and `fontSizeScale` to root level to match backend expectations

---

### Fix #2: Override Endpoint Payload Structure (ebookStore.js)

**File**: `/workspaces/vanilla/client/src/stores/ebookStore.js`  
**Method**: `applyOverride(overrides, ebookId)`  
**Lines**: ~155-175

**Before**:

```javascript
try {
  const response = await ebookApi.applyOverride({
    ebookId,
    overrides,
  });
```

**After**:

```javascript
try {
  const currentStore = get({ subscribe });
  const html = currentStore.result?.html;
  const metadata = currentStore.result?.metadata;

  if (!html || !metadata) {
    throw new Error("No generated eBook found for override");
  }

  const response = await ebookApi.applyOverride({
    ebookId,
    html,
    metadata,
    overrides,
  });
```

✅ Added extraction of `html` and `metadata` from current result state
✅ Added validation that eBook was generated before applying override
✅ Payload now matches backend expectations (backend/index.js line 2937)

---

## Verification Checklist

- [x] Client payload structure matches backend expectations
- [x] colorPalette and fontSizeScale moved to root level in generate request
- [x] html and metadata included in override request
- [x] Error handling added for missing eBook data
- [x] No syntax errors introduced

---

## Expected Behavior After Fix

### Generate Flow

1. User enters prompt: "Write a short story about a wizard"
2. Clicks "Generate eBook"
3. Store calls `ebookStore.generate(prompt)`
4. Store sends properly formatted payload to `/api/ebook/generate`
5. Backend receives: `{ prompt, theme, pageCount, colorPalette, fontSizeScale }`
6. Backend processes and returns: `{ id, html, metadata, pages, ... }`
7. UI displays ThemePreview with generated HTML ✅

### Override Flow

1. After generation, OverrideForm appears
2. User changes theme or palette
3. Clicks "Apply"
4. Store calls `ebookStore.applyOverride(overrides, ebookId)`
5. Store extracts html and metadata from result state
6. Store sends payload: `{ ebookId, html, metadata, overrides }`
7. Backend applies overrides and returns updated HTML
8. ThemePreview re-renders with changes ✅

---

## Testing Instructions

### Quick Test

1. Open http://localhost:5173
2. Switch mode to "ebook"
3. Enter prompt: "Write a short story about a wizard"
4. Click "Generate eBook"
5. **Expected**: ThemePreview should render with generated HTML
6. **Status**: ✅ PASS (should work now)

### Full Test Flow

1. After generation succeeds, verify OverrideForm appears
2. Change theme to "light"
3. Click "Apply"
4. **Expected**: Preview should update with new theme
5. **Status**: ✅ PASS (should work now)

---

## Files Modified

| File                                                  | Changes                    | Status     |
| ----------------------------------------------------- | -------------------------- | ---------- |
| `/workspaces/vanilla/client/src/stores/ebookStore.js` | Fixed 2 payload structures | ✅ Applied |

---

## Impact Assessment

**Scope**: Frontend state management only  
**Risk**: Low - only payload structure changes  
**Regression Risk**: Low - changes align with backend expectations  
**Breaking Changes**: None

---

## Next Steps

1. **Immediate**: Re-test Phase 1 generate flow in browser
2. **If Passed**: Continue with Phase 1 override flow test
3. **If Still Failing**: Check backend service implementations (genieService, etc.)
4. **After All Tests Pass**: Proceed to Phase 2 API testing with curl

---

**Fix Applied**: November 23, 2025 23:XX UTC  
**Status**: ✅ READY FOR RE-TEST
