# API Payload Implementation - Frontend Actionables

date: 2025-11-10
status: active

## Implementation Branch

All implementation work should be done in a dedicated feature branch:

```bash
git checkout -b feature/enhance-prompt-payload-frontend
```

## Overview

Phase 2 focuses on updating the frontend to assemble and send the enhanced payload structure to the backend. The main work is transforming `submitPrompt()` from a simple "send prompt string" function to a rich "assemble payload with validation, send, and parse response" function.

---

## 1. Store Structure Verification

### Verify promptStore

Location: `client/src/stores/promptStore.js`

**Required Fields:**

```javascript
{
  prompt: string,           // The user's prompt text
  metadata: {
    title?: string,         // Optional: content title
    author?: string,        // Optional: content author
    pages?: number          // Optional: page count
  },
  mode?: string,            // Optional: generation mode (may be in modeStore)
  options?: object          // Optional: future extension point
}
```

**Verification Checklist:**

- [ ] `prompt` field exists and is writable
- [ ] `metadata` object exists with title, author, pages subfields
- [ ] `mode` field exists OR is exclusively in modeStore
- [ ] `options` field exists or can be added
- [ ] All fields are reactive (observable)
- [ ] Document any deviations from expected structure

### Verify modeStore

Location: `client/src/stores/modeStore.js`

**Required Fields:**

```javascript
{
  current: "basic" | "demo" | "ebook",  // Currently selected mode
  params?: object                       // Optional: mode-specific parameters
}
```

**Verification Checklist:**

- [ ] `current` field tracks the selected mode
- [ ] Valid values: "basic", "demo", "ebook"
- [ ] Field is reactive/observable
- [ ] Default value is defined (likely "basic")
- [ ] Document how mode is selected (dropdown, button, etc.)

---

## 2. API Function Enhancement

### Update submitPrompt() Function

Location: `client/src/lib/api.js`

**Current Signature:**

```javascript
export async function submitPrompt() {
  // Currently sends only { prompt } to backend
}
```

**Required Changes:**

#### 2.1 Read Stores

```javascript
import { get } from "svelte/store";
import { promptStore } from "../stores/promptStore.js";
import { modeStore } from "../stores/modeStore.js";

// Read current store values
const ps = get(promptStore);
const ms = get(modeStore);
```

#### 2.2 Assemble Enhanced Payload

```javascript
const payload = {
  mode: ms.current || ps.mode || "basic",
  prompt: ps.prompt || "",
  metadata: ps.metadata || {},
  options: ps.options || {},
};
```

**Payload Structure:**

- `mode`: From modeStore.current, fallback to promptStore.mode, fallback to "basic"
- `prompt`: From promptStore.prompt (required, non-empty)
- `metadata`: From promptStore.metadata (optional, but checked if mode requires it)
- `options`: From promptStore.options (optional, for future use)

#### 2.3 Implement Client-Side Validation

```javascript
// Validate payload based on mode
function validatePayload(payload) {
  const { mode, prompt, metadata } = payload;

  // All modes require non-empty prompt
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("Prompt is required and must be non-empty");
  }

  // Demo mode requires metadata
  if (mode === "demo") {
    const md = metadata || {};
    if (!md.title || !md.author || !md.pages) {
      const missing = [];
      if (!md.title) missing.push("title");
      if (!md.author) missing.push("author");
      if (!md.pages) missing.push("pages");
      throw new Error(`Demo mode requires: ${missing.join(", ")}`);
    }
  }

  // Ebook mode requires metadata
  if (mode === "ebook") {
    const md = metadata || {};
    if (!md.title || !md.author || !md.pages) {
      const missing = [];
      if (!md.title) missing.push("title");
      if (!md.author) missing.push("author");
      if (!md.pages) missing.push("pages");
      throw new Error(`Ebook mode requires: ${missing.join(", ")}`);
    }
  }
}
```

#### 2.4 Send Payload to Backend

```javascript
// Call validation first
try {
  validatePayload(payload);
} catch (validationError) {
  // Client-side validation failed
  throw {
    type: "validation",
    message: validationError.message,
    code: "VALIDATION_ERROR",
  };
}

// Send to backend
const res = await fetch("/prompt", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```

#### 2.5 Handle Response

```javascript
// Parse response
if (!res.ok) {
  // Server-side error (validation or generation)
  const err = await res.json().catch(() => ({}));
  throw {
    type: "server",
    code: err.error || "UNKNOWN_ERROR",
    message: err.message || `HTTP ${res.status}`,
    fields: err.fields,
  };
}

// Success - parse response envelope
const response = await res.json();
return {
  success: true,
  data: response.out_envelope || response,
};
```

**Updated submitPrompt() Signature:**

```javascript
export async function submitPrompt() {
  // Returns: { success: true, data: { pages, metadata, actions } }
  // Throws: { type, code, message, fields? }
}
```

---

## 3. Error Code Handling

### Map Backend Error Codes to User Messages

Location: `client/src/lib/api.js` or `client/src/lib/errorHandler.js`

**Error Code Mapping:**

```javascript
const ERROR_MESSAGES = {
  INVALID_PAYLOAD: {
    title: "Invalid Request",
    message:
      "The request is missing required fields. Please provide both a prompt and select a generation mode.",
    recoverable: true,
  },
  INVALID_MODE: {
    title: "Invalid Mode",
    message:
      "The selected generation mode is not supported. Please choose from: Basic, Demo, or Ebook.",
    recoverable: true,
  },
  MISSING_METADATA: {
    title: "Missing Information",
    message:
      "This generation mode requires additional information. Please fill in all required fields.",
    recoverable: true,
    hasFields: true, // Shows which fields are missing
  },
  GENERATION_ERROR: {
    title: "Generation Failed",
    message: "An error occurred while generating content. Please try again.",
    recoverable: true,
  },
  VALIDATION_ERROR: {
    title: "Validation Error",
    message: "Please check your input and try again.",
    recoverable: true,
  },
  UNKNOWN_ERROR: {
    title: "Unknown Error",
    message: "An unexpected error occurred. Please try again.",
    recoverable: false,
  },
};
```

**Error Handler Function:**

```javascript
export function getErrorDisplay(error) {
  const errorInfo = ERROR_MESSAGES[error.code] || ERROR_MESSAGES.UNKNOWN_ERROR;

  return {
    title: errorInfo.title,
    message: errorInfo.message,
    fields: error.fields, // For MISSING_METADATA errors
    recoverable: errorInfo.recoverable,
  };
}
```

---

## 4. Response Handling Integration

### Update Components to Handle New Response Format

**Old Response Format:**

```json
{
  "success": true,
  "data": {
    "content": { "title": "...", "body": "..." },
    "aiResponse": "...",
    "copies": [...],
    "metadata": { ... }
  }
}
```

**New Response Format:**

```json
{
  "out_envelope": {
    "pages": [
      {
        "id": "p1",
        "title": "...",
        "blocks": [{ "type": "text", "content": "..." }]
      }
    ],
    "metadata": {
      "title": "...",
      "author": "...",
      "pages": 0,
      "generated_at": "2025-11-10T...",
      "mode": "basic|demo|ebook"
    },
    "actions": {
      "can_export": true,
      "can_preview": true
    }
  }
}
```

**Components to Update:**

1. **PreviewWindow or Content Display**

   - Change: `response.data.content` → `response.out_envelope.pages`
   - Update page rendering to work with blocks structure
   - Use metadata for title/author display

2. **Export Functionality**

   - Check: `response.out_envelope.actions.can_export`
   - Pass pages and metadata to export handler

3. **Metadata Display**
   - Display: `response.out_envelope.metadata.generated_at`
   - Display: `response.out_envelope.metadata.mode`
   - Display: User-provided metadata (title, author)

---

## 5. Implementation Order

### Phase 2.1: Store & Error Verification

- [ ] Verify promptStore structure and fields
- [ ] Verify modeStore structure and fields
- [ ] Document any deviations or missing fields
- [ ] Identify store import paths and module structure

### Phase 2.2: API Function Enhancement

- [ ] Update submitPrompt() to read stores
- [ ] Implement payload assembly logic
- [ ] Implement client-side validation
- [ ] Update fetch call with enhanced payload
- [ ] Add response envelope handling
- [ ] Test with manual curl commands

### Phase 2.3: Error Handling

- [ ] Create error code mapping table
- [ ] Implement error handler function
- [ ] Distinguish error types (validation vs. server)
- [ ] Provide user-friendly error messages

### Phase 2.4: Component Integration

- [ ] Identify all components consuming submitPrompt() response
- [ ] Update response handling in each component
- [ ] Update page/block rendering logic
- [ ] Update metadata display
- [ ] Update export/preview action handling

### Phase 2.5: Testing

- [ ] Test basic mode (no metadata required)
- [ ] Test demo mode with valid metadata
- [ ] Test demo mode with missing metadata (MISSING_METADATA error)
- [ ] Test invalid mode (INVALID_MODE error)
- [ ] Test empty prompt (INVALID_PAYLOAD error)
- [ ] Test successful response parsing
- [ ] Test error display in UI

---

## Implementation Guidelines

### 1. Store Reading

- Use Svelte's `get()` function for snapshot reads
- Consider using `subscribe()` if reactive updates needed
- Handle undefined/null gracefully with fallbacks

### 2. Validation Strategy

- Client-side validation: Fail fast, provide clear messages
- Server-side validation: Already implemented in backend
- Never trust client validation alone (security)

### 3. Error Handling

- Distinguish between client (validation) and server (generation) errors
- Provide specific field information for validation errors
- Include error codes for programmatic handling

### 4. Response Format

- Assume backend always returns `{ out_envelope: {...} }` on success
- Assume backend always returns `{ error, message, fields? }` on error
- Never assume old format structure
- Validate response shape before consuming

### 5. Backward Compatibility

- Identify any legacy code still using old response format
- Plan migration strategy if multiple code paths exist
- Consider adapter pattern if gradual migration needed

---

## Integration Points

### Files to Review/Modify

1. **Store Verification**

   - `client/src/stores/promptStore.js`
   - `client/src/stores/modeStore.js`

2. **API Function**

   - `client/src/lib/api.js` — submitPrompt() function

3. **Error Handling**

   - `client/src/lib/errorHandler.js` (create if needed)
   - Or add to `client/src/lib/api.js`

4. **Response Consumers**

   - `client/src/App.svelte` (likely caller)
   - `client/src/components/PreviewWindow.svelte` (or similar)
   - `client/src/components/ExportButton.svelte` (or similar)
   - Any other components using submitPrompt() response

5. **Testing**
   - `client/__tests__/api.test.js` (update or create)
   - Integration tests for end-to-end flow

---

## Response Schema Reference

### Success Response (200/201)

```json
{
  "out_envelope": {
    "pages": [
      {
        "id": "p1",
        "title": "Page Title",
        "blocks": [
          {
            "type": "text",
            "content": "Page content..."
          }
        ]
      }
    ],
    "metadata": {
      "title": "...",
      "author": "...",
      "pages": 0,
      "generated_at": "2025-11-10T12:34:56.789Z",
      "mode": "basic",
      "model": "sample-v1"
    },
    "actions": {
      "can_export": true,
      "can_preview": true
    }
  }
}
```

### Error Response (400/500)

```json
{
  "error": {
    "message": "Human readable message",
    "code": "INVALID_PAYLOAD|INVALID_MODE|MISSING_METADATA|GENERATION_ERROR",
    "status": 400,
    "timestamp": "2025-11-10T12:34:56.789Z",
    "requestId": "uuid-here",
    "fields": ["title", "author"]
  }
}
```

---

## Acceptance Criteria

1. **Store Integration** ✅

   - promptStore and modeStore fields verified
   - Stores can be read via `get()` function
   - Fallback values work correctly

2. **Payload Assembly** ✅

   - Enhanced payload assembled correctly
   - All required fields present
   - Optional fields handled gracefully

3. **Validation** ✅

   - Client-side validation works for all modes
   - Error messages are clear and actionable
   - Validation fails fast before send

4. **API Communication** ✅

   - Payload sent to backend with correct structure
   - Response envelope parsed correctly
   - Error responses handled appropriately

5. **Error Handling** ✅

   - All error codes mapped to user messages
   - Error context preserved (fields, messages, codes)
   - Recoverable vs. non-recoverable errors distinguished

6. **Component Integration** ✅

   - All response consumers updated
   - Pages render from blocks structure
   - Metadata displayed correctly
   - Actions (export/preview) work

7. **Testing** ✅
   - Manual curl tests pass for all scenarios
   - Component integration tests pass
   - Error scenarios tested and handled

---

## Timeline Estimate

| Phase | Task                  | Complexity | Time            |
| ----- | --------------------- | ---------- | --------------- |
| 2.1   | Store Verification    | Low        | 10-15 min       |
| 2.2   | API Enhancement       | Medium     | 30-45 min       |
| 2.3   | Error Handling        | Low        | 15-20 min       |
| 2.4   | Component Integration | Medium     | 30-45 min       |
| 2.5   | Testing               | Medium     | 30-45 min       |
|       | **Total**             |            | **2-2.5 hours** |

---

## Next Steps

After frontend implementation is complete:

1. Integration testing with backend
2. End-to-end testing (frontend → backend → response)
3. UI/UX refinement based on error messages
4. Performance optimization (lazy loading, caching)
5. Production deployment planning

---

Last updated: 2025-11-10
Status: Ready for Phase 2 Implementation
