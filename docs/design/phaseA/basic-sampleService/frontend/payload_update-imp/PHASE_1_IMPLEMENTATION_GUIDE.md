---
title: Phase 1 Backend Implementation Quick Reference
date: 2025-11-10
status: implementation-ready
---

## Phase 1: Backend Implementation (Self-Contained)

This is a quick reference for implementing Phase 1. Frontend changes are NOT needed for Phase 1 to work.

---

## Step 1A: Update `/prompt` Endpoint in `server/index.js`

**Location**: Lines 660-690

**Current Code Structure**:

```javascript
app.post("/prompt", async (req, res, next) => {
  const { prompt } = req.body;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return sendValidationError(res, "...");
  }
  try {
    const genieResult = await genieService.generate(prompt);
    const data = genieResult && genieResult.data ? { ...genieResult.data } : {};
    return res.status(201).json({ success: true, data });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
});
```

**Updated Code**:

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

  if (!body.prompt.trim()) {
    return res.status(400).json({
      error: "INVALID_PROMPT",
      message: "prompt cannot be empty",
    });
  }

  // Mode-specific validation
  if (body.mode === "demo") {
    const md = body.metadata || {};
    if (!md.title || !md.author || typeof md.pages !== "number") {
      return res.status(400).json({
        error: "MISSING_METADATA",
        message: "demo mode requires title, author, and pages (number)",
        fields: ["title", "author", "pages"],
      });
    }
  }

  try {
    const result = await genieService.process(body);
    return res.status(201).json(result);
  } catch (err) {
    err.status = err.status || 500;
    err.message = `Generation Error: ${err.message}`;
    next(err);
  }
});
```

**Changes Summary**:

- ✅ Validate `mode` presence
- ✅ Validate `prompt` non-empty
- ✅ Add demo mode metadata validation (title, author, pages as number)
- ✅ Call `genieService.process(body)` instead of `generate(prompt)`
- ✅ Return response directly (don't wrap in `{ success, data }`)
- ✅ Error handling for each validation

---

## Step 1B: Add `process()` Method to `server/genieService.js`

**Location**: Add at end of genieService object (before module.exports)

**New Method**:

```javascript
  /**
   * Process a payload with mode-based routing
   * @param {Object} payload - { mode, prompt, metadata?, options? }
   * @returns {Promise<Object>} - { out_envelope: {...} }
   */
  async process(payload) {
    const { mode = "basic", prompt, metadata = {}, options = {} } = payload;

    // Validate prompt
    if (!prompt || !String(prompt).trim()) {
      const e = new Error("Prompt is required");
      e.status = 400;
      throw e;
    }

    // Route to appropriate service handler
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

    // Call handler and return result
    if (typeof handler.handle === "function") {
      return await handler.handle(payload);
    }

    // Fallback error if handler doesn't have handle() method
    const e = new Error(`Service handler for mode "${mode}" not properly initialized`);
    e.status = 500;
    throw e;
  },
```

**Add to module.exports**:

```javascript
module.exports = {
  generate: genieService.generate,
  process: genieService.process, // ← ADD THIS
  readLatest: genieService.readLatest,
  getPersistedContent: genieService.getPersistedContent,
  // ... other exports ...
};
```

---

## Step 1C: Add `handle()` to `server/sampleService.js`

**Location**: At end of file, before module.exports

**New Function**:

```javascript
/**
 * Handle a generation request with full payload support
 * @param {Object} payload - { prompt, metadata?, options? }
 * @returns {Promise<Object>} - { out_envelope: { pages, metadata, actions } }
 */
async function handle(payload) {
  const { prompt, metadata = {}, options = {} } = payload;

  // Validate prompt
  if (!prompt || !String(prompt).trim()) {
    const e = new Error("Prompt is required");
    e.status = 400;
    throw e;
  }

  // Use existing generate logic
  const envelopeReq = { in_envelope: { prompt }, out_envelope: {} };
  const result = await generate(envelopeReq, options);

  // Merge metadata if provided
  if (Object.keys(metadata).length > 0 && result.out_envelope) {
    result.out_envelope.metadata = {
      ...(result.out_envelope.metadata || {}),
      ...metadata,
    };
  }

  return result;
}
```

**Update module.exports**:

```javascript
module.exports = {
  buildContent,
  makeCopies,
  buildPagesFromCopies,
  generate,
  generateFromPrompt,
  handle, // ← ADD THIS
};
```

---

## Step 1D: Add `handle()` to `server/demoService.js`

**Location**: At end of file, before module.exports

**New Function**:

```javascript
/**
 * Handle a generation request for demo mode
 * @param {Object} payload - { prompt, metadata? }
 * @returns {Promise<Object>} - { out_envelope: { pages, metadata, actions } }
 */
async function handle(payload) {
  const { prompt, metadata = {} } = payload;

  // Use existing demo generation logic
  const content = buildContent(prompt);
  const copies = makePages(content, 3);

  // Return standardized envelope format
  return {
    out_envelope: {
      pages: copies,
      metadata: {
        model: "demo-1",
        pages: copies.length,
        ...(metadata || {}),
      },
      actions: {},
    },
  };
}
```

**Update module.exports**:

```javascript
module.exports = {
  generateFromPrompt,
  buildContent,
  makePages,
  handle, // ← ADD THIS
};
```

---

## Step 1E: Create/Update `server/ebookService.js` Stub

**Location**: Create new file or update existing `ebook.js`

**Create `server/ebookService.js`**:

```javascript
/**
 * ebookService - Stub for ebook generation
 * To be fully implemented in future sprint
 */

/**
 * Handle a generation request for ebook mode (stub)
 * @param {Object} payload - { prompt, metadata? }
 * @returns {Promise<Object>} - { out_envelope: { pages, metadata, actions } }
 */
async function handle(payload) {
  const { prompt, metadata = {} } = payload;

  // Stub: Return placeholder response
  // TODO: Implement full ebook generation pipeline
  return {
    out_envelope: {
      pages: [],
      metadata: {
        model: "ebook-stub",
        status: "not-implemented",
        prompt: prompt.substring(0, 50) + "...",
        ...(metadata || {}),
      },
      actions: {
        warning: "ebook generation is not yet available",
        suggestion: "Please use 'basic' or 'demo' mode for now",
      },
    },
  };
}

module.exports = {
  handle,
};
```

---

## Step 1F: Testing Phase 1

### Test 1: Basic Mode (No Metadata)

**Request**:

```bash
curl -X POST http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "basic",
    "prompt": "Write a short story"
  }'
```

**Expected Response**:

```json
{
  "out_envelope": {
    "pages": [...],
    "metadata": {
      "model": "sample-v1",
      "generatedAt": "2025-11-10T..."
    },
    "actions": {}
  }
}
```

**Status**: ✅ 201 Created

---

### Test 2: Demo Mode (With Metadata)

**Request**:

```bash
curl -X POST http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "demo",
    "prompt": "Write a poem",
    "metadata": {
      "title": "Summer Dreams",
      "author": "Jane Doe",
      "pages": 3
    }
  }'
```

**Expected Response**:

```json
{
  "out_envelope": {
    "pages": [
      {
        "title": "Demo: Write a poem — Part 1",
        "body": "...",
        "layout": "ebook-mock"
      },
      ...
    ],
    "metadata": {
      "model": "demo-1",
      "pages": 3,
      "title": "Summer Dreams",
      "author": "Jane Doe"
    },
    "actions": {}
  }
}
```

**Status**: ✅ 201 Created

---

### Test 3: Missing Mode (Error Case)

**Request**:

```bash
curl -X POST http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Write something"}'
```

**Expected Response**:

```json
{
  "error": "INVALID_PAYLOAD",
  "message": "payload must include mode and prompt"
}
```

**Status**: ❌ 400 Bad Request

---

### Test 4: Demo Mode Missing Metadata (Error Case)

**Request**:

```bash
curl -X POST http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "demo",
    "prompt": "Write a poem"
  }'
```

**Expected Response**:

```json
{
  "error": "MISSING_METADATA",
  "message": "demo mode requires title, author, and pages (number)",
  "fields": ["title", "author", "pages"]
}
```

**Status**: ❌ 400 Bad Request

---

### Test 5: Ebook Mode (Stub)

**Request**:

```bash
curl -X POST http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "ebook",
    "prompt": "Write a book"
  }'
```

**Expected Response**:

```json
{
  "out_envelope": {
    "pages": [],
    "metadata": {
      "model": "ebook-stub",
      "status": "not-implemented",
      "prompt": "Write a book",
      "suggestion": "Please use 'basic' or 'demo' mode for now"
    },
    "actions": {
      "warning": "ebook generation is not yet available"
    }
  }
}
```

**Status**: ✅ 201 Created (stub returns success, but empty pages)

---

## Checklist: Phase 1 Complete

- [ ] Updated `/prompt` endpoint in `server/index.js`

  - [ ] Validates `mode` presence
  - [ ] Validates `prompt` non-empty
  - [ ] Adds demo mode metadata validation
  - [ ] Calls `genieService.process(body)`
  - [ ] Returns `out_envelope` response

- [ ] Added `process()` method to `server/genieService.js`

  - [ ] Routes by mode (basic, demo, ebook)
  - [ ] Handles service handler resolution
  - [ ] Proper error handling

- [ ] Updated `server/sampleService.js`

  - [ ] Added `handle(payload)` method
  - [ ] Metadata merging implemented
  - [ ] Exported new `handle` function

- [ ] Updated `server/demoService.js`

  - [ ] Added `handle(payload)` method
  - [ ] Returns `out_envelope` format
  - [ ] Metadata included in response
  - [ ] Exported new `handle` function

- [ ] Created `server/ebookService.js` stub

  - [ ] Implements `handle(payload)` method
  - [ ] Returns standardized response format
  - [ ] Module exported correctly

- [ ] Tested all 5 test cases above
  - [ ] Test 1: Basic mode success
  - [ ] Test 2: Demo mode with metadata success
  - [ ] Test 3: Missing mode error
  - [ ] Test 4: Demo mode missing metadata error
  - [ ] Test 5: Ebook mode stub

---

## Notes

- ✅ **Frontend is NOT needed for Phase 1 to work**
- ✅ **Phase 1 can be tested with curl/Postman**
- ✅ **Phase 1 is fully isolated from frontend changes**
- ✅ **Once Phase 1 is complete and tested, Phase 2 becomes simple**

---

## What's Next?

Only after all of the above is complete and tested:

- Phase 2: Update `client/src/lib/api.js` to send enhanced payload
- Phase 2: Update `client/src/App.svelte` to call submitPrompt with store
- Phase 2: Test end-to-end integration
