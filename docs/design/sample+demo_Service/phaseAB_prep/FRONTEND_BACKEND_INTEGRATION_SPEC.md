# Frontend-Backend Integration Specification

"Here's how frontend components receive data from backend responses, how state transitions work, and what errors look like"

**Document Version**: 1.0  
**Date**: November 18, 2025  
**Status**: 🟢 **READY FOR IMPLEMENTATION**  
**Audience**: Frontend developers, backend developers, integration testers  
**Scope**: Maps progressive disclosure frontend flow to Phase A-B backend endpoints

---

## **Table of Contents**

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [API Endpoint Specifications](#api-endpoint-specifications)
4. [State-to-API Mapping](#state-to-api-mapping)
5. [Data Flow Diagram](#data-flow-diagram)
6. [Component-to-Backend Binding](#component-to-backend-binding)
7. [Error Handling & Recovery](#error-handling--recovery)
8. [Configuration & Thresholds](#configuration--thresholds)
9. [Testing Strategy](#testing-strategy)
10. [Implementation Checklist](#implementation-checklist)

---

## **Executive Summary**

This document provides the **missing link** between:

- **Frontend**: `FRONTEND_PROGRESSIVE_DISCLOSURE_ARCHITECTURE.md` (describes 8-state flow and UI components)
- **Backend**: `PHASE_A-B_INTEGRATION_CHECKLIST.md` (describes 10 Phase A-B modules)
- **Connection**: This spec (maps states → API calls → store updates → component props)

### **Key Points**

- **3 new API endpoints** required from backend (POST /api/classify, /api/generate, /api/override)
- **7 API response types** that frontend components consume
- **5 state transitions** triggered by API responses (MEDIUM_SELECTED → GENERATING → CLASSIFICATION_READY → RESULT_READY → OVERRIDE_ACTIVE)
- **10 error scenarios** with specific recovery strategies
- **Configuration-driven thresholds** (confidence 0.85, cost multipliers 5/40/100%)

---

## **Architecture Overview**

### **Three-Layer Pattern (Reviewed)**

The backend follows a three-layer orchestrator pattern:

```
┌──────────────────────────────────────────────────────────┐
│ Layer 1: HTTP Plumbing (server/index.js)                │
│ - Request validation                                     │
│ - Route to orchestrator                                  │
│ - Response serialization                                 │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ Layer 2: Orchestrator (server/genieService.js)           │
│ - classifyPrompt() ← CALLS Phase A-B classification      │
│ - process() ← ROUTES to service.handle()                 │
│ - normalizeResponse() ← ADDS classification metadata     │
│ - persistenceLayer() ← SAVES with UUID                   │
│ - actionDispatch() ← TRIGGERS callbacks                  │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ Layer 3: Services (demoService, ebookService, etc.)      │
│ - service.handle(prompt, mode, classification)           │
│ - Returns: { content, format, metadata }                 │
└──────────────────────────────────────────────────────────┘
```

### **Frontend State Machine (Reference)**

```
INITIAL
  ↓ [user clicks medium]
MEDIUM_SELECTED
  ↓ [user enters prompt + clicks Generate]
GENERATING (phase 1: classification)
  ↓ [/api/classify returns]
CLASSIFICATION_READY (if confidence < 0.85)
  ↓ [user clicks Accept OR Override]
  ├─→ Accept: go to GENERATING (phase 2: generation)
  └─→ Override: go to OVERRIDE_ACTIVE (select styles)
      ↓ [user clicks Apply Override]
      go to GENERATING (phase 3: regeneration with overrides)
GENERATING (phase 2 or 3: actual PDF generation)
  ↓ [/api/generate returns]
RESULT_READY
  ↓ [user clicks Customize Style]
OVERRIDE_ACTIVE
  ↓ [user clicks Apply Override]
GENERATING (phase 3)
  ↓ [/api/override returns]
RESULT_READY
  ↓ [user clicks Export]
COMPLETE
```

---

## **API Endpoint Specifications**

### **Endpoint 1: POST /api/classify**

**Purpose**: Classify user prompt to determine medium, style, theme, etc.

**When Called**: User clicks "Generate →" button (MEDIUM_SELECTED → GENERATING)

**Request Schema**:

```typescript
POST /api/classify
Content-Type: application/json

{
  "prompt": string,           // User's creative prompt (required, min 10 chars)
  "selectedMedium": string,   // User's pre-selected medium (ebook|calendar|poster|stickers|card)
  "userId": string,           // Optional: for personalization
  "context": object           // Optional: { previousSelection, userPreferences, ... }
}
```

**Response Schema** (Success 200):

```typescript
{
  "id": string,               // Unique classification ID (UUID)
  "medium": string,           // Detected/confirmed medium
  "mediumConfidence": number, // 0-1 (default: 1.0 if matched user selection)
  "style": string,            // Inferred style (minimalist|gothic|abstract|etc)
  "styleConfidence": number,  // 0-1
  "themes": string[],         // 1-3 themes (magical-realism, minimalist-zen, etc)
  "audience": string,         // Target audience (general|professional|creative|kids)
  "genre": string,            // Genre if applicable (sci-fi|poetry|self-help|etc)
  "tone": string,             // Tone (formal|casual|playful|serious)
  "source": "rules|ai|hybrid",// How was classification done?
  "confidence": number,       // Overall confidence (0-1) = average of all dimensions
  "metadata": {
    "rulesMatched": string[], // Which keyword rules fired
    "aiModel": string,        // Which LLM (gemini-pro-vision)
    "processingTimeMs": number
  }
}
```

**Response Schema** (Error):

```typescript
// 400 Bad Request
{ "error": "Prompt too short (min 10 chars)" }

// 500 Server Error
{ "error": "Classification service unavailable", "retryAfter": 5 }
```

**Frontend Usage**:

```typescript
// In GenerateFlow.svelte
async function handleGenerateClick() {
  startGenerating();
  try {
    const classResult = await classify({
      prompt: $flowStore.prompt,
      selectedMedium: $flowStore.selectedMedium,
    });

    flowStore.setClassification(classResult);

    if (classResult.confidence > CONFIDENCE_THRESHOLD) {
      // Auto-accept and move to generation
      await handleAcceptClassification();
    } else {
      // Show user for review
      transition("CLASSIFICATION_READY");
    }
  } catch (error) {
    setError(error);
    transition("CLASSIFICATION_READY"); // Allow retry
  }
}
```

---

### **Endpoint 2: POST /api/generate**

**Purpose**: Generate PDF based on classification (actual content creation)

**When Called**:

- User accepts high-confidence classification (CLASSIFICATION_READY → GENERATING)
- User clicks "Generate" on medium selection (MEDIUM_SELECTED → GENERATING, if classification was skipped)

**Request Schema**:

```typescript
POST /api/generate
Content-Type: application/json

{
  "prompt": string,           // Original user prompt (required)
  "medium": string,           // Medium from classification (required)
  "classification": {         // Full classification object from /api/classify
    "id": string,
    "style": string,
    "themes": string[],
    "audience": string,
    "genre": string,
    "tone": string,
    "confidence": number,
    "source": "rules|ai|hybrid"
  },
  "mode": string,             // Optional: override mode (demo|ebook|calendar)
  "userId": string,           // Optional: for tracking
  "requestId": string         // Optional: for debugging, correlates with classification.id
}
```

**Response Schema** (Success 200):

```typescript
{
  "id": string,               // Unique generation ID (UUID)
  "pdfUrl": string,           // URL to generated PDF (/tmp-exports/{uuid}.pdf)
  "pageCount": number,        // Number of pages generated
  "medium": string,           // Confirmed medium used
  "style": string,            // Confirmed style applied
  "classification": {         // Echo back classification for reference
    "id": string,
    "confidence": number
  },
  "metadata": {
    "model": string,          // Service used (demo-1, gemini-pro, etc)
    "processingTimeMs": number,
    "imageCount": number,     // How many images were generated/used
    "tokenCount": number      // API tokens consumed (if LLM-based)
  },
  "latency": number,          // Total generation time in milliseconds
  "costEstimate": number      // USD cost of this generation (0.0 for demo)
}
```

**Response Schema** (Error):

```typescript
// 400 Bad Request
{ "error": "Invalid classification ID" }

// 408 Request Timeout
{ "error": "Generation exceeded 30s timeout", "retryAfter": 10 }

// 500 Server Error
{ "error": "PDF generation failed", "details": "Image generation timeout" }
```

**Frontend Usage**:

```typescript
// In GenerateFlow.svelte
async function handleAcceptClassification() {
  transition("GENERATING");
  try {
    const genResult = await generate({
      prompt: $flowStore.prompt,
      medium: $flowStore.classification.medium,
      classification: $flowStore.classification,
    });

    flowStore.setResult(genResult);
    flowStore.setLatency(genResult.latency);
    transition("RESULT_READY");
  } catch (error) {
    setError(error);
    transition("CLASSIFICATION_READY"); // Back to accept/override choice
  }
}
```

---

### **Endpoint 3: POST /api/override**

**Purpose**: Apply style/theme overrides and regenerate PDF with new parameters

**When Called**: User clicks "Apply Override" in OVERRIDE_ACTIVE state (OVERRIDE_ACTIVE → GENERATING)

**Request Schema**:

```typescript
POST /api/override
Content-Type: application/json

{
  "generationId": string,     // UUID from /api/generate response (required)
  "classification": {         // Current classification (required)
    "id": string,
    "medium": string,
    "style": string,
    "themes": string[]
  },
  "overrides": {              // What user changed (required, at least 1)
    "style": string,          // New style value
    "color": string,          // New color scheme
    "medium": string,         // New medium (may trigger full regeneration)
    "theme": string,          // New theme
    "tone": string            // New tone
  },
  "preserveImages": boolean,  // If true, reuse images from original (cost 5%)
  "userId": string            // Optional: for tracking
}
```

**Response Schema** (Success 200):

```typescript
{
  "id": string,               // New generation ID (UUID)
  "pdfUrl": string,           // URL to regenerated PDF
  "pageCount": number,
  "overrides": {
    "applied": string[],      // Which overrides were applied
    "skipped": string[],      // Which were ignored (e.g., invalid values)
    "warning": string         // Optional: "Medium change requires full regeneration"
  },
  "costMultiplier": number,   // Cost factor (0.05, 0.40, 1.0)
  "costBreakdown": {
    "color": 0.05,            // Only if color was changed
    "style": 0.40,            // Only if style was changed
    "medium": 1.0             // Only if medium was changed (full regen)
  },
  "latency": number,          // Time to regenerate (ms)
  "metadata": {
    "processingTimeMs": number,
    "imageReused": boolean,
    "regenerationStrategy": "partial|full"
  },
  "costEstimate": number      // Updated cost estimate (USD)
}
```

**Response Schema** (Error):

```typescript
// 400 Bad Request
{ "error": "Generation ID not found" }

// 422 Unprocessable Entity
{ "error": "Invalid override values", "invalid": ["style: invalid-value"] }

// 500 Server Error
{ "error": "Override regeneration failed" }
```

**Frontend Usage**:

```typescript
// In GenerateFlow.svelte (OverrideControls emits)
async function handleApplyOverride(overrides) {
  transition("GENERATING");
  try {
    const overrideResult = await applyOverride({
      generationId: $flowStore.result.id,
      classification: $flowStore.classification,
      overrides: overrides,
    });

    flowStore.setResult(overrideResult);
    flowStore.setOverrideCost(overrideResult.costMultiplier);
    transition("RESULT_READY");
  } catch (error) {
    setError(error);
    transition("OVERRIDE_ACTIVE"); // Retry without losing selections
  }
}
```

---

## **State-to-API Mapping**

This table shows the critical state transitions and which API endpoint triggers them:

| Current State               | User Action                            | API Call           | Request Key Data                         | Response → Store          | Next State                                   | Decision Logic                                                                             |
| --------------------------- | -------------------------------------- | ------------------ | ---------------------------------------- | ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `MEDIUM_SELECTED`           | Click "Generate →"                     | POST /api/classify | prompt, selectedMedium                   | classification            | GENERATING (phase 1)                         | Always call classify first                                                                 |
| `GENERATING (phase 1)`      | /api/classify returns                  | —                  | —                                        | classification            | CLASSIFICATION_READY OR GENERATING (phase 2) | If confidence > 0.85: auto-advance to GENERATING (phase 2). Else: show for review.         |
| `CLASSIFICATION_READY`      | User clicks "Accept"                   | POST /api/generate | prompt, medium, classification           | result, latency           | GENERATING (phase 2)                         | Use classification from store                                                              |
| `CLASSIFICATION_READY`      | User clicks "Override"                 | —                  | —                                        | —                         | OVERRIDE_ACTIVE                              | No API call; UI-only transition                                                            |
| `OVERRIDE_ACTIVE`           | User clicks "Apply Override"           | POST /api/override | generationId?, classification, overrides | result, costMultiplier    | GENERATING (phase 3)                         | If generationId missing: error. If overrides invalid: show error & stay in OVERRIDE_ACTIVE |
| `GENERATING (phase 2 or 3)` | /api/generate or /api/override returns | —                  | —                                        | result, pdfUrl, pageCount | RESULT_READY                                 | Success path; show PDF + stats                                                             |
| `RESULT_READY`              | User clicks "Customize Style"          | —                  | —                                        | —                         | OVERRIDE_ACTIVE                              | UI-only transition; pre-populate current values                                            |
| `RESULT_READY`              | User clicks "New Prompt"               | —                  | —                                        | reset all                 | INITIAL                                      | Clear all state; return to medium selection                                                |
| `RESULT_READY`              | User clicks "Export PDF"               | — (fetch pdfUrl)   | —                                        | —                         | (download PDF)                               | No state change; browser downloads file                                                    |

---

## **Data Flow Diagram**

### **Full E2E Flow with Data Passing**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend State Management (Svelte Store)                             │
│                                                                       │
│  flowStore {                                                          │
│    state: "INITIAL|MEDIUM_SELECTED|GENERATING|..."                 │
│    selectedMedium: "ebook"                                           │
│    prompt: "Summer poetry..."                                        │
│    classification: { id, medium, style, confidence, source }        │
│    result: { id, pdfUrl, pageCount, latency, costEstimate }         │
│    overrideCost: 0.05                                                │
│    error: null                                                        │
│  }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                ↑
                                │ (listen + update)
                                │
┌─────────────────────────────────────────────────────────────────────┐
│ Component Logic (GenerateFlow.svelte)                                │
│                                                                       │
│  handleGenerateClick() {                                             │
│    1. POST /api/classify(prompt, selectedMedium)                    │
│    2. flowStore.setClassification(response)                         │
│    3. if response.confidence > 0.85: go to GENERATING              │
│       else: transition('CLASSIFICATION_READY')                      │
│  }                                                                   │
│                                                                       │
│  handleAcceptClassification() {                                      │
│    1. POST /api/generate(prompt, classification)                   │
│    2. flowStore.setResult(response)                                │
│    3. transition('RESULT_READY')                                   │
│  }                                                                   │
│                                                                       │
│  handleApplyOverride(overrides) {                                   │
│    1. POST /api/override(generationId, overrides)                  │
│    2. flowStore.setResult(response)                                │
│    3. transition('RESULT_READY')                                   │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
         ↑
         │ API Calls (fetch/axios)
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Backend HTTP Layer (server/index.js)                                 │
│                                                                       │
│  POST /api/classify → validatePayload() → genieService.classify()   │
│  POST /api/generate → validatePayload() → genieService.generate()   │
│  POST /api/override → validatePayload() → genieService.override()   │
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Backend Orchestrator (server/genieService.js)                        │
│                                                                       │
│  classifyPrompt(prompt) → ruleEngine + llmClassifier → Classification
│  generate(prompt, classification) → select service → service.handle()
│  override(classification, overrides) → apply overrides → regenerate
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Phase A-B Modules (server/utils/)                                    │
│                                                                       │
│  • ruleEngine.js: tokenization, scoring, semantic rules              │
│  • llmClassifier.js: Gemini API integration                          │
│  • classificationValidator.js: merge rules + AI results              │
│  • svgLibrary.js: cached SVG search/increment                        │
│  • overrideSystem.js: apply style overrides                          │
└─────────────────────────────────────────────────────────────────────┘
```

### **Component → Store → API → Backend Flow**

**Example: User clicks "Generate →"**

```
1. PromptInput.svelte emits('generate')
   ↓
2. GenerateFlow.svelte catches event
   → calls handleGenerateClick()
   ↓
3. handleGenerateClick() calls:
   → classify(prompt, selectedMedium)
   ↓
4. client/lib/api.js::classify():
   → POST /api/classify with { prompt, selectedMedium }
   ↓
5. server/index.js::POST /api/classify:
   → validatePayload()
   → genieService.classifyPrompt(prompt)
   ↓
6. server/genieService.js::classifyPrompt():
   → ruleEngine.extract(prompt)
   → llmClassifier.classify(prompt)
   → classificationValidator.merge(rules, ai)
   → return Classification
   ↓
7. server/index.js returns:
   → { classification }
   ↓
8. client/lib/api.js::classify() resolves with response
   ↓
9. handleGenerateClick() calls:
   → flowStore.setClassification(response)
   ↓
10. flowStore.setClassification():
    → Svelte reactivity triggers re-render
    → ClassificationFeedback component gets new props
    ↓
11. State transition logic:
    if response.confidence > 0.85:
      transition('GENERATING')
      → auto-call handleAcceptClassification()
    else:
      transition('CLASSIFICATION_READY')
      → show ClassificationFeedback component
      → user clicks Accept
      → call handleAcceptClassification()
```

---

## **Component-to-Backend Binding**

This section shows exactly which component props are populated by which backend API responses:

### **MediaSelector.svelte**

**No backend binding** (pure UI selection)

- Props: (none)
- Emits: `on:mediaSelected` → GenerateFlow.handleMediaSelect()

---

### **PromptInput.svelte**

**No backend binding** (pure user input)

- Props: `selectedMedium` (from store), `isLoading` (from store.isLoading)
- Emits: `on:generate` → GenerateFlow.handleGenerateClick()

---

### **LoadingSpinner.svelte**

**No backend binding** (pure UI feedback)

- Props: `progress` (0-100), `message`, `currentStep`
- Emits: (none)

---

### **ClassificationFeedback.svelte**

**Backend binding**: ← POST /api/classify response

```typescript
// In GenerateFlow.svelte
$: classification = $flowStore.classification;

// Bind to component
<ClassificationFeedback {classification} ... />

// ClassificationFeedback.svelte receives:
export let classification = {
  medium: string,           // ← API response.medium
  confidence: number,       // ← API response.confidence
  style: string,            // ← API response.style
  themes: string[],         // ← API response.themes
  audience: string,         // ← API response.audience
  genre: string,            // ← API response.genre
  tone: string,             // ← API response.tone
  source: "rules|ai|hybrid" // ← API response.source
};
```

**Emits**:

- `on:accept` → GenerateFlow.handleAcceptClassification()
- `on:override` → GenerateFlow.transition('OVERRIDE_ACTIVE')

---

### **ResultsDisplay.svelte**

**Backend binding**: ← POST /api/generate response + POST /api/override response

```typescript
// In GenerateFlow.svelte
$: result = $flowStore.result;
$: classification = $flowStore.classification;
$: latency = $flowStore.latency;

// Bind to component
<ResultsDisplay {result} {classification} {latency} ... />

// ResultsDisplay.svelte receives:
export let result = {
  pdfUrl: string,           // ← API response.pdfUrl
  pageCount: number,        // ← API response.pageCount
  medium: string,           // ← API response.medium
  style: string,            // ← API response.style
  id: string                // ← API response.id (for override calls)
};

export let classification = {
  confidence: number,       // ← From ClassificationFeedback
  source: string            // ← From ClassificationFeedback
};

export let latency = number; // ← API response.latency (ms)
```

**Emits**:

- `on:customize` → GenerateFlow.transition('OVERRIDE_ACTIVE')
- `on:export` → browser downloads PDF from result.pdfUrl
- `on:newPrompt` → GenerateFlow.reset() → INITIAL

---

### **OverrideControls.svelte**

**No backend binding on input** (user selects style, color, etc. locally)

**Backend binding on output**: sends to POST /api/override

```typescript
// In GenerateFlow.svelte
async function handleApplyOverride(overrides) {
  // overrides comes from OverrideControls component:
  // { style: "gothic", color: "dark", tone: "serious" }

  const response = await applyOverride({
    generationId: $flowStore.result.id, // ← From result.id
    classification: $flowStore.classification, // ← From store
    overrides: overrides, // ← From component
  });

  flowStore.setResult(response); // ← Updates result
  flowStore.setOverrideCost(response.costMultiplier); // ← New cost
}
```

**Emits**:

- `on:apply` → GenerateFlow.handleApplyOverride()
- `on:cancel` → GenerateFlow.transition('RESULT_READY')

---

### **CostVisualization.svelte**

**Backend binding**: ← POST /api/override response

```typescript
// In OverrideControls.svelte (child of ResultsDisplay)
export let costMultiplier = number; // ← API response.costMultiplier (0.05, 0.40, 1.0)
export let changedDimensions = string[]; // ← Calculated from overrides array

// costMultiplier values:
// 0.05 → only color changed (light regeneration)
// 0.40 → style or theme changed (moderate regeneration)
// 1.0  → medium changed (full regeneration)
```

---

### **StatsPanel.svelte**

**Backend binding**: ← POST /api/generate or POST /api/override response

```typescript
// In ResultsDisplay.svelte (passes to StatsPanel)
export let latency = number; // ← API response.latency (ms)
export let model = string; // ← API response.metadata.model
export let medium = string; // ← API response.medium
export let confidence = number; // ← From classification
export let source = string; // ← From classification (rules|ai|hybrid)
export let pageCount = number; // ← API response.pageCount
export let costEstimate = number; // ← API response.costEstimate (USD)
```

**Displays**: No backend calls; pure data display

---

### **ActionButtons.svelte**

**No backend binding** (pure button group)

**Emits**:

- `on:customize` → GenerateFlow.transition('OVERRIDE_ACTIVE')
- `on:export` → browser downloads from result.pdfUrl
- `on:newPrompt` → GenerateFlow.reset()

---

### **GenerateFlow.svelte (Orchestrator)**

**Backend binding**: Calls all 3 API endpoints + orchestrates state transitions

**Key methods**:

```typescript
// Phase 1: Classification
async function handleGenerateClick() {
  const classResult = await classify({ prompt, selectedMedium });
  flowStore.setClassification(classResult);
  if (classResult.confidence > 0.85) {
    await handleAcceptClassification();
  } else {
    transition("CLASSIFICATION_READY");
  }
}

// Phase 2: Generation
async function handleAcceptClassification() {
  const genResult = await generate({ prompt, classification });
  flowStore.setResult(genResult);
  flowStore.setLatency(genResult.latency);
  transition("RESULT_READY");
}

// Phase 3: Override
async function handleApplyOverride(overrides) {
  const overrideResult = await applyOverride({
    generationId: result.id,
    classification,
    overrides,
  });
  flowStore.setResult(overrideResult);
  flowStore.setOverrideCost(overrideResult.costMultiplier);
  transition("RESULT_READY");
}
```

---

## **Error Handling & Recovery**

### **Error Matrix by Endpoint**

| Endpoint        | Error Code | Error Message               | Cause                                   | Recovery Strategy                       | User Experience                            |
| --------------- | ---------- | --------------------------- | --------------------------------------- | --------------------------------------- | ------------------------------------------ |
| `/api/classify` | 400        | "Prompt too short"          | User input < 10 chars                   | (none)                                  | PromptInput shows validation error inline  |
| `/api/classify` | 400        | "Invalid classification ID" | Backend bug                             | Retry classification                    | Error panel: "Retry" button                |
| `/api/classify` | 408        | "Classification timeout"    | LLM API timeout                         | Exponential backoff (1s, 2s, 4s, 8s)    | Error panel: "Retry now" button            |
| `/api/classify` | 500        | "Fallback to rules engine"  | LLM unavailable                         | Use rule engine only (confidence lower) | Show warning badge on classification       |
| `/api/generate` | 400        | "Invalid classification ID" | Classification ID expired/invalid       | Re-classify from scratch                | Error panel: "Start over" or "Re-classify" |
| `/api/generate` | 408        | "Generation timeout"        | Service took >30s                       | Retry same request                      | Error panel: "Retry" button                |
| `/api/generate` | 500        | "Image generation failed"   | Image API error                         | Retry or use placeholder images         | Warning banner: "Some images unavailable"  |
| `/api/generate` | 500        | "PDF rendering failed"      | Puppeteer/PDF lib error                 | Retry or download as HTML               | Error panel: [Retry] [Download HTML]       |
| `/api/override` | 400        | "Generation ID not found"   | User navigated away + returned          | Re-generate from classification         | Error panel: "Start over" or "Re-generate" |
| `/api/override` | 422        | "Invalid override values"   | User selected invalid style/color combo | Show validation error                   | Error panel: "Invalid style '{value}'"     |

### **Error Recovery Flows**

#### **Scenario 1: Classification Timeout (408)**

```
User clicks "Generate"
  ↓
POST /api/classify (pending 30s timeout)
  ↓
Error: 408 Timeout after 30s
  ↓
flowStore.setError(error)
transition('CLASSIFICATION_READY')
  ↓
Show ClassificationFeedback with error badge
  ↓
User sees options:
  [Retry Classification] [Try Without Classification]
  ↓
If [Retry]:
  Exponential backoff: wait 1s, 2s, 4s, 8s
  Retry POST /api/classify with same prompt
  ↓
If [Try Without]:
  Go directly to generation with rule-based classification only
  Show "Low confidence (rules only)" badge
```

#### **Scenario 2: Generation Failure (500)**

```
User clicks "Accept" on classification
  ↓
POST /api/generate (pending 20s)
  ↓
Error: 500 PDF rendering failed
  ↓
flowStore.setError(error)
transition('CLASSIFICATION_READY') // Back to accept state
  ↓
Show ClassificationFeedback with error message
  ↓
User sees options:
  [Retry Generation] [Customize & Retry] [Start Over]
  ↓
If [Retry Generation]:
  POST /api/generate again with same params
  ↓
If [Customize & Retry]:
  transition('OVERRIDE_ACTIVE')
  User can adjust style/theme before retry
  ↓
If [Start Over]:
  flowStore.reset()
  transition('INITIAL')
```

#### **Scenario 3: Override Failed (422)**

```
User clicks "Apply Override" with custom style
  ↓
POST /api/override(generationId, { style: "invalid-gothic" })
  ↓
Error: 422 "Invalid override values" invalid: ["style: invalid-gothic"]
  ↓
flowStore.setError(error)
Stay in OVERRIDE_ACTIVE (don't transition away)
  ↓
Show error message: "Style 'invalid-gothic' not supported"
Show list of valid styles: [minimalist] [gothic] [abstract]
  ↓
User selects valid style from dropdown
User clicks "Apply Override" again
  ↓
POST /api/override succeeds
transition('RESULT_READY')
```

#### **Scenario 4: Network Failure (All Endpoints)**

```
POST /api/classify (network timeout or no response)
  ↓
Fetch error: "Network error"
  ↓
flowStore.setError(error, "recoverable")
Show error panel: "Network error. Retrying..."
  ↓
Exponential backoff retry loop:
  Retry 1: wait 1s, retry
  Retry 2: wait 2s, retry
  Retry 3: wait 4s, retry
  Retry 4: wait 8s, retry
  Retry 5: GIVE UP
  ↓
After Retry 5 fails:
  Show persistent error panel:
    "Network error. Could not connect to server."
    [Retry Now] [Check Status Page]
  ↓
User can click [Retry Now] anytime
```

### **Error Recovery Code Example** (Frontend)

```typescript
// In GenerateFlow.svelte
async function withRetry(
  fn: () => Promise<any>,
  maxRetries = 3,
  initialDelayMs = 1000
) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && error.retryable) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delayMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

// Usage
async function handleGenerateClick() {
  transition("GENERATING");
  try {
    const classResult = await withRetry(() =>
      classify({ prompt, selectedMedium })
    );
    flowStore.setClassification(classResult);
    // ... continue flow
  } catch (error) {
    setError(error);
    transition("CLASSIFICATION_READY");
  }
}
```

---

## **Configuration & Thresholds**

### **Global Configuration Values**

These should be environment variables or a config file:

```javascript
// config/frontend.js (or imported from backend)
export const FRONTEND_CONFIG = {
  // Classification
  CONFIDENCE_THRESHOLD: 0.85,        // Auto-accept if >= this
  MIN_CLASSIFICATION_CONFIDENCE: 0.50, // Show warning if < this

  // Timeouts (milliseconds)
  CLASSIFY_TIMEOUT_MS: 30000,        // 30s
  GENERATE_TIMEOUT_MS: 30000,        // 30s
  OVERRIDE_TIMEOUT_MS: 10000,        // 10s (faster, just styling)

  // Retries
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 1000,      // 1s, then 2s, 4s, 8s, etc

  // Cost Multipliers
  COST_MULTIPLIER_COLOR: 0.05,        // 5% cost for color change
  COST_MULTIPLIER_STYLE: 0.40,        // 40% cost for style change
  COST_MULTIPLIER_MEDIUM: 1.0,        // 100% cost for medium change

  // UI
  LOADING_SPINNER_STEP_DURATION_MS: 3000,
  ERROR_PANEL_AUTO_DISMISS_MS: 5000,  // Auto-dismiss after 5s

  // Features
  ENABLE_SHARE_BUTTON: false,         // Future feature
  ENABLE_HISTORY: false,              // Future feature
  ENABLE_COST_DISPLAY: true,          // Show cost estimates?

  // Classification dimensions
  SUPPORTED_MEDIA: ['ebook', 'calendar', 'poster', 'stickers', 'card'],
  SUPPORTED_STYLES: ['minimalist', 'gothic', 'abstract', 'retro', 'modern'],
  SUPPORTED_THEMES: ['magical-realism', 'minimalist-zen', 'cyberpunk', ...],
  SUPPORTED_AUDIENCES: ['general', 'professional', 'creative', 'kids']
};
```

### **Backend Configuration** (Must match frontend)

```javascript
// server/config.js (or environment variables)
export const BACKEND_CONFIG = {
  // Classification
  CONFIDENCE_THRESHOLD: 0.85, // MUST match frontend
  RULE_ENGINE_WEIGHT: 0.6, // Rules count for 60% of confidence
  AI_ENGINE_WEIGHT: 0.4, // AI counts for 40% of confidence

  // API Timeouts
  CLASSIFY_TIMEOUT_MS: 30000,
  GENERATE_TIMEOUT_MS: 30000,
  OVERRIDE_TIMEOUT_MS: 10000,

  // Classification models
  LLM_MODEL: "gemini-pro-vision",
  FALLBACK_TO_RULES_IF_LLM_FAILS: true,

  // Cost calculation (for estimates)
  COST_PER_IMAGE: 0.001,
  COST_PER_PAGE: 0.001,
  BASE_GENERATION_COST: 0.01,

  // Services
  SERVICES: {
    demo: { enabled: true, maxPages: 5 },
    ebook: { enabled: true, maxPages: 20 },
    calendar: { enabled: true, maxPages: 12 },
    poster: { enabled: true, maxPages: 1 },
    stickers: { enabled: true, maxPages: 2 },
    card: { enabled: true, maxPages: 1 },
  },
};
```

---

## **Testing Strategy**

### **Unit Tests** (Component ↔ API)

#### **Test: ClassificationFeedback receives classification from /api/classify**

```typescript
import { render } from "@testing-library/svelte";
import ClassificationFeedback from "../ClassificationFeedback.svelte";

test("displays classification metadata from API response", () => {
  const classification = {
    medium: "ebook",
    confidence: 0.92,
    style: "minimalist",
    themes: ["zen", "modern"],
    source: "rules",
  };

  const { getByText } = render(ClassificationFeedback, {
    props: { classification },
  });

  expect(getByText(/medium.*ebook/i)).toBeTruthy();
  expect(getByText(/confidence.*92/i)).toBeTruthy();
  expect(getByText(/minimalist/i)).toBeTruthy();
});
```

#### **Test: StatsPanel displays latency and metadata from /api/generate**

```typescript
test("formats latency from milliseconds to seconds", () => {
  const { getByText } = render(StatsPanel, {
    props: { latency: 8234, model: "demo-1", pageCount: 5 },
  });

  expect(getByText(/latency.*8.2/i)).toBeTruthy(); // 8234ms → 8.2s
  expect(getByText(/demo-1/i)).toBeTruthy();
  expect(getByText(/5.*pages/i)).toBeTruthy();
});
```

#### **Test: CostVisualization calculates multiplier from /api/override response**

```typescript
test("shows correct cost breakdown for multi-dimension override", () => {
  const { getByText } = render(CostVisualization, {
    props: {
      costMultiplier: 0.4,
      changedDimensions: ["style"],
    },
  });

  expect(getByText(/40%.*regeneration/i)).toBeTruthy();
  expect(getByText(/style.*change/i)).toBeTruthy();
});
```

### **Integration Tests** (GenerateFlow ↔ API)

#### **Test: Full E2E flow from medium selection to PDF export**

```typescript
test("complete user flow: select → generate → classify → accept → export", async () => {
  // Mock API responses
  fetchMock.post("/api/classify", {
    status: 200,
    body: {
      id: "class-123",
      medium: "ebook",
      confidence: 0.92,
      style: "minimalist",
    },
  });

  fetchMock.post("/api/generate", {
    status: 200,
    body: {
      id: "gen-456",
      pdfUrl: "/tmp-exports/gen-456.pdf",
      pageCount: 5,
      latency: 8234,
    },
  });

  const { getByText, getByRole } = render(GenerateFlow);

  // User selects medium
  fireEvent.click(getByText("📖 eBook"));
  expect(getByText(/eBook.*selected/i)).toBeTruthy();

  // User enters prompt and clicks Generate
  const textarea = getByRole("textbox");
  await userEvent.type(textarea, "Summer poetry collection");
  fireEvent.click(getByText("Generate →"));

  // Wait for classification
  await waitFor(() => {
    expect(getByText(/confidence.*92/i)).toBeTruthy();
  });

  // User accepts classification
  fireEvent.click(getByText("Accept"));

  // Wait for generation
  await waitFor(() => {
    expect(getByText(/⏳.*Generating/i)).toBeTruthy();
  });

  await waitFor(() => {
    expect(getByText(/Your Generated eBook/i)).toBeTruthy();
  });

  // User exports PDF
  fireEvent.click(getByText(/Download PDF/i));

  // Verify PDF fetch (would check download in real app)
  expect(fetchMock.lastUrl()).toContain("/tmp-exports/gen-456.pdf");
});
```

#### **Test: Auto-accept high-confidence classification**

```typescript
test("skips CLASSIFICATION_READY state if confidence > 0.85", async () => {
  fetchMock.post("/api/classify", {
    body: { confidence: 0.92 }, // > 0.85
  });

  const { queryByText } = render(GenerateFlow);

  // User clicks Generate
  fireEvent.click(getByText("Generate →"));

  // Should NOT show "Accept / Override" buttons
  await waitFor(() => {
    expect(queryByText("Accept")).toBeNull();
  });

  // Should go straight to GENERATING and then RESULT_READY
  await waitFor(() => {
    expect(queryByText(/Your Generated/i)).toBeTruthy();
  });
});
```

#### **Test: Error recovery with retry**

```typescript
test("retries classification after timeout", async () => {
  let attemptCount = 0;

  fetchMock.post("/api/classify", () => {
    attemptCount++;
    if (attemptCount === 1) {
      return { status: 408, body: { error: "Timeout" } };
    }
    return { status: 200, body: { confidence: 0.92 } };
  });

  const { getByText } = render(GenerateFlow);
  fireEvent.click(getByText("Generate →"));

  // First call fails with 408
  await waitFor(() => {
    expect(getByText(/timeout/i)).toBeTruthy();
  });

  // User clicks Retry
  fireEvent.click(getByText(/Retry/i));

  // Wait for automatic retry (exponential backoff 1s)
  await waitFor(
    () => {
      expect(getByText(/confidence.*92/i)).toBeTruthy();
    },
    { timeout: 3000 }
  );

  expect(attemptCount).toBe(2);
});
```

### **E2E Tests** (Full User Scenarios)

Run via Playwright or Cypress with real backend:

```typescript
// e2e/generate-flow.spec.ts
test("user can generate and customize ebook", async ({ page }) => {
  await page.goto("http://localhost:5173");

  // Select medium
  await page.click("text=📖 eBook");

  // Enter prompt
  await page.fill("textarea", "A magical summer in a small village");

  // Click Generate
  await page.click("text=Generate →");

  // Wait for classification
  await page.waitForSelector("text=Confidence");
  const confidence = await page.textContent("text=Confidence");
  expect(confidence).toContain("%");

  // Accept classification
  await page.click("text=Accept");

  // Wait for PDF
  await page.waitForSelector('iframe[title="Generated PDF"]');

  // Click Customize
  await page.click("text=Customize");

  // Change style
  await page.selectOption('select:has-text("Style")', "gothic");

  // Apply override
  await page.click("text=Apply Override");

  // Verify cost multiplier displayed
  const cost = await page.textContent("text=Cost Impact");
  expect(cost).toContain("%");

  // Export PDF
  const downloadPromise = page.waitForEvent("download");
  await page.click("text=Download PDF");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(".pdf");
});
```

---

## **Implementation Checklist**

### **Backend: Phase A-B Integration** (from PHASE_A-B_INTEGRATION_CHECKLIST.md)

- [ ] **Phase 1: Add classifyPrompt() to genieService.js** (2-3 hours)

  - [ ] Import ruleEngine, llmClassifier, classificationValidator
  - [ ] Create genieService.classifyPrompt(prompt) method
  - [ ] Return normalized Classification object with all required fields

- [ ] **Phase 2: Create 3 new API endpoints in server/index.js** (1-2 hours)

  - [ ] POST /api/classify (request validation → genieService.classifyPrompt())
  - [ ] POST /api/generate (request validation → genieService.process())
  - [ ] POST /api/override (request validation → overrideSystem.apply())

- [ ] **Phase 3: Enhance genieService.process()** (1-2 hours)
  - [ ] Accept classification parameter
  - [ ] Pass classification to service.handle()
  - [ ] Include classification in response envelope

### **Frontend: Progressive Disclosure Integration** (from FRONTEND_PROGRESSIVE_DISCLOSURE_MODULARITY.md)

- [ ] **Phase 1: StateManager + GenerateFlow** (2-3 hours)

  - [ ] Module 1: StateManager store with all state transitions
  - [ ] Module 2: GenerateFlow orchestrator component

- [ ] **Phase 2: Input Components** (3-4 hours)

  - [ ] Module 4: PromptInput
  - [ ] Module 5: LoadingSpinner
  - [ ] Integrate with /api/classify calls

- [ ] **Phase 3: Classification & Results** (3 hours)

  - [ ] Module 6: Enhance ClassificationFeedback
  - [ ] Module 7: ResultsDisplay
  - [ ] Module 10: StatsPanel
  - [ ] Wire to /api/generate responses

- [ ] **Phase 4: Customization** (3-4 hours)

  - [ ] Module 8: Enhance OverrideControls
  - [ ] Module 9: CostVisualization
  - [ ] Module 11: ActionButtons
  - [ ] Wire to /api/override requests/responses

- [ ] **Phase 5: Integration & QA** (2-3 hours)
  - [ ] Module 12: Refactor App.svelte
  - [ ] E2E flow testing
  - [ ] Mobile responsiveness
  - [ ] Accessibility audit

### **Testing Integration** (8-12 hours)

- [ ] Unit tests for each component ↔ API binding
- [ ] Integration tests for full flow
- [ ] E2E tests for all user scenarios
- [ ] Error recovery tests (retries, fallbacks)
- [ ] Performance tests (latency < 30s)
- [ ] Accessibility tests (WCAG AA)

### **Documentation** (Ongoing)

- [ ] Update API docs with new endpoints
- [ ] Add troubleshooting guide for common errors
- [ ] Create deployment checklist
- [ ] Document environment variable configuration

---

## **Success Criteria**

✅ **Functional**

- [ ] User selects medium (all 6 options work)
- [ ] User enters prompt and generates
- [ ] Classification displays with confidence, source, style, themes
- [ ] User can override style/color with cost visualization
- [ ] PDF exports successfully
- [ ] All 457 existing tests still pass (zero regressions)

✅ **Performance**

- [ ] Classify: < 2 seconds (rule engine) or < 5s (with LLM)
- [ ] Generate: 8-20 seconds
- [ ] Override: < 2 seconds
- [ ] Overall flow: < 30 seconds (95th percentile)

✅ **Reliability**

- [ ] Error recovery: automatic retries on timeout
- [ ] Network resilience: fallback to rule engine if LLM unavailable
- [ ] No unhandled promise rejections
- [ ] All error messages clear and actionable

✅ **UX**

- [ ] Mobile layout responsive (tested on device)
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader announcements for state changes
- [ ] High contrast for accessibility (WCAG AA)

---

## **Document Control**

| Version | Date       | Status   | Notes                                                    |
| ------- | ---------- | -------- | -------------------------------------------------------- |
| 1.0     | 2025-11-18 | 🟢 READY | Complete frontend-backend integration spec with examples |

---

**Status**: 🟢 **READY FOR IMPLEMENTATION** — All API contracts defined, component bindings specified, error handling documented, success criteria locked.

**Next Steps**:

1. Backend developers: Implement 3 API endpoints + enhance genieService
2. Frontend developers: Implement 12 modules + integrate with APIs
3. QA: Parallel testing throughout implementation

**Related Documents**:

- `ORCHESTRATOR_ARCHITECTURE.md` - Backend architecture details
- `PHASE_A-B_INTEGRATION_CHECKLIST.md` - Backend implementation tasks
- `FRONTEND_PROGRESSIVE_DISCLOSURE_ARCHITECTURE.md` - Frontend state machine
- `FRONTEND_PROGRESSIVE_DISCLOSURE_MODULARITY.md` - Frontend module breakdown

---

**END OF FRONTEND_BACKEND_INTEGRATION_SPEC**
