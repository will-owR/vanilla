# Phase 1 Testing - Quick Start Guide

## 30-Second Setup

1. **Open browser**: http://localhost:5173
2. **Open DevTools**: Press F12
3. **Switch to Network tab**: Click "Network" at top
4. **Switch to ebook mode**: Look for mode selector in UI
5. **You're ready!**

---

## The Basic Flow (3 clicks)

### Click 1: Generate

1. Enter prompt: "A fairy tale about a brave princess"
2. Click "Generate eBook"
3. **Watch**: Network tab should show POST `/api/ebook/generate` → Status **200**
4. **Expect**: Preview updates with styled content

### Click 2: Change Theme

1. Click theme selector → Choose "light"
2. **Watch**: Preview updates immediately (no network request)

### Click 3: Apply Override

1. Click "Apply" button to apply the override
2. **Watch**: Network tab shows POST `/api/override` → Status **200**
3. **Expect**: Preview updates with new theme colors

---

## What to Look For

### ✅ Success Signs

- **Green 200 status** in Network tab
- **Preview updates** with styled HTML
- **No error messages** in Console (F12 → Console)
- **Clean text** (no red errors)
- **Response completes in < 30 seconds**

### ❌ Problem Signs

- **Red 4xx/5xx status** in Network tab
- **Preview stays blank** after generate
- **Red error messages** in Console
- **Timeout after 30 seconds**
- **"undefined" or "null" errors**

---

## Quick Validation Checklist

| Item            | Check                            | Pass? |
| --------------- | -------------------------------- | ----- |
| Frontend loads  | http://localhost:5173 accessible | ✓/✗   |
| Phase B shows   | ebook mode has form              | ✓/✗   |
| Generate works  | POST returns 200                 | ✓/✗   |
| Preview renders | HTML displays in preview         | ✓/✗   |
| Override works  | Apply returns 200                | ✓/✗   |
| Console clean   | No red errors                    | ✓/✗   |
| **ALL PASS?**   | If all ✓                         | ✅    |

---

## Troubleshooting

### Issue: "Cannot GET /"

**Solution**: Frontend not running. Run `npm run dev` in client folder

### Issue: Network request fails with 500

**Solution**: Backend error. Check backend console for error message

### Issue: Preview stays blank

**Solution**: Check if HTML response is being returned. Look at Network tab response body

### Issue: Console shows "ebookStore is undefined"

**Solution**: ebookStore not imported. Check imports in App.svelte

### Issue: Timeout at 30 seconds

**Solution**: Backend slow. Either:

- Generate is processing (this is OK, let it finish)
- Backend crash (check backend logs)
- Network issue (try again)

---

## Network Tab Pro Tips

1. **Filter to see only relevant requests**:

   - Click filter icon
   - Type: `api`
   - Shows only API calls

2. **View request body**:

   - Click the request
   - Click "Request" tab
   - See what client sent

3. **View response body**:

   - Click the request
   - Click "Response" tab
   - See what server returned

4. **See timing**:
   - Look at "Time" column
   - Should be < 30 seconds for generate

---

## Test Variations (Optional)

### Theme Test (2 min)

```
Dark → light → corporate → bold
Check: colors change each time
```

### Page Count Test (2 min)

```
Set to 3 → 8 → 20 pages
Check: density changes in metadata
```

### Error Test (2 min)

```
Leave prompt empty → click Generate
Check: error message appears
```

---

## Success Criteria

✅ **Phase 1 Complete When**:

1. Generate request returns 200
2. Response has `id`, `html`, `metadata`, `pages`
3. Preview renders with styled content
4. Override request returns 200
5. No red errors in Console
6. All 4 themes work
7. Page counts 3-20 work

**If all above** → Phase 1 ✅ **PASS**

---

## Time Estimate

| Task                  | Time          |
| --------------------- | ------------- |
| Setup (F12, DevTools) | 1 min         |
| Generate test         | 5 min         |
| Override test         | 3 min         |
| Error test            | 2 min         |
| Theme variations      | 5 min         |
| Page count variations | 5 min         |
| Console check         | 2 min         |
| **Total**             | **20-25 min** |

---

## One-Liner Commands for Backend

### Check if backend is running:

```bash
curl http://localhost:3000/health
```

### Check if frontend is running:

```bash
curl http://localhost:5173
```

### View backend logs:

```bash
# In server terminal, look for recent logs
```

---

## Test Data You Can Use

### Short Prompt:

```
Write a recipe for chocolate cake
```

### Medium Prompt:

```
Explain the solar system including planets, moons, asteroids, and comets
```

### Long Prompt:

```
Create a detailed guide for learning programming, including topics like variables,
functions, loops, object-oriented programming, design patterns, testing, deployment,
and best practices. Include practical examples for each topic.
```

---

## What Each Theme Should Look Like

| Theme     | Background      | Text                | Accents          |
| --------- | --------------- | ------------------- | ---------------- |
| Dark      | Black (#1a1a1a) | White               | Cyan (#00d4ff)   |
| Light     | White (#ffffff) | Black (#333)        | Blue (#0066cc)   |
| Corporate | Gray (#f5f5f5)  | Dark gray (#2c3e50) | Blue (#003d82)   |
| Bold      | Black           | Yellow (#ffff00)    | Orange (#ff6b35) |

---

## Remember

- DevTools (F12) is your best friend
- Network tab shows all requests/responses
- Console shows all errors
- Right-click → Inspect element to see HTML
- Slow networks are OK (might be 10-30 seconds)
- Empty prompts will error (this is correct)

---

## You're All Set! 🚀

**Next**: Open http://localhost:5173 and start testing!

**Questions?** Refer to `PHASE1_BROWSER_TESTING.md` for detailed guide.

**Ready?** Let's go! ✅
