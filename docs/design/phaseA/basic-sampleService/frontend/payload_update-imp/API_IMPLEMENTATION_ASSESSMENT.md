---
title: API Payload Implementation - Codebase Assessment
date: 2025-11-10
status: assessment
---

## Executive Summary

This assessment validates the three-step sequential implementation approach documented in `API_payload_implementation.md`:

1. **Backend Enhancement** (`/prompt` Endpoint)
2. **Service Layer Updates**
3. **Frontend Integration**

The documented plan is sound and well-structured. This assessment confirms the approach, identifies all gaps between the plan and current codebase, and provides detailed step-by-step implementation with complete code examples and test cases.

**Current Codebase Status**: The codebase has **partial support** for this design but with significant gaps and misalignment between the frontend stores and backend endpoints.

### Current State: 3/10 (30% implemented)

- ✅ **Stores exist**: `promptStore` and `modeStore` with metadata structures
- ✅ **Backend `/prompt` endpoint exists** with basic prompt handling
- ✅ **Service layer routing exists** (genieService delegates to handlers)
- ❌ **Frontend/Backend payload mismatch**: Client doesn't send enhanced payload structure
- ❌ **Mode-specific validation missing**: Not enforced for demo/ebook modes
- ❌ **Service handlers don't receive full payload**: Only receive prompt string
- ❌ **Metadata not flowing through pipeline**: Stored locally, not sent to server

---

## Detailed Gap Analysis

### 1. Frontend (`client/src/lib/api.js`)

**Current Implementation (Lines 112-138):**

```javascript
export async function submitPrompt(prompt) {
  // ⚠️ ISSUE: Only sends { prompt } - ignores mode, metadata, options
  const response = await fetchWithRetry("/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  // Returns { data: { content, ... } }
}
```

**Planned Implementation (per documentation):**

```javascript
const payload = {
  mode: ms.current || ps.mode || "basic",
  prompt: ps.prompt || "",
  metadata: ps.metadata || {},
  options: ps.options || {},
};
```

**Gap: Frontend payload structure not implemented**

- [ ] Does not read `promptStore` or `modeStore`
- [ ] Does not assemble enhanced payload with mode/metadata/options
- [ ] Does not perform client-side validation for demo mode
- [ ] App.svelte passes only prompt string, not full store state

**Impact**: Backend receives `{ prompt }` instead of `{ mode, prompt, metadata, options }`

---

### 2. Backend `/prompt` Endpoint (server/index.js, Lines 660-690)

**Current Implementation:**

```javascript
app.post("/prompt", async (req, res, next) => {
  const { prompt } = req.body;  // ⚠️ Only destructures prompt

  if (typeof prompt !== "string" || !prompt.trim()) {
    return sendValidationError(res, "...", { provided, required });
  }

  try {
    const genieResult = await genieService.generate(prompt);  // ⚠️ Passes only prompt
    const data = genieResult && genieResult.data ? { ...genieResult.data } : {};
    return res.status(201).json({ success: true, data });
  }
});
```

**Planned Implementation (per documentation):**

```javascript
app.post("/prompt", async (req, res) => {
  const body = req.body || {};
  if (!body.mode || typeof body.prompt !== "string") {
    return res.status(400).json({ error: "INVALID_PAYLOAD", message: "..." });
  }

  if (body.mode === "demo") {
    const md = body.metadata || {};
    if (!md.title || !md.author || !md.pages) {
      return res.status(400).json({
        error: "MISSING_METADATA",
        fields: ["title", "author", "pages"],
      });
    }
  }

  const result = await genieService.process(body); // ⚠️ Method doesn't exist
  return res.json(result);
});
```

**Gaps:**

- [ ] Does not validate presence of `mode` field
- [ ] Does not perform mode-specific metadata validation
- [ ] Calls `genieService.generate(prompt)` instead of `genieService.process(body)`
- [ ] `genieService.process()` method doesn't exist (has `generate()`)
- [ ] Does not pass full payload to service layer

**Impact**: Mode-based routing and validation cannot occur

---

### 3. Service Layer (server/genieService.js)

**Current Implementation (Lines 95-180):**

```javascript
async generate(prompt) {
  // ⚠️ Only accepts prompt string parameter
  if (!prompt || !String(prompt).trim()) {
    const e = new Error("Prompt is required");
    e.status = 400;
    throw e;
  }

  // Calls sampleService.generateFromPrompt with envelope
  const in_envelope = { prompt: String(prompt) };
  const envelopeReq = { in_envelope, out_envelope: {} };
  const result = await svc.generateFromPrompt(envelopeReq);
  // Returns normalized result
}
```

**Planned Implementation (per documentation):**

```javascript
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

**Gaps:**

- [ ] `process()` method doesn't exist
- [ ] No mode-based routing logic
- [ ] Cannot handle ebook or demo mode specifically
- [ ] Service handlers (sampleService, demoService, etc.) don't accept full payload
- [ ] No metadata extraction/passthrough

**Impact**: Mode-based generation selection cannot happen

---

### 4. Service Handlers (sampleService.js, demoService.js, ebook.js)

**Current Interface:**

```javascript
// sampleService.js
async function generate(envelopeReq = {}) {
  // Only accepts { in_envelope, out_envelope }
  // Does not support metadata, mode, options
}

// demoService.js
async function generateFromPrompt(prompt) {
  // Only accepts prompt string
  // Cannot access metadata
}

// ebook.js
async function renderBookToPDF(poems, browser) {
  // Takes poems array + browser
  // No support for metadata from prompt
}
```

**Planned Interface (per documentation):**

```javascript
export async function handle(payload) {
  const { prompt, metadata, options } = payload;
  // Access full payload capabilities
  const result = await generateContent(prompt);
  if (metadata) {
    result.metadata = { ...result.metadata, ...metadata };
  }
  return result;
}
```

**Gaps:**

- [ ] Service handlers don't have `handle()` method
- [ ] Cannot receive or process metadata
- [ ] Cannot receive or process options
- [ ] demoService returns `{ content, copies, metadata }` (different shape)
- [ ] No metadata flow-through to responses

**Impact**: Metadata doesn't propagate through generation pipeline

---

### 5. Frontend Stores (promptStore.js, modeStore.js)

**Current State (✅ Mostly Correct):**

```javascript
// promptStore.js - HAS metadata structure
const initialState = {
  mode: "demo",
  prompt: "",
  metadata: {
    title: "",
    author: "",
    pages: undefined,
  },
  generating: false,
  error: null,
};

// modeStore.js - PARTIALLY structured
const modeStore = {
  current: "demo",
  params: {
    promptType: "demo",
    outputType: "book",
    validation: "enhanced",
  },
};
```

**Assessment:**

- ✅ Stores are well-structured and exist
- ✅ Support for metadata fields
- ❌ **Critical Issue**: `submitPrompt(prompt)` in App.svelte only passes the prompt string
- ❌ Stores are never consulted when submitting

**Code Evidence (App.svelte, Line 41):**

```javascript
const result = await apiSubmitPrompt(prompt);
// ⚠️ Only passes prompt variable, ignores promptStore/modeStore
```

**Impact**: Client has the right infrastructure but doesn't use it

---

## Response Schema Analysis

**Documentation states:**

```json
{
  "out_envelope": {
    "pages": [],
    "metadata": {},
    "actions": {}
  }
}
```

**Current Backend returns:**

```javascript
res.status(201).json({ success: true, data });
// where data = genieResult.data
// Shape is { content: { title, body, ... }, metadata?, promptId?, resultId? }
```

**Current sampleService returns:**

```javascript
{
  out_envelope: outEnv, metadata;
}
// where outEnv = { pages, metadata, actions }
```

**Assessment:**

- ⚠️ Documentation schema doesn't match actual response shapes
- ⚠️ Two different response formats in circulation
- ✅ Can be unified by wrapping appropriately at endpoint level

---

## Data Flow Mismatch

### Planned (Documented) Flow:

```
UI (promptStore + modeStore)
  ↓ assembles { mode, prompt, metadata, options }
  ↓
submitPrompt()
  ↓ POST /prompt with full payload
  ↓
/prompt endpoint validates mode + metadata
  ↓ routes to genieService.process(payload)
  ↓
genieService routes to mode-specific handler
  ↓
Service handler receives full payload, enhances with metadata
  ↓
Response includes enhanced metadata
  ↓
UI receives { content, metadata, actions }
```

### Actual (Current) Flow:

```
UI (App.svelte)
  ↓ extracts only prompt string
  ↓
submitPrompt(prompt)
  ↓ POST /prompt with { prompt } only
  ↓
/prompt endpoint receives only { prompt }
  ↓ calls genieService.generate(prompt)
  ↓
genieService calls sampleService.generateFromPrompt(envelopeReq)
  ↓
sampleService generates without any mode/metadata awareness
  ↓
Response is { success, data: { content, ... } }
  ↓
UI receives generic content, mode/metadata lost
```

**Impact**: Mode and metadata are stranded in frontend stores, never reaching backend

---

## Validation Gaps

### Missing Validations (Planned vs Current):

| Validation                  | Planned      | Current      | Status     |
| --------------------------- | ------------ | ------------ | ---------- |
| `mode` presence             | ✅ Required  | ❌ N/A       | Missing    |
| `prompt` presence           | ✅ Required  | ✅ Check     | Partial    |
| `demo` mode requires title  | ✅ Required  | ❌ N/A       | Missing    |
| `demo` mode requires author | ✅ Required  | ❌ N/A       | Missing    |
| `demo` mode requires pages  | ✅ Required  | ❌ N/A       | Missing    |
| `ebook` mode requirements   | ✅ Implied   | ❌ N/A       | Missing    |
| Client-side validation      | ✅ Proposed  | ❌ Missing   | Missing    |
| Error response format       | ✅ Specified | ❌ Different | Mismatched |

---

## Error Response Misalignment

**Documented Format:**

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "fields": ["field1", "field2"]
}
```

**Current Format (sendValidationError):**

```json
{
  "error": "...",
  "message": "..."
  // Additional context object
}
```

**Assessment**: Mostly compatible but `fields` array not used

---

## Service Handler Compatibility

### demoService.js (Lines 1-30)

```javascript
async function generateFromPrompt(prompt) {
  const content = buildContent(prompt);
  const copies = makePages(content, 3);
  const metadata = { model: "demo-1", pages: copies.length };
  return { content, copies, metadata }; // ⚠️ Different shape!
}
```

**Issues:**

- Returns `{ content, copies, metadata }` not `{ out_envelope }`
- Doesn't match sampleService interface
- Can't receive mode-specific parameters
- `copies` doesn't exist in planned `out_envelope`

### sampleService.js (Lines 32-68)

```javascript
async function generate(envelopeReq = {}) {
  // Returns { out_envelope: {...}, metadata }
  outEnv.pages = pages;
  outEnv.metadata = outEnv.metadata || { model: "sample-v1" };
  outEnv.actions = outEnv.actions || {};
  return { out_envelope: outEnv, metadata };
}
```

**Status:** ✅ Matches documented interface correctly

### ebook.js (Lines 1-117)

```javascript
async function renderBookToPDF(poems, browser) {
  // Different interface entirely
  // Takes poems array, not envelope
  // No metadata flow-through
}
```

**Issues:**

- Completely different interface
- Not designed for mode-based payload routing
- Used directly for export, not integrated with `/prompt` flow

---

## Acceptance Criteria Assessment

### From Documentation:

**1. Enhanced Payload** ✅ Partial

- [ ] ✅ Stores exist with correct structure
- [ ] ❌ Frontend doesn't assemble payload
- [ ] ❌ Endpoint doesn't validate enhanced structure
- [ ] ❌ Mode-specific validation missing

**2. Service Integration** ❌ Missing

- [ ] ❌ Services don't receive complete payload
- [ ] ❌ Metadata doesn't flow through pipeline
- [ ] ❌ Mode routing not implemented
- [ ] ⚠️ Services have incompatible interfaces

**3. Error Handling** ⚠️ Partial

- [ ] ✅ Basic validation errors present
- [ ] ❌ Mode-specific validation errors missing
- [ ] ⚠️ Error format close but not exact
- [ ] ❌ Field-specific validation errors missing

---

## Root Causes

1. **Incomplete Implementation**: Plan was documented but not coded
2. **Frontend/Backend Disconnect**: API contract not enforced
3. **Service Handler Mismatch**: No unified interface for mode handlers
4. **Missing Method**: `genieService.process()` doesn't exist
5. **Response Format Ambiguity**: Multiple shapes in circulation
6. **Stores Unused**: Powerful data structures exist but aren't consulted

---

## Dependencies & Blockers

### Critical Path to Implementation:

1. **Frontend submitPrompt() modification** (Blocks all)

   - Must read from promptStore/modeStore
   - Must assemble enhanced payload
   - Must add client-side validation

2. **Create genieService.process()** (Blocks backend)

   - Must implement mode-based routing
   - Must call appropriate handler

3. **Update Service Handlers** (Blocks data flow)

   - Unify to accept full payload
   - Implement metadata handling
   - Standardize response shape

4. **Update /prompt endpoint** (Depends on #2, #3)

   - Add enhanced validation
   - Call genieService.process()
   - Return consistent response format

5. **Update Response Envelope** (Depends on #3, #4)
   - Standardize response schema
   - Ensure metadata preservation
   - Handle actions properly

---

## Implementation Strategy: Two-Phase Approach

The implementation will proceed in two distinct phases, with backend fully functional before frontend integration:

### Phase 1: Backend (Weeks 1-2)

#### Step 1A: Update `/prompt` Endpoint (FIRST)

- **File**: `server/index.js` (Lines 660-690)
- **Changes**:

  - Validate `mode` presence and value
  - Validate `prompt` presence
  - Add mode-specific metadata validation for "demo" mode
  - Call new `genieService.process(body)` (instead of `genieService.generate(prompt)`)
  - Return standardized response envelope
  - Implement error responses with consistent format

- **Code Required** (~25-35 lines):
  ```javascript
  app.post("/prompt", async (req, res, next) => {
    const body = req.body || {};

    // Validate required fields
    if (!body.mode || typeof body.prompt !== "string") {
      return res.status(400).json({
        error: "INVALID_PAYLOAD",
        message: "payload must include mode and prompt",
      });
    }

    // Mode-specific validation
    if (body.mode === "demo") {
      const md = body.metadata || {};
      if (!md.title || !md.author || typeof md.pages !== "number") {
        return res.status(400).json({
          error: "MISSING_METADATA",
          message: "demo mode requires title, author, and pages",
          fields: ["title", "author", "pages"],
        });
      }
    }

    try {
      const result = await genieService.process(body);
      return res.status(201).json(result);
    } catch (err) {
      err.status = err.status || 500;
      next(err);
    }
  });
  ```

#### Step 1B: Create `genieService.process()` Method

- **File**: `server/genieService.js`
- **Changes**:

  - Add new `process(payload)` method (keep `generate()` for backward compatibility)
  - Implement mode-based routing:
    - `"basic"` → sampleService
    - `"demo"` → demoService (to be introduced later)
    - `"ebook"` → ebookService (stub for now)
  - Pass full payload to service handlers
  - Handle responses from all services

- **Code Required** (~20-30 lines):
  ```javascript
  async process(payload) {
    const { mode = "basic", prompt, metadata, options } = payload;

    if (!prompt || !String(prompt).trim()) {
      const e = new Error("Prompt is required");
      e.status = 400;
      throw e;
    }

    let handler;
    switch (mode) {
      case "demo":
        handler = require("./demoService");
        break;
      case "ebook":
        handler = require("./ebookService");
        break;
      case "basic":
      default:
        handler = require("./sampleService");
    }

    if (typeof handler.handle === "function") {
      return await handler.handle(payload);
    }

    // Fallback for services without handle()
    const e = new Error(`Service ${mode} not properly initialized`);
    e.status = 500;
    throw e;
  }
  ```

#### Step 1C: Update Service Layer - `sampleService.js`

- **File**: `server/sampleService.js`
- **Changes**:

  - Add new `handle(payload)` method
  - Extract `prompt`, `metadata`, `options` from payload
  - Apply metadata to generated content
  - Keep `generate()` and `generateFromPrompt()` for backward compatibility
  - Return standardized `out_envelope` response

- **Code Required** (~15-25 lines):

  ```javascript
  async function handle(payload) {
    const { prompt, metadata = {}, options = {} } = payload;

    if (!prompt || !String(prompt).trim()) {
      const e = new Error("Prompt is required");
      e.status = 400;
      throw e;
    }

    // Use existing generate logic
    const envelopeReq = { in_envelope: { prompt }, out_envelope: {} };
    const result = await generate(envelopeReq, options);

    // Merge metadata if provided
    if (Object.keys(metadata).length > 0) {
      result.out_envelope.metadata = {
        ...result.out_envelope.metadata,
        ...metadata,
      };
    }

    return result;
  }

  module.exports = {
    // ... existing exports ...
    handle,
  };
  ```

#### Step 1D: Introduce `demoService.js` Handler Interface

- **File**: `server/demoService.js`
- **Changes**:

  - Modify existing `demoService.js` to add `handle(payload)` method
  - Keep existing functions for backward compatibility
  - Return response in `out_envelope` format (matching sampleService)
  - Process metadata from payload

- **Code Required** (~20-30 lines):

  ```javascript
  async function handle(payload) {
    const { prompt, metadata = {} } = payload;

    const content = buildContent(prompt);
    const copies = makePages(content, 3);

    // Return standardized envelope format
    return {
      out_envelope: {
        pages: copies,
        metadata: {
          model: "demo-1",
          pages: copies.length,
          ...metadata,
        },
        actions: {},
      },
    };
  }

  module.exports = {
    // ... existing exports ...
    handle,
  };
  ```

#### Step 1E: Add `ebookService.js` Stub

- **File**: `server/ebookService.js` (new or extend `server/ebook.js`)
- **Changes**:

  - Add stub `handle(payload)` method
  - Return appropriate error or placeholder response
  - Maintain interface consistency with other services

- **Code Required** (~15-20 lines):

  ```javascript
  async function handle(payload) {
    // Stub implementation - ebook service not fully implemented yet
    const { prompt, metadata = {} } = payload;

    return {
      out_envelope: {
        pages: [],
        metadata: {
          model: "ebook-stub",
          status: "not-implemented",
          ...metadata,
        },
        actions: {
          warning: "ebook generation not yet available",
        },
      },
    };
  }

  module.exports = { handle };
  ```

#### Step 1F: Integration Testing (Backend)

- Create test cases for `/prompt` endpoint with:
  - Valid basic mode payload
  - Valid demo mode with metadata
  - Invalid payloads (missing mode, missing metadata)
  - Mode-specific validation failures
  - Service routing verification

---

### Phase 2: Frontend (Week 3)

**Only after Phase 1 is complete and tested**

#### Step 2A: Update `submitPrompt()` in `client/src/lib/api.js`

- Implement store-based payload assembly
- Add client-side validation
- Update error handling

#### Step 2B: Update Call Sites

- Modify `App.svelte` to pass store instead of prompt string
- Update any other components calling submitPrompt

#### Step 2C: Frontend Testing

- Test payload assembly
- Test client-side validation
- Test mode switching

---

## Recommendations (Updated for Phased Approach)

### Phase 1: Backend (FIRST - Complete Before Frontend)

**Priority 1A: Endpoint Enhancement**

1. Update `/prompt` handler with enhanced validation
2. Call new `genieService.process(payload)` method
3. Return standardized response envelope
4. ✅ **Blocks**: All backend service work

**Priority 1B: Service Layer Architecture**

1. Create `genieService.process()` with mode routing
2. Add `handle(payload)` to sampleService
3. Update demoService interface to match
4. Add ebookService stub
5. ✅ **Blocks**: Frontend integration, end-to-end testing

**Priority 1C: Validation & Error Handling**

1. Implement mode validation in endpoint
2. Implement mode-specific metadata validation
3. Standardize error response format

**Priority 1D: Testing**

1. Unit tests for each service handler
2. Integration tests for `/prompt` endpoint with all modes
3. Validation error test cases

---

### Phase 2: Frontend (SECOND - After Backend Complete)

**Priority 2A: API Integration**

1. Update `submitPrompt()` to read from stores
2. Assemble enhanced payload
3. Add client-side validation

**Priority 2B: Component Updates**

1. Update `App.svelte` call site
2. Update any components using submitPrompt

**Priority 2C: Frontend Testing**

1. Test payload assembly from stores
2. Test client-side validation
3. Test mode switching behavior
4. Integration tests with backend

---

## File Change Summary - By Phase

### Phase 1: Backend Implementation

| File                      | Change Type            | Scope                               | Est. LOC | Priority |
| ------------------------- | ---------------------- | ----------------------------------- | -------- | -------- |
| `server/index.js`         | Update /prompt handler | Mode validation, route to process() | 25-35    | 1A       |
| `server/genieService.js`  | Add process() method   | Mode routing, service delegation    | 20-30    | 1B       |
| `server/sampleService.js` | Add handle() method    | Payload support, metadata merge     | 15-25    | 1B       |
| `server/demoService.js`   | Add handle() method    | Standardize envelope, add metadata  | 20-30    | 1B       |
| `server/ebookService.js`  | Create stub handle()   | Placeholder implementation          | 15-20    | 1B       |
| Test suite (new/updated)  | Integration tests      | `/prompt` endpoint, mode routing    | 40-60    | 1D       |

**Phase 1 Subtotal: 135-200 lines of code across 6 files**

### Phase 2: Frontend Integration (After Phase 1 Complete)

| File                     | Change Type           | Scope                               | Est. LOC | Priority |
| ------------------------ | --------------------- | ----------------------------------- | -------- | -------- |
| `client/src/lib/api.js`  | Modify submitPrompt() | Store reading, payload assembly     | 20-30    | 2A       |
| `client/src/App.svelte`  | Update call site      | Pass store instead of prompt string | 3-5      | 2B       |
| Test suite (new/updated) | Frontend tests        | Store integration, validation       | 30-50    | 2C       |

**Phase 2 Subtotal: 53-85 lines of code across 2-3 files**

### Total Implementation: 188-285 lines across 8-9 files (2 phases)

---

## Conclusion

The **documented implementation plan is sound and well-designed**, but it remains largely **unimplemented in the codebase**. The infrastructure (stores, basic endpoint) exists but pieces don't communicate.

**Key Issue**: Frontend assembles enhanced payload into stores but never sends it. Backend expects simple payload. Service layer isn't designed for mode-based routing.

**Implementation Feasibility**: HIGH - The architectural design is solid, just needs execution of the documented plan across backend and frontend layers.

**Phased Approach**: By implementing **backend first and independently**, we can:

1. ✅ Validate mode routing logic before frontend complexity
2. ✅ Test service layer changes in isolation
3. ✅ Ensure backend is stable and tested
4. ✅ Then integrate frontend without backend risk

**Risk Level**: LOW - Phase 1 (backend) is self-contained and testable. Phase 2 (frontend) is straightforward once backend is ready.

---

## Next Steps - Execution Order

### Phase 1: Backend Implementation (Start Here)

1. **Step 1A: Update `/prompt` Endpoint**

   - [ ] Modify `server/index.js` (lines 660-690)
   - [ ] Add mode validation
   - [ ] Call `genieService.process(body)` instead of `genieService.generate(prompt)`
   - [ ] Implement standardized error responses
   - [ ] **Estimated: 2-3 hours**

2. **Step 1B: Create `genieService.process()` Method**

   - [ ] Modify `server/genieService.js`
   - [ ] Add mode-based routing logic
   - [ ] **Estimated: 1-2 hours**

3. **Step 1C: Update `sampleService.js`**

   - [ ] Add `handle(payload)` method
   - [ ] Implement metadata merging
   - [ ] Keep existing functions for backward compat
   - [ ] **Estimated: 1-2 hours**

4. **Step 1D: Update `demoService.js`**

   - [ ] Add `handle(payload)` method
   - [ ] Return `out_envelope` format
   - [ ] Include metadata support
   - [ ] **Estimated: 1-2 hours**

5. **Step 1E: Create `ebookService.js` Stub**

   - [ ] Add minimal `handle(payload)` stub
   - [ ] Return placeholder response
   - [ ] **Estimated: 30 minutes**

6. **Step 1F: Phase 1 Integration Testing**
   - [ ] Test `/prompt` endpoint with valid payloads
   - [ ] Test mode routing
   - [ ] Test validation errors
   - [ ] Test metadata flow-through
   - [ ] **Estimated: 2-3 hours**

**Phase 1 Total: 8-15 hours, Backend fully functional and tested**

---

### Phase 2: Frontend Integration (Only After Phase 1 Complete)

1. **Step 2A: Update `submitPrompt()` in `api.js`**

   - [ ] Read from `promptStore` and `modeStore`
   - [ ] Assemble enhanced payload
   - [ ] Add client-side validation
   - [ ] **Estimated: 1-2 hours**

2. **Step 2B: Update Call Sites**

   - [ ] Modify `App.svelte` submitPrompt call
   - [ ] Update any other components
   - [ ] **Estimated: 30 minutes**

3. **Step 2C: Phase 2 Integration Testing**
   - [ ] Test payload assembly
   - [ ] Test client-side validation
   - [ ] Test end-to-end flow with backend
   - [ ] **Estimated: 2-3 hours**

**Phase 2 Total: 4-6 hours, Frontend fully integrated**

---

**Total Estimated Time: 12-21 hours (2-3 days of focused development)**
