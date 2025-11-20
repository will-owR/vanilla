# Orchestrator Architecture: Plumbing → Orchestrator → Services Pattern

**Date**: November 18, 2025  
**Status**: 🟢 **CURRENT ARCHITECTURE DOCUMENTED**  
**Scope**: Backend coordination pattern, current implementation, Phase A-B integration points  
**Audience**: Backend engineers, architects, system designers

---

## **1. Executive Summary**

AetherPress backend uses a **three-layer orchestration pattern**:

```
HTTP Request (Plumbing)
    ↓
genieService.process() (Orchestrator)
    ↓
demoService | ebookService | sampleService (Services)
```

This pattern separates concerns cleanly:

- **Plumbing**: HTTP validation and routing (Express)
- **Orchestrator**: Coordination, persistence, action dispatch (genieService)
- **Services**: Domain-specific content generation

The orchestrator is **already designed to support Phase A-B classification**—it just needs the classification pipeline wired in.

---

## **2. Three-Layer Architecture**

### **2.1 Layer 1: Plumbing (HTTP Handler)**

**File**: `server/index.js` (lines 665-688)  
**Purpose**: Validate HTTP request, delegate to orchestrator, return standardized response

```javascript
app.post("/prompt", async (req, res, next) => {
  // STEP 1: Validate incoming payload
  const validation = validatePayload(req.body);
  if (!validation.valid) {
    return sendValidationError(res, validation.message, {
      error: validation.error,
      fields: validation.fields,
    });
  }

  try {
    // STEP 2: Delegate to orchestrator
    const result = await genieService.process(req.body);

    // STEP 3: Return standardized response
    return res.status(201).json(result);
  } catch (err) {
    // STEP 4: Handle errors consistently
    err.status = err.status || 500;
    err.code = err.code || "GENERATION_ERROR";
    err.message = `Generation Error: ${err.message}`;
    next(err);
  }
});
```

#### **Plumbing Responsibilities**

| Responsibility   | Implementation                   | Status    |
| ---------------- | -------------------------------- | --------- |
| **Validate**     | `validatePayload(req.body)`      | ✅ Active |
| **Route**        | Hardcoded to `/prompt` endpoint  | ✅ Active |
| **Delegate**     | `genieService.process(req.body)` | ✅ Active |
| **Respond**      | `res.status(201).json(result)`   | ✅ Active |
| **Error Handle** | Pass to Express error middleware | ✅ Active |

---

### **2.2 Layer 2: Orchestrator (genieService)**

**File**: `server/genieService.js` (lines 544-631)  
**Purpose**: Coordinate all generation activities (routing, normalization, persistence, actions)

```javascript
async process(payload) {
  const { mode, prompt } = payload;

  try {
    // STEP 1: Route by mode to appropriate service
    let result;
    switch (mode) {
      case "demo": {
        const demoService = require("./demoService");
        result = await demoService.handle(payload);
        break;
      }
      case "ebook": {
        const ebookService = require("./ebookService");
        result = await ebookService.handle(payload);
        break;
      }
      case "basic":
      default: {
        result = await sampleService.handle(payload);
      }
    }

    // STEP 2: Build canonical response envelope with enriched metadata
    const envelope = {
      out_envelope: {
        pages: result.pages || [],
        metadata: {
          ...result.metadata,
          generated_at: new Date().toISOString(),
          mode: mode,
        },
        actions: result.actions || {},
        ...(result.epilogue && { epilogue: result.epilogue }),
      },
    };

    // STEP 3: Persist result with unique UUID
    const resultId = uuidv4();
    try {
      await resultDb.saveResult(resultId, envelope.out_envelope, mode);
      envelope.resultId = resultId;
    } catch (err) {
      console.warn("Result persistence failed", err?.message);
      envelope.resultId = resultId;  // Best-effort
    }

    // STEP 4: Process actions from service
    if (result.actions) {
      if (result.actions.persist_prompt === true) {
        try {
          const { saveContentToFile } = require("./utils/fileUtils");
          saveContentToFile(prompt).catch((err) => {
            console.warn("persist_prompt action failed", err?.message);
          });
        } catch (e) {
          console.warn("Could not process persist_prompt action", e?.message);
        }
      }
      // Future: if (result.actions.send_notification) { ... }
      // Future: if (result.actions.trigger_webhook) { ... }
    }

    // STEP 5: Return envelope
    return envelope;
  } catch (error) {
    throw new Error(`Generation failed: ${error.message}`);
  }
}
```

#### **Orchestrator Responsibilities**

| Step | Responsibility | Implementation                      | Location |
| ---- | -------------- | ----------------------------------- | -------- |
| 1    | **Route**      | `switch(mode) { case "demo": ... }` | Line 552 |
| 2    | **Normalize**  | Build canonical `out_envelope`      | Line 576 |
| 3    | **Persist**    | UUID-based result storage           | Line 587 |
| 4    | **Dispatch**   | Process `result.actions`            | Line 610 |
| 5    | **Return**     | Return standardized envelope        | Line 630 |

#### **Orchestrator Data Flow**

```
Input: payload { mode, prompt, metadata, options }
    ↓
[1] Route: Select service by mode
    ↓
[2] Call: service.handle(payload)
    ↓
[3] Normalize: Wrap in out_envelope
    ├─ pages: result.pages
    ├─ metadata: { ...result.metadata, generated_at, mode }
    ├─ actions: result.actions
    └─ epilogue: result.epilogue
    ↓
[4] Persist: Save to resultDb with UUID
    ├─ resultId: unique identifier
    ├─ out_envelope: full content
    └─ mode: service mode
    ↓
[5] Process: Handle side effects
    ├─ persist_prompt: save to file
    ├─ send_notification: (future)
    └─ trigger_webhook: (future)
    ↓
Output: envelope { out_envelope, resultId }
```

---

### **2.3 Layer 3: Services (Domain Handlers)**

**Purpose**: Implement domain-specific content generation logic

#### **Service Interface Contract**

All services implement the same interface:

```typescript
interface ContentService {
  // Generate content for given payload
  handle(payload: ServicePayload): Promise<ServiceResult>;
}

interface ServicePayload {
  mode: string;
  prompt: string;
  metadata?: Record<string, any>;
  options?: Record<string, any>;
}

interface ServiceResult {
  pages: Page[];
  metadata?: Record<string, any>;
  actions?: Record<string, any>;
  epilogue?: any;
}

interface Page {
  title: string;
  blocks?: Block[];
  layout?: string;
}

interface Block {
  content: string;
  type?: string;
}
```

#### **Service Implementations**

| Service           | File                      | Mode      | Purpose                | Status    |
| ----------------- | ------------------------- | --------- | ---------------------- | --------- |
| **demoService**   | `server/demoService.js`   | `"demo"`  | 5-page dark theme demo | ✅ Active |
| **ebookService**  | `server/ebookService.js`  | `"ebook"` | eBook generation       | ✅ Active |
| **sampleService** | `server/sampleService.js` | `"basic"` | Basic/default mode     | ✅ Active |

#### **Service Example: demoService**

```javascript
// server/demoService.js
const demoService = {
  async handle(payload) {
    const { prompt } = payload;

    // Domain logic: generate 5-page structure
    const pages = [
      { title: "Cover", content: "..." },
      { title: "Page 1", content: "..." },
      { title: "Page 2", content: "..." },
      { title: "Page 3", content: "..." },
      { title: "Epilogue", content: "..." },
    ];

    return {
      pages: pages,
      metadata: {
        model: "demo-1",
        version: "1.0",
        theme: "dark",
      },
      actions: {
        persist_prompt: true,
      },
    };
  },
};
```

---

## **3. Complete Request → Response Flow**

### **3.1 Sequence Diagram**

```
Client              Plumbing             Orchestrator        Service
  │                   │                      │                  │
  ├──POST /prompt────→│                      │                  │
  │   {mode,prompt}   │                      │                  │
  │                   │                      │                  │
  │                   ├─validatePayload()──→│                  │
  │                   │   OK                 │                  │
  │                   │                      │                  │
  │                   ├──process(payload)───→│                  │
  │                   │                      │                  │
  │                   │                      ├─route by mode───→│
  │                   │                      │                  │
  │                   │                      │  ├─generate pages│
  │                   │                      │  └─return result─┤
  │                   │                      │←─────────────────┤
  │                   │                      │                  │
  │                   │                      ├─normalize────┐   │
  │                   │                      │  out_envelope│   │
  │                   │                      ├──────────────┘   │
  │                   │                      │                  │
  │                   │                      ├─persist (UUID)   │
  │                   │                      │                  │
  │                   │                      ├─dispatch actions │
  │                   │                      │  (fire-and-forget)
  │                   │                      │                  │
  │                   │←──return envelope───│                  │
  │                   │  {out_envelope,     │                  │
  │                   │   resultId}         │                  │
  │                   │                      │                  │
  │←──res.json()──────│                      │                  │
  │ {out_envelope,    │                      │                  │
  │  resultId}        │                      │                  │
```

### **3.2 Data Structure: Request**

```javascript
// POST /prompt
{
  mode: "demo" | "ebook" | "basic",    // Service selection
  prompt: string,                       // User prompt
  metadata?: {                          // Optional metadata
    user?: string,
    session?: string,
    ...any
  },
  options?: {                           // Optional service options
    theme?: string,
    layout?: string,
    ...any
  }
}
```

### **3.3 Data Structure: Response**

```javascript
// 201 Created
{
  out_envelope: {                       // Canonical content envelope
    pages: [                            // Content pages
      {
        title: string,
        blocks?: [{ content: string }],
        layout?: string
      },
      ...
    ],
    metadata: {                         // Normalized metadata
      ...service_metadata,
      generated_at: ISO8601,
      mode: string
    },
    actions?: {                         // Service intents
      persist_prompt?: boolean,
      send_notification?: boolean,
      ...any
    },
    epilogue?: any                      // Optional epilogue
  },
  resultId: UUID                        // Persistent result identifier
}
```

---

## **4. Key Orchestrator Features**

### **4.1 Routing: Mode-Based Service Selection**

The orchestrator routes to services via the `mode` parameter:

```javascript
switch (mode) {
  case "demo":
    return await demoService.handle(payload);
  case "ebook":
    return await ebookService.handle(payload);
  case "basic":
  default:
    return await sampleService.handle(payload);
}
```

**Future Enhancement**: Replace `mode`-based routing with **classification-based routing** (Phase A-B).

---

### **4.2 Normalization: Canonical Response Shape**

All services return different structures. The orchestrator normalizes them into a canonical `out_envelope`:

```javascript
const envelope = {
  out_envelope: {
    pages: result.pages || [], // Normalized from service
    metadata: {
      ...result.metadata, // Service metadata
      generated_at: new Date().toISOString(),
      mode: mode, // Orchestrator adds mode
    },
    actions: result.actions || {},
    ...(result.epilogue && { epilogue: result.epilogue }),
  },
};
```

**Benefit**: Clients always receive consistent structure, regardless of service.

---

### **4.3 Persistence: UUID-Based Result Storage**

The orchestrator assigns a UUID to each generation for retrieval:

```javascript
const resultId = uuidv4();
try {
  await resultDb.saveResult(resultId, envelope.out_envelope, mode);
  envelope.resultId = resultId;
} catch (err) {
  console.warn("Persistence failed", err?.message);
  // Best-effort: include resultId even if persistence fails
  envelope.resultId = resultId;
}
```

**Benefits**:

- Enables reference-based export: `GET /export?resultId=uuid`
- Supports async job queuing: jobs reference resultId, not full content
- Audit trail: all results stored by UUID

---

### **4.4 Action Dispatch: Service Side Effects**

Services express intent via `actions`; the orchestrator handles execution:

```javascript
if (result.actions) {
  if (result.actions.persist_prompt === true) {
    // Fire-and-forget: save prompt in background
    saveContentToFile(prompt).catch((err) => {
      console.warn("persist_prompt failed", err?.message);
    });
  }
  // Future actions:
  // if (result.actions.send_notification) { ... }
  // if (result.actions.trigger_webhook) { ... }
}
```

**Benefit**: Services don't handle side effects directly; orchestrator coordinates them.

---

### **4.5 Error Resilience: Best-Effort Semantics**

Failures in non-critical paths don't block response:

```javascript
// Persistence failure doesn't prevent response
try {
  await resultDb.saveResult(...);
} catch (err) {
  console.warn("Persistence failed (non-blocking)");
  // Still return resultId for client reference
}

// Action failure doesn't prevent response
saveContentToFile(prompt).catch(err => {
  console.warn("Action failed (non-blocking)");
});
```

---

## **5. Integration Points for Phase A-B**

### **5.1 Current State: Phase A Only**

The orchestrator currently:

- Accepts `mode` from client
- Routes to service by mode
- Returns result with mode metadata

```javascript
// Current (Phase A)
async process(payload) {
  const { mode, prompt } = payload;  // mode from client
  const result = await this.selectService(mode).handle(payload);
  return {
    out_envelope: { pages, metadata: { mode } },
    resultId
  };
}
```

### **5.2 Phase A-B Integration Points**

#### **Integration Point 1: Pre-Routing Classification**

**Where**: In `genieService.process()`, before service selection  
**What**: Call classification system to extract medium, style, theme

```javascript
// Phase A-B: Classification injection point
async process(payload) {
  let { mode, prompt } = payload;

  // NEW: Classify if medium not explicitly provided
  let classification = null;
  if (!mode || mode === "auto") {
    classification = await this.classifyPrompt(prompt);
    mode = classification.medium;  // Override with detected medium
  }

  // EXISTING: Route to service
  const result = await this.selectService(mode).handle(payload, classification);

  // EXISTING: Normalize response
  const envelope = {
    out_envelope: {
      pages: result.pages,
      metadata: {
        ...result.metadata,
        generated_at: new Date().toISOString(),
        mode: mode,
        classification: classification,  // NEW: Include classification
      },
      actions: result.actions,
    },
  };

  // EXISTING: Persist and return
  return envelope;
}
```

#### **Integration Point 2: Service Interface Enhancement**

**Where**: Service `handle()` method signature  
**What**: Accept classification parameter for medium-aware content generation

```javascript
// Current (Phase A)
async handle(payload) { }

// Phase A-B
async handle(payload, classification) {
  const { medium, style, theme, audience, tone } = classification;
  // Use classification to tailor generation
}
```

#### **Integration Point 3: Classification Lambda**

**Where**: New `classifyPrompt()` method in genieService  
**What**: Orchestrate classification pipeline (rule engine → LLM fallback)

```javascript
async classifyPrompt(prompt) {
  const ruleEngine = require("./utils/ruleEngine");
  const llmClassifier = require("./utils/llmClassifier");
  const validator = require("./utils/classificationValidator");

  // 1. Fast path: rule engine
  let classification = ruleEngine.extract(prompt);

  // 2. LLM fallback if low confidence
  if (classification.confidence < 0.8) {
    const aiResult = await llmClassifier.classify(prompt);
    if (aiResult) {
      classification = validator.merge(classification, aiResult);
    }
  }

  return classification;
}
```

#### **Integration Point 4: Response Metadata Enhancement**

**Where**: Envelope normalization  
**What**: Include classification metadata in response for client feedback

```javascript
// Current
metadata: {
  ...result.metadata,
  generated_at: new Date().toISOString(),
  mode: mode,
}

// Phase A-B
metadata: {
  ...result.metadata,
  generated_at: new Date().toISOString(),
  mode: mode,
  classification: {                    // NEW
    medium: string,
    style: string,
    theme: string[],
    audience?: string,
    tone?: string,
    confidence: number,
    source: "rules" | "ai" | "hybrid"
  }
}
```

---

## **6. Plumbing Enhancements for Phase A-B**

The plumbing `/prompt` endpoint can be enhanced to support Phase A-B without changing orchestrator:

### **6.1 Phase A-B Endpoint Additions**

```javascript
// NEW: Direct classification endpoint
app.post("/api/classify", async (req, res, next) => {
  try {
    const classification = await genieService.classifyPrompt(req.body.prompt);
    return res.json({ classification });
  } catch (err) {
    next(err);
  }
});

// NEW: Generate with explicit medium
app.post("/api/generate", async (req, res, next) => {
  try {
    const { prompt, medium } = req.body;
    // Classify, then use medium to select service
    const payload = { mode: medium, prompt, ...req.body };
    const result = await genieService.process(payload);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// NEW: Apply style override
app.post("/api/override", async (req, res, next) => {
  try {
    const { resultId, overrides } = req.body;
    // Fetch result, apply style overrides, re-render
    const result = await genieService.applyOverride(resultId, overrides);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});
```

### **6.2 Backward Compatibility**

Enhance existing `/prompt` to support both Phase A and Phase A-B:

```javascript
app.post("/prompt", async (req, res, next) => {
  const validation = validatePayload(req.body);
  if (!validation.valid) {
    return sendValidationError(res, validation.message, {...});
  }

  try {
    // Phase A-B: Support auto-classification
    let payload = req.body;
    if (!payload.mode && payload.enableClassification !== false) {
      // Auto-classify if no mode provided and not explicitly disabled
      const classification = await genieService.classifyPrompt(payload.prompt);
      payload.mode = classification.medium;
      payload._classification = classification;
    }

    // Orchestrator handles rest (routes, normalizes, persists)
    const result = await genieService.process(payload);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});
```

---

## **7. Architecture Diagram: Full System**

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                          │
│                                                                     │
│  PromptInput → generateAndPreview() → flows.js → api.submitPrompt()│
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    POST /prompt or /api/generate
                    { mode, prompt, metadata }
                                 │
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      PLUMBING (server/index.js)                     │
│                                                                     │
│  ├─ validatePayload()                                              │
│  ├─ Phase A-B enhancement: auto-classify if needed                │
│  └─ genieService.process()                                         │
│                                                                     │
│  app.post("/prompt", async (req, res, next) => {                   │
│    // Validation                                                   │
│    // Phase A-B: auto-classification                              │
│    const result = await genieService.process(req.body);           │
│    res.status(201).json(result);                                  │
│  })                                                                │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  ORCHESTRATOR (genieService.process)                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 1. ROUTE (by mode or classification)                        │  │
│  │   ├─ Phase A: switch(mode) → service selection              │  │
│  │   └─ Phase A-B: switch(classification.medium) → service     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 2. DELEGATE to service.handle()                             │  │
│  │   service.handle(payload, classification)                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 3. NORMALIZE to canonical out_envelope                      │  │
│  │   ├─ pages: service.pages                                   │  │
│  │   ├─ metadata: { ...service.metadata, mode, classification }│  │
│  │   ├─ actions: service.actions                               │  │
│  │   └─ epilogue: service.epilogue                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 4. PERSIST with UUID                                        │  │
│  │   resultDb.saveResult(resultId, out_envelope, mode)         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 5. DISPATCH actions (fire-and-forget)                       │  │
│  │   ├─ persist_prompt: save to file                           │  │
│  │   └─ future: send_notification, trigger_webhook             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          ↓                                          │
│  return { out_envelope, resultId }                                 │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│              SERVICES LAYER (Domain Handlers)                       │
│                                                                     │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────┐ │
│  │  demoService        │  │  ebookService       │  │sampleService│ │
│  │  handle() → {       │  │  handle() → {       │  │handle() → { │ │
│  │    pages,           │  │    pages,           │  │  pages,     │ │
│  │    metadata,        │  │    metadata,        │  │  metadata,  │ │
│  │    actions          │  │    actions          │  │  actions    │ │
│  │  }                  │  │  }                  │  │}             │ │
│  └─────────────────────┘  └─────────────────────┘  └────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## **8. Design Principles**

### **8.1 Separation of Concerns**

- **Plumbing**: HTTP concerns only (validation, routing, response formatting)
- **Orchestrator**: Coordination concerns (routing, persistence, action dispatch)
- **Services**: Domain concerns (content generation logic)

### **8.2 Single Responsibility**

- Each service handles one medium/domain
- Orchestrator handles one responsibility per method
- Plumbing focuses on HTTP contract only

### **8.3 Interface Contracts**

- Services implement common `handle(payload, classification?)` interface
- Orchestrator guarantees canonical response shape
- Plumbing enforces payload validation

### **8.4 Resilience & Best-Effort**

- Persistence failures don't block response
- Action failures don't prevent generation
- All non-critical paths fail silently

### **8.5 Extensibility**

- New services added via switch case (orchestrator)
- New actions added via `result.actions` dispatch logic
- New endpoints added to plumbing without orchestrator changes

---

## **9. Comparison: Phase A vs Phase A-B**

| Aspect                 | Phase A (Current)           | Phase A-B (Future)                              |
| ---------------------- | --------------------------- | ----------------------------------------------- |
| **Medium Selection**   | Client via `mode` parameter | Auto-detect via classification                  |
| **Routing Logic**      | `switch(mode)`              | `switch(classification.medium)`                 |
| **Service Parameters** | `handle(payload)`           | `handle(payload, classification)`               |
| **Metadata**           | `{ mode }`                  | `{ mode, classification }`                      |
| **UI Feedback**        | None                        | Classification feedback + overrides             |
| **Integration Points** | None                        | Pre-routing classification, service enhancement |

---

## **10. Implementation Roadmap: Activating Phase A-B**

### **Phase 1: Add Classification Pipeline to Orchestrator**

```
✅ genieService.classifyPrompt(prompt) implementation
✅ Integration of ruleEngine + LLMClassifier + validator
```

### **Phase 2: Enhance Orchestrator.process()**

```
✅ Pre-routing classification logic
✅ Pass classification to service.handle()
✅ Include classification in response envelope
```

### **Phase 3: Add New Endpoints**

```
✅ POST /api/classify
✅ POST /api/generate (with explicit medium)
✅ POST /api/override (for style changes)
```

### **Phase 4: Wire Frontend UI**

```
✅ MediaSelector component connected to /api/generate
✅ ClassificationFeedback component receives classification data
✅ OverrideControls component calls /api/override
```

### **Phase 5: Backward Compatibility**

```
✅ Existing /prompt endpoint supports both Phase A and Phase A-B
✅ Auto-classification opt-in via payload flag
```

---

## **11. Testing Strategy**

### **Unit Tests**

- Test orchestrator routing logic
- Test response normalization
- Test persistence behavior

### **Integration Tests**

- Test plumbing → orchestrator → service flow
- Test error handling at each layer
- Test response structure consistency

### **E2E Tests**

- Test complete user flow (submit prompt → receive result)
- Test result persistence and retrieval
- Test action dispatch (fire-and-forget)

---

## **12. Monitoring & Observability**

### **Metrics to Track**

- **Route Distribution**: % of requests per service
- **Classification Accuracy**: Confidence scores, LLM fallback rate
- **Persistence Success**: % of results successfully persisted
- **Action Dispatch**: % of actions successfully processed

### **Logging Points**

- Service selection (orchestrator routing)
- Classification results (confidence, source)
- Persistence failures (non-blocking)
- Action execution (side effects)

---

## **Document Control**

| Version | Date       | Status     | Changes                                                                          |
| ------- | ---------- | ---------- | -------------------------------------------------------------------------------- |
| 1.0     | 2025-11-18 | 🟢 CURRENT | Initial documentation of orchestrator architecture, Phase A-B integration points |

---

**Last Updated**: November 18, 2025  
**Audience**: Backend engineers, architects, Phase A-B implementation team  
**Next Document**: `PHASE_A-B_INTEGRATION_CHECKLIST.md` (implementation guide)

---

**END OF ORCHESTRATOR ARCHITECTURE DOCUMENT**
