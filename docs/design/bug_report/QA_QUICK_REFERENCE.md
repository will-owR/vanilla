# QA Testing Quick Reference - Fresh Start Session

**Date**: December 5, 2025  
**Status**: READY TO TEST  
**Frontend**: http://localhost:5173  
**Backend**: http://localhost:3000  

---

## The Bug (In 30 Seconds)

**Problem**: 10-page ebook generation was BROKEN
- Chapters 2, 5, 8 completely EMPTY (missing content)
- Chapters 3, 4, 6, 7, 9 had garbage "undefinedundefined" text
- Only 2 chapters (1, 10) were clean = 80% content loss

**Fix Applied**: Three solutions implemented
- Reorder chapters from batch response
- Sanitize undefined fields
- Defensive sort by chapter number

**What We're Testing Today**: Does the fix actually work?

---

## Test Execution Flow

### Before Starting

```bash
cd /workspaces/Aether
# Verify backend is running
curl http://localhost:3000/health | jq .status
# Should see: "ok"

# Verify frontend is running
curl -s http://localhost:5173 | head -1
# Should see: "<!DOCTYPE html>"
```

### Test 1: 3-Page (Quick Baseline)

| Step | Action | Expected | Check |
|------|--------|----------|-------|
| 1 | Open http://localhost:5173 | App loads | Browser shows UI |
| 2 | Click mode "eBook Prompt → Book" | Mode switches | Button highlights |
| 3 | Paste prompt | Text appears | Textarea filled |
| 4 | Click "Generate eBook" | Generation starts | "Generating..." shows |
| 5 | Wait ~2-3 minutes | Generation completes | Result displays |
| 6 | DevTools: Ctrl+F "undefinedundefined" | Not found | 0 matches |
| 7 | Count chapters | 3 chapters | All 3 present |
| 8 | Click "Export as PDF" | PDF downloads | File appears |
| 9 | Open PDF | Readable 3-pager | All chapters visible |

**Status**: [ ] PASS / [ ] FAIL

---

### Test 2: 10-Page (PRIMARY VALIDATION)

**THIS IS THE KEY TEST** - If this passes, fix is proven working

| Step | Action | Expected | Check |
|------|--------|----------|-------|
| 1 | Refresh browser | Clean slate | Page reloads |
| 2 | Enter 10-page prompt | Text appears | Textarea filled |
| 3 | Click "Generate eBook" | Generation starts | "Generating..." shows |
| 4 | Wait ~3-5 minutes | Generation completes | Result displays |
| 5 | DevTools: Ctrl+F "undefinedundefined" | **0 matches** (was 5) | **✅ FIX WORKS IF 0** |
| 6 | Count chapters | **10 chapters** (was 7) | All 10 present |
| 7 | Verify Ch2 has content | **NOT EMPTY** (was empty) | **✅ FIX WORKS IF FULL** |
| 8 | Verify Ch5 has content | **NOT EMPTY** (was empty) | **✅ FIX WORKS IF FULL** |
| 9 | Verify Ch8 has content | **NOT EMPTY** (was empty) | **✅ FIX WORKS IF FULL** |
| 10 | Click "Export as PDF" | PDF downloads | File appears |
| 11 | Open PDF | Readable 10-pager | All 10 chapters, no blanks |

**Status**: [ ] PASS / [ ] FAIL

**If Step 5-9 are all PASS, then FIX IS CONFIRMED WORKING** ✅

---

### Test 3: 20-Page (Stress Test - Optional)

| Step | Action | Expected | Check |
|------|--------|----------|-------|
| 1 | Refresh browser | Clean slate | Page reloads |
| 2 | Enter 20-page prompt | Text appears | Textarea filled |
| 3 | Click "Generate eBook" | Generation starts | "Generating..." shows |
| 4 | Wait ~5-10 minutes | Generation completes | Result displays |
| 5 | DevTools: Ctrl+F "undefinedundefined" | 0 matches | No garbage text |
| 6 | Count chapters | 20 chapters | All 20 present |
| 7 | Check batch boundaries | Ch3,6,9,12,15,18 not empty | All have content |
| 8 | Export to PDF | PDF downloads | File appears |
| 9 | Open PDF | Readable 20-pager | All chapters, no blanks |

**Status**: [ ] PASS / [ ] FAIL / [ ] SKIP

---

## Prompts Ready to Copy

### 3-Page Prompt
```
A children's mystery tale about a blind mouse detective in Mouse-town.
```

### 10-Page Prompt  
```
An epic fantasy quest with ten distinct adventures, challenges, and triumphs, each more intense than the last
```

### 20-Page Prompt
```
A comprehensive guide through twenty challenging trials and triumphs
```

---

## Critical Validation Checks

### ✅ Garbage Text Check (Most Important)

**DevTools**: Ctrl+F "undefinedundefined"

| Result | Meaning | Fix Status |
|--------|---------|-----------|
| **0 matches** | ✅ PASS - Text not found | Fix working |
| **N > 0 matches** | ❌ FAIL - Garbage text present | Fix not working |

**Baseline Comparison**:
- 3-page: Had 0 → Should still be 0
- 10-page: Had 5 → Must now be 0 (critical!)
- 20-page: Estimated ~10 → Should be 0

---

### ✅ Missing Chapter Check

**In Browser**: Count visible chapters

| Test | Expected | Previous Baseline | Critical? |
|------|----------|------------------|-----------|
| 3-page | 3 chapters | 3 ✅ | No - baseline good |
| 10-page | **10 chapters** (esp Ch2,5,8) | 7 ❌ (missing 2,5,8) | **YES - THIS VALIDATES FIX** |
| 20-page | 20 chapters | Unknown | Helpful |

**How to Check**:
1. Open DevTools > Elements
2. Search for `<h2>` or `<h3>` (chapter headers)
3. Count matches
4. Verify chapters numbered 1, 2, 3... (not out of order)

---

### ✅ PDF Export Check

**After Export**:
1. Open PDF in reader
2. Verify chapter count matches HTML
3. Verify no blank pages (especially Ch2, 5, 8 in 10-page test)
4. Verify all text readable

---

## Logging to Watch

### Enable Debug Logging

```bash
# Server should be running with:
DEBUG_BATCH=1 npm run dev
```

### Key Log Lines to Spot

```
[BatchOptimization] Generated X chapters with YYYYms total latency
[DEBUG_BATCH] Before reordering: [1, 4, 2, 3]  ← Out of order
[DEBUG_BATCH] After reordering: [1, 2, 3, 4]  ← Fixed order
[DEBUG_BATCH] Final chapters (sanitized & sorted): 1,2,3,4,5,6,7,8,9,10
[COMPOSE] HTML generation complete, length: XXXXX
```

If you see these logs → Batch optimization is working!

---

## Troubleshooting Quick Guide

| Problem | Solution |
|---------|----------|
| Frontend blank page | Refresh: Ctrl+Shift+R (hard refresh) |
| Generation not starting | Check network tab for errors |
| Generation stuck | Wait longer (large ebooks take 5-10 min) or check server logs |
| PDF won't download | Check if browser blocked popup/download |
| PDF won't open | Try different PDF reader |
| Server errors in console | Check server terminal for error messages |

---

## Success Criteria Summary

**For Fix to be VALID**:

✅ **Test 2 (10-page) MUST show ALL of these**:
1. Chapters 2, 5, 8 are NOT empty (have real content)
2. Zero "undefinedundefined" text (was 5 instances)
3. All 10 chapters present and in order (1-10)
4. PDF exports with all chapters visible

If all 4 are true → **FIX IS VALIDATED** ✅

If any are false → **FIX NEEDS MORE WORK** ❌

---

## Document References

- **Full Test Plan**: `docs/design/QA_TESTING_RESULTS_FRESH_START.md`
- **Recap**: `docs/design/QA_RECAP_FRESH_START.md`
- **Bug Details**: `docs/design/bug_report/BUG_CHAPTER_MISALIGNMENT_BATCH.md`
- **Fix Details**: `docs/design/bug_report/BUG_FIX_CHAPTER_MISALIGNMENT.md`
- **Baseline Results**: `docs/design/QA_TESTING_RESULTS_baseline.md` (for comparison)

---

## Ready?

1. ✅ Application is running (both frontend and backend)
2. ✅ You have test prompts ready
3. ✅ You know what to look for (missing chapters, garbage text)
4. ✅ You have validation criteria

**Open http://localhost:5173 and start Test 1!** 🚀
