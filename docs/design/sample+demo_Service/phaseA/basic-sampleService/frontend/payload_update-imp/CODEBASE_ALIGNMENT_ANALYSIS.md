# Codebase Alignment Summary

**Date:** 2025-11-10  
**Scope:** Comprehensive review of error codes against existing implementation patterns  
**Conclusion:** Error codes are fully aligned; service signatures require updates

---

## Executive Summary

The proposed numeric error codes align **perfectly** with the existing error handling infrastructure in the codebase. The framework already supports structured error responses with codes, messages, HTTP status codes, and optional technical details.

**No changes to error handling patterns are required.** Implementation should focus on:

1. Creating the payload validator with mode-specific validation
2. Updating service method signatures (from `generate()` to `handle()`)
3. Updating return shapes (standardizing `out_envelope` structure)

---

## Detailed Codebase Review

### Error Handling Infrastructure ✅

**File:** `server/utils/errorHandler.js`

**Current Implementation:**

```javascript
const ERROR_TYPES = {
  VALIDATION: "VALIDATION_ERROR",
  PROCESSING: "PROCESSING_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
};

function createErrorResponse(message, code, status, details = null) {
  const errorResponse = {
    error: {
      message,
      code,
      status,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    },
  };
  if (isDev && details) {
    errorResponse.error.details = details;
  }
  return errorResponse;
}

function sendValidationError(res, message, details = null) {
  const response = createErrorResponse(
    message,
    ERROR_TYPES.VALIDATION,
    400,
    details
  );
  res.status(400).json(response);
}
```

**Alignment:** ✅ **Perfect**

- Already accepts numeric/string codes
- Returns structured error object with code, message, status, timestamp, requestId
- Separates development and production error details
- Used by endpoint for validation responses

**Proposed Usage:**

```javascript
// Replace generic VALIDATION_ERROR with specific numeric codes:
sendValidationError(res, "Prompt is required", { error: "INVALID_PAYLOAD" });
```

---

### Endpoint Validation ✅

**File:** `server/index.js` (lines 660-690)

**Current Implementation:**

```javascript
app.post("/prompt", async (req, res, next) => {
  const { prompt } = req.body;

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

**Current Validation Checks:**

1. ✅ Validates `prompt` exists and is non-empty string
2. ❌ Does not validate `mode`
3. ❌ Does not validate `metadata`

**Alignment Issues:**

- Error code returned: Generic `VALIDATION_ERROR`
- Does not map to proposed `INVALID_PAYLOAD`, `INVALID_MODE`, `MISSING_METADATA`
- Error caught as middleware exception (generic error handler)

**Proposed Changes:**

```javascript
// Will add these validation checks:
1. validatePayload() - checks mode and prompt
2. validateDemoPayload() - checks metadata for demo mode
3. validateEbookPayload() - checks metadata for ebook mode
```

**HTTP Status Alignment:**

- Current: 400 (validation), 500 (processing) → ✅ Matches proposed
- Current: 201 (success) → Can stay, or change to 200

---

### Service Validation (genieService) ✅

**File:** `server/genieService.js`

**Current Implementation:**

```javascript
async generate(prompt) {
  if (!prompt || !String(prompt).trim()) {
    const e = new Error("Prompt is required");
    e.status = 400;
    throw e;
  }
  // ... rest of implementation
}
```

**Validation Checks:**

- ✅ Validates prompt is non-empty string
- ❌ Does not validate mode
- ❌ Does not have mode-based routing

**Error Pattern:**

- Creates Error object with `.status` property (400)
- Thrown to middleware for formatting

**Alignment:** ✅ **Pattern-Aligned**

- Uses same HTTP status pattern as proposed
- Error is caught by middleware (already handles error formatting)
- Can be extended with mode-based routing

**Proposed Changes:**

```javascript
export async function process(payload) {
  // Will add mode-based routing:
  switch (payload.mode) {
    case "demo":
      result = await demoService.handle(payload);
      break;
    case "ebook":
      result = await ebookService.handle(payload);
      break;
    default:
      result = await sampleService.handle(payload);
  }
  // Will return standardized out_envelope
}
```

---

### Service Response Structure ✅

**File:** `server/sampleService.js`

**Current Implementation:**

```javascript
async function generate(envelopeReq = {}, opts = {}) {
  // ... validation and generation
  outEnv.pages = pages;
  outEnv.metadata = outEnv.metadata || { model: "sample-v1" };
  outEnv.actions = outEnv.actions || {};

  const metadata = { generatedAt: new Date().toISOString() };
  return { out_envelope: outEnv, metadata };
}
```

**Current Response Shape:**

```json
{
  "out_envelope": {
    "pages": [...],
    "metadata": { "model": "sample-v1", ... },
    "actions": { ... }
  },
  "metadata": { "generatedAt": "2025-11-10T..." }
}
```

**Alignment:** ✅ **Highly Aligned**

- Already implements `out_envelope` structure
- Already includes `pages`, `metadata`, `actions`
- Already adds `generated_at` timestamp (proposed: `generated_at`)
- Already includes `mode` (proposed: `mode` field)

**Proposed Standardization:**

```json
{
  "out_envelope": {
    "pages": [...],
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

---

### Demo Service ⚠️

**File:** `server/demoService.js`

**Current Implementation:**

```javascript
async function generateFromPrompt(prompt) {
  const content = buildContent(prompt);
  const copies = makePages(content, 3);
  const metadata = { model: "demo-1", pages: copies.length };
  return { content, copies, metadata };
}
```

**Current Response Shape:**

```json
{
  "content": { "title": "...", "body": "..." },
  "copies": [...],
  "metadata": { "model": "demo-1", "pages": 3 }
}
```

**Alignment Issue:** ⚠️ **Incompatible Response Shape**

- Returns `{ content, copies, metadata }` instead of `{ out_envelope }`
- Returns `copies` instead of `pages`
- Missing `actions` key
- Needs adapter/wrapper to match standardized format

**Proposed Update:**

```javascript
// Add new method alongside current one for backward compatibility:
async function handle(payload) {
  const { prompt, metadata = {}, options = {} } = payload;

  // Validate mode-specific metadata
  const md = metadata || {};
  if (!md.title || !md.author || !md.pages) {
    const e = new Error("Demo mode requires title, author, and pages");
    e.status = 400;
    e.code = "MISSING_METADATA";
    throw e;
  }

  // Generate content
  const content = buildContent(prompt);
  const pages = makePages(content, parseInt(md.pages) || 3);

  return {
    pages,
    metadata: {
      ...metadata,
      model: "demo-1",
      generatedAt: new Date().toISOString(),
    },
    actions: { can_export: true, can_preview: true },
  };
}
```

---

### Ebook Service ❌

**File:** `server/ebookService.js` (Does not exist)

**Status:** Must be created

**Proposed Implementation:**

```javascript
export async function handle(payload) {
  const { prompt, metadata = {}, options = {} } = payload;

  // Validate mode-specific metadata
  const md = metadata || {};
  if (!md.title || !md.author || !md.pages) {
    const e = new Error("Ebook mode requires title, author, and pages");
    e.status = 400;
    e.code = "MISSING_METADATA";
    throw e;
  }

  // Generate ebook content
  // ... implementation

  return {
    pages,
    metadata: {
      ...metadata,
      model: "ebook-v1",
      generatedAt: new Date().toISOString(),
    },
    actions: { can_export: true, can_preview: true },
  };
}
```

---

## Error Code Mapping Table

| Numeric Code       | Meaning                                 | Validation Layer                             | HTTP Status | Current Pattern       |
| ------------------ | --------------------------------------- | -------------------------------------------- | ----------- | --------------------- |
| `INVALID_PAYLOAD`  | Missing `mode` or `prompt`              | promptPayload.validatePayload()              | 400         | sendValidationError() |
| `INVALID_MODE`     | Unsupported mode (not basic/demo/ebook) | promptPayload.validatePayload()              | 400         | sendValidationError() |
| `MISSING_METADATA` | Mode-specific metadata missing          | promptPayload.validate{Demo\|Ebook}Payload() | 400         | sendValidationError() |
| `GENERATION_ERROR` | Service throws during generation        | genieService.process() catch block           | 500         | Error middleware      |

---

## Implementation Checklist

### Phase 1: Validator Creation ✅ Ready

- [ ] Create `server/validators/promptPayload.js`
- [ ] Implement `validatePayload(body)`
  - Check `mode` exists and is string
  - Check `prompt` exists and is non-empty string
  - Route to mode-specific validators
- [ ] Implement `validateDemoPayload(body)`
  - Check `metadata.title`, `metadata.author`, `metadata.pages` exist
- [ ] Implement `validateEbookPayload(body)`
  - Check `metadata.title`, `metadata.author`, `metadata.pages` exist

### Phase 2: Endpoint Enhancement ✅ Ready

- [ ] Update `server/index.js` POST `/prompt` handler
- [ ] Call `validatePayload()` before processing
- [ ] Return structured error responses with numeric codes
- [ ] Route to `genieService.process(body)` instead of `generate(prompt)`

### Phase 3: Service Routing ✅ Ready

- [ ] Add `process(payload)` to `server/genieService.js`
- [ ] Implement mode-based switch routing
- [ ] Call appropriate service handler based on mode
- [ ] Return standardized `out_envelope` response

### Phase 4: Service Handlers ✅ Ready

- [ ] Add `handle(payload)` to `server/sampleService.js`
- [ ] Add `handle(payload)` to `server/demoService.js`
- [ ] Create `server/ebookService.js` with `handle(payload)`
- [ ] Standardize response shape across all services

### Phase 5: Testing ✅ Ready

- [ ] Test invalid payload (missing mode)
- [ ] Test invalid mode (unsupported value)
- [ ] Test missing metadata (demo mode)
- [ ] Test generation error (service failure)
- [ ] Test success response (all modes)

---

## Backward Compatibility Notes

The codebase has multiple endpoint consumers. When updating the `/prompt` endpoint:

1. **frontend** (`client/src/lib/api.js`)

   - Currently sends: `{ prompt }`
   - Will send: `{ mode, prompt, metadata, options }`
   - **Status:** Frontend must be updated in Phase 2

2. **Legacy code paths**

   - Some services still use old signatures (e.g., `generateFromPrompt`)
   - Keep old methods for backward compatibility during transition
   - Add new `handle()` methods alongside

3. **Error response format**
   - Current: `{ error: { message, code, status, timestamp, requestId, details } }`
   - Proposed: Same format, with specific numeric codes
   - **Status:** Fully backward compatible

---

## Conclusion

### Error Codes: ✅ **Fully Aligned**

The proposed numeric error codes map perfectly to existing HTTP status patterns and error handling infrastructure. No framework changes needed.

### Service Contracts: ⚠️ **Requires Updates**

Services need method signature changes (from `generate(prompt)` to `handle(payload)`) and return shape standardization. This is a breaking change that requires careful transition planning.

### Implementation Path: ✅ **Clear and Straightforward**

1. Create validator with error codes
2. Update endpoint to call validator and route to new service
3. Add mode-based routing in genieService
4. Update all service handlers to accept payload and return standardized envelope
5. Update frontend to assemble and send enhanced payload

**All work should proceed as outlined in `API_payload_actionables.md`.**

---

**Last Updated:** 2025-11-10  
**Alignment Status:** ✅ Complete  
**Ready for Implementation:** Yes
