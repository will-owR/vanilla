# Error Code Alignment - Visual Reference

**Quick Reference Guide for Error Code Implementation**

---

## Error Code Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend sends enhanced payload                              │
│ { mode, prompt, metadata{title,author,pages}, options }     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /prompt endpoint (server/index.js)                      │
│ • Receives req.body with enhanced payload                   │
│ • Calls validatePayload(req.body)                           │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
         ▼                ▼
    [Valid]           [Invalid]
         │                │
         │                ▼
         │        Returns error response:
         │        {
         │          error: "INVALID_PAYLOAD|INVALID_MODE|MISSING_METADATA",
         │          message: "...",
         │          fields?: [...]
         │        }
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ genieService.process(payload)                               │
│ • Routes by mode using switch statement                     │
│ • Calls appropriate service handler                         │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────┼───────┬─────────┐
         │       │       │         │
         ▼       ▼       ▼         ▼
     [basic] [demo] [ebook]   [error]
         │       │       │         │
         ▼       ▼       ▼         ▼
    sample  demo    ebook     Throws
    Service Service Service    Error
         │       │       │    (status=500)
         │       │       │    (code="GENERATION_ERROR")
         │       │       │         │
         └───────┼───────┴─────────┤
                 │                 │
                 ▼                 ▼
         [Handler Success]   [Error Middleware]
                 │                 │
                 ▼                 ▼
      Returns out_envelope   Returns error response:
      {                      {
        out_envelope: {        error: "GENERATION_ERROR",
          pages: [...],       message: "...",
          metadata: {...},    status: 500
          actions: {...}      }
        }
      }
                 │
                 └─────────┬───────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Endpoint returns response to frontend                        │
│ • Success: { out_envelope: { pages, metadata, actions } }   │
│ • Error:   { error: "CODE", message: "...", status: ... }   │
└─────────────────────────────────────────────────────────────┘
```

---

## Error Code Decision Tree

```
Request arrives at POST /prompt
         │
         ▼
    Does body have 'mode'?
    ├─ NO ──────────────────────────▶ INVALID_PAYLOAD ❌
    │
    └─ YES ──┐
             │
             ▼
    Is 'prompt' a non-empty string?
    ├─ NO ──────────────────────────▶ INVALID_PAYLOAD ❌
    │
    └─ YES ──┐
             │
             ▼
    Is mode in ['basic','demo','ebook']?
    ├─ NO ──────────────────────────▶ INVALID_MODE ❌
    │
    └─ YES ──┐
             │
             ▼
    Is mode === 'demo' or 'ebook'?
    ├─ NO (basic mode) ─────────────▶ Call sampleService.handle() ✅
    │
    └─ YES ──┐
             │
             ▼
    Does metadata have {title, author, pages}?
    ├─ NO ──────────────────────────▶ MISSING_METADATA ❌
    │
    └─ YES ──┐
             │
             ▼
    Call mode-specific service ✅
             │
             ▼
    Does service throw error?
    ├─ YES ─────────────────────────▶ GENERATION_ERROR ❌
    │
    └─ NO ──────────────────────────▶ Return out_envelope ✅
```

---

## Code Example: Error Flow

### Scenario 1: Invalid Payload (Missing Mode)

```javascript
// Request
POST /prompt
{ "prompt": "Hello world" }  // ← Missing 'mode'

// Validation
validatePayload(req.body)
  → !body.mode
  → return { valid: false, error: "INVALID_PAYLOAD", ... }

// Response
{
  "error": "INVALID_PAYLOAD",
  "message": "payload must include mode and prompt",
  "status": 400
}
```

### Scenario 2: Invalid Mode

```javascript
// Request
POST /prompt
{
  "mode": "summary",  // ← Not in ['basic','demo','ebook']
  "prompt": "Hello world"
}

// Validation
validatePayload(req.body)
  → body.mode = "summary"
  → !validModes.includes("summary")
  → return { valid: false, error: "INVALID_MODE", ... }

// Response
{
  "error": "INVALID_MODE",
  "message": "unsupported mode specified",
  "status": 400
}
```

### Scenario 3: Missing Metadata

```javascript
// Request
POST /prompt
{
  "mode": "demo",
  "prompt": "Hello world",
  "metadata": { "title": "Test" }  // ← Missing author and pages
}

// Validation
validatePayload(req.body)
  → mode === "demo"
  → call validateDemoPayload(body)
    → !md.author || !md.pages
    → return { valid: false, error: "MISSING_METADATA", fields: [...] }

// Response
{
  "error": "MISSING_METADATA",
  "message": "missing required metadata fields for demo mode",
  "fields": ["title", "author", "pages"],
  "status": 400
}
```

### Scenario 4: Generation Error

```javascript
// Request
POST /prompt
{
  "mode": "basic",
  "prompt": "Hello world",
  "metadata": {}
}

// Validation passes ✅
// Service processing fails
genieService.process(payload)
  → sampleService.handle(payload)
    → throw new Error("Database connection failed")
    → caught by error middleware
    → returns { error: "GENERATION_ERROR", ... }

// Response
{
  "error": "GENERATION_ERROR",
  "message": "Database connection failed",
  "status": 500
}
```

### Scenario 5: Success

```javascript
// Request
POST /prompt
{
  "mode": "demo",
  "prompt": "Science fiction story",
  "metadata": {
    "title": "My Story",
    "author": "John Doe",
    "pages": 10
  }
}

// Validation passes ✅
// Service processing succeeds ✅
genieService.process(payload)
  → demoService.handle(payload)
    → generates pages
    → return { pages, metadata, actions }
  → wraps in out_envelope
  → returns { out_envelope: { pages, metadata, actions } }

// Response
{
  "out_envelope": {
    "pages": [
      { "title": "...", "blocks": [...] },
      { "title": "...", "blocks": [...] }
    ],
    "metadata": {
      "title": "My Story",
      "author": "John Doe",
      "pages": 10,
      "generated_at": "2025-11-10T...",
      "mode": "demo"
    },
    "actions": {
      "can_export": true,
      "can_preview": true
    }
  }
}
```

---

## HTTP Status Code Mapping

| Error Code         | HTTP Status               | Severity     | Action                            |
| ------------------ | ------------------------- | ------------ | --------------------------------- |
| `INVALID_PAYLOAD`  | 400 Bad Request           | Client Error | Retry with valid payload          |
| `INVALID_MODE`     | 400 Bad Request           | Client Error | Use valid mode (basic/demo/ebook) |
| `MISSING_METADATA` | 400 Bad Request           | Client Error | Provide required metadata fields  |
| `GENERATION_ERROR` | 500 Internal Server Error | Server Error | Retry later or contact support    |

---

## Implementation Checklist

### Phase 1: Validator Creation

- [ ] Create `server/validators/promptPayload.js`
- [ ] Implement `validatePayload(body)` function
  - [ ] Check `body.mode` exists
  - [ ] Check `body.prompt` is non-empty string
  - [ ] Route to mode-specific validator
  - [ ] Return `{ valid: true }` or `{ valid: false, error: "CODE", ... }`
- [ ] Implement `validateDemoPayload(body)` function
  - [ ] Check `metadata.title` exists
  - [ ] Check `metadata.author` exists
  - [ ] Check `metadata.pages` exists
  - [ ] Return error code `MISSING_METADATA` if missing
- [ ] Implement `validateEbookPayload(body)` function
  - [ ] Same checks as demo mode

### Phase 2: Endpoint Update

- [ ] Import validator in `server/index.js`
- [ ] Call `validatePayload(req.body)` in POST `/prompt` handler
- [ ] Return error response if validation fails
  - [ ] Use proper error code from validator
  - [ ] Use proper HTTP status code (400)
- [ ] Call `genieService.process(req.body)` on validation success

### Phase 3: Service Layer

- [ ] Add `process(payload)` to `genieService.js`
- [ ] Implement mode-based routing with switch statement
- [ ] Call appropriate service handler based on mode
- [ ] Catch service errors and return with error code `GENERATION_ERROR`

### Phase 4: Service Handlers

- [ ] Add `handle(payload)` to `sampleService.js`
- [ ] Add `handle(payload)` to `demoService.js`
- [ ] Create `ebookService.js` with `handle(payload)`
- [ ] All handlers return `{ pages, metadata, actions }`

### Phase 5: Testing

- [ ] Test `INVALID_PAYLOAD` error (missing mode)
- [ ] Test `INVALID_PAYLOAD` error (missing prompt)
- [ ] Test `INVALID_MODE` error (invalid mode value)
- [ ] Test `MISSING_METADATA` error (demo mode)
- [ ] Test `MISSING_METADATA` error (ebook mode)
- [ ] Test `GENERATION_ERROR` (service throws error)
- [ ] Test success response (all modes)

---

## Files to Create/Modify

### New Files

- `server/validators/promptPayload.js` - Validation functions
- `server/ebookService.js` - Ebook mode handler

### Modified Files

- `server/index.js` - Add validator call and error handling
- `server/genieService.js` - Add process() method with routing
- `server/sampleService.js` - Add handle() method
- `server/demoService.js` - Add handle() method

### No Changes Needed

- `server/utils/errorHandler.js` - Already supports error codes
- Error middleware - Already formats errors correctly

---

## Key Takeaway

The error codes flow through the system in this order:

1. **Validation Layer** (validator) → returns error code
2. **Endpoint** (index.js) → checks validity, uses error code
3. **Service Layer** (genieService) → routes or catches errors
4. **Service Handlers** → throw errors or return success
5. **Response** → Contains error code (failure) or out_envelope (success)

Error codes are standardized numeric identifiers that allow frontend to handle specific error scenarios programmatically.

---

**Reference Status:** ✅ Complete  
**Implementation Ready:** ✅ Yes  
**Next Step:** Create validator (`server/validators/promptPayload.js`)

Last Updated: 2025-11-10
