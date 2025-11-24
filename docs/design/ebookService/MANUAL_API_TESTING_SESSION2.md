# Manual API Testing - Session 2 Continuation

**Status**: 🟡 Blocked - Gemini API Credentials Issue  
**Date**: 2025-11-24  
**Issue**: Manual API Test 1 returned "Unknown Gemini error" despite proper payload and endpoint setup

---

## Problem Summary

The first manual curl test failed with:

```json
{
  "error": "Failed to generate e-book",
  "details": "Generation failed: Gemini call failed: Unknown Gemini error"
}
```

### Root Cause Analysis

After investigation, the issue is not with the code but with **credentials availability**:

1. **devcontainer.json** uses `${localEnv:GEMINI_API_URL}` and `${localEnv:GEMINI_API_KEY}`
2. These pull from the **HOST machine's environment variables**
3. If not set on the host, they become empty strings in the container
4. When empty, the geminiClient returns "Missing GEMINI API URL or KEY"
5. But somewhere in the API call chain, this was returning "Unknown Gemini error" instead

### Investigation Findings

Updated code to better handle this:

✅ **geminiClient.js**: Enhanced error extraction to detect `{ error: { message } }` structure from Gemini API responses  
✅ **geminiClient.js**: Added debug logging (`DEBUG_GEMINI_API=1`) to see actual API responses  
✅ **server/index.js**: Updated to load both `.env` and `.env.local` files  
✅ **devcontainer.json**: Updated containerEnv to also check for GEMINI credentials  
✅ **Created guides**:

- `/workspaces/strawberry/docs/GEMINI_SETUP.md` - Setup instructions
- `/workspaces/strawberry/server/.env.local.template` - Template for local credentials
- `/workspaces/strawberry/server/test-gemini-credentials.js` - Test script

---

## How to Fix This (For Local Testing)

### Step 1: Set Up Gemini Credentials

**Choose one approach:**

#### Approach A: Environment Variables (Recommended for VS Code Dev Containers)

On your **HOST machine** (not in container), set:

```bash
# macOS/Linux - add to ~/.bashrc or ~/.zshrc:
export GEMINI_API_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
export GEMINI_API_KEY="YOUR_API_KEY_HERE"
export GEMINI_VISION_API_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

# Windows (PowerShell):
[Environment]::SetEnvironmentVariable("GEMINI_API_URL", "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", "User")
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "YOUR_API_KEY_HERE", "User")
[Environment]::SetEnvironmentVariable("GEMINI_VISION_API_URL", "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", "User")
```

Then **restart VS Code**.

#### Approach B: .env.local File (For Local Docker)

Create `/workspaces/strawberry/server/.env.local`:

```bash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
GEMINI_API_KEY=YOUR_API_KEY_HERE
GEMINI_VISION_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
USE_REAL_AI=1
```

### Step 2: Get Your Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key
4. Paste into environment variables above

**Ensure:**

- ✅ Billing is enabled on the Google Cloud project
- ✅ Generative Language API is enabled
- ✅ The API key has no restrictions (or specifically allows Generative Language API)

### Step 3: Verify Credentials Are Loaded

```bash
cd /workspaces/strawberry/server
DEBUG_GEMINI_API=1 node test-gemini-credentials.js
```

Expected output:

```
=== Gemini API Credential Debug ===

Environment Variables:
  GEMINI_API_URL: https://generativelanguage.googleapis.com/...
  GEMINI_API_KEY: SET (length=39)
  USE_REAL_AI: 1
  FORCE_MOCK_AI: (not set)

Required for real AI:
  ✅ Both credentials present

Attempting test API call...
  HTTP Status: 200
  ✅ API Success! Response: API is working
```

If you see "MISSING", credentials are not being loaded.

### Step 4: Restart Server and Re-Test

```bash
# Terminal 1: Start server with debug logging
cd /workspaces/strawberry/server
DEBUG_GEMINI_API=1 npm run dev

# Terminal 2: Run manual test
curl -X POST http://localhost:3000/api/ebook/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A detective story set in Victorian London",
    "theme": "light",
    "pageCount": 3,
    "colorPalette": ["#1a1a1a", "#ffffff", "#d4af37"],
    "fontSizeScale": 1
  }'
```

Expected:

- Response time: 8-15 seconds
- Content: Semantic story about Victorian detective (not mock data)
- Image concepts: Real descriptions (not "Concept 1", "Concept 2")

---

## Troubleshooting

### Issue: "Missing GEMINI API URL or KEY"

**Solution**:

- Check credentials are set: `echo $GEMINI_API_URL` and `echo $GEMINI_API_KEY`
- For Dev Containers: Make sure you restarted VS Code after setting host environment
- For .env.local: Verify file exists at `/workspaces/strawberry/server/.env.local`
- For .env.local: Restart server with `npm run dev`

### Issue: "Gemini call failed: INVALID_ARGUMENT"

**Solution**:

- API key may be invalid or expired
- Try generating a new key in [Google AI Studio](https://aistudio.google.com/app/apikey)
- Verify key format starts with `AIza...` or `ya29...`

### Issue: "Gemini call failed: PERMISSION_DENIED"

**Solution**:

- Billing may not be enabled on Google Cloud project
- Go to Google Cloud Console → Enable Billing
- Or check that API key has permission to use Generative Language API

### Issue: Response still shows mock data

**Solution**:

- Check `FORCE_MOCK_AI` is not set: `echo $FORCE_MOCK_AI`
- Check `USE_REAL_AI` is set to "1": `echo $USE_REAL_AI`
- Server test scripts override with `FORCE_MOCK_AI=1 npm test` - this is intentional
- For real AI testing: Use `npm run dev` (not `npm test`)

### Issue: Server won't start

**Solution**:

- Check server logs: `cd server && npm run dev`
- If you see "EACCES: permission denied", try `npm cache clean --force`
- Check Node.js version: `node -v` (should be 18+)

---

## Next Steps (Once Credentials Work)

### Run All 3 Manual Tests

```bash
# Test 1: Detective story (light theme) - 5-10 seconds
curl -X POST http://localhost:3000/api/ebook/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A detective story set in Victorian London. Include mysterious plot elements.",
    "theme": "light",
    "pageCount": 3,
    "colorPalette": ["#1a1a1a", "#ffffff", "#d4af37"],
    "fontSizeScale": 1
  }'

# Test 2: Adventure (dark theme) - 5-10 seconds
curl -X POST http://localhost:3000/api/ebook/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "An adventure story through a mysterious forest with ancient ruins",
    "theme": "dark",
    "pageCount": 3,
    "colorPalette": ["#2a2a2a", "#f0f0f0", "#4a7c59"],
    "fontSizeScale": 1.1
  }'

# Test 3: Corporate narrative (professional theme)
curl -X POST http://localhost:3000/api/ebook/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Corporate success story about a startup scaling to unicorn status",
    "theme": "professional",
    "pageCount": 3,
    "colorPalette": ["#1e3a8a", "#e0e7ff", "#1e40af"],
    "fontSizeScale": 0.95
  }'
```

### Document Results in design/ebookService/TEST_RESULTS_SESSION2.md

For each test, record:

- ✅ Response time
- ✅ Content quality (semantic vs mock)
- ✅ Image concepts (specific vs generic)
- ✅ Formatting/structure

### Proceed to Browser Testing

Once API tests pass:

```bash
# Terminal 1: Start frontend
cd /workspaces/strawberry/client
npm run dev

# Terminal 2: Keep server running
cd /workspaces/strawberry/server
npm run dev

# Browser: Go to http://localhost:5173
# Test Option 2 frontend UI
```

---

## References

- **Setup Guide**: `/workspaces/strawberry/docs/GEMINI_SETUP.md`
- **Credentials Template**: `/workspaces/strawberry/server/.env.local.template`
- **Test Script**: `/workspaces/strawberry/server/test-gemini-credentials.js`
- **Updated Code**:
  - `/workspaces/strawberry/server/geminiClient.js` - Better error extraction
  - `/workspaces/strawberry/server/index.js` - Load .env.local support
  - `/workspaces/strawberry/.devcontainer/devcontainer.json` - Container env updates

## Success Criteria

✅ Credentials are properly set and loading  
✅ Test script returns "✅ API Success!"  
✅ Manual API tests return semantic content (not "Mock: ...")  
✅ Response times are 5-15 seconds (realistic API latency)  
✅ Image concepts are specific ("watercolor painting of Victorian detective") not generic ("Concept 1")

---

**Status Update**: Ready for user to set up credentials and re-test.
