# Phase 1: Manual Browser Testing - Complete Guide

**Date**: November 23, 2025
**Status**: Ready to Execute
**Test Type**: End-to-End Browser Testing (Critical Path)
**Expected Duration**: 30-45 minutes

---

## Setup Instructions

### Step 1: Verify Servers Are Running

**Backend Server (Node.js)**:

```bash
# Check if running on port 3000
curl http://localhost:3000/health

# Expected response: { "status": "ok" }
```

**Frontend Server (Vite)**:

```bash
# Check if running on port 5173
curl http://localhost:5173

# Expected response: HTML page loads
```

### Step 2: Open Browser Developer Tools

1. Open http://localhost:5173 in your browser
2. Press **F12** to open Developer Tools
3. Click on **Network** tab
4. Enable **Request logging** (should be on by default)
5. Click on **Console** tab to watch for errors
6. Pin DevTools to the right side for easier viewing

---

## Test 1: Generate eBook Flow

### 1.1 Verify Phase B UI Appears

**Steps**:

1. Navigate to http://localhost:5173
2. Look for a **mode selector** or similar UI element
3. Switch mode to **"ebook"** (or check if already in ebook mode)
4. Verify the following components appear:
   - [ ] Theme Selector (dropdown or buttons showing: dark, light, corporate, bold)
   - [ ] Page Count Slider (showing 3-20 range)
   - [ ] Prompt Input Field
   - [ ] Generate eBook Button
   - [ ] Override Form (may be hidden initially)
   - [ ] Theme Preview (may be empty initially)

**Expected**: Phase B section displays all 6 components

**If fails**: Check browser Console (F12) for errors starting with "ebookStore" or "Phase B"

---

### 1.2 Enter Prompt and Generate

**Steps**:

1. Click on the Prompt Input Field
2. Enter a test prompt:
   ```
   Write a short story about a wizard discovering a hidden library in an ancient forest
   ```
3. Open the **Network** tab (F12 → Network)
4. Click the **"Generate eBook"** button
5. Watch the Network tab

**Network Validation**:

- [ ] Loading message appears ("Generating eBook...")
- [ ] POST request to `/api/ebook/generate` is visible in Network tab
- [ ] Request shows:
  - Method: **POST**
  - URL: `http://localhost:3000/api/ebook/generate`
  - Status: **200** (should complete within 30 seconds)
  - Response size: > 1KB (contains HTML and metadata)

**Response Validation**:

1. In Network tab, click on the `/api/ebook/generate` request
2. Click the **Response** tab
3. Verify response contains:
   ```json
   {
     "id": "...",
     "content": "...",
     "html": "<html>...</html>",
     "metadata": {
       "title": "...",
       "theme": "dark",
       "pageCount": 8,
       ...
     },
     "pages": [...],
     "can_export": true,
     "can_override": true
   }
   ```

**UI Validation After Generation**:

- [ ] Loading message disappears
- [ ] No error message appears
- [ ] Theme Preview becomes visible
- [ ] Preview displays rendered HTML (styled page content)
- [ ] Override Form becomes visible

**Browser Console**:

- [ ] No errors or warnings
- [ ] If any errors, note them in the "Issues Found" section

---

## Test 2: Theme Override Flow

### 2.1 Change Theme

**Steps**:

1. In the Theme Selector, click on **"light"** theme
2. Watch the Theme Preview area

**Expected**:

- [ ] Preview updates immediately (light background, dark text)
- [ ] No network request yet (change is local)

### 2.2 Change Color Palette

**Steps**:

1. In the Override Form, adjust the Color Palette
2. Select **"vibrant"** palette
3. Watch the preview

**Expected**:

- [ ] Preview updates with vibrant colors
- [ ] No network request yet

### 2.3 Adjust Font Size

**Steps**:

1. In the Override Form, adjust the Font Size Scale slider
2. Move it to **1.2** (larger text)
3. Watch the preview

**Expected**:

- [ ] Preview text appears larger
- [ ] No network request yet

### 2.4 Apply Overrides

**Steps**:

1. Click **"Apply Overrides"** button (or similar)
2. Watch the Network tab

**Network Validation**:

- [ ] POST request to `/api/override` appears
- [ ] Request status: **200** (should complete within 10 seconds)
- [ ] Response contains updated HTML with new styles

**UI Validation**:

- [ ] Loading message appears during override
- [ ] Loading disappears when complete
- [ ] Theme Preview updates with new styling
- [ ] No error messages

**Browser Console**:

- [ ] No errors

---

## Test 3: Error Handling

### 3.1 Empty Prompt Error

**Steps**:

1. Clear the Prompt Input Field completely
2. Click "Generate eBook"

**Expected**:

- [ ] Error message appears: "Prompt cannot be empty"
- [ ] No POST request is made
- [ ] Browser Console shows validation error

### 3.2 Very Long Prompt

**Steps**:

1. Enter a very long prompt (copy-paste 2000+ characters)
2. Click "Generate eBook"

**Expected**:

- [ ] Generation succeeds (backend should accept long prompts)
- [ ] Request completes within 30 seconds
- [ ] Response is valid HTML

### 3.3 Network Timeout (Optional Advanced Test)

**Steps**:

1. Open DevTools → Network tab
2. Click the **throttling dropdown** (usually shows "No throttling")
3. Select **"Slow 3G"**
4. Click "Generate eBook"
5. Watch the request

**Expected**:

- [ ] Request might take 30+ seconds (or timeout at 30s)
- [ ] If timeout: Error message appears "Request timeout"
- [ ] If succeeds: HTML loads (slowly)

**After test**: Switch throttling back to "No throttling"

---

## Test 4: Theme Variations

Test generation with different themes to verify styling applies correctly.

### 4.1 Dark Theme

**Steps**:

1. Set Theme Selector to **"dark"**
2. Click "Generate eBook"
3. Verify response

**Expected in Preview**:

- [ ] Background: Very dark (near black #1a1a1a)
- [ ] Text: White or very light gray
- [ ] Headings: White or light
- [ ] Accents: Cyan/light blue

### 4.2 Light Theme

**Steps**:

1. Set Theme Selector to **"light"**
2. Click "Generate eBook"

**Expected in Preview**:

- [ ] Background: White or very light
- [ ] Text: Very dark (near black)
- [ ] Headings: Dark
- [ ] Accents: Blue

### 4.3 Corporate Theme

**Steps**:

1. Set Theme Selector to **"corporate"**
2. Click "Generate eBook"

**Expected in Preview**:

- [ ] Background: Light gray (#f5f5f5)
- [ ] Text: Dark gray/charcoal (#2c3e50)
- [ ] Headings: Dark blue
- [ ] Accents: Professional blue tones

### 4.4 Bold Theme

**Steps**:

1. Set Theme Selector to **"bold"**
2. Click "Generate eBook"

**Expected in Preview**:

- [ ] Background: Black
- [ ] Text: Bright yellow
- [ ] Headings: Bright colors (red/orange)
- [ ] High contrast

---

## Test 5: Page Count Variations

Test different page counts to verify density calculation.

### 5.1 Low Page Count (Light Density)

**Steps**:

1. Set Page Count Slider to **3**
2. Click "Generate eBook"
3. Check response metadata

**Expected**:

- [ ] Density in metadata: "light"
- [ ] Layout has minimal chapters
- [ ] HTML renders successfully

### 5.2 Medium Page Count (Standard Density)

**Steps**:

1. Set Page Count Slider to **8**
2. Click "Generate eBook"

**Expected**:

- [ ] Density in metadata: "medium"
- [ ] Reasonable chapter distribution
- [ ] HTML renders successfully

### 5.3 High Page Count (Dense)

**Steps**:

1. Set Page Count Slider to **20**
2. Click "Generate eBook"

**Expected**:

- [ ] Density in metadata: "dense"
- [ ] Many chapters in TOC
- [ ] HTML renders successfully

---

## Test 6: Console Validation

Throughout all tests, keep the **Console** tab open (F12 → Console).

### Expected:

- [ ] No **red error messages**
- [ ] No **warnings** about missing properties
- [ ] No **undefined** references

### If errors appear:

1. Take note of the error message
2. Record the exact text
3. Check if error is from ebookStore, ebookApi, or browser API
4. Document in "Issues Found" section below

---

## Test 7: Response Structure Validation

### After Each Generation:

In Network tab, click the `/api/ebook/generate` response and verify structure:

```json
{
  "id": "string",                           // ✓ Present
  "content": "string",                      // ✓ Present
  "html": "<html>...</html>",               // ✓ HTML content
  "metadata": {
    "title": "string",
    "author": "Aether AI",
    "theme": "dark|light|corporate|bold",   // ✓ Matches selection
    "pageCount": 3-20,                      // ✓ Integer in range
    "density": "light|medium|dense",        // ✓ Calculated correctly
    "wordCount": "number",
    "classification": { ... }               // ✓ If provided
  },
  "pages": [ ... ],                         // ✓ Array
  "can_export": true,                       // ✓ Boolean
  "can_override": true                      // ✓ Boolean
}
```

**Checklist**:

- [ ] All required fields present
- [ ] No null/undefined values (except classification)
- [ ] HTML is valid (starts with `<!DOCTYPE html>`)
- [ ] Metadata matches current config

---

## Checkpoint: Success Criteria

### ✅ Test Complete When:

1. **Generate Flow Works**:

   - [ ] All 3 requests succeeds (generate, theme fetch optional)
   - [ ] Responses are valid JSON with correct structure
   - [ ] UI updates reflect changes
   - [ ] No console errors

2. **Override Flow Works**:

   - [ ] Override request succeeds
   - [ ] Preview updates with new styles
   - [ ] HTML changes apply correctly

3. **Error Handling Works**:

   - [ ] Empty prompt shows error
   - [ ] Long prompts are accepted
   - [ ] Network errors handled gracefully

4. **Theme Variations Work**:

   - [ ] All 4 themes generate valid responses
   - [ ] Preview colors match theme
   - [ ] Styling applies correctly

5. **Console is Clean**:
   - [ ] No red errors
   - [ ] No warnings about undefined
   - [ ] Successful logs show generation complete

---

## Issues Found Template

If you encounter issues, document them here:

### Issue 1: [Title]

**When**: [Steps to reproduce]

**Expected**: [What should happen]

**Actual**: [What actually happened]

**Error Message**: [Full error text from console]

**Screenshot**: [If applicable]

**Status**: [ ] Blocker [ ] Minor

---

## Success Confirmation

When all tests pass, you'll have validated:

✅ Frontend state management (ebookStore)
✅ HTTP client (ebookApi)
✅ Backend endpoints (POST /api/ebook/generate, POST /api/override)
✅ Service orchestration (genieService → ebookService)
✅ Phase B pipeline (6-step process)
✅ UI component wiring
✅ Error handling
✅ Theme system
✅ Response structure

**This confirms the entire Phase B Option 2 flow is working end-to-end.**

---

## Next Steps After Tests Pass

1. **Document Results**: Record any issues found
2. **Fix Issues** (if any): Address blockers and minor issues
3. **Phase 2 Testing**: Run API tests with curl (optional)
4. **Deployment**: Ready for QA/staging environment

---

**Start Time**: [Record when you begin]
**End Time**: [Record when you finish]
**Total Time**: [Duration]
**Result**: ✅ PASS / ⚠️ ISSUES / ❌ FAIL
