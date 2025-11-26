---
title: API Payload Actionables — Pending Cleanup (Legacy-Mode Bridges & Response Normalization)
date: 2025-11-12
status: active
branch: feature/export-refactoring

**Note:** This document captures remaining work items identified during implementation review of `API_payload_actionables-merged.md`. These are minor cleanup tasks that ensure 100% alignment between canonical envelope design and live codebase.
---

## Overview

The enhanced prompt payload implementation is ~95% complete. The following work items address:

1. **Legacy-mode bridges**: Paths that still wrap responses in `{ success, data }` instead of canonical `{ out_envelope: {...} }`
2. **Response normalization**: Handlers returning inconsistent shapes across modes
3. **Metadata field coverage**: Ensuring every response includes `generated_at`, `mode`, and optional `request_id`
4. **Test coverage refresh**: Verifying all 4 error codes and canonical shapes are tested

---

## Issue 1: Response Wrapping Inconsistency

### Problem

The `/prompt` endpoint and service handlers return inconsistent shapes in different execution paths:

- **Canonical path**: `{ out_envelope: { pages, metadata, actions } }`
- **Legacy path** (via `defaultModule`): `{ success: true, data: { content, copies, metadata, promptId, resultId } }`
- **Cached path**: `{ success: true, data: { content, copies, metadata, promptId, resultId } }`

### Where It Happens

**File**: `server/genieService.js` (Lines 225–260)

```javascript
// Current: generate() still returns legacy shape through defaultModule
const { out, persistencePromise } = await defaultModule.runDefault({
  prompt,
  svcOut,
  result,
  injectedDbUtils: ...,
  ENABLE_PERSISTENCE,
  AWAIT_PERSISTENCE,
});
return out; // ← Returns { content, copies, metadata, promptId, resultId } (no out_envelope wrapper)
```

**File**: `server/genieService.js` (Lines 125–165)

```javascript
// Cached path also returns legacy shape
return {
  success: true,
  data: {
    content,
    copies: resultObj.copies || [],
    metadata,
    promptId: match.id,
    resultId: aiRow.id,
  },
};
```

### Why It Matters

Frontend `submitPrompt()` (Line 160–170 in `client/src/lib/api.js`) expects:

```javascript
const envelope = json?.out_envelope;
if (!envelope || !Array.isArray(envelope.pages)) {
  throw { type: "server", code: "INVALID_RESPONSE", message: "..." };
}
```

If `generate()` returns legacy shape, frontend parsing **fails**.

### Solution: Normalize All Paths to Canonical Envelope

#### Step 1A: Wrap `defaultModule` Output

**File**: `server/genieService.js` (Lines 225–260)

Replace:

```javascript
const defaultModule = require("./defaultModule");
const { out, persistencePromise } = await defaultModule.runDefault({
  prompt,
  svcOut,
  result,
  injectedDbUtils:
    typeof _injectedDbUtils !== "undefined" ? _injectedDbUtils : undefined,
  ENABLE_PERSISTENCE,
  AWAIT_PERSISTENCE,
});

// Expose the persistence promise for tests to await (compat with prior behavior)
genieService._lastPersistencePromise = persistencePromise;

return out;
```

With:

```javascript
const defaultModule = require("./defaultModule");
const { out, persistencePromise } = await defaultModule.runDefault({
  prompt,
  svcOut,
  result,
  injectedDbUtils:
    typeof _injectedDbUtils !== "undefined" ? _injectedDbUtils : undefined,
  ENABLE_PERSISTENCE,
  AWAIT_PERSISTENCE,
});

// Expose the persistence promise for tests to await (compat with prior behavior)
genieService._lastPersistencePromise = persistencePromise;

// Normalize legacy output to canonical envelope shape
const legacy = out || {};
return {
  out_envelope: {
    pages: legacy.content
      ? [{ id: 1, title: "Generated", blocks: [legacy.content] }]
      : [],
    metadata: {
      ...legacy.metadata,
      generated_at: legacy.metadata?.generated_at || new Date().toISOString(),
      mode: "basic",
    },
    actions: legacy.actions || {},
  },
};
```

**Rationale**: Converts `{ content, copies, metadata, ... }` → `{ out_envelope: { pages, metadata, actions } }`

#### Step 1B: Normalize Cached Lookup Path

**File**: `server/genieService.js` (Lines 125–165)

Replace:

```javascript
const resultObj =
  typeof aiRow.result === "string" ? JSON.parse(aiRow.result) : aiRow.result;
// Ensure cached results follow the same envelope shape as
// freshly-generated results: always include content.layout
// and a metadata object so callers/tests can rely on the
// contract.
const content = resultObj.content || resultObj || {};
if (!content.layout) content.layout = "poem-single-column";
const metadata = resultObj.metadata || {
  model: "cached-1",
  tokens: Math.max(10, Math.min(200, String(match.prompt || "").length)),
};

return {
  success: true,
  data: {
    content,
    copies: resultObj.copies || [],
    metadata,
    promptId: match.id,
    resultId: aiRow.id,
  },
};
```

With:

```javascript
const resultObj =
  typeof aiRow.result === "string" ? JSON.parse(aiRow.result) : aiRow.result;
// Ensure cached results follow the same envelope shape as
// freshly-generated results: always include content.layout
// and a metadata object so callers/tests can rely on the
// contract.
const content = resultObj.content || resultObj || {};
if (!content.layout) content.layout = "poem-single-column";
const metadata = resultObj.metadata || {
  model: "cached-1",
  tokens: Math.max(10, Math.min(200, String(match.prompt || "").length)),
};

// Return canonical envelope shape for consistency
return {
  out_envelope: {
    pages: content ? [{ id: 1, title: "Cached", blocks: [content] }] : [],
    metadata: {
      ...metadata,
      generated_at: metadata.generated_at || new Date().toISOString(),
      mode: "basic",
      cached: true,
      promptId: match.id,
      resultId: aiRow.id,
    },
    actions: {},
  },
};
```

---

## Issue 2: Service Handler Response Shapes Diverging

### Problem

Service handlers (`sampleService.handle()`, `demoService.handle()`, `ebookService.handle()`) return:

```javascript
{
  pages, metadata, actions;
}
```

But some legacy code paths still call `genieService.generate()` which returns a different shape. Additionally, the `process()` method wraps this, creating a mismatch:

**File**: `server/genieService.js` (Line 570–592)

```javascript
async process(payload) {
  const { mode, prompt, metadata = {}, options = {} } = payload;
  try {
    let result;
    // Mode-based routing to appropriate service handler
    switch (mode) {
      case "demo":
        const demoService = require("./demoService");
        result = await demoService.handle(payload);
        break;
      case "ebook":
        const ebookService = require("./ebookService");
        result = await ebookService.handle(payload);
        break;
      case "basic":
      default:
        result = await sampleService.handle(payload);
    }
    // Return standardized response envelope
    return {
      out_envelope: {
        pages: result.pages || [],
        metadata: {
          ...result.metadata,
          generated_at: new Date().toISOString(),
          mode: mode,
        },
        actions: result.actions || {},
      },
    };
  } catch (error) {
    throw new Error(`Generation failed: ${error.message}`);
  }
}
```

### Why It Matters

If a handler returns `{ pages: null }` or `{ pages: undefined }` instead of an array, frontend parsing treats it as valid and crashes. Also, if `metadata` is missing, frontend doesn't have `generated_at` or `mode`.

### Solution: Validate Handler Output in `process()`

**File**: `server/genieService.js` (Line 570–592)

Replace the entire `process()` method with:

```javascript
async process(payload) {
  const { mode, prompt, metadata = {}, options = {} } = payload;
  try {
    let result;
    // Mode-based routing to appropriate service handler
    switch (mode) {
      case "demo":
        const demoService = require("./demoService");
        result = await demoService.handle(payload);
        break;
      case "ebook":
        const ebookService = require("./ebookService");
        result = await ebookService.handle(payload);
        break;
      case "basic":
      default:
        result = await sampleService.handle(payload);
    }

    // Validate handler output shape: ensure pages is always an array
    if (!result || typeof result !== "object") {
      throw new Error(
        `Service handler for mode "${mode}" returned invalid type: ${typeof result}`
      );
    }

    const pages = Array.isArray(result.pages) ? result.pages : [];
    if (pages.length === 0) {
      console.warn(
        `genieService.process: handler for mode "${mode}" returned empty pages array`
      );
    }

    const handlerMetadata = result.metadata || {};
    if (!handlerMetadata.generated_at) {
      handlerMetadata.generated_at = new Date().toISOString();
    }

    // Return standardized response envelope
    return {
      out_envelope: {
        pages: pages,
        metadata: {
          ...handlerMetadata,
          mode: mode,
        },
        actions: result.actions || {},
      },
    };
  } catch (error) {
    throw new Error(`Generation failed: ${error.message}`);
  }
}
```

**Rationale**:

- Validates `pages` is always an array (prevents frontend crashes)
- Ensures `generated_at` is always present
- Warns if `pages` is empty (helps debug handler issues)
- Preserves all handler-specific metadata while enforcing canonical fields

---

## Issue 3: Endpoint-Level Response Normalization

### Problem

The `/prompt` endpoint (Lines 661–690 in `server/index.js`) calls `genieService.process()` but doesn't consistently wrap errors or success in the canonical format.

**File**: `server/index.js` (Lines 661–690)

```javascript
app.post("/prompt", async (req, res, next) => {
  try {
    const { validatePayload } = require("./validators/promptPayload");

    // Validate enhanced payload
    const validation = validatePayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        message: validation.message,
        fields: validation.fields,
      });
    }

    // genieService.process() handles mode-based routing and service delegation
    const result = await genieService.process(req.body);

    return res.status(201).json(result); // ← Assumes result is already canonical
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
});
```

### Why It Matters

If `genieService.process()` or any service handler throws an error that doesn't have `.status` set, the error middleware may format it inconsistently. Also, the endpoint assumes `result` is always `{ out_envelope: {...} }` but doesn't validate.

### Solution: Add Endpoint-Level Validation & Normalization

**File**: `server/index.js` (Lines 661–690)

Replace with:

```javascript
app.post("/prompt", async (req, res, next) => {
  try {
    const { validatePayload } = require("./validators/promptPayload");

    // Validate enhanced payload
    const validation = validatePayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        message: validation.message,
        fields: validation.fields,
      });
    }

    // genieService.process() handles mode-based routing and service delegation
    const result = await genieService.process(req.body);

    // Validate canonical response shape before returning
    if (
      !result ||
      !result.out_envelope ||
      !Array.isArray(result.out_envelope.pages)
    ) {
      const err = new Error(
        "Service returned invalid envelope: missing out_envelope.pages array"
      );
      err.status = 500;
      throw err;
    }

    // Attach request_id to metadata for traceability
    if (req.id && result.out_envelope.metadata) {
      result.out_envelope.metadata.request_id = req.id;
    }

    return res.status(201).json(result);
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
});
```

**Rationale**:

- Validates canonical shape at endpoint boundary (defensive)
- Attaches `request_id` from middleware (traceability per merged doc)
- Catches shape errors before frontend receives them

---

## Issue 4: Test Coverage Gaps

### Problem

While validators, endpoint, and handlers exist, integration tests may not cover:

1. All 4 error codes: `INVALID_PAYLOAD`, `INVALID_MODE`, `MISSING_METADATA`, `GENERATION_ERROR`
2. Canonical envelope shape in all modes
3. Metadata field presence (`generated_at`, `mode`, `request_id`)
4. Legacy-path normalization (cached results, defaultModule output)

### Test Files to Audit/Create

#### `server/__tests__/prompt.controller.test.mjs`

**Coverage needed**:

- ✅ POST `/prompt` with `mode: "basic"` → canonical 201 response
- ✅ POST `/prompt` with `mode: "demo"` + full metadata → canonical 201 response
- ✅ POST `/prompt` missing `mode` → `INVALID_PAYLOAD` 400
- ✅ POST `/prompt` invalid `mode: "unknown"` → `INVALID_MODE` 400
- ✅ POST `/prompt` `mode: "demo"` missing `metadata.title` → `MISSING_METADATA` 400
- ✅ POST `/prompt` service throws → `GENERATION_ERROR` 500 (or similar)
- ✅ Response includes `out_envelope.metadata.generated_at` (ISO timestamp)
- ✅ Response includes `out_envelope.metadata.mode`
- ✅ Response includes `out_envelope.metadata.request_id` (from middleware)
- ✅ Response includes `out_envelope.pages` as non-empty array

#### `server/__tests__/genieService.process.test.mjs`

**Coverage needed**:

- ✅ `process({ mode: "basic", prompt: "..." })` returns `{ out_envelope: {...} }`
- ✅ `process()` calls correct handler by mode (mock/spy)
- ✅ Handler with empty pages → warning logged, but still returns canonical shape
- ✅ Handler without `generated_at` → process() adds it
- ✅ Cached lookup returns canonical shape (not legacy `{ success, data }`)

#### `client/__tests__/api.submitPrompt.test.js`

**Coverage needed**:

- ✅ Mock fetch to return canonical `{ out_envelope: { pages, metadata, actions } }`
- ✅ `submitPrompt()` parses pages array successfully
- ✅ `submitPrompt()` rejects on missing `out_envelope.pages`
- ✅ `submitPrompt()` rejects on server error with code + message
- ✅ `submitPrompt()` passes `metadata.title`, etc. for demo mode

### Quick Test Template

```javascript
// Example: server/__tests__/prompt.controller.test.mjs
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../index.js";

describe("POST /prompt canonical envelope", () => {
  it("should return canonical envelope for basic mode", async () => {
    const response = await request(app).post("/prompt").send({
      mode: "basic",
      prompt: "Hello world",
      metadata: {},
      options: {},
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("out_envelope");
    expect(response.body.out_envelope).toHaveProperty("pages");
    expect(Array.isArray(response.body.out_envelope.pages)).toBe(true);
    expect(response.body.out_envelope.metadata).toHaveProperty("generated_at");
    expect(response.body.out_envelope.metadata).toHaveProperty("mode", "basic");
    expect(response.body.out_envelope.metadata).toHaveProperty("request_id");
  });

  it("should return MISSING_METADATA for demo mode without title", async () => {
    const response = await request(app)
      .post("/prompt")
      .send({
        mode: "demo",
        prompt: "Hello",
        metadata: { author: "Someone" }, // missing title, pages
        options: {},
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("MISSING_METADATA");
    expect(Array.isArray(response.body.fields)).toBe(true);
  });
});
```

---

## Implementation Checklist

### Phase 1: Response Normalization (Blocking)

- [ ] **Step 1A**: Wrap `defaultModule.runDefault()` output in canonical envelope (Issue 1A)
- [ ] **Step 1B**: Normalize cached lookup path to canonical envelope (Issue 1B)
- [ ] **Step 2**: Add validation + `request_id` attachment at endpoint (Issue 3)
- [ ] **Step 3**: Add handler output validation in `process()` (Issue 2)

### Phase 2: Test Coverage Refresh (Verification)

- [ ] Audit `prompt.controller.test.mjs` for all 4 error codes
- [ ] Add coverage for canonical envelope shape in all modes
- [ ] Add coverage for metadata fields (`generated_at`, `mode`, `request_id`)
- [ ] Add coverage for legacy-path normalization (cached results)
- [ ] Run full test suite: `cd server && npm test`

### Phase 3: Frontend Integration Test (Optional But Recommended)

- [ ] Run client tests: `cd client && npm test`
- [ ] Manual curl test to verify envelope shape:
  ```bash
  curl -X POST http://localhost:3000/prompt \
    -H "Content-Type: application/json" \
    -d '{"mode":"basic","prompt":"Hello","metadata":{},"options":{}}'
  ```

---

## Files to Modify (Summary)

| File                                             | Lines   | Change                                       | Priority   |
| ------------------------------------------------ | ------- | -------------------------------------------- | ---------- |
| `server/genieService.js`                         | 225–260 | Wrap defaultModule output                    | **High**   |
| `server/genieService.js`                         | 125–165 | Normalize cached lookup                      | **High**   |
| `server/genieService.js`                         | 570–592 | Validate handler output + add `generated_at` | **High**   |
| `server/index.js`                                | 661–690 | Validate envelope + attach `request_id`      | **High**   |
| `server/__tests__/prompt.controller.test.mjs`    | —       | Add/refresh canonical envelope tests         | **Medium** |
| `server/__tests__/genieService.process.test.mjs` | —       | Add/refresh handler output tests             | **Medium** |
| `client/__tests__/api.submitPrompt.test.js`      | —       | Add/refresh envelope parsing tests           | **Low**    |

---

## Acceptance Criteria

- [ ] All service paths return `{ out_envelope: { pages, metadata, actions } }` shape
- [ ] Every response includes `metadata.generated_at` (ISO timestamp) and `metadata.mode`
- [ ] Every response includes `metadata.request_id` (from middleware)
- [ ] Frontend `submitPrompt()` successfully parses envelope without errors
- [ ] All 4 error codes (`INVALID_PAYLOAD`, `INVALID_MODE`, `MISSING_METADATA`, `GENERATION_ERROR`) tested
- [ ] Cached lookup and defaultModule paths return canonical envelope
- [ ] Manual curl test returns canonical shape
- [ ] Full test suite passes: `cd server && npm test && cd ../client && npm test`

---

## Deployment Notes

**Order**: Backend changes must be deployed before frontend (as per merged doc):

1. Deploy `server/genieService.js` + `server/index.js` changes
2. Run `server` tests
3. Verify with manual curl tests
4. Deploy `client/__tests__/` updates
5. Run `client` tests

**Backward Compatibility**: These changes are **backward compatible** because:

- Existing `/prompt` endpoint still accepts same payload shape
- Response shape change only affects new canonical-aware clients
- Legacy clients expecting old shape will need frontend update (which is coordinated separately)

---

**Status**: Ready for implementation sprint. These are small, focused cleanups that complete the canonical envelope rollout without disrupting current functionality.
