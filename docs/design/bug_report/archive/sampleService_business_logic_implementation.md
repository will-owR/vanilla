---
title: sampleService Business Logic Implementation
date: 2025-11-12
status: active
type: implementation-plan
---

## Purpose

Document the implementation plan to fix the architectural separation of concerns between `sampleService` (business logic) and `genieService` (orchestration). This addresses the critical issue where `genieService.process()` was isolated from orchestration responsibilities and services lacked proper business logic.

## Problem Statement

**Current State (Broken):**

- `genieService.process()` is an isolated thin wrapper that routes to services but does NO orchestration
- `sampleService.handle()` does minimal work and ignores actions/persistence
- The legacy `genieService.generate()` path contains all orchestration logic but is unused by `/prompt` endpoint
- Two completely separate code paths exist with duplicated logic

**Desired State:**

- `sampleService.handle()` implements FULL business logic for basic mode
- `genieService.process()` acts as true orchestrator (routes, enriches, processes actions)
- Single clean code path from endpoint → orchestrator → service → endpoint
- Proper separation: service = business logic, orchestrator = coordination

---

## Architecture: Separation of Concerns

### Service Layer (sampleService) — Business Logic

**Responsibility**: Transform prompt into content (pages, metadata, actions)

**Input**: Canonical payload

```javascript
{
  mode: "basic",
  prompt: "Compose a haiku about rain",
  metadata: {},
  options: {}
}
```

**Processing**:

1. Derive title from prompt (first 6 words)
2. Use prompt text as body content
3. Create 3 pages (ad-hoc count, could be parameterized)
4. Each page contains: { id, title, blocks: [{ type: "text", content }] }
5. Return canonical shape with actions signaling persistence

**Output**: Canonical service result

```javascript
{
  pages: [
    {
      id: "p1",
      title: "Compose a haiku about rain — Page 1",
      blocks: [{ type: "text", content: "Compose a haiku about rain" }]
    },
    {
      id: "p2",
      title: "Compose a haiku about rain — Page 2",
      blocks: [{ type: "text", content: "Compose a haiku about rain" }]
    },
    {
      id: "p3",
      title: "Compose a haiku about rain — Page 3",
      blocks: [{ type: "text", content: "Compose a haiku about rain" }]
    }
  ],
  metadata: {
    model: "sample-v1",
    pages_count: 3,
    source: "prompt"
  },
  actions: {
    persist_prompt: true  // ← Signal to orchestrator
  }
}
```

**Constraints**:

- ❌ Does NOT handle persistence (file I/O)
- ❌ Does NOT handle caching
- ❌ Does NOT do orchestration
- ✅ Does NOT include request metadata in response
- ✅ Returns only service-generated fields

---

### Orchestrator Layer (genieService.process) — Coordination

**Responsibility**: Route requests, enrich responses, process actions, coordinate persistence

**Input**: Canonical payload (same as service receives)

**Processing**:

1. Route by mode to appropriate service handler (sampleService for basic)
2. Call service.handle(payload)
3. Receive result: { pages, metadata, actions }
4. Build canonical envelope with enriched metadata:
   - Add `generated_at` (ISO timestamp)
   - Add `mode`
   - Preserve service metadata
5. **Process actions**:
   - Check for `actions.persist_prompt`
   - If true: call `saveContentToFile(prompt)` (non-blocking)
6. Return final envelope

**Output**: Canonical response envelope

```javascript
{
  out_envelope: {
    pages: [...],
    metadata: {
      model: "sample-v1",
      pages_count: 3,
      source: "prompt",
      generated_at: "2025-11-12T...",
      mode: "basic"
    },
    actions: {
      persist_prompt: true
    }
  }
}
```

**Constraints**:

- ❌ Does NOT generate content
- ❌ Does NOT do business logic
- ✅ Does NOT spread request metadata into response
- ✅ Coordinates with external concerns (persistence, caching, actions)

---

## Data Flow: E2E

```
┌─ Frontend: POST /prompt ─────────────────────────────────────┐
│ { mode: "basic", prompt: "...", metadata: {}, options: {} }  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─ Endpoint: /prompt ──────────────────────────────────────────┐
│ 1. Validate payload ✅                                       │
│ 2. Call genieService.process(req.body)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─ genieService.process(payload) ──────────────────────────────┐
│ ORCHESTRATOR                                                  │
│ 1. Extract mode, prompt, metadata, options                  │
│ 2. Route by mode:                                            │
│    case "basic": result = await sampleService.handle()      │
│ 3. Build envelope:                                           │
│    - pages: result.pages                                    │
│    - metadata: { ...result.metadata,                         │
│                  generated_at: ISO,                          │
│                  mode: "basic" }                             │
│    - actions: result.actions                                 │
│ 4. Process actions:                                          │
│    if (result.actions.persist_prompt) {                      │
│      saveContentToFile(prompt)  // non-blocking              │
│    }                                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─ sampleService.handle(payload) ──────────────────────────────┐
│ BUSINESS LOGIC                                                │
│ 1. Extract prompt from payload                               │
│ 2. Derive title: "Compose a haiku about rain"               │
│ 3. Set body: prompt text                                     │
│ 4. Create 3 pages:                                           │
│    pages = [                                                  │
│      { id: "p1", title: "... — Page 1",                     │
│        blocks: [{ type: "text", content: prompt }] },       │
│      { id: "p2", ... },                                      │
│      { id: "p3", ... }                                       │
│    ]                                                          │
│ 5. Return:                                                    │
│    {                                                          │
│      pages,                                                   │
│      metadata: { model, pages_count, source },              │
│      actions: { persist_prompt: true }                       │
│    }                                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ (async file save in background)
                       ↓
         saveContentToFile(prompt)
         └─ Saves prompt to disk (non-blocking)
                       │
                       ↓
┌─ Endpoint Response ──────────────────────────────────────────┐
│ HTTP 201 { out_envelope: { pages, metadata, actions } }      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
         Frontend receives canonical envelope
         ready for rendering
```

---

## Implementation Tasks

### Task 1: Implement sampleService.handle() — Full Business Logic

**File**: `server/sampleService.js`

**Location**: Replace the existing `handle()` function (lines 69–92)

**Current Code** (incorrect — minimal logic):

```javascript
async function handle(payload) {
  const { prompt, metadata = {}, options = {} } = payload;

  const content = buildContent(prompt, options);
  const copies = makeCopies(content, options.copies || 3);
  const pages = buildPagesFromCopies(copies);

  return {
    pages,
    metadata: {
      model: "sample-v1",
      pages_count: pages.length,
    },
    actions: {
      can_export: true,
      can_preview: true,
    },
  };
}
```

**New Code** (correct — full business logic):

```javascript
/**
 * Handle enhanced payload for basic/default mode
 * Creates a multi-page ebook from a single prompt
 *
 * Business Logic:
 * 1. Derive title from prompt (first 6 words or less)
 * 2. Use entire prompt as body content
 * 3. Create 3 pages (ad-hoc; can be parameterized via options.pages_count)
 * 4. Express persistence intent via actions.persist_prompt
 *
 * @param {Object} payload - { mode, prompt, metadata, options }
 * @returns {Promise<Object>} Canonical service result { pages, metadata, actions }
 */
async function handle(payload) {
  const { prompt, metadata = {}, options = {} } = payload;

  // 1. Derive title from prompt
  // Take first 6 words, add ellipsis if prompt is longer
  const titleWords = prompt.split(/\s+/).slice(0, 6);
  const title = titleWords.join(" ");
  const isTruncated = prompt.split(/\s+/).length > 6;
  const finalTitle = title + (isTruncated ? "..." : "");

  // 2. Use prompt as body
  const body = prompt;

  // 3. Create pages
  // Default to 3 pages (ad-hoc), can be overridden via options.pages_count
  const numPages = parseInt(options.pages_count || 3, 10);
  const pages = Array.from({ length: numPages }).map((_, idx) => ({
    id: `p${idx + 1}`,
    title: `${finalTitle} — Page ${idx + 1}`,
    blocks: [
      {
        type: "text",
        content: body,
      },
    ],
  }));

  // 4. Return canonical shape with actions for persistence
  return {
    pages,
    metadata: {
      // Service-generated fields ONLY
      model: "sample-v1",
      pages_count: pages.length,
      source: "prompt",
    },
    actions: {
      // Signal to orchestrator: persist the prompt to file
      persist_prompt: true,
      can_export: true,
      can_preview: true,
    },
  };
}
```

**Key Changes**:

- ✅ Derives meaningful title from prompt
- ✅ Creates 3 pages with proper structure
- ✅ Adds `persist_prompt: true` to actions (signals orchestrator)
- ✅ Does NOT include request metadata in response
- ✅ Adds `source: "prompt"` metadata field
- ✅ Full business logic centralized in service

---

### Task 2: Implement genieService.process() — Action Processing

**File**: `server/genieService.js`

**Location**: Update the `process()` method (lines 555–592)

**Current Code** (incomplete — no action processing):

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

**New Code** (complete — with action processing):

```javascript
/**
 * Process enhanced payload — Orchestrator
 *
 * Responsibilities:
 * 1. Route by mode to appropriate service handler
 * 2. Build canonical envelope with enriched metadata
 * 3. Process actions from service (e.g., persist_prompt)
 * 4. Coordinate with external concerns (persistence, caching, etc.)
 *
 * @param {Object} payload - { mode, prompt, metadata, options }
 * @returns {Promise<Object>} Canonical response { out_envelope: { pages, metadata, actions } }
 */
async process(payload) {
  const { mode, prompt, metadata = {}, options = {} } = payload;

  try {
    let result;

    // 1. Route by mode to appropriate service handler
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

    // 2. Build canonical response envelope with enriched metadata
    const envelope = {
      out_envelope: {
        pages: result.pages || [],
        metadata: {
          // Service-generated fields
          ...result.metadata,
          // Orchestrator-added fields
          generated_at: new Date().toISOString(),
          mode: mode,
        },
        actions: result.actions || {},
      },
    };

    // 3. Process actions from service (orchestrator responsibility)
    // Actions allow services to express intent without handling side effects
    if (result.actions) {
      // Check for persist_prompt action
      if (result.actions.persist_prompt === true) {
        try {
          const { saveContentToFile } = require("./utils/fileUtils");
          // Fire-and-forget: save prompt in background (non-blocking)
          saveContentToFile(prompt).catch((err) => {
            // Log but do not fail the request
            // eslint-disable-next-line no-console
            console.warn(
              "genieService.process: persist_prompt action failed",
              err?.message
            );
          });
        } catch (e) {
          // Log but do not fail the request
          // eslint-disable-next-line no-console
          console.warn(
            "genieService.process: Could not process persist_prompt action",
            e?.message
          );
        }
      }

      // Other actions can be added here as needed:
      // if (result.actions.send_notification) { ... }
      // if (result.actions.trigger_webhook) { ... }
    }

    return envelope;
  } catch (error) {
    throw new Error(`Generation failed: ${error.message}`);
  }
}
```

**Key Changes**:

- ✅ Keeps routing logic (unchanged)
- ✅ Keeps metadata enrichment (unchanged)
- ✅ **NEW: Action processing** — checks for `persist_prompt` and calls `saveContentToFile()`
- ✅ Non-blocking persistence (fire-and-forget with error handling)
- ✅ Extensible design for future actions
- ✅ Clear separation: orchestrator handles side effects, services express intent

---

## Testing Strategy

### Unit Tests for sampleService.handle()

**File**: `server/__tests__/sampleService.handle.test.mjs`

```javascript
import { describe, it, expect } from "vitest";
import sampleService from "../sampleService.js";

describe("sampleService.handle() - business logic", () => {
  it("derives title from prompt (first 6 words)", async () => {
    const payload = {
      mode: "basic",
      prompt: "Compose a haiku about rain and wind patterns",
      metadata: {},
      options: {},
    };

    const result = await sampleService.handle(payload);
    expect(result.pages[0].title).toBe("Compose a haiku about rain and...");
  });

  it("uses prompt as body content in all pages", async () => {
    const payload = {
      mode: "basic",
      prompt: "Test prompt",
      metadata: {},
      options: {},
    };

    const result = await sampleService.handle(payload);
    expect(result.pages).toHaveLength(3);
    result.pages.forEach((page) => {
      expect(page.blocks[0].content).toBe("Test prompt");
    });
  });

  it("creates 3 pages by default", async () => {
    const payload = {
      mode: "basic",
      prompt: "Test",
      metadata: {},
      options: {},
    };

    const result = await sampleService.handle(payload);
    expect(result.pages).toHaveLength(3);
    expect(result.metadata.pages_count).toBe(3);
  });

  it("respects options.pages_count to create custom page count", async () => {
    const payload = {
      mode: "basic",
      prompt: "Test",
      metadata: {},
      options: { pages_count: 5 },
    };

    const result = await sampleService.handle(payload);
    expect(result.pages).toHaveLength(5);
    expect(result.metadata.pages_count).toBe(5);
  });

  it("returns actions.persist_prompt = true", async () => {
    const payload = {
      mode: "basic",
      prompt: "Test",
      metadata: {},
      options: {},
    };

    const result = await sampleService.handle(payload);
    expect(result.actions.persist_prompt).toBe(true);
  });

  it("does NOT include request metadata in response", async () => {
    const payload = {
      mode: "basic",
      prompt: "Test",
      metadata: { title: "User Title", author: "User" },
      options: {},
    };

    const result = await sampleService.handle(payload);
    expect(result.metadata).not.toHaveProperty("title");
    expect(result.metadata).not.toHaveProperty("author");
    expect(result.metadata).toHaveProperty("model", "sample-v1");
  });
});
```

### Integration Tests for genieService.process()

**File**: `server/__tests__/genieService.process.actions.test.mjs`

```javascript
import { describe, it, expect, vi, beforeEach } from "vitest";
import genieService from "../genieService.js";

describe("genieService.process() - action processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes persist_prompt action and calls saveContentToFile", async () => {
    // Mock saveContentToFile
    const mockSaveFile = vi.fn().mockResolvedValue(undefined);
    vi.doMock("./utils/fileUtils", () => ({
      saveContentToFile: mockSaveFile,
    }));

    const payload = {
      mode: "basic",
      prompt: "Test prompt",
      metadata: {},
      options: {},
    };

    const result = await genieService.process(payload);

    expect(result.out_envelope).toHaveProperty("pages");
    expect(result.out_envelope.metadata).toHaveProperty("generated_at");
    expect(result.out_envelope.metadata).toHaveProperty("mode", "basic");
    // Note: saveContentToFile is async, may not have completed yet
  });

  it("returns canonical envelope with enriched metadata", async () => {
    const payload = {
      mode: "basic",
      prompt: "Test",
      metadata: {},
      options: {},
    };

    const result = await genieService.process(payload);

    expect(result).toHaveProperty("out_envelope");
    expect(result.out_envelope).toHaveProperty("pages");
    expect(result.out_envelope).toHaveProperty("metadata");
    expect(result.out_envelope).toHaveProperty("actions");

    const { metadata } = result.out_envelope;
    expect(metadata).toHaveProperty("generated_at");
    expect(metadata).toHaveProperty("mode", "basic");
    expect(metadata).toHaveProperty("model", "sample-v1");
  });

  it("does NOT include request metadata in response", async () => {
    const payload = {
      mode: "basic",
      prompt: "Test",
      metadata: { title: "User Title", author: "User" },
      options: {},
    };

    const result = await genieService.process(payload);

    const { metadata } = result.out_envelope;
    expect(metadata).not.toHaveProperty("title");
    expect(metadata).not.toHaveProperty("author");
  });
});
```

---

## Implementation Checklist

- [ ] **sampleService.handle()** — Implement full business logic

  - [ ] Derive title from prompt
  - [ ] Create 3 pages with title + body
  - [ ] Return canonical shape
  - [ ] Add `persist_prompt: true` action
  - [ ] Remove request metadata from response

- [ ] **genieService.process()** — Implement action processing

  - [ ] Keep routing logic
  - [ ] Keep metadata enrichment
  - [ ] Add action processing
  - [ ] Handle `persist_prompt` action
  - [ ] Call `saveContentToFile(prompt)`
  - [ ] Non-blocking error handling

- [ ] **Tests for sampleService.handle()**

  - [ ] Title derivation test
  - [ ] Page creation test (3 pages default)
  - [ ] Custom page count test
  - [ ] Action presence test
  - [ ] Request metadata filtering test

- [ ] **Tests for genieService.process()**

  - [ ] Canonical envelope structure test
  - [ ] Metadata enrichment test
  - [ ] Action processing test
  - [ ] Request metadata filtering test

- [ ] **Integration test** — E2E flow
  - [ ] POST /prompt with basic mode
  - [ ] Verify response shape
  - [ ] Verify page count
  - [ ] Verify prompt saved to file

---

## Validation Criteria

Once implemented, the following must be true:

1. ✅ `sampleService.handle()` implements ALL business logic for basic mode
2. ✅ `genieService.process()` acts as orchestrator (routes, enriches, processes actions)
3. ✅ Response metadata contains ONLY service-generated + orchestrator-added fields
4. ✅ Request metadata (title, author, etc.) is NOT reflected in response
5. ✅ Actions allow services to express intent without handling side effects
6. ✅ Prompt is saved to file via `persist_prompt` action
7. ✅ All tests pass (unit + integration)
8. ✅ E2E flow works: frontend → endpoint → orchestrator → service → response
9. ✅ Semantic separation: service = logic, orchestrator = coordination

---

## Rationale

### Why This Design

**Service (Business Logic)**:

- Centralized source of truth for "how do we generate content?"
- Easy to test: mock orchestrator, verify output shape
- Easy to modify: change generation rules in one place
- Reusable: other orchestrators could call the same service
- Expresses intent via actions: "please persist this" without handling persistence

**Orchestrator (Coordination)**:

- Routes requests to appropriate handler
- Enriches responses with standard metadata
- Processes actions (persistence, caching, webhooks, etc.)
- Single integration point with external systems
- Non-blocking persistence: actions don't delay response

### Why NOT the Current Design

**Current broken design**:

- Service does minimal work; orchestrator is a thin wrapper
- No separation of concerns; orchestration logic missing
- Actions not processed; no way to express intent
- No persistence coordination; prompt never saved
- Two code paths; legacy `generate()` unused; confusion and duplication

---

## Future Extensions

This design is extensible for future features:

```javascript
// In sampleService.handle(), return:
actions: {
  persist_prompt: true,
  send_notification: { email: "user@example.com" },
  trigger_webhook: { url: "https://example.com/webhook" }
}

// In genieService.process(), process each action:
if (result.actions.send_notification) {
  // Notify user asynchronously
}
if (result.actions.trigger_webhook) {
  // Call webhook
}
```

---

## References

- **Current broken code**: `server/sampleService.js:69-92`, `server/genieService.js:555-592`
- **Example implementations**: `server/demoService.js`, `server/ebookService.js` (WIP)
- **Related files**: `server/utils/fileUtils.js::saveContentToFile`
- **Endpoint**: `server/index.js:661-679` (POST /prompt)

---

**Document Version**: 1.0  
**Status**: Ready for Implementation  
**Created**: 2025-11-12  
**Target**: Immediate (blocking E2E tests)
