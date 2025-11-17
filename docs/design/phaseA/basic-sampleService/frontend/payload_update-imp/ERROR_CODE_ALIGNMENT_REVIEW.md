# Error Code Alignment Review

**Date:** 2025-11-10  
**Status:** Review Complete (No Codebase Changes)  
**Purpose:** Identify existing error handling patterns and alignment gaps with proposed numeric error codes

---

## Proposed Error Codes

```
INVALID_PAYLOAD    - Missing required fields
INVALID_MODE       - Unsupported mode specified
MISSING_METADATA   - Missing mode-specific metadata
GENERATION_ERROR   - Content generation failed
```

---

## Current Error Handling in Codebase

### 1. **server/utils/errorHandler.js** (Existing)

**Status:** Structured error framework already in place

```javascript
ERROR_TYPES = {
  VALIDATION: "VALIDATION_ERROR",
  PROCESSING: "PROCESSING_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
};
```

**Current Pattern:**

- Uses `createErrorResponse(message, code, status, details)`
- Returns: `{ error: { message, code, status, timestamp, requestId, [details] } }`
- HTTP status codes: 400 (validation), 500 (processing), 404 (not found), 503 (unavailable)

**Observation:**

- Framework is already designed for numeric-style codes
- Uses clear separation of concerns (code vs. message vs. status)
- Development mode includes technical details; production excludes them

---

### 2. **server/index.js** - POST /prompt Endpoint (Current Implementation)

**Location:** Lines 660-690

```javascript
app.post("/prompt", async (req, res, next) => {
  const { prompt } = req.body;

  // Current validation
  if (typeof prompt !== "string" || !prompt.trim()) {
    return sendValidationError(
      res,
      "Prompt is required and must be a non-empty string",
      {
        provided: typeof prompt,
        required: "non-empty string",
      }
    );
  }

  try {
    const genieResult = await genieService.generate(prompt);
    const data = genieResult && genieResult.data ? { ...genieResult.data } : {};
    return res.status(201).json({ success: true, data });
  } catch (err) {
    err.status = err.status || 500;
    err.message = `Generation Error: ${err.message}`;
    next(err);
  }
});
```

**Current Behavior:**

- ✅ Uses `sendValidationError()` helper (structured approach)
- ✅ Catches generation errors with 500 status
- ❌ **Only validates `prompt` field**
- ❌ **No mode validation**
- ❌ **No metadata validation**
- ❌ **Response envelope not implemented**

**Alignment Gaps:**

- Currently only checks for required prompt string
- Does not use numeric error codes (uses sendValidationError helper)
- No branching logic for mode-specific validation
- Service contract expects `genieService.generate(prompt)` (string), not payload object

---

### 3. **server/genieService.js** (Current Implementation)

**Status:** Single-method service

```javascript
async generate(prompt) {
  if (!prompt || !String(prompt).trim()) {
    const e = new Error("Prompt is required");
    e.status = 400;
    throw e;
  }
  // ... persistence and delegation logic
}
```

**Current Behavior:**

- ✅ Basic input validation
- ✅ Sets HTTP status codes on errors
- ❌ **Only accepts string prompt, not payload object**
- ❌ **No mode-based routing**
- ❌ **No service handler delegation**
- ❌ **No metadata handling**

**Alignment Gaps:**

- Service method signature: `generate(prompt)` — must become `process(payload)`
- No switch/case routing for different modes
- Does not call specialized service handlers (sampleService, demoService, ebookService)
- Does not return standardized `out_envelope` structure

---

### 4. **server/sampleService.js** (Current Implementation)

**Status:** Pure service with envelope support

```javascript
async function generate(envelopeReq = {}, opts = {}) {
  if (!envelopeReq || !envelopeReq.in_envelope) {
    const e = new Error(
      "Invalid input: expected { in_envelope, out_envelope }"
    );
    e.status = 400;
    throw e;
  }
  // ... builds pages, metadata, actions
  return { out_envelope: outEnv, metadata };
}
```

**Current Behavior:**

- ✅ Already returns `{ out_envelope: {...}, metadata }`
- ✅ Builds `pages`, `metadata`, `actions` in response
- ✅ Implements envelope contract
- ❌ **Expects envelope request object, not payload**
- ❌ **No `handle(payload)` method**
- ❌ **Expects `in_envelope` and `out_envelope` structure (legacy)**

**Alignment Gaps:**

- Method name is `generate()`, proposal uses `handle(payload)`
- Currently expects legacy envelope structure: `{ in_envelope: {...}, out_envelope: {...} }`
- Proposal expects flattened payload: `{ mode, prompt, metadata, options }`
- Needs adapter method `handle(payload)` that transforms to/from envelope format

---

### 5. **server/demoService.js** (Current Implementation)

**Status:** Single-method service

```javascript
async function generateFromPrompt(prompt) {
  const content = buildContent(prompt);
  const copies = makePages(content, 3);
  const metadata = { model: "demo-1", pages: copies.length };
  return { content, copies, metadata };
}
```

**Current Behavior:**

- ✅ Builds content and metadata
- ❌ **Only has `generateFromPrompt(prompt)` method**
- ❌ **No `handle(payload)` method**
- ❌ **Returns `{ content, copies, metadata }`, not `out_envelope` structure**
- ❌ **No error handling with status codes**

**Alignment Gaps:**

- Method signature: `generateFromPrompt(prompt)` → needs `handle(payload)`
- Return shape: `{ content, copies, metadata }` → needs `{ pages, metadata, actions }`
- No validation for mode-specific metadata (e.g., title, author for demo)
- No structured error responses

---

### 6. **server/ebookService.js** (Does Not Exist)

**Status:** Not yet created

**Requirements for Alignment:**

- Must implement `handle(payload)` method
- Must return `{ pages, metadata, actions }`
- Must validate mode-specific metadata (e.g., pages field for ebook)
- Must throw errors with HTTP status codes
- Should follow same pattern as proposed demoService handler

---

## Error Code Mapping

### Proposed to Current Alignment

| Proposed Code      | Proposed Meaning               | Current Pattern                    | HTTP Status | Location                          |
| ------------------ | ------------------------------ | ---------------------------------- | ----------- | --------------------------------- |
| `INVALID_PAYLOAD`  | Missing required fields        | `sendValidationError()`            | 400         | index.js                          |
| `INVALID_MODE`     | Unsupported mode               | `sendValidationError()`            | 400         | index.js (new)                    |
| `MISSING_METADATA` | Missing mode-specific metadata | `sendValidationError()`            | 400         | validators/promptPayload.js (new) |
| `GENERATION_ERROR` | Content generation failed      | Error thrown, caught by middleware | 500         | genieService.js                   |

### Implementation Strategy

The proposed numeric error codes align well with existing error handling infrastructure:

1. **Use existing errorHandler utility** for consistency
2. **Create promptPayload.js validator** to centralize validation logic
3. **Return structured error responses** with numeric codes instead of generic messages
4. **Maintain backward compatibility** in error middleware

---

## Alignment Checklist

### Error Code Alignment ✅

- [x] Error codes map to existing HTTP status patterns
- [x] Framework (`createErrorResponse`) supports numeric codes
- [x] Error structure matches proposed format
- [x] Error middleware can handle all four codes

### Endpoint Validation ✅

- [x] Current endpoint uses `sendValidationError()` helper
- [x] Endpoint can be extended to validate mode and metadata
- [x] Error responses already structured correctly

### Service Layer ⚠️

- [x] genieService has error handling pattern
- [x] Services throw errors with status codes
- [ ] Services need to return standardized `out_envelope`
- [ ] Services need `handle(payload)` signature instead of current signatures

### Service Handlers ⚠️

- [x] sampleService already uses envelope structure
- [ ] demoService needs envelope signature update
- [ ] ebookService needs to be created

---

## Key Findings

### 1. **Error Framework is Aligned** ✅

The existing `errorHandler.js` utility already supports the structured error format with codes, messages, and HTTP status codes. No changes needed to error framework.

### 2. **Endpoint Validation Pattern is Aligned** ✅

The `/prompt` endpoint already uses `sendValidationError()` for structured validation errors. The proposed validation can use the same helper.

### 3. **Service Signatures Need Update** ⚠️

Current services use different method signatures and return shapes:

- **Current:** `generate(prompt)` or `generateFromPrompt(prompt)`
- **Proposed:** `handle(payload)` with standardized return

This requires method signatures to change, not error codes.

### 4. **Response Envelope is Partially Aligned** ✅

- `sampleService` already returns `{ out_envelope: {...}, metadata }`
- `demoService` returns `{ content, copies, metadata }` (needs adapter)
- Proposal standardizes on `{ out_envelope: { pages, metadata, actions } }`

### 5. **Error Codes Are Semantically Clear** ✅

Proposed numeric codes map cleanly to existing validation layers:

- `INVALID_PAYLOAD` → missing prompt/mode in body
- `INVALID_MODE` → unsupported mode in switch
- `MISSING_METADATA` → failed mode-specific validation
- `GENERATION_ERROR` → service throws error (already caught)

---

## Implementation Readiness

### Ready to Implement (No Alignment Changes Needed)

- ✅ Error code framework
- ✅ Validation error responses
- ✅ HTTP status code patterns
- ✅ Error middleware handling

### Requires Signature Changes (Service Contract Evolution)

- ⚠️ Method naming (`handle` vs. `generate`/`generateFromPrompt`)
- ⚠️ Parameter shape (payload object vs. string)
- ⚠️ Return envelope structure (standardization needed)

### Requires New Code

- ⚠️ `promptPayload.js` validator with mode-specific validation functions
- ⚠️ `genieService.process(payload)` with mode routing
- ⚠️ Service `handle(payload)` methods on all three services
- ⚠️ `ebookService.js` (new file)

---

## Recommendation

**The proposed numeric error codes are fully aligned with existing error handling infrastructure.** Implementation should proceed with:

1. **Use the proposed error codes exactly as specified** (they match HTTP status patterns)
2. **Leverage existing `errorHandler.js` utility** for consistency
3. **Focus implementation effort on service signature changes**, not error handling
4. **Maintain backward compatibility** in error middleware for existing code paths

No changes to error handling patterns are needed; the framework already supports the proposed codes.

---

**Last Updated:** 2025-11-10  
**Reviewed By:** Code Analysis Agent  
**Status:** ✅ Alignment Complete - Ready for Implementation
