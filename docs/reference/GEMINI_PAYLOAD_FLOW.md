# Gemini 2.5 Payload Structure - Visual Guide

This document shows exactly what payloads ChronosCraft is sending to Gemini 2.5 APIs.

---

## Request Flow Diagram

```
User Request (Frontend)
    ↓
    └→ POST /api/ebook/generate
       {prompt, theme, pageCount, colorPalette, fontSizeScale}
    ↓
server/index.js
    ├→ Receives flat payload
    ├→ Wraps with metadata
    └→ Calls genieService
    ↓
genieService.js
    ├→ Routes to ebookService
    └→ Calls service with wrapped metadata
    ↓
ebookService.js
    ├→ First AI call: Generate structure
    ├→ Loops: Generate each chapter
    └→ Calls aiService for each
    ↓
aiService.js (createAIService)
    ├→ Checks FORCE_MOCK_AI
    ├→ Checks USE_REAL_AI
    └→ Routes to RealAIService
    ↓
RealAIService.generateContent()
    ├→ Calls geminiClient.callGemini()
    └→ Passes modality (TEXT or IMAGERY)
    ↓
geminiClient.callGemini()
    ├→ Builds Gemini 2.5 payload ← YOU ARE HERE
    ├→ Makes HTTP request
    └→ Returns parsed response
    ↓
Response back through chain
```

---

## Current Payload Structure (Correct for Gemini 2.5)

### For Text Generation (GEMINI_API_URL - Flash)

```javascript
// What geminiClient.js sends to Gemini 2.5 Flash API
{
  contents: [
    {
      role: "user",           // ← REQUIRED
      parts: [
        {
          text: "Generate a detective story for a 3-page e-book..."
        }
      ]
    }
  ],
  generationConfig: {         // ← Optional, but recommended
    temperature: 0.7,
    maxOutputTokens: 1000
  }
}
```

**Sent to**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

**Headers**:

```
Content-Type: application/json
X-goog-api-key: ${GEMINI_API_KEY}
```

**Response**:

```javascript
{
  candidates: [
    {
      content: {
        parts: [
          {
            text: "# The Detective's First Case\n\n[Generated story content...]",
          },
        ],
      },
    },
  ];
}
```

---

### For Image Understanding (GEMINI_VISION_API_URL - Pro)

```javascript
// What geminiClient.js sends to Gemini 2.5 Pro API (for image tasks)
{
  contents: [
    {
      role: "user",           // ← REQUIRED
      parts: [
        {
          text: "Analyze this book cover concept and describe what visual elements you see..."
        },
        {
          inline_data: {      // ← Correct for Gemini 2.5
            mime_type: "image/png",
            data: "/9j/4AAQSkZJRgABA... [BASE64 IMAGE DATA] ...8AAA=="
          }
        }
      ]
    }
  ],
  generationConfig: {
    temperature: 0.4,
    topK: 32,
    topP: 1,
    maxOutputTokens: 4096
  }
}
```

**Sent to**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`

**Headers**: Same as Flash

**Response**: Same structure as Flash

---

## Code Location: Where This Happens

File: `/workspaces/strawberry/server/geminiClient.js`

### Lines 73-95: Build Parts Array

```javascript
// Gemini 2.5 uses inline_data structure for embedded images
const textPart =
  typeof prompt !== "undefined" && prompt !== null
    ? { text: String(prompt) }
    : null;
const parts = [];
if (textPart) parts.push(textPart);

if (imageB64) {
  // Gemini 2.5 uses inline_data structure for embedded images
  // This allows mixing text and images freely within parts array
  parts.push({
    inline_data: {
      mime_type: "image/png", // ← Correct field name (lowercase with underscore)
      data: String(imageB64).replace(/\s+/g, ""),
    },
  });
}
```

### Lines 96-107: Build Final Body

```javascript
// Gemini 2.5 requires role field in contents
// role: "user" for prompts, "model" for model responses
const body = {
  contents: [
    {
      role: "user", // ← REQUIRED for Gemini 2.5
      parts,
    },
  ],
  ...(Object.keys(generationConfig || {}).length ? { generationConfig } : {}),
};
```

---

## Comparison: What Changed

### Before (Incorrect for Gemini 2.5)

```javascript
// OLD - Would fail with Gemini 2.5
{
  contents: [{
    parts: [
      { text: "..." },
      {
        image: {                // ← WRONG field name
          mimeType: "image/png",  // ← WRONG case
          data: "..."
        }
      }
    ]
  }],
  generationConfig: { ... }
}
```

**Problems**:

- ❌ Missing `role` field (required)
- ❌ Using `image` instead of `inline_data`
- ❌ Using `mimeType` instead of `mime_type`

### After (Correct for Gemini 2.5) ✅

```javascript
// NEW - Works with Gemini 2.5
{
  contents: [{
    role: "user",               // ← ADDED
    parts: [
      { text: "..." },
      {
        inline_data: {          // ← CHANGED from 'image'
          mime_type: "image/png",  // ← CHANGED case
          data: "..."
        }
      }
    ]
  }],
  generationConfig: { ... }
}
```

**Fixed**:

- ✅ Added `role: "user"`
- ✅ Changed `image` → `inline_data`
- ✅ Changed `mimeType` → `mime_type`

---

## How Parts Are Combined

### Text Only

```
parts = [
  { text: "Your prompt here" }
]
```

Result: Text-only request to Flash API

### Text + Image (New Feature in 2.5)

```
parts = [
  { text: "First part of prompt" },
  { inline_data: { mime_type: "...", data: "..." } },
  { text: "Second part of prompt" }    // ← Can add more text after!
]
```

Result: Multimodal request to Pro API with flexible mixing

### Multiple Images (Advanced)

```
parts = [
  { text: "First image:" },
  { inline_data: { mime_type: "image/jpeg", data: "BASE64_1" } },
  { text: "Second image:" },
  { inline_data: { mime_type: "image/jpeg", data: "BASE64_2" } },
  { text: "Which would work better for X?" }
]
```

Result: Complex visual reasoning with multiple inputs

---

## Actual Example: Story Generation

When you call:

```bash
curl -X POST http://localhost:3000/api/ebook/generate \
  -d '{
    "prompt": "A detective story",
    "theme": "light",
    "pageCount": 3,
    "colorPalette": ["#1a1a1a", "#ffffff", "#d4af37"],
    "fontSizeScale": 1
  }'
```

### Step 1: Received at Endpoint

```javascript
{
  prompt: "A detective story",
  theme: "light",
  pageCount: 3,
  colorPalette: ["#1a1a1a", "#ffffff", "#d4af37"],
  fontSizeScale: 1
}
```

### Step 2: Sent to Gemini API as

```javascript
{
  contents: [{
    role: "user",
    parts: [{
      text: "Generate an e-book structure with 3 pages for: A detective story..."
    }]
  }],
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 1000
  }
}
```

### Step 3: Then Per-Chapter

```javascript
{
  contents: [{
    role: "user",
    parts: [{
      text: "Generate chapter 1 content for: A detective story... Chapter title: The Mystery Begins"
    }]
  }],
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 1000
  }
}
```

### Step 4: Response Structure

```javascript
{
  ok: true,
  status: 200,
  json: {
    candidates: [{
      content: {
        parts: [{
          text: "# The Mystery Begins\n\nIn the foggy streets of Victorian London..."
        }]
      }
    }]
  },
  text: "# The Mystery Begins\n\nIn the foggy streets of Victorian London...",
  image: null
}
```

### Step 5: Extracted and Returned

```javascript
{
  success: true,
  chapters: [
    {
      title: "The Mystery Begins",
      content: "In the foggy streets of Victorian London...",
      imageConcepts: ["A misty street in Victorian London with gas lamps"]
    },
    // ... more chapters
  ]
}
```

---

## Environment Variables Used

```javascript
// In geminiClient.js

// Get API endpoints based on modality
const apiUrl =
  (isText ? process.env.GEMINI_API_URL_TEXT : null) ||
  (isImage ? process.env.GEMINI_API_URL_IMAGE : null) ||
  (isImagery ? process.env.GEMINI_API_URL_IMAGERY : null) ||
  process.env.GEMINI_API_URL;

// Get API key
const rawKey =
  (isText ? process.env.GEMINI_API_KEY_TEXT : null) ||
  (isImage ? process.env.GEMINI_API_KEY_IMAGE : null) ||
  (isImagery ? process.env.GEMINI_API_KEY_IMAGE : null) ||
  process.env.GEMINI_API_KEY;
```

**What This Means**:

- ✅ You can use one key for all models (fallback to `GEMINI_API_KEY`)
- ✅ Or separate keys per modality for better control/billing
- ✅ Or separate URLs per modality (Flash vs Pro)

**For Codespaces**: Both are set, system uses them correctly

---

## Validation: What Gets Checked

In geminiClient before sending:

```javascript
if (!apiUrl || !rawKey) {
  return {
    ok: false,
    status: 0,
    error: "Missing GEMINI API URL or KEY for modality " + modality,
  };
}
```

In aiService when response returns:

```javascript
if (!resp || resp.ok === false) {
  const errMsg = resp && resp.error ? resp.error : "Unknown Gemini error";
  throw new Error(`Gemini call failed: ${errMsg}`);
}
```

---

## Summary

✅ **Text generation** (Flash): Sends simple text in `parts`, uses `role: "user"`  
✅ **Image analysis** (Pro): Sends mixed text + `inline_data` image parts  
✅ **Both use**: Gemini 2.5 format with `role` and correct field names  
✅ **Credentials**: From Codespaces secrets (already configured)

**Result**: Full Gemini 2.5 API support with proper multimodal capabilities.

---

**Last Updated**: 2025-11-24  
**Code Status**: ✅ Current and correct for Gemini 2.5  
**Codespaces Status**: ✅ Credentials integrated and ready
