---
title: Enhanced API Payload Implementation (update)
date: 2025-11-10
status: active
---

## Purpose

Define the enhanced prompt payload structure and implementation steps for extending the existing `/prompt` endpoint to support metadata-rich requests across different generation modes.

## Current to Enhanced Payload

The system evolves the current simple payload to a richer structure supporting multiple modes and metadata:

POST /prompt

Request JSON:

```json
// Enhanced payload structure
{
  "mode": "basic" | "demo" | "ebook",  // Generation context
  "prompt": "...",                     // Core prompt content
  "metadata": {                        // Optional structured data
    "title"?: "...",
    "author"?: "...",
    "pages"?: 123
  },
  "options"?: {                        // Future configuration
    // Extension point for future features
  }
}
```

## Implementation Steps

### 1. Backend Enhancement (`/prompt` Endpoint)

Update the endpoint handler in `server/index.js`; requirements for `/prompt` handler:

```javascript
app.post("/prompt", async (req, res) => {

  // payload-specific validation
  const body = req.body || {};
  if (!body.mode || typeof body.prompt !== "string") {
    return res.status(400).json({
      error: "INVALID_PAYLOAD",
      message: "payload must include mode and prompt",
    });
  }

  // Mode-specific validation
  if (body.mode === "demo") {
    const md = body.metadata || {};
    if (!md.title || !md.author || !md.pages) {
      return res.status(400).json({
        error: "MISSING_METADATA",
        fields: ["title", "author", "pages"],
      });
    }
  }

  const result = await genieService.process(body);
  return res.json(result);
});
```

### 2. Service Layer Updates

Update `genieService.js` to handle the enhanced payload:

```javascript
// genieService.js
import sampleService from "./sampleService.js";
import demoService from "./demoService.js";
import ebookService from "./ebookService.js";

export async function process(payload) {
  switch (payload.mode) {
    case "demo":
      return demoService.handle(payload);
    case "ebook":
      return ebookService.handle(payload);
    case "basic":
    default:
      return sampleService.handle(payload);
  }
}
```

Update service handlers to work with full payload:

```javascript
// sampleService.js
export async function handle(payload) {
  // Access full payload capabilities
  const { prompt, metadata, options } = payload;

  // Core generation logic
  const result = await generateContent(prompt);

  // Enhance with metadata if provided
  if (metadata) {
    result.metadata = { ...result.metadata, ...metadata };
  }

  return result;
}
```

### 3. Frontend Integration

Update `client/src/lib/api.js` to assemble the enhanced payload:

```javascript
import { get } from "svelte/store";
import { promptStore } from "../stores/promptStore.js";
import { modeStore } from "../stores/modeStore.js";

export async function submitPrompt() {
  const ps = get(promptStore);
  const ms = get(modeStore);

  const payload = {
    mode: ms.current || ps.mode || "basic",
    prompt: ps.prompt || "",
    metadata: ps.metadata || {},
    options: ps.options || {},
  };

  // Client-side validation for demo mode
  if (payload.mode === "demo") {
    const md = payload.metadata || {};
    if (!md.title || !md.author || !md.pages) {
      throw new Error("Missing demo metadata: title, author, pages");
    }
  }

  const res = await fetch("/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || `HTTP ${res.status}`);
  }

  return res.json();
}
```

## Implementation Order

1. Backend Updates
   - Enhance `/prompt` endpoint handler
   - Update `genieService.process`
   - Update service handlers
   - Verify all services handle the enhanced payload

2. Frontend Updates
   - Update `submitPrompt` implementation
   - Update store interactions
   - Add client-side validation

## Response Schema

All responses follow this structure:

```json
{
  "out_envelope": {
    "pages": [], // Generated content pages
    "metadata": {}, // Generation metadata
    "actions": {} // Available post-generation actions
  }
}
```

## Error Responses

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "fields"?: ["field1", "field2"]  // For validation errors
}
```

Common error codes:

- `INVALID_PAYLOAD`: Missing required fields
- `MISSING_METADATA`: Missing mode-specific metadata
- `GENERATION_ERROR`: Content generation failed

## Acceptance Criteria

1. Enhanced Payload
   - Endpoint accepts and validates the enhanced payload structure
   - Each mode correctly validates its required metadata
   - Options object is preserved for future use

2. Service Integration
   - Services receive and handle the complete payload
   - Metadata flows through to the response when provided
   - Mode routing works correctly

3. Error Handling
   - Invalid payloads return 400 with clear error messages
   - Missing metadata returns specific validation errors
   - Successful responses match the documented schema

Last updated: 2025-11-10
