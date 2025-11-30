# Gemini API Configuration Guide

This guide explains how to set up Google Gemini API credentials for ChronosCraft AI.

## Prerequisites

1. **For GitHub Codespaces** (Recommended): Secrets already configured - no action needed ✅
2. **For Local Development**: A Google Cloud project with billing enabled, Generative Language API enabled, and an API key created

## API Models & Endpoints

ChronosCraft uses:

- **GEMINI_API_URL** (Gemini 2.5 Flash): `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
  - Fast, cost-effective text generation for story structure and content
  - 1M token context window
- **GEMINI_VISION_API_URL** (Gemini 2.5 Pro): `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`
  - Higher accuracy multimodal tasks (text + image analysis)
  - 2M token context window
  - Better for image understanding and complex reasoning

Both support the **Gemini 2.5 unified multimodal payload format** with flexible text/image mixing.

## Setup Instructions

### Option 1: GitHub Codespaces (Already Configured ✅)

If using GitHub Codespaces, the secrets are **automatically available**:

- `GEMINI_API_URL` → Used for text generation (Flash)
- `GEMINI_API_KEY` → API authentication key
- `GEMINI_VISION_API_URL` → Used for image understanding tasks (Pro)

**Status**: ✅ No setup needed - credentials are automatically available in the container environment.

To verify: Run `DEBUG_GEMINI_API=1 node test-gemini-credentials.js` in the server directory.

### Option 2: Local Development (VS Code Dev Containers)

If you're using VS Code with Dev Containers (recommended), set these environment variables on your **HOST machine** (not inside the container):

#### On macOS/Linux:

Add to `~/.bash_profile`, `~/.bashrc`, or `~/.zshrc`:

```bash
export GEMINI_API_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
export GEMINI_API_KEY="YOUR_API_KEY_HERE"
export GEMINI_VISION_API_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
```

Then reload your shell:

```bash
source ~/.bash_profile  # or ~/.zshrc depending on your shell
```

#### On Windows (PowerShell):

```powershell
[Environment]::SetEnvironmentVariable("GEMINI_API_URL", "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", "User")
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "YOUR_API_KEY_HERE", "User")
[Environment]::SetEnvironmentVariable("GEMINI_VISION_API_URL", "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", "User")
```

Then restart VS Code.

### Option 3: Docker Compose (Direct)

If running without Dev Containers, create a `.env` file in the `.devcontainer` directory:

```bash
# .devcontainer/.env
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
GEMINI_API_KEY=YOUR_API_KEY_HERE
GEMINI_VISION_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
```

## Verifying Configuration

### Test 1: Check Environment Variables

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

### Test 2: Run Manual API Test

```bash
cd /workspaces/strawberry/server
npm run dev  # Start the server

# In another terminal
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

Expected response time: 5-15 seconds (with semantic content, not mock data)

## Troubleshooting

### "Missing GEMINI API URL or KEY"

This means the environment variables aren't reaching the container. Check:

1. **For Dev Containers**: Make sure you restarted VS Code or ran "Dev Containers: Rebuild Container" after setting host environment variables
2. **For Codespaces**: Verify secrets are set and redeploy the Codespace
3. **For Docker**: Verify `.env` file exists in `.devcontainer` directory

### "Gemini call failed: Unknown Gemini error"

This usually means the API key is invalid or the API endpoint is wrong. Check:

1. Verify API key is correct: `echo $GEMINI_API_KEY`
2. Verify API URL is correct (should end with `:generateContent`)
3. Check Google Cloud Console that:
   - Generative Language API is enabled
   - Billing is active on the project
   - API key has no restrictions on Generative Language API

### API Returns 400 or 403

Your API key may not have permissions. In Google Cloud Console:

1. Go to APIs & Services → Credentials
2. Click your API key
3. Under "API restrictions", make sure "Generative Language API" is included (or "Unrestricted")

## Switching Between Real and Mock AI

The system automatically uses mock AI in test environments (`npm test` in server/) but can use real Gemini for manual testing:

### Force Mock (even if credentials are set):

```bash
FORCE_MOCK_AI=1 npm run dev
```

### Force Real AI (if available):

```bash
USE_REAL_AI=1 npm run dev
```

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key
4. Follow setup instructions above

## API Models Available

The configuration uses Gemini 2.5 Flash by default:

- `gemini-2.5-flash`: Fastest, best for real-time, 1M tokens context
- `gemini-2.5-pro`: More capable, slower, higher cost, 2M tokens context

To switch models, update the URL in your environment variables:

```bash
# Replace "gemini-2.5-flash" with another model
export GEMINI_API_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"
```

## Gemini 2.5 Payload Formats

ChronosCraft uses the **Gemini 2.5 unified multimodal payload format**, which is more flexible than previous versions.

### Text-Only Generation (GEMINI_API_URL - Flash)

Use this for fast, cost-effective text generation (story structure, content):

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Summarize this article in three bullet points..."
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 1000
  }
}
```

**Key Points**:

- `role: "user"` required for all requests
- Simple text in `parts[].text`
- Fast response times (< 2 seconds)
- Lower cost (Flash pricing)

### Multimodal (Text + Image) - GEMINI_VISION_API_URL (Pro)

Use this for image understanding and complex reasoning tasks:

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Describe what is happening in this image and extract any visible text."
        },
        {
          "inline_data": {
            "mime_type": "image/jpeg",
            "data": "BASE64_ENCODED_IMAGE_STRING_HERE"
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.4,
    "topK": 32,
    "topP": 1,
    "maxOutputTokens": 4096
  }
}
```

**Key Points**:

- `role: "user"` required
- Mix text and images freely in `parts` array
- Image data uses `inline_data` with `mime_type` and base64-encoded `data`
- Higher accuracy for visual reasoning
- Supports JPEG, PNG, WebP, GIF

### Gemini 2.5 Feature Comparison

| Feature       | 2.5 Flash   | 2.5 Pro     |
| ------------- | ----------- | ----------- |
| Multimodal    | Yes         | Yes         |
| Mixed parts   | ✅ Full     | ✅ Full     |
| Speed         | ✅ Fast     | Medium      |
| Cost          | ✅ Lower    | Medium      |
| Context       | 1M tokens   | 2M tokens   |
| `role` field  | ✅ Required | ✅ Required |
| `inline_data` | ✅ Standard | ✅ Standard |

## Cost Considerations

- Gemini 2.5 Flash: ~$0.075 per 1M input tokens
- Free tier: 15 calls/minute, 1,500 calls/day
- See [Pricing](https://ai.google.dev/pricing) for full details

For development with tests:

- Use `FORCE_MOCK_AI=1` during development (`npm test` does this automatically)
- Only run real API tests manually when needed
- Enable billing alerts in Google Cloud Console to avoid surprises

---

**Last Updated**: 2025-11-24  
**Status**: ✅ Tested and verified
