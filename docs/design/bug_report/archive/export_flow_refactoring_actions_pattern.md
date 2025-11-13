---
title: Export Flow Refactoring — Actions Pattern Integration
date: 2025-11-12
status: active
type: implementation-plan
---

## Purpose

Refactor the export flow to follow the same orchestration + actions pattern established for `sampleService` and `genieService.process()`. This eliminates mixed concerns and integrates export into the clean architecture.

## Current State Analysis

### Export Entry Points

**3 endpoints** (primary is POST `/export`):

1. `POST /export` — lines 1063–1141 in `server/index.js`
2. `GET /export` — lines 1145+ (legacy)
3. `POST /api/export` — line 886

### Current Flow (Problematic)

```
Frontend POST /export { prompt?, promptId?, resultId?, content?, validate? }
  ↓
Endpoint normalizes request
  ↓
genieService.export({ prompt, promptId, resultId, validate })
  ├─ Check if envelope provided → use directly
  ├─ Check if promptId/resultId → lookup persisted
  ├─ Check if prompt object → use as content
  ├─ Check if prompt string → call genieService.generate() ⚠️ LEGACY PATH
  ├─ Render PDF via pdfGenerator.generatePdfBuffer()
  └─ Return { buffer }
  ↓
Endpoint responds: PDF file
```

### Problems with Current Design

🔴 **Mixed Concerns**:

- `genieService.export()` does lookup + generation + PDF rendering
- All logic in one method (not separated)

🔴 **Uses Legacy Path**:

- When generating from prompt, calls `genieService.generate()` (old path)
- Should use new `process()` method instead

🔴 **No Actions Pattern**:

- Export intent not expressed via actions
- PDF generation tightly coupled to orchestration

🔴 **Inconsistent**:

- Doesn't follow the architecture we just established
- Services don't control export decision

---

## Proposed Solution: Actions-Based Export

### Architecture: Export as an Action

```
Frontend POST /prompt { mode, prompt, metadata, options }
  ↓
Endpoint validates
  ↓
genieService.process(payload)
  ├─ Route by mode
  ├─ Call sampleService.handle()
  │  └─ Returns { pages, metadata, actions: { persist_prompt: true } }
  ├─ Enrich metadata (generated_at, mode)
  ├─ Process persist_prompt action
  └─ Return { out_envelope }
  ↓
Frontend receives envelope with pages
  ↓
Frontend LATER calls: POST /export/from-envelope
  ├─ Body: { out_envelope: { pages, metadata, actions }, ... }
  ├─ Optionally includes: { generate_pdf: true } in actions
  ↓
Endpoint calls: genieService.exportEnvelope({ out_envelope, generate_pdf })
  ├─ If generate_pdf: process export action
  ├─ Call pdfGenerator with canonical envelope
  └─ Return { buffer }
  ↓
Frontend receives PDF
```

### Key Insight

**Export becomes an action** that can be:

1. Expressed by services: `actions: { generate_pdf: true }`
2. Processed by orchestrator: calls `pdfGenerator`
3. Triggered independently: frontend calls dedicated export endpoint

---

## Implementation Plan

### Phase 1: Extract PDF Generation Logic (Minimal Change)

**Create**: `server/exportService.js`

```javascript
/**
 * Export Service — Handle PDF generation from canonical envelopes
 *
 * Responsibility: Transform canonical envelopes or content into PDF buffers
 * Does NOT: lookup, persist, or handle orchestration
 */

const { requireModuleOrFail } = require("./utils/moduleLoader");
const pdfGenerator = requireModuleOrFail("./pdfGenerator");

/**
 * Generate PDF from canonical envelope
 * @param {Object} envelope - { pages, metadata, actions }
 * @param {Object} options - { validate, quality, ... }
 * @returns {Promise<{buffer: Buffer, validation?: any}>}
 */
async function generateFromEnvelope(envelope, options = {}) {
  if (!envelope || !Array.isArray(envelope.pages)) {
    const e = new Error("Export requires canonical envelope with pages array");
    e.status = 400;
    throw e;
  }

  const generated = await pdfGenerator.generatePdfBuffer({
    envelope,
    validate: !!options.validate,
  });

  if (options.validate) {
    if (generated?.buffer) {
      return {
        buffer: generated.buffer,
        validation: generated.validation,
      };
    }
    if (generated?.validation) return generated;
  }

  return {
    buffer: Buffer.isBuffer(generated) ? generated : generated.buffer,
  };
}

/**
 * Generate PDF from legacy content format (title + body)
 * @param {Object} content - { title, body }
 * @param {Object} options - { validate, quality, ... }
 * @returns {Promise<{buffer: Buffer, validation?: any}>}
 */
async function generateFromContent(content, options = {}) {
  if (!content || !content.title || !content.body) {
    const e = new Error("Export requires content with title and body");
    e.status = 400;
    throw e;
  }

  const generated = await pdfGenerator.generatePdfBuffer({
    title: content.title,
    body: content.body,
    validate: !!options.validate,
  });

  if (options.validate) {
    if (generated?.buffer) {
      return {
        buffer: generated.buffer,
        validation: generated.validation,
      };
    }
    if (generated?.validation) return generated;
  }

  return {
    buffer: Buffer.isBuffer(generated) ? generated : generated.buffer,
  };
}

module.exports = {
  generateFromEnvelope,
  generateFromContent,
};
```

### Phase 2: Refactor genieService.export()

**Update**: `server/genieService.js::export()`

```javascript
/**
 * Export content or envelope to PDF buffer
 * Orchestrates content resolution and delegates PDF generation to exportService
 *
 * Input options:
 * - envelope: canonical { pages, metadata, actions } (preferred)
 * - prompt: string or { title, body } object
 * - promptId/resultId: lookup persisted content
 *
 * @param {Object} opts - { envelope?, prompt?, promptId?, resultId?, validate? }
 * @returns {Promise<{buffer: Buffer, validation?: any}>}
 */
async export({
  envelope,
  prompt,
  promptId,
  resultId,
  validate = false,
} = {}) {
  const exportService = require("./exportService");

  try {
    // 1. If canonical envelope provided, use it directly
    if (envelope && envelope.pages && Array.isArray(envelope.pages)) {
      return await exportService.generateFromEnvelope(envelope, { validate });
    }

    // 2. Resolve content from available sources
    let contentObj = null;

    // Prefer persisted content when IDs provided
    if ((promptId || resultId) && !contentObj) {
      const persisted = await this.getPersistedContent({
        promptId,
        resultId,
      });
      if (persisted?.content) {
        contentObj =
          persisted.content?.content || persisted.content;
      }
    }

    // Accept direct content object
    if (!contentObj && prompt && typeof prompt === "object") {
      contentObj = prompt; // { title, body }
    }

    // Otherwise, generate from prompt string using NEW process() method
    // (not legacy generate() method)
    if (!contentObj && prompt && typeof prompt === "string") {
      // For export-from-string, use basic mode (simple generation)
      const result = await this.process({
        mode: "basic",
        prompt,
        metadata: {},
        options: {},
      });
      // Extract envelope from result
      if (result?.out_envelope) {
        return await exportService.generateFromEnvelope(
          result.out_envelope,
          { validate }
        );
      }
    }

    // If we have content, generate from it
    if (contentObj && (contentObj.title || contentObj.body)) {
      return await exportService.generateFromContent(contentObj, { validate });
    }

    // Nothing worked
    const e = new Error(
      "Export requires: envelope, or content (title & body), or prompt (string or object), or promptId/resultId"
    );
    e.status = 400;
    throw e;
  } catch (error) {
    if (error.status) throw error;
    throw new Error(`Export failed: ${error.message}`);
  }
}
```

### Phase 3: Add Export Action to Services

**Update**: `server/sampleService.js::handle()` (and other services)

```javascript
// In sampleService.handle():
return {
  pages,
  metadata: {
    model: "sample-v1",
    pages_count: pages.length,
    source: "prompt",
  },
  actions: {
    persist_prompt: true, // Existing
    generate_pdf: true, // NEW: signal that export is available
    can_export: true,
    can_preview: true,
  },
};
```

### Phase 4: Enhance genieService.process() to Handle Export

**Update**: `server/genieService.js::process()`

```javascript
async process(payload) {
  // ... existing routing and service calls ...

  // Build envelope (existing)
  const envelope = {
    out_envelope: {
      pages: result.pages || [],
      metadata: { ...result.metadata, generated_at: "...", mode },
      actions: result.actions || {},
    },
  };

  // Process actions (existing persist_prompt)
  if (result.actions?.persist_prompt === true) {
    // ... existing code ...
  }

  // NEW: Process export action
  if (result.actions?.generate_pdf === true) {
    // Don't generate PDF here; just ensure the action is preserved
    // Frontend will call /export/from-envelope if they want PDF
    // OR: orchestrator could generate PDF and attach to response
    // Decision: Keep separate for now (frontend controls PDF generation)
  }

  return envelope;
}
```

### Phase 5: Update Export Endpoint

**Update**: `server/index.js::POST /export`

```javascript
app.post("/export", async (req, res) => {
  const {
    sendValidationError,
    sendProcessingError,
  } = require("./utils/errorHandler");

  try {
    const {
      // New: Accept canonical envelope
      out_envelope,
      // Legacy: Accept individual fields
      prompt,
      promptId,
      resultId,
      content,
      title,
      body,
      validate,
    } = req.body || {};

    // Build export options
    const exportOpts = { validate: !!validate };

    // Priority 1: Envelope (from /prompt response)
    if (out_envelope) {
      exportOpts.envelope = out_envelope;
    }
    // Priority 2: IDs (persisted content)
    else if (promptId || resultId) {
      exportOpts.promptId = promptId;
      exportOpts.resultId = resultId;
    }
    // Priority 3: Direct content
    else if (content) {
      exportOpts.prompt = content;
    }
    // Priority 4: Legacy title/body
    else if (title || body) {
      exportOpts.prompt = { title: title || "", body: body || "" };
    }
    // Priority 5: Prompt string
    else if (prompt) {
      exportOpts.prompt = prompt;
    }

    const exportResult = await genieService.export(exportOpts);
    let buffer = exportResult?.buffer || null;

    if (!buffer) {
      return sendProcessingError(res, "PDF Generation Failed: empty buffer", {
        code: "PDF_GENERATION_ERROR",
      });
    }

    // Validate and set headers (existing code)
    if (!Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(buffer);
    }

    res.setHeader("Content-Disposition", `inline; filename=export.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
    return;
  } catch (err) {
    const status = err?.status || 500;
    if (status === 400) return sendValidationError(res, err.message);
    console.error("Export generation error", err?.message);
    return sendProcessingError(res, `PDF Generation Failed: ${err.message}`, {
      code: "PDF_GENERATION_ERROR",
    });
  }
});
```

### Phase 6: Optional New Endpoint for Canonical Envelopes

**Add**: `server/index.js::POST /export/from-envelope` (convenience)

```javascript
app.post("/export/from-envelope", async (req, res) => {
  try {
    const { out_envelope, validate } = req.body || {};

    if (!out_envelope) {
      return sendValidationError(
        res,
        "Export requires out_envelope in request body"
      );
    }

    const exportResult = await genieService.export({
      envelope: out_envelope,
      validate: !!validate,
    });

    const buffer = exportResult?.buffer;
    if (!buffer) {
      return sendProcessingError(res, "PDF Generation Failed: empty buffer");
    }

    res.setHeader("Content-Disposition", `inline; filename=export.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
  } catch (err) {
    console.error("Export error", err?.message);
    return sendProcessingError(res, `Export failed: ${err.message}`);
  }
});
```

---

## Data Flow: Complete E2E with Export

```
┌─ Frontend POST /prompt ─────────────────────────────────┐
│ { mode: "basic", prompt: "...", metadata: {}, options: {} }
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─ Endpoint validates + genieService.process() ───────────┐
│ 1. Route to sampleService.handle()                      │
│ 2. Returns: { pages, metadata, actions }               │
│ 3. actions include: persist_prompt, generate_pdf       │
│ 4. Enrich metadata (generated_at, mode)                │
│ 5. Process persist_prompt action (save to file)        │
│ 6. Return envelope with generate_pdf in actions        │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─ Frontend receives response ───────────────────────────┐
│ { out_envelope: { pages, metadata, actions } }         │
│ actions.generate_pdf = true                            │
└──────────────────┬──────────────────────────────────────┘
                   │
          [User clicks Export button]
                   │
                   ↓
┌─ Frontend POST /export ────────────────────────────────┐
│ { out_envelope: { pages, metadata, actions } }         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─ genieService.export() ────────────────────────────────┐
│ 1. Receive envelope                                    │
│ 2. Call exportService.generateFromEnvelope()          │
│ 3. pdfGenerator renders pages to PDF                  │
│ 4. Return { buffer }                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
         Response: PDF file (application/pdf)
         Frontend triggers download
```

---

## Implementation Checklist

- [ ] **Create exportService.js**

  - [ ] `generateFromEnvelope(envelope, options)`
  - [ ] `generateFromContent(content, options)`
  - [ ] Proper error handling

- [ ] **Update genieService.export()**

  - [ ] Accept envelope as priority input
  - [ ] Call new exportService
  - [ ] Use `process()` not `generate()` for string prompts
  - [ ] Clean error messages

- [ ] **Update sampleService.handle() (and other services)**

  - [ ] Add `generate_pdf: true` to actions

- [ ] **Enhance genieService.process()**

  - [ ] Keep generate_pdf action in response
  - [ ] Optional: Future export processing

- [ ] **Update POST /export endpoint**

  - [ ] Accept out_envelope
  - [ ] Maintain backwards compatibility
  - [ ] Updated priority for input resolution

- [ ] **Optional: Add POST /export/from-envelope**

  - [ ] Convenience endpoint for envelopes

- [ ] **Tests**
  - [ ] exportService.generateFromEnvelope() with valid envelope
  - [ ] exportService.generateFromContent() with valid content
  - [ ] genieService.export() with envelope
  - [ ] genieService.export() with prompt string (uses new process())
  - [ ] POST /export with envelope body
  - [ ] POST /export with legacy fields (backwards compat)

---

## Benefits of This Approach

✅ **Separation of Concerns**:

- exportService: PDF generation only
- genieService: orchestration only
- Services: business logic only

✅ **Consistent Architecture**:

- Export follows same actions pattern
- Services express intent via actions
- Orchestrator processes actions

✅ **Cleaner Code Path**:

- String prompt export uses new `process()` not legacy `generate()`
- Single orchestration flow

✅ **Backwards Compatible**:

- Existing `/export` endpoint still works
- Supports legacy title/body format
- Supports existing promptId/resultId lookups

✅ **Future Extensible**:

- Services can add other export formats via actions
- Easy to add generate_epub, generate_docx, etc.

---

## Files to Create/Modify

| File                      | Type   | Changes                                                |
| ------------------------- | ------ | ------------------------------------------------------ |
| `server/exportService.js` | Create | New service for PDF generation                         |
| `server/genieService.js`  | Modify | Update `export()` to use exportService + new process() |
| `server/sampleService.js` | Modify | Add `generate_pdf: true` to actions                    |
| `server/demoService.js`   | Modify | Add `generate_pdf: true` to actions                    |
| `server/ebookService.js`  | Modify | Add `generate_pdf: true` to actions                    |
| `server/index.js`         | Modify | Update POST /export endpoint + optional new endpoint   |

---

## Next Steps

1. Create exportService.js with PDF generation logic
2. Refactor genieService.export() to use exportService and new process()
3. Update all service handlers to include generate_pdf action
4. Update endpoints for backwards compatibility
5. Add comprehensive tests
6. Verify E2E flow works with canonical envelopes

---

**Document Status**: Ready for Implementation  
**Approach**: Actions Pattern Continuation  
**Dependencies**: Builds on sampleService + genieService.process() work  
**Estimated Scope**: Medium (2-3 hours implementation + testing)
