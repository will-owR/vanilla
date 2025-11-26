# 🎯 Action Guide: Get Real Gemini API Working - Session 2 Complete

**Current Status**: Code fixes ✅ | Documentation ✅ | **Your Setup**

---

## The Problem (Now Fixed)

Last session's manual API test failed with "Unknown Gemini error" because:

1. ❌ Gemini API credentials weren't set in your environment
2. ❌ Error messages weren't clear about what went wrong
3. ❌ No way to verify credentials without running the full server

**What We Fixed**:

- ✅ Better error extraction in geminiClient.js
- ✅ Corrected Gemini 2.5 multimodal payload format
- ✅ Added .env.local support for local development
- ✅ Created test script to verify credentials
- ✅ Updated documentation with payload examples
- ✅ Comprehensive setup and troubleshooting guides

---

## Your Setup (Choose One)

### 🎉 If Using GitHub Codespaces

**You're all set!** ✅

The credentials are already available:

- `GEMINI_API_URL` (Flash)
- `GEMINI_API_KEY`
- `GEMINI_VISION_API_URL` (Pro)

**Just verify they work**:

```bash
DEBUG_GEMINI_API=1 node /workspaces/strawberry/server/test-gemini-credentials.js
```

Then jump to [Step 4: Start Server](#step-4-start-server) below.

### 🏠 If Using Local Dev Containers

**You need to set credentials** on your **HOST machine**:

## Your To-Do List (10 minutes)

### ✅ Step 1: Get Gemini API Key (2 minutes) - LOCAL DEV ONLY

If using GitHub Codespaces, **skip to Step 3** (credentials already set).

```
1. Go to: https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the generated key (looks like: AIza...)
4. ✅ Keep this tab open, you'll need it below
```

### ✅ Step 2: Set Credentials in Your Environment (3 minutes) - LOCAL DEV ONLY

If using GitHub Codespaces, **skip to Step 3** (credentials already configured).

**Choose ONE approach based on your setup:**

#### For VS Code Dev Containers (Recommended)

On your **HOST COMPUTER** (not in VS Code terminal), set environment variables:

**macOS/Linux:**

```bash
# Open terminal on your Mac/Linux
# Add these to ~/.bashrc or ~/.zshrc:

export GEMINI_API_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
export GEMINI_API_KEY="AIza..."  # ← PASTE YOUR KEY HERE
export GEMINI_VISION_API_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

# Save file and reload:
source ~/.bashrc  # or ~/.zshrc
```

**Windows (PowerShell as Admin):**

```powershell
[Environment]::SetEnvironmentVariable("GEMINI_API_URL", "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", "User")
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "AIza...", "User")  # ← PASTE YOUR KEY
[Environment]::SetEnvironmentVariable("GEMINI_VISION_API_URL", "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", "User")
```

Then **restart VS Code completely** (close and reopen).

#### Alternative: Using .env.local File

If you're not using VS Code Dev Containers:

```bash
# Inside the dev container:
cd /workspaces/strawberry/server
cp .env.local.template .env.local

# Edit .env.local with your API key:
# GEMINI_API_KEY=AIza...  ← PASTE YOUR KEY HERE
```

### ✅ Step 3: Verify Credentials Loaded (2 minutes) - ALL USERS

Run this to verify credentials are working:

```bash
# Inside dev container/terminal
cd /workspaces/strawberry/server

# Run the verification script
DEBUG_GEMINI_API=1 node test-gemini-credentials.js
```

**Expected output:**

```
=== Gemini API Credential Debug ===

Environment Variables:
  GEMINI_API_URL: https://generativelanguage.googleapis.com/...
  GEMINI_API_KEY: SET (length=39)
  USE_REAL_AI: 1

Required for real AI:
  ✅ Both credentials present

Attempting test API call...
  HTTP Status: 200
  ✅ API Success! Response: API is working
```

**If you see "MISSING"**: Go back to Step 2 and verify credentials are set

**If you see "PERMISSION_DENIED"**: Check your Google Cloud project has Generative Language API enabled and billing active

### ✅ Step 4: Start Server with Real AI (2 minutes) - ALL USERS

```bash
cd /workspaces/strawberry/server
npm run dev
```

Server should start normally. You'll see:

```
Express server running on http://localhost:3000
```

### ✅ Step 5: Run Manual API Test (1 minute) - ALL USERS

**Open NEW terminal tab** (keep server running in first tab):

```bash
# Copy this entire curl command and paste in terminal:
curl -X POST http://localhost:3000/api/ebook/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A detective story set in Victorian London with mysterious clues",
    "theme": "light",
    "pageCount": 3,
    "colorPalette": ["#1a1a1a", "#ffffff", "#d4af37"],
    "fontSizeScale": 1
  }'
```

**Expected response** (after 8-15 seconds):

```json
{
  "success": true,
  "chapters": [
    {
      "title": "The Mystery Begins",
      "content": "In the foggy streets of Victorian London...",
      "imageConcepts": ["A misty London street with gas lamps..."]
    },
    ...
  ]
}
```

**NOT** like this (which means it's using mocks):

```json
{
  "chapters": [
    {
      "title": "Mock: Chapter 1",
      "content": "Mock: This is generated chapter content",
      ...
    }
  ]
}
```

---

## Quick Reference: Common Issues

| Issue                           | Solution                                                  |
| ------------------------------- | --------------------------------------------------------- |
| "Missing GEMINI API URL or KEY" | Go back to Step 2, verify env vars are set                |
| "INVALID_ARGUMENT"              | API key may be wrong, try generating new one              |
| "PERMISSION_DENIED"             | Enable Generative Language API in Google Cloud Console    |
| "Still getting mock data"       | Make sure FORCE_MOCK_AI is NOT set: `echo $FORCE_MOCK_AI` |
| Response takes 2 seconds        | You're getting mock data; check credentials again         |

---

## Next: Run All 3 Test Cases

Once Step 5 works, you're ready to run the full test suite:

```bash
# These are copy/paste ready - just run in terminal with server running

# Test 1: Detective story (light theme) - what you just ran above ✅

# Test 2: Adventure story (dark theme)
curl -X POST http://localhost:3000/api/ebook/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "An adventure through ancient ruins in a mysterious forest",
    "theme": "dark",
    "pageCount": 3,
    "colorPalette": ["#2a2a2a", "#f0f0f0", "#4a7c59"],
    "fontSizeScale": 1.1
  }'

# Test 3: Corporate narrative
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

---

## Documentation to Reference

| Document                                                                                                                             | Purpose                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| [`GEMINI_SETUP.md`](/workspaces/strawberry/docs/GEMINI_SETUP.md)                                                                     | Detailed setup guide with all options       |
| [`MANUAL_API_TESTING_SESSION2.md`](/workspaces/strawberry/docs/MANUAL_API_TESTING_SESSION2.md)                                       | Complete testing guide with troubleshooting |
| [`design/ebookService/SESSION2_DEBUGGING_SUMMARY.md`](/workspaces/strawberry/docs/design/ebookService/SESSION2_DEBUGGING_SUMMARY.md) | What was fixed and why                      |

---

## Verification Checklist

- [ ] Step 1: Got API key from Google AI Studio ✅
- [ ] Step 2: Set credentials on host machine OR in .env.local ✅
- [ ] Step 3: Test script shows "✅ API Success!" ✅
- [ ] Step 4: Server starts with `npm run dev` ✅
- [ ] Step 5: Manual API test returns semantic content ✅
- [ ] Response time is 5-15 seconds (not 1-2 seconds) ✅
- [ ] Image concepts are specific (not "Concept 1") ✅
- [ ] All 3 test cases pass ✅

---

## You're All Set! 🎉

Once your credentials are working:

✅ Manual API testing with real Gemini AI  
✅ Ready for Option 2 frontend validation  
✅ Can proceed to browser testing  
✅ Full E2E workflow ready

---

**Questions?** Check the [GEMINI_SETUP.md](docs/GEMINI_SETUP.md) troubleshooting section or the more detailed [MANUAL_API_TESTING_SESSION2.md](docs/MANUAL_API_TESTING_SESSION2.md).

**Ready to test?** Run Step 1-5 above, then come back and report results! 🚀
