# Phase A-B Integration Checklist

**Date**: November 18, 2025  
**Purpose**: Step-by-step guide to wire Phase A-B implementation into the active orchestrator architecture  
**Status**: 🔴 **READY TO IMPLEMENT**  
**Prerequisite**: All Phase A-B modules completed (10/10, 413/413 tests passing)

---

## **Executive Summary**

The Phase A-B implementation is **complete but disconnected**. This checklist activates it by:

1. ✅ Creating missing backend endpoints
2. ✅ Wiring classification into orchestrator.process()
3. ✅ Connecting frontend UI to Phase A-B APIs
4. ✅ Maintaining backward compatibility with Phase A

**Estimated Effort**: 2-3 days (20-30 hours)  
**Blockers**: None (all modules ready)  
**Risk Level**: Low (Phase A-B isolated, Phase A path unchanged by default)

---

## **Phase 1: Backend Orchestrator Enhancement**

### **1.1 Add classifyPrompt() Method to genieService**

**File**: `server/genieService.js`  
**Location**: After `process()` method (around line 635)  
**Effort**: 30 minutes

```javascript
/**
 * Classify a prompt to extract medium, style, theme, audience, tone
 *
 * Pipeline:
 * 1. Rule engine (fast path, <10ms, >80% accuracy)
 * 2. LLM classifier (slow path, ~500ms, fallback when confidence < 0.8)
 * 3. Validator (merge rule + AI results intelligently)
 *
 * @param {string} prompt - User prompt to classify
 * @returns {Promise<Classification>}
 */
async classifyPrompt(prompt) {
  if (!prompt || !String(prompt).trim()) {
    return {
      medium: "ebook",
      style: "minimalist",
      theme: [],
      audience: "general",
      tone: "neutral",
      colorPalette: "neutral",
      confidence: 0.0,
      source: "default",
    };
  }

  try {
    // STEP 1: Fast path - rule engine extraction
    const RuleEngine = require("./utils/ruleEngine");
    const KeywordDatabase = require("./utils/keywordDatabase");
    const ruleEngine = new RuleEngine(KeywordDatabase);

    let classification = ruleEngine.extract(prompt);

    // STEP 2: LLM fallback - if rule engine low confidence
    if (classification.confidence < 0.8) {
      try {
        const LLMClassifier = require("./utils/llmClassifier");
        const llmClassifier = new LLMClassifier();
        const aiResult = await llmClassifier.classify(prompt);

        if (aiResult) {
          // STEP 3: Merge rule + AI results
          const Validator = require("./utils/classificationValidator");
          const validator = new Validator();
          classification = validator.merge(classification, aiResult);
        }
      } catch (aiError) {
        // Log but don't fail - rule engine result is sufficient
        console.warn("LLM classification failed (non-blocking)", aiError?.message);
        // Keep rule engine result
      }
    }

    return classification;
  } catch (error) {
    console.warn("Classification pipeline failed", error?.message);
    // Return safe default
    return {
      medium: "ebook",
      style: "minimalist",
      theme: [],
      confidence: 0.0,
      source: "error",
    };
  }
}
```

#### **Checklist**

- [ ] Add method to genieService
- [ ] Test with sample prompts
- [ ] Verify rule engine path: <10ms
- [ ] Verify LLM fallback: ~500ms when triggered
- [ ] Verify fallback to defaults on error
- [ ] Add unit tests (3-5 scenarios)

---

### **1.2 Enhance genieService.process() to Support Classification**

**File**: `server/genieService.js`  
**Location**: Lines 544-631 (replace `process()` method)  
**Effort**: 1 hour

**Changes**:

1. Extract classification before routing
2. Pass classification to service.handle()
3. Include classification in response metadata

```javascript
/**
 * Process enhanced payload with orchestration
 *
 * Pipeline:
 * 1. Classify prompt (if mode not explicit)
 * 2. Route to appropriate service
 * 3. Normalize response to canonical envelope
 * 4. Persist with UUID
 * 5. Dispatch service actions
 *
 * @param {Object} payload - { mode?, prompt, metadata?, options? }
 * @returns {Promise<Object>} { out_envelope, resultId }
 */
async process(payload) {
  const { prompt } = payload;
  let { mode } = payload;
  const { v4: uuidv4 } = require("uuid");
  const resultDb = require("./utils/resultDb");

  try {
    // STEP 1: Determine medium (Phase A-B: classify if not explicit)
    let classification = null;

    if (!mode || mode === "auto") {
      // Phase A-B: Auto-classify
      classification = await this.classifyPrompt(prompt);
      mode = classification.medium;  // Use detected medium
    } else if (payload._classify === true) {
      // Explicit classification flag
      classification = await this.classifyPrompt(prompt);
    }

    // STEP 2: Route by mode to appropriate service
    let result;
    switch (mode) {
      case "demo": {
        const demoService = require("./demoService");
        result = await demoService.handle(payload, classification);
        break;
      }
      case "ebook": {
        const ebookService = require("./ebookService");
        result = await ebookService.handle(payload, classification);
        break;
      }
      case "calendar": {
        // Phase B: Calendar service placeholder
        const calendarService = require("./calendarService");
        result = await calendarService.handle(payload, classification);
        break;
      }
      case "poster": {
        // Phase B: Poster service placeholder
        const wallartService = require("./wallartService");
        result = await wallartService.handle(payload, classification);
        break;
      }
      case "basic":
      default: {
        result = await sampleService.handle(payload, classification);
      }
    }

    // STEP 3: Build canonical response envelope with enriched metadata
    const envelope = {
      out_envelope: {
        pages: result.pages || [],
        metadata: {
          // Service-generated fields
          ...result.metadata,
          // Orchestrator-added fields
          generated_at: new Date().toISOString(),
          mode: mode,
          // Phase A-B: Include classification
          ...(classification && { classification }),
        },
        actions: result.actions || {},
        // Include epilogue if provided by service (e.g., demo mode)
        ...(result.epilogue && { epilogue: result.epilogue }),
      },
    };

    // STEP 4: Persist result with unique UUID for retrieval
    const resultId = uuidv4();
    try {
      await resultDb.saveResult(resultId, envelope.out_envelope, mode);
      envelope.resultId = resultId;
    } catch (err) {
      // Log but do not fail the request - persistence is best-effort
      console.warn("genieService.process: result persistence failed", err?.message);
      // Still include resultId in response for client reference (best-effort)
      envelope.resultId = resultId;
    }

    // STEP 5: Process actions from service (orchestrator responsibility)
    if (result.actions) {
      if (result.actions.persist_prompt === true) {
        try {
          const { saveContentToFile } = require("./utils/fileUtils");
          // Fire-and-forget: save prompt in background (non-blocking)
          saveContentToFile(prompt).catch((err) => {
            console.warn("genieService.process: persist_prompt action failed", err?.message);
          });
        } catch (e) {
          console.warn("genieService.process: Could not process persist_prompt action", e?.message);
        }
      }
      // Future actions can be added here
    }

    return envelope;
  } catch (error) {
    throw new Error(`Generation failed: ${error.message}`);
  }
}
```

#### **Checklist**

- [ ] Update process() method signature
- [ ] Add classification extraction logic
- [ ] Pass classification to service.handle()
- [ ] Add classification to response metadata
- [ ] Maintain backward compatibility (mode still works if provided)
- [ ] Test Phase A flow (explicit mode) unchanged
- [ ] Test Phase A-B flow (auto-classification)
- [ ] Test mixed flows (mode + \_classify flag)

---

### **1.3 Update Service Interface to Accept Classification**

**Files**:

- `server/demoService.js`
- `server/ebookService.js`
- `server/sampleService.js`

**Effort**: 30 minutes (3 services)

**Change**: Update `handle()` signature to accept optional `classification` parameter:

```javascript
// Before
async handle(payload) { ... }

// After
async handle(payload, classification) {
  // Use classification to tailor generation
  const { style, theme, audience, tone } = classification || {};
  // ... domain logic
}
```

#### **Checklist**

- [ ] Update demoService.handle() signature
- [ ] Update ebookService.handle() signature
- [ ] Update sampleService.handle() signature
- [ ] Verify backward compatibility (classification is optional)
- [ ] Test each service with and without classification
- [ ] Update service JSDoc comments

---

## **Phase 2: Backend Endpoints (New APIs)**

### **2.1 POST /api/classify Endpoint**

**File**: `server/index.js`  
**Location**: New endpoint after POST /prompt  
**Effort**: 30 minutes

```javascript
/**
 * POST /api/classify - Classify a prompt to extract metadata
 *
 * Request: { prompt: string }
 * Response: { classification: Classification }
 */
app.post("/api/classify", async (req, res, next) => {
  try {
    const { prompt } = req.body;

    // Validate
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "Prompt is required and must be non-empty",
      });
    }

    // Classify
    const classification = await genieService.classifyPrompt(prompt);

    // Return
    return res.json({ classification });
  } catch (err) {
    err.status = err.status || 500;
    err.code = err.code || "CLASSIFICATION_ERROR";
    err.message = `Classification Error: ${err.message}`;
    next(err);
  }
});
```

#### **Checklist**

- [ ] Add endpoint to server/index.js
- [ ] Test with valid prompt
- [ ] Test with empty prompt (400)
- [ ] Verify response structure
- [ ] Add unit test (3-5 scenarios)

---

### **2.2 POST /api/generate Endpoint**

**File**: `server/index.js`  
**Location**: New endpoint after /api/classify  
**Effort**: 30 minutes

```javascript
/**
 * POST /api/generate - Generate content with explicit medium
 *
 * Request: { prompt: string, medium: string, options?: any }
 * Response: { out_envelope, resultId }
 */
app.post("/api/generate", async (req, res, next) => {
  try {
    const { prompt, medium, options } = req.body;

    // Validate
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "Prompt is required and must be non-empty",
      });
    }

    if (!medium || !String(medium).trim()) {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "Medium is required",
      });
    }

    // Build payload
    const payload = {
      mode: medium,
      prompt: String(prompt).trim(),
      options: options || {},
      _classify: true, // Always classify for metadata
    };

    // Process
    const result = await genieService.process(payload);

    // Return
    return res.status(201).json(result);
  } catch (err) {
    err.status = err.status || 500;
    err.code = err.code || "GENERATION_ERROR";
    err.message = `Generation Error: ${err.message}`;
    next(err);
  }
});
```

#### **Checklist**

- [ ] Add endpoint to server/index.js
- [ ] Test with valid prompt + medium
- [ ] Test with missing prompt (400)
- [ ] Test with missing medium (400)
- [ ] Verify response structure matches /prompt
- [ ] Add unit test (5-10 scenarios)

---

### **2.3 POST /api/override Endpoint**

**File**: `server/index.js`  
**Location**: New endpoint after /api/generate  
**Effort**: 1 hour

```javascript
/**
 * POST /api/override - Apply style overrides to existing result
 *
 * Request: {
 *   resultId: string,
 *   overrides: {
 *     style?: string,
 *     theme?: string[],
 *     colorPalette?: string,
 *     ...any
 *   }
 * }
 * Response: { out_envelope, pdfUrl? }
 */
app.post("/api/override", async (req, res, next) => {
  try {
    const { resultId, overrides } = req.body;

    // Validate
    if (!resultId || !String(resultId).trim()) {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "resultId is required",
      });
    }

    if (!overrides || typeof overrides !== "object") {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "Overrides must be an object",
      });
    }

    // Fetch original result
    const resultDb = require("./utils/resultDb");
    const originalEnvelope = await resultDb.getResult(resultId);
    if (!originalEnvelope) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Result not found",
      });
    }

    // Apply overrides
    const updatedEnvelope = {
      ...originalEnvelope,
      metadata: {
        ...originalEnvelope.metadata,
        classification: {
          ...originalEnvelope.metadata.classification,
          ...overrides,
        },
      },
    };

    // Optional: Re-render with new styling
    // (depends on implementation of theme engine)
    // const pdfUrl = await exportService.render(updatedEnvelope);

    // Return updated envelope
    return res.json({ out_envelope: updatedEnvelope });
  } catch (err) {
    err.status = err.status || 500;
    err.code = err.code || "OVERRIDE_ERROR";
    err.message = `Override Error: ${err.message}`;
    next(err);
  }
});
```

#### **Checklist**

- [ ] Add endpoint to server/index.js
- [ ] Test with valid resultId + overrides
- [ ] Test with missing resultId (400)
- [ ] Test with non-existent resultId (404)
- [ ] Test with invalid overrides (400)
- [ ] Verify updated envelope returned
- [ ] Add unit test (5-10 scenarios)

---

### **2.4 GET /api/router/services Endpoint**

**File**: `server/index.js`  
**Location**: New endpoint (informational)  
**Effort**: 15 minutes

```javascript
/**
 * GET /api/router/services - List available services and mediums
 *
 * Response: {
 *   services: [
 *     { id: "ebook", label: "eBook", icon: "📖" },
 *     { id: "calendar", label: "Calendar", icon: "📅" },
 *     ...
 *   ]
 * }
 */
app.get("/api/router/services", (req, res) => {
  const services = [
    {
      id: "ebook",
      label: "eBook",
      icon: "📖",
      description: "Digital book with chapters",
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: "📅",
      description: "12-month printable calendar",
    },
    {
      id: "poster",
      label: "Wall Art",
      icon: "🖼️",
      description: "Printable poster designs",
    },
    {
      id: "stickers",
      label: "Stickers",
      icon: "✨",
      description: "Sticker pack designs",
    },
    {
      id: "card",
      label: "Greeting Card",
      icon: "💌",
      description: "Card + envelope designs",
    },
    {
      id: "journal",
      label: "Journal",
      icon: "📔",
      description: "Structured journal",
    },
    {
      id: "basic",
      label: "Basic (Demo)",
      icon: "🎯",
      description: "Basic content generation",
    },
  ];

  return res.json({ services });
});
```

#### **Checklist**

- [ ] Add endpoint to server/index.js
- [ ] Test endpoint returns full services list
- [ ] Verify response structure

---

## **Phase 3: Frontend UI Wiring**

### **3.1 Wire MediaSelector to /api/generate**

**File**: `client/src/components/PromptInput.svelte`  
**Effort**: 1 hour

**Change**: Connect MediaSelector.onMediaSelected to call /api/generate with explicit medium

```svelte
<script>
  import MediaSelector from './MediaSelector.svelte';
  import { generate } from '../lib/api';

  let selectedMedium = 'ebook';
  let prompt = '';

  async function handleGenerateWithMedium() {
    try {
      const result = await generate(prompt, selectedMedium);
      // Display result
      contentStore.set(result.out_envelope);
      // Show classification feedback
      classificationFeedback.set(result.out_envelope.metadata.classification);
    } catch (err) {
      // Error handling
    }
  }
</script>

<MediaSelector onMediaSelected={(medium) => { selectedMedium = medium }} />
<button on:click={handleGenerateWithMedium}>Generate with Medium</button>
```

#### **Checklist**

- [ ] Add MediaSelector to PromptInput
- [ ] Wire onMediaSelected handler
- [ ] Call /api/generate with selectedMedium
- [ ] Display classification feedback from response
- [ ] Test with each medium
- [ ] Add UI test (3-5 scenarios)

---

### **3.2 Display ClassificationFeedback Component**

**File**: `client/src/components/PromptInput.svelte`  
**Effort**: 30 minutes

**Change**: Show classification results after generation

```svelte
<script>
  import ClassificationFeedback from './ClassificationFeedback.svelte';

  let classification = null;

  async function handleGenerateWithMedium() {
    const result = await generate(prompt, selectedMedium);
    classification = result.out_envelope.metadata.classification;
  }
</script>

{#if classification}
  <ClassificationFeedback {classification} onOverride={handleOverride} />
{/if}
```

#### **Checklist**

- [ ] Import ClassificationFeedback component
- [ ] Extract classification from response
- [ ] Display component when classification present
- [ ] Show confidence bar + source badge
- [ ] Show metadata (style, theme, audience)
- [ ] Test component displays correctly
- [ ] Add UI test

---

### **3.3 Wire OverrideControls to /api/override**

**File**: `client/src/components/OverrideControls.svelte`  
**Effort**: 1 hour

**Change**: Connect override form to /api/override endpoint

```svelte
<script>
  import { applyOverride } from '../lib/api';

  let selectedStyle = '';
  let selectedTheme = [];

  async function handleApplyOverride() {
    try {
      const result = await applyOverride(resultId, {
        style: selectedStyle,
        theme: selectedTheme,
      });

      // Update content with new styling
      contentStore.set(result.out_envelope);
      uiStateStore.set({ status: 'success', message: 'Style updated' });
    } catch (err) {
      uiStateStore.set({ status: 'error', message: err.message });
    }
  }
</script>

<div class="override-controls">
  <select bind:value={selectedStyle}>
    <option value="">Select style...</option>
    <option value="minimalist">Minimalist</option>
    <option value="gothic">Gothic</option>
    <option value="whimsical">Whimsical</option>
  </select>

  <button on:click={handleApplyOverride}>Apply Style</button>
</div>
```

#### **Checklist**

- [ ] Wire style selector to state
- [ ] Wire theme selector to state
- [ ] Call /api/override on button click
- [ ] Update contentStore with new envelope
- [ ] Show success message
- [ ] Handle errors gracefully
- [ ] Test with each style option
- [ ] Add UI test

---

## **Phase 4: Backward Compatibility**

### **4.1 Enhance /prompt Endpoint for Phase A-B**

**File**: `server/index.js`  
**Location**: Existing /prompt endpoint (around line 665)  
**Effort**: 30 minutes

**Change**: Auto-classify if mode not provided, but don't break Phase A

```javascript
app.post("/prompt", async (req, res, next) => {
  const validation = validatePayload(req.body);
  if (!validation.valid) {
    return sendValidationError(res, validation.message, {...});
  }

  try {
    // Phase A-B: Auto-classify if no mode provided
    let payload = req.body;

    if (!payload.mode && payload.enableClassification !== false) {
      // Auto-detect medium via classification
      const classification = await genieService.classifyPrompt(payload.prompt);
      payload.mode = classification.medium;
      payload._classification = classification;
    }

    // Orchestrator handles rest
    const result = await genieService.process(payload);
    return res.status(201).json(result);
  } catch (err) {
    err.status = err.status || 500;
    err.code = err.code || "GENERATION_ERROR";
    err.message = `Generation Error: ${err.message}`;
    next(err);
  }
});
```

#### **Checklist**

- [ ] Update /prompt to support auto-classification
- [ ] Maintain backward compatibility: explicit mode still works
- [ ] Add opt-out flag: enableClassification: false
- [ ] Test Phase A flow (mode provided): unchanged behavior
- [ ] Test Phase A-B flow (no mode): auto-classify
- [ ] Test opt-out: enableClassification=false bypasses classification

---

## **Phase 5: Testing & Validation**

### **5.1 Unit Tests**

**Files**: Create new test files or extend existing

```javascript
// server/__tests__/orchestrator-a2b.test.js
describe("Phase A-B Orchestrator Integration", () => {
  test("classifyPrompt extracts medium correctly", () => { ... });
  test("process() routes by classification when mode not provided", () => { ... });
  test("process() includes classification in response", () => { ... });
  test("service.handle() receives classification", () => { ... });
  test("/api/classify endpoint works", () => { ... });
  test("/api/generate endpoint works", () => { ... });
  test("/api/override endpoint works", () => { ... });
  test("Backward compatibility: explicit mode ignored classification", () => { ... });
});
```

**Effort**: 2 hours

#### **Checklist**

- [ ] Write 10+ unit tests for orchestrator
- [ ] Write 5+ tests for each endpoint
- [ ] Write 5+ tests for backward compatibility
- [ ] All tests passing
- [ ] Code coverage >80%

---

### **5.2 Integration Tests**

**Files**: `server/__tests__/phase-a2b.integration.test.js`

```javascript
describe("Phase A-B End-to-End Flows", () => {
  test("Flow 1: User submits prompt → auto-classify → generate", () => { ... });
  test("Flow 2: User selects medium → generate with explicit medium", () => { ... });
  test("Flow 3: User applies override → re-style content", () => { ... });
  test("Flow 4: Classification feedback displayed correctly", () => { ... });
  test("Flow 5: All mediums route correctly", () => { ... });
  test("Backward compat: Phase A flow unchanged", () => { ... });
});
```

**Effort**: 1.5 hours

#### **Checklist**

- [ ] Write 6+ integration tests
- [ ] All tests passing
- [ ] Coverage includes happy path + error paths
- [ ] All existing Phase A tests still pass

---

### **5.3 Manual E2E Testing**

**Scenarios**:

1. **Phase A Flow (Backward Compat)**

   - [ ] POST /prompt with mode="demo" → generates demo content
   - [ ] Response includes metadata.mode but no metadata.classification
   - [ ] No classification called

2. **Phase A-B Flow (Auto-Classify)**

   - [ ] POST /prompt without mode → auto-classifies
   - [ ] Medium detected correctly from prompt
   - [ ] Response includes metadata.classification
   - [ ] Service receives classification

3. **Explicit Medium Selection**

   - [ ] POST /api/generate with medium="ebook" → generates ebook
   - [ ] POST /api/generate with medium="calendar" → generates calendar (if implemented)
   - [ ] Both include classification metadata

4. **Classification API**

   - [ ] POST /api/classify with prompt → returns classification
   - [ ] Confidence scores reasonable (0-1)
   - [ ] Medium detected correctly
   - [ ] Style and theme extracted

5. **Override Flow**
   - [ ] Generate content
   - [ ] POST /api/override with resultId + style override
   - [ ] Returns updated envelope with new style
   - [ ] Content preserved, style changed

---

## **Phase 6: Performance Validation**

### **6.1 Latency Benchmarks**

| Operation                      | Target         | Must Achieve | Measurement                   |
| ------------------------------ | -------------- | ------------ | ----------------------------- |
| Rule engine classification     | <10ms          | ✅           | Single prompt                 |
| LLM classification             | ~500ms         | ✅           | When triggered (<20% of time) |
| /api/classify endpoint         | <600ms         | ✅           | P95 latency                   |
| /api/generate endpoint         | <1s            | ✅           | P95 latency                   |
| /api/override endpoint         | <500ms         | ✅           | P95 latency                   |
| Auto-classification in /prompt | <50ms overhead | ✅           | vs original                   |

#### **Checklist**

- [ ] Measure rule engine: <10ms ✅
- [ ] Measure LLM: ~500ms ✅
- [ ] Measure endpoint latencies (all <1s)
- [ ] Verify overhead minimal (<50ms)
- [ ] Document in operations runbook

---

### **6.2 Resource Usage**

| Resource    | Metric         | Target | Acceptable |
| ----------- | -------------- | ------ | ---------- |
| Memory      | Per-request    | <50MB  | <100MB     |
| CPU         | Classification | <5%    | <10%       |
| Database    | Persist ops    | <10ms  | <50ms      |
| SVG Library | Query latency  | <5ms   | <50ms      |

#### **Checklist**

- [ ] Profile memory usage (no leaks)
- [ ] Profile CPU during classification
- [ ] Verify database query performance
- [ ] Verify SVG library queries fast

---

## **Phase 7: Documentation & Handoff**

### **7.1 Documentation Updates**

- [ ] Update ORCHESTRATOR_ARCHITECTURE.md (integration points marked ✅)
- [ ] Add Phase A-B integration examples to architecture docs
- [ ] Update API documentation with new endpoints
- [ ] Add troubleshooting guide for classification issues

### **7.2 Team Handoff**

- [ ] Code review checklist
- [ ] Update runbooks for operations team
- [ ] Create alerts for classification failures
- [ ] Plan phase-out of Phase A UI (future)

#### **Checklist**

- [ ] All documentation updated
- [ ] Team trained on new endpoints
- [ ] Operations runbooks updated
- [ ] Monitoring/alerts configured

---

## **Summary Checklist**

### **Backend: Ready to Start**

- [ ] Phase 1: Orchestrator Enhancement (classifyPrompt, enhance process())

  - [ ] 1.1 Add classifyPrompt() method
  - [ ] 1.2 Enhance process() method
  - [ ] 1.3 Update service interfaces

- [ ] Phase 2: Backend Endpoints
  - [ ] 2.1 POST /api/classify
  - [ ] 2.2 POST /api/generate
  - [ ] 2.3 POST /api/override
  - [ ] 2.4 GET /api/router/services

### **Frontend: Ready to Start**

- [ ] Phase 3: UI Wiring
  - [ ] 3.1 Wire MediaSelector to /api/generate
  - [ ] 3.2 Display ClassificationFeedback
  - [ ] 3.3 Wire OverrideControls to /api/override

### **Compatibility: Ready to Start**

- [ ] Phase 4: Backward Compatibility
  - [ ] 4.1 Enhance /prompt endpoint

### **Quality: Ready to Start**

- [ ] Phase 5: Testing

  - [ ] 5.1 Unit tests
  - [ ] 5.2 Integration tests
  - [ ] 5.3 Manual E2E

- [ ] Phase 6: Performance

  - [ ] 6.1 Latency benchmarks
  - [ ] 6.2 Resource usage

- [ ] Phase 7: Handoff
  - [ ] 7.1 Documentation
  - [ ] 7.2 Team training

---

## **Risks & Mitigations**

| Risk                                        | Probability | Impact | Mitigation                                 |
| ------------------------------------------- | ----------- | ------ | ------------------------------------------ |
| Classification performance degrades latency | Medium      | High   | Benchmark early, optimize rule engine      |
| LLM cost spikes                             | Low         | Medium | Rate limit to <20% of requests             |
| Phase A users confused by new UI            | Low         | Low    | Keep Phase A mode working, gradual rollout |
| Database query performance                  | Low         | Medium | Index optimization, caching                |
| Frontend components break                   | Low         | High   | Comprehensive UI tests before merge        |

---

## **Success Criteria**

- ✅ All 7 phases completed
- ✅ All unit tests passing (>80% coverage)
- ✅ All integration tests passing
- ✅ All E2E scenarios working
- ✅ Performance targets met
- ✅ Backward compatibility verified
- ✅ Zero Phase A regressions
- ✅ Classification accuracy >80%
- ✅ LLM fallback <20% of requests

---

## **Timeline Estimate**

| Phase                         | Duration     | Start    | End      |
| ----------------------------- | ------------ | -------- | -------- |
| Phase 1: Backend Orchestrator | 2 hours      | Day 1 AM | Day 1 PM |
| Phase 2: Endpoints            | 2 hours      | Day 1 PM | Day 2 AM |
| Phase 3: Frontend UI          | 2.5 hours    | Day 2 AM | Day 2 PM |
| Phase 4: Backward Compat      | 0.5 hours    | Day 2 PM | Day 2 PM |
| Phase 5: Testing              | 3.5 hours    | Day 2 PM | Day 3 AM |
| Phase 6: Performance          | 1.5 hours    | Day 3 AM | Day 3 PM |
| Phase 7: Handoff              | 2 hours      | Day 3 PM | Day 3 PM |
| **TOTAL**                     | **14 hours** |          |          |

**Effort**: 2-3 engineering days (20-30 hours with testing & reviews)

---

## **Document Control**

| Version | Date       | Status            | Changes                                 |
| ------- | ---------- | ----------------- | --------------------------------------- |
| 1.0     | 2025-11-18 | 🔴 READY TO START | Initial Phase A-B integration checklist |

---

**Last Updated**: November 18, 2025  
**Status**: 🔴 READY TO IMPLEMENT — No blockers, all dependencies available  
**Next Step**: Assign Phase 1 to backend engineer, begin 2025-11-19

---

**END OF PHASE A-B INTEGRATION CHECKLIST**
