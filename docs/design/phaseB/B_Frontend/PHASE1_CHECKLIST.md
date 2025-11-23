# Phase 1 Browser Testing - Quick Checklist

**Date**: November 23, 2025  
**Tester**: [Your Name]  
**Start Time**: ****\_\_\_****  
**End Time**: ****\_\_\_****

---

## PRE-TEST SETUP

- [ ] Backend running on http://localhost:3000
- [ ] Frontend running on http://localhost:5173
- [ ] Browser DevTools open (F12)
- [ ] Network tab visible and recording
- [ ] Console tab visible and monitoring
- [ ] Both windows visible side-by-side (DevTools on right)

---

## TEST 1: UI Components Appear

**After switching to ebook mode:**

- [ ] Theme Selector visible (dark, light, corporate, bold)
- [ ] Page Count Slider visible (3-20 range)
- [ ] Prompt Input Field visible and clickable
- [ ] Generate eBook Button visible
- [ ] Override Form NOT visible yet (hidden until generation)
- [ ] Theme Preview area visible but empty

**Notes**: ******************************\_\_\_******************************

---

## TEST 2: Generate eBook - Happy Path

**Prompt entered**: Write a short story about a wizard discovering a hidden library

**Generate button clicked**: ****\_\_\_****

| Check                      | Expected                                 | Actual | ✓/✗ |
| -------------------------- | ---------------------------------------- | ------ | --- |
| Loading message appears    | "Generating eBook..."                    |        |     |
| Network tab shows POST     | /api/ebook/generate                      |        |     |
| Request method             | POST                                     |        |     |
| Request URL                | http://localhost:3000/api/ebook/generate |        |     |
| Request status             | 200 OK                                   |        |     |
| Response time              | < 30 seconds                             |        |     |
| Loading message disappears | Yes                                      |        |     |
| No error message           | Correct                                  |        |     |
| Override Form appears      | Visible                                  |        |     |
| Theme Preview shows HTML   | Styled content visible                   |        |     |
| Console: No errors         | ✓                                        |        |     |

**Network Response Structure**:

```json
{
  "id": "_______________"
  "content": "Present? ✓ / ✗"
  "html": "Valid HTML? ✓ / ✗"
  "metadata": {
    "title": "_______________"
    "theme": "_______________"
    "pageCount": "_______________"
    "density": "_______________"
  },
  "pages": "Array? ✓ / ✗"
  "can_export": "_______________"
  "can_override": "_______________"
}
```

**Notes**: ******************************\_\_\_******************************

---

## TEST 3: Theme Override

### Sub-test 3.1: Change Theme

**Action**: Set theme selector to "light"

- [ ] Preview updates immediately
- [ ] Background becomes white/light
- [ ] Text becomes dark
- [ ] No network request yet

### Sub-test 3.2: Change Color Palette

**Action**: Select "vibrant" palette

- [ ] Preview colors change
- [ ] Accents become more vibrant
- [ ] No network request yet

### Sub-test 3.3: Adjust Font Size

**Action**: Move font scale to 1.2

- [ ] Text in preview appears larger
- [ ] No network request yet

### Sub-test 3.4: Apply Overrides

**Action**: Click "Apply" button

| Check              | Expected            | Actual | ✓/✗ |
| ------------------ | ------------------- | ------ | --- |
| Loading message    | "Applying..."       |        |     |
| POST request made  | /api/override       |        |     |
| Request status     | 200 OK              |        |     |
| Response time      | < 10 seconds        |        |     |
| Loading disappears | Yes                 |        |     |
| Preview updates    | New styling visible |        |     |
| No errors          | Clean console       |        |     |

**Notes**: ******************************\_\_\_******************************

---

## TEST 4: Error Handling

### Sub-test 4.1: Empty Prompt

**Action**: Clear prompt and click Generate

| Check           | Expected                 | Actual | ✓/✗ |
| --------------- | ------------------------ | ------ | --- |
| Error message   | "Prompt cannot be empty" |        |     |
| No POST request | Network tab empty        |        |     |
| Console error   | Validation error shown   |        |     |

### Sub-test 4.2: Very Long Prompt

**Action**: Paste 2000+ character prompt and generate

| Check               | Expected     | Actual | ✓/✗ |
| ------------------- | ------------ | ------ | --- |
| Generation succeeds | Status 200   |        |     |
| Response valid      | HTML present |        |     |
| Time < 30s          | Completes    |        |     |

### Sub-test 4.3: Network Timeout (Optional)

**Action**: Enable "Slow 3G" throttling and generate

| Check                         | Expected         | Actual | ✓/✗ |
| ----------------------------- | ---------------- | ------ | --- |
| Request takes time            | Visible delay    |        |     |
| Either completes or times out | One or other     |        |     |
| Error handled gracefully      | UI shows message |        |     |

**Notes**: ******************************\_\_\_******************************

---

## TEST 5: Theme Variations

### Dark Theme

**Action**: Set theme="dark", Generate

| Check                  | Expected          | Actual | ✓/✗ |
| ---------------------- | ----------------- | ------ | --- |
| BG color               | Very dark (black) |        |     |
| Text color             | White/light gray  |        |     |
| Accents                | Cyan/blue         |        |     |
| Generates successfully | Status 200        |        |     |

### Light Theme

**Action**: Set theme="light", Generate

| Check                  | Expected    | Actual | ✓/✗ |
| ---------------------- | ----------- | ------ | --- |
| BG color               | White/light |        |     |
| Text color             | Very dark   |        |     |
| Accents                | Blue        |        |     |
| Generates successfully | Status 200  |        |     |

### Corporate Theme

**Action**: Set theme="corporate", Generate

| Check                  | Expected          | Actual | ✓/✗ |
| ---------------------- | ----------------- | ------ | --- |
| BG color               | Light gray        |        |     |
| Text color             | Dark gray         |        |     |
| Accents                | Professional blue |        |     |
| Generates successfully | Status 200        |        |     |

### Bold Theme

**Action**: Set theme="bold", Generate

| Check                  | Expected          | Actual | ✓/✗ |
| ---------------------- | ----------------- | ------ | --- |
| BG color               | Black             |        |     |
| Text color             | Bright yellow     |        |     |
| Accents                | Bright red/orange |        |     |
| High contrast          | Yes               |        |     |
| Generates successfully | Status 200        |        |     |

**Notes**: ******************************\_\_\_******************************

---

## TEST 6: Page Count Variations

### Low Count (3 pages)

**Action**: Page count = 3, Generate

| Check    | Expected   | Actual | ✓/✗ |
| -------- | ---------- | ------ | --- |
| Density  | "light"    |        |     |
| Chapters | Few        |        |     |
| Success  | Status 200 |        |     |

### Medium Count (8 pages)

**Action**: Page count = 8, Generate

| Check    | Expected   | Actual | ✓/✗ |
| -------- | ---------- | ------ | --- |
| Density  | "medium"   |        |     |
| Chapters | Moderate   |        |     |
| Success  | Status 200 |        |     |

### High Count (20 pages)

**Action**: Page count = 20, Generate

| Check    | Expected   | Actual | ✓/✗ |
| -------- | ---------- | ------ | --- |
| Density  | "dense"    |        |     |
| Chapters | Many       |        |     |
| Success  | Status 200 |        |     |

**Notes**: ******************************\_\_\_******************************

---

## TEST 7: Console Validation

**Throughout all tests, check console for:**

- [ ] No red error messages
- [ ] No undefined references
- [ ] No warnings about missing properties
- [ ] Generation success logs (if any)

**Any errors found?**: ✓ None / ✗ Yes

**If errors**: ****************************\_\_\_****************************

---

---

## FINAL VALIDATION

### Response Structure Checks

After each generation, verify response has:

| Field        | Required | Present | Type    | Sample Value |
| ------------ | -------- | ------- | ------- | ------------ |
| id           | ✓        | ✓/✗     | string  | "ebook\_..." |
| content      | ✓        | ✓/✗     | string  | "Content..." |
| html         | ✓        | ✓/✗     | string  | "<html>..."  |
| metadata     | ✓        | ✓/✗     | object  | {...}        |
| pages        | ✓        | ✓/✗     | array   | [...]        |
| can_export   | ✓        | ✓/✗     | boolean | true         |
| can_override | ✓        | ✓/✗     | boolean | true         |

### Metadata Structure Checks

| Field     | Expected                  | Sample                    |
| --------- | ------------------------- | ------------------------- |
| title     | Non-empty string          | "Ebook: Write a short..." |
| author    | "Aether AI"               | "Aether AI"               |
| theme     | dark/light/corporate/bold | "dark"                    |
| pageCount | 3-20                      | 8                         |
| density   | light/medium/dense        | "medium"                  |

---

## ISSUES FOUND

### Issue 1:

**Title**: ****************************\_\_\_****************************

**When**: ****************************\_\_\_****************************

**Expected**: **************************\_\_\_**************************

**Actual**: ****************************\_****************************

**Error**: ****************************\_\_****************************

**Severity**: [ ] Critical [ ] Blocker [ ] Minor [ ] UI

---

### Issue 2:

**Title**: ****************************\_\_\_****************************

**When**: ****************************\_\_\_****************************

**Expected**: **************************\_\_\_**************************

**Actual**: ****************************\_****************************

**Error**: ****************************\_\_****************************

**Severity**: [ ] Critical [ ] Blocker [ ] Minor [ ] UI

---

## SUMMARY

**Total Tests Executed**: **\_\_\_\_**

**Tests Passed**: **\_\_\_\_** ✓

**Tests Failed**: **\_\_\_\_** ✗

**Issues Found**: **\_\_\_\_**

**Overall Result**:

- [ ] ✅ **PASS** - All tests passed, no blockers
- [ ] ⚠️ **PASS WITH ISSUES** - Tests passed, minor issues found
- [ ] ❌ **FAIL** - Critical issues found, tests blocked

**Tester Signature**: ************\_************ **Date**: ****\_****

---

## NOTES

General observations and additional comments:

---

---

---

---

---

## NEXT STEPS

After completing this checklist:

1. [ ] Review all ✓/✗ marks
2. [ ] Document any ✗ issues above
3. [ ] Photo/screenshot of any visual issues
4. [ ] Compare results with expected outcomes in PHASE1_BROWSER_TESTING.md
5. [ ] If all ✓: **PHASE 1 COMPLETE** ✅
6. [ ] If issues: Create GitHub issue with details

**Ready to proceed to Phase 2 API Testing?**: [ ] Yes [ ] No (Fix issues first)
