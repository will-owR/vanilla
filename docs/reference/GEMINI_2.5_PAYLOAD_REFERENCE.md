# Gemini 2.5 Payload Reference Card

Quick reference for building requests to Gemini 2.5 API.

---

## Basic Template (All Requests)

**Every request to Gemini 2.5 must have:**

```javascript
{
  contents: [{
    role: "user",              // ← REQUIRED
    parts: [/* ... your parts ... */]
  }],
  generationConfig: {         // ← Optional
    temperature: 0.7,
    maxOutputTokens: 1000
  }
}
```

---

## Pattern 1: Text-Only (Flash)

**Use Case**: Story generation, content creation, fast responses  
**Model**: `gemini-2.5-flash`  
**Cost**: Lowest (~$0.075 per 1M tokens)  
**Speed**: Fastest (<2 seconds)

```javascript
{
  contents: [{
    role: "user",
    parts: [
      {
        text: "Generate a detective story set in Victorian London..."
      }
    ]
  }],
  generationConfig: {
    temperature: 0.7,         // More creative
    maxOutputTokens: 1000     // Reasonable length
  }
}
```

**When to use**:

- Story structure
- Chapter content
- Descriptions
- Anything that doesn't need images

---

## Pattern 2: Image Understanding (Pro)

**Use Case**: Analyze an image, extract text, describe content  
**Model**: `gemini-2.5-pro`  
**Cost**: Medium (~$1.50 per 1M tokens)  
**Speed**: Medium (5-10 seconds)

```javascript
{
  contents: [{
    role: "user",
    parts: [
      {
        text: "Describe what's in this image and extract any visible text"
      },
      {
        inline_data: {
          mime_type: "image/jpeg",              // or image/png, image/webp, image/gif
          data: "BASE64_ENCODED_IMAGE_HERE"     // No "data:image/..." prefix!
        }
      }
    ]
  }],
  generationConfig: {
    temperature: 0.4,         // More factual
    topK: 32,
    topP: 1,
    maxOutputTokens: 4096     // Allow longer responses for analysis
  }
}
```

**When to use**:

- Image concept refinement
- Visual asset analysis
- OCR text extraction
- Image suitability checking

---

## Pattern 3: Multi-Turn Conversation

**Use Case**: Follow-up questions based on previous response  
**Add**: Previous model response as `role: "model"`

```javascript
{
  contents: [
    {
      role: "user",
      parts: [{text: "First question..."}]
    },
    {
      role: "model",                          // ← From previous response
      parts: [{text: "Previous model answer..."}]
    },
    {
      role: "user",
      parts: [{text: "Follow-up question..."}]
    }
  ],
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 1000
  }
}
```

---

## Pattern 4: Mixed Content (Advanced)

**Use Case**: Complex reasoning with multiple images and text  
**Note**: All parts in same `parts` array

```javascript
{
  contents: [{
    role: "user",
    parts: [
      {
        text: "Compare these two images. Image 1:"
      },
      {
        inline_data: {
          mime_type: "image/jpeg",
          data: "BASE64_IMAGE_1"
        }
      },
      {
        text: "Image 2:"
      },
      {
        inline_data: {
          mime_type: "image/jpeg",
          data: "BASE64_IMAGE_2"
        }
      },
      {
        text: "Which would work better for a book cover about mystery?"
      }
    ]
  }],
  generationConfig: {
    temperature: 0.4,
    maxOutputTokens: 2000
  }
}
```

---

## Temperature Settings

| Value | Behavior                  | Use For                                  |
| ----- | ------------------------- | ---------------------------------------- |
| 0.0   | Deterministic, repeatable | Content that must match previous outputs |
| 0.4   | Factual, precise          | Image analysis, technical writing        |
| 0.7   | Balanced                  | Story content, general writing           |
| 1.0   | Creative, variable        | Brainstorming, art prompts               |
| 1.5+  | Wild, unpredictable       | Experimental content                     |

---

## Common Mistakes

### ❌ Wrong: Using `image` instead of `inline_data`

```javascript
// WRONG - Won't work
{
  inline_data: {
    image: {          // ← WRONG
      mimeType: "...",
      data: "..."
    }
  }
}
```

### ✅ Correct Format

```javascript
// CORRECT
{
  inline_data: {
    mime_type: "image/jpeg",   // ← Lower case with underscore
    data: "BASE64..."           // ← Direct data, no wrapper
  }
}
```

---

### ❌ Wrong: Forgetting `role`

```javascript
// WRONG - Will fail
{
  contents: [
    {
      parts: [{ text: "..." }], // ← Missing role
    },
  ];
}
```

### ✅ Correct

```javascript
// CORRECT
{
  contents: [
    {
      role: "user", // ← Required!
      parts: [{ text: "..." }],
    },
  ];
}
```

---

### ❌ Wrong: Using `mimeType` instead of `mime_type`

```javascript
// WRONG - Property name mismatch
inline_data: {
  mimeType: "image/jpeg",     // ← Wrong field name
  data: "..."
}
```

### ✅ Correct

```javascript
// CORRECT
inline_data: {
  mime_type: "image/jpeg",    // ← Correct field name
  data: "..."
}
```

---

### ❌ Wrong: Including data URI prefix in base64

```javascript
// WRONG
inline_data: {
  mime_type: "image/jpeg",
  data: "data:image/jpeg;base64,/9j/4AAQSk..."  // ← Keep only base64!
}
```

### ✅ Correct

```javascript
// CORRECT
inline_data: {
  mime_type: "image/jpeg",
  data: "/9j/4AAQSkZJRg=="     // ← Just the base64 data
}
```

---

## Configuration Defaults

ChronosCraft uses:

### For Text Generation (Flash)

```javascript
generationConfig: {
  temperature: 0.7,
  maxOutputTokens: 1000
}
```

### For Image Analysis (Pro)

```javascript
generationConfig: {
  temperature: 0.4,
  topK: 32,
  topP: 1,
  maxOutputTokens: 4096
}
```

---

## Supported Image Formats

- JPEG (`image/jpeg`)
- PNG (`image/png`)
- WebP (`image/webp`)
- GIF (`image/gif`)

All must be base64-encoded (no data: prefix).

---

## Response Structure

All responses follow this format:

```javascript
{
  ok: true,
  status: 200,
  json: {
    candidates: [{
      content: {
        parts: [{
          text: "Generated response text here..."
        }]
      }
    }]
  },
  text: "Generated response text here...",  // Extracted for convenience
  image: null                                 // If image was generated
}
```

**To get the text:**

```javascript
response.text; // Simple access
// OR
response.json.candidates[0].content.parts[0].text; // Full path
```

---

## Decision Tree: Which Model to Use?

```
Do you need image analysis?
├─ NO → Use GEMINI_API_URL (Flash)
│       ✅ Fast (<2s), cheap, perfect for text
│
└─ YES → Use GEMINI_VISION_API_URL (Pro)
         ✅ Accurate vision, supports mixed content
         ⚠️ Slower (5-10s), higher cost
```

---

## Rate Limits & Quotas

- **Free Tier**: 15 requests/minute, 1,500/day
- **Paid Tier**: Much higher (depends on project)
- **Per request**: Check quota in Google Cloud Console

---

**Last Updated**: 2025-11-24  
**API Version**: Gemini 2.5 (Flash/Pro)  
**Status**: ✅ Current and accurate
