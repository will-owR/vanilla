# Frontend Architecture: Visual Reference Guide

**Quick diagrams and visual flows for the Frontend Lead**

---

## **1. THE 8-STATE MACHINE (Visual)**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    FRONTEND STATE MACHINE                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

                            INITIAL
                              │
                              │ [user clicks medium]
                              ↓
                    ┌─────────────────────┐
                    │ MEDIUM_SELECTED     │
                    │ Show: PromptInput   │
                    │ User: Enters text   │
                    └─────────────────────┘
                              │
                              │ [user clicks Generate]
                              ↓
                    ┌─────────────────────────────────┐
                    │ GENERATING (Phase 1: Classify)  │
                    │ API: POST /api/classify         │
                    │ Backend: Running classification │
                    │ Show: LoadingSpinner            │
                    └─────────────────────────────────┘
                              │
                   ┌──────────┴──────────┐
                   │                     │
           [if confidence ≥ 85%]   [if confidence < 85%]
                   │                     │
        ┌──────────▼─────────┐  ┌────────▼──────────┐
        │ Auto-Accept Logic  │  │ CLASSIFICATION_   │
        │ Skip to GENERATING │  │ READY             │
        │ (Phase 2)          │  │ Show: Feedback +  │
        └────────┬────────────┘  │ Accept/Override  │
                 │               └────────┬──────────┘
                 │                        │
                 │      ┌─────────────────┴─────────────────┐
                 │      │                                   │
         [Auto-accept]   │                           [user clicks Accept]
                 │       │                                   │
                 ├───────┤                                   │
                 │       │                                   │
                 ↓       └───────────────┐                   ↓
        ┌─────────────────────────┐     [user clicks Override]
        │ GENERATING (Phase 2)    │     │
        │ API: /api/generate      │     ↓
        │ Backend: Creating PDF   │  OVERRIDE_ACTIVE
        │ Show: LoadingSpinner    │  Show: OverrideControls
        └─────────────┬───────────┘  Style/Tone/Theme pickers
                      │              User: Customizes
                      │
                      │              ┌────────────────────┐
                      │              │ [user clicks Apply] │
                      │              └─────────┬──────────┘
                      │                        │
                      │                        ↓
                      │              GENERATING (Phase 3)
                      │              API: /api/override
                      │              Backend: Regenerating
                      │
                      │        ┌──────────────┐
                      └────────┼──────────────┘
                               │
                               ↓
                    ┌─────────────────────────┐
                    │ RESULT_READY            │
                    │ Show: ResultsDisplay +  │
                    │ StatsPanel              │
                    │ User: Export OR         │
                    │ Customize again         │
                    └──────────┬──────────────┘
                               │
                    ┌──────────┘
                    │
              [user clicks Export]
                    │
                    ↓
                 COMPLETE
                 Show: SuccessPanel
                 User: Download / Start Over
```

---

## **2. STATE MACHINE TABLE**

| State                | Shows                                       | User Can Do                   | Transition To                                | API Called         |
| -------------------- | ------------------------------------------- | ----------------------------- | -------------------------------------------- | ------------------ |
| INITIAL              | MediaSelector                               | Click medium button           | MEDIUM_SELECTED                              | No                 |
| MEDIUM_SELECTED      | PromptInput + Medium badge                  | Enter prompt + click Generate | GENERATING                                   | No                 |
| GENERATING (Phase 1) | LoadingSpinner                              | Wait                          | CLASSIFICATION_READY or GENERATING (Phase 2) | POST /api/classify |
| CLASSIFICATION_READY | ClassificationFeedback                      | Accept OR Override            | GENERATING (Phase 2) or OVERRIDE_ACTIVE      | No                 |
| GENERATING (Phase 2) | LoadingSpinner                              | Wait                          | RESULT_READY                                 | POST /api/generate |
| RESULT_READY         | ResultsDisplay + StatsPanel                 | Export OR Customize           | COMPLETE or OVERRIDE_ACTIVE                  | No                 |
| OVERRIDE_ACTIVE      | ResultsDisplay + OverrideControls + CostViz | Change settings + Apply       | GENERATING (Phase 3)                         | No                 |
| GENERATING (Phase 3) | LoadingSpinner                              | Wait                          | RESULT_READY                                 | POST /api/override |
| COMPLETE             | SuccessPanel                                | Download or Start Over        | INITIAL                                      | No                 |

---

## **3. COMPONENT HIERARCHY (Visual)**

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.svelte                              │
├─────────────────────────────────────────────────────────────────┤
│  Header (Health status, title)                                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  GenerateFlow.svelte (ORCHESTRATOR)                     │  │
│  │  - State machine logic                                  │  │
│  │  - API orchestration (all 3 endpoints)                 │  │
│  │  - Event dispatch to children                          │  │
│  │  - Error handling + recovery                           │  │
│  │                                                          │  │
│  │  {#if state === 'INITIAL'}                             │  │
│  │  ├─ MediaSelector.svelte (user picks 6 options)       │  │
│  │                                                          │  │
│  │  {#else if state === 'MEDIUM_SELECTED'}               │  │
│  │  ├─ PromptInput.svelte (user enters text)             │  │
│  │  └─ MediaIndicator.svelte (shows selected)            │  │
│  │                                                          │  │
│  │  {#else if state === 'GENERATING'}                    │  │
│  │  └─ LoadingSpinner.svelte (progress bar)              │  │
│  │                                                          │  │
│  │  {#else if state === 'CLASSIFICATION_READY'}          │  │
│  │  ├─ ClassificationFeedback.svelte (shows metadata)    │  │
│  │  └─ [Accept] / [Override] buttons                     │  │
│  │                                                          │  │
│  │  {#else if state === 'RESULT_READY'}                  │  │
│  │  ├─ ResultsDisplay.svelte (PDF iframe)                │  │
│  │  ├─ StatsPanel.svelte (metadata display)              │  │
│  │  └─ ActionButtons.svelte                              │  │
│  │                                                          │  │
│  │  {#else if state === 'OVERRIDE_ACTIVE'}               │  │
│  │  ├─ ResultsDisplay.svelte (PDF)                       │  │
│  │  ├─ OverrideControls.svelte (dropdowns/checkboxes)   │  │
│  │  └─ CostVisualization.svelte (cost breakdown)         │  │
│  │                                                          │  │
│  │  {#else if state === 'COMPLETE'}                      │  │
│  │  └─ SuccessPanel.svelte (download options)            │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Footer (Status, debug info)                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## **4. DATA FLOW (Visual)**

```
┌─────────────────────────────────────────────────────────────┐
│                   Backend API                               │
│  /api/classify  /api/generate  /api/override                │
└─────────────────────────────────────────────────────────────┘
                          ↓ (API response)
┌─────────────────────────────────────────────────────────────┐
│              GenerateFlow.svelte                            │
│          (orchestrator, handles all API)                    │
│                                                             │
│  ├─ API wrapper functions:                                │
│  │  ├─ classify(prompt, medium) → /api/classify         │
│  │  ├─ generate(prompt, medium, classification)         │
│  │  └─ override(genId, overrides)                        │
│  │                                                        │
│  ├─ Error handling:                                      │
│  │  ├─ Timeout → retry with backoff                     │
│  │  ├─ 400/422 → show error, stay in state              │
│  │  └─ 500 → retry with backoff                         │
│  │                                                        │
│  └─ State machine:                                       │
│     ├─ setState(newState)                                │
│     ├─ setClassification(response)                       │
│     ├─ setResult(response)                               │
│     └─ setError(error)                                   │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ (dispatch events)
         ┌─────────────┼─────────────────────────────┐
         │             │             │               │
         ↓             ↓             ↓               ↓
    MediaSelector  PromptInput   Classification   ResultsDisplay
                               Feedback         + StatsPanel
                                               + OverrideControls
                                               + CostViz

         │             │             │               │
         └─────────────┼─────────────┴───────────────┘
                       │ (props from flowStore)
                       ↓
                    flowStore
            (Svelte store: state, classification,
                    result, latency, etc.)

             [single source of truth]
```

---

## **5. API PHASES (Visual)**

```
PHASE 1: CLASSIFY
═════════════════════════════════════════════════════════════

User Input:
  Medium: "📖 eBook"
  Prompt: "A magical summer in a small village"

Frontend Request (POST /api/classify):
  {
    prompt: "A magical summer in a small village",
    selectedMedium: "ebook"
  }

Backend Processing:
  Step 1: Rule-based classification (fast)
  Step 2: If confidence < 0.85, call LLM API (slower)
  Step 3: Merge results, normalize response

Backend Response:
  {
    id: "uuid-123",
    medium: "ebook",
    style: "minimalist",
    confidence: 0.92,  ← KEY: Used for auto-accept decision
    themes: ["magical-realism", "minimalist-zen"],
    source: "hybrid",
    ... (other metadata)
  }

Frontend Decision:
  if (confidence ≥ 0.85) {
    Auto-accept → Skip CLASSIFICATION_READY state
    Go straight to Phase 2 (GENERATING)
  } else {
    Show user → CLASSIFICATION_READY state
    User must click Accept or Override
  }

═════════════════════════════════════════════════════════════

PHASE 2: GENERATE
═════════════════════════════════════════════════════════════

User Action: Click "Accept" (or auto-accepted)

Frontend Request (POST /api/generate):
  {
    prompt: "A magical summer in a small village",
    medium: "ebook",
    classification: {
      id: "uuid-123",
      style: "minimalist",
      themes: ["magical-realism"],
      ... (full classification object)
    }
  }

Backend Processing:
  Step 1: Select service (demoService, ebookService, etc.)
  Step 2: Generate PDF with style + theme applied
  Step 3: Return PDF + metadata

Backend Response:
  {
    id: "uuid-456",
    pdfUrl: "/tmp-exports/uuid-456.pdf",
    pageCount: 12,
    latency: 8200,  ← Shown as "8.2s" in StatsPanel
    costEstimate: 0.42,  ← Shown as "$0.42"
    metadata: {
      model: "demo-service-v1",
      processingTimeMs: 8200,
      ... (other metadata)
    }
  }

Frontend Display:
  ResultsDisplay:
    <iframe src="/tmp-exports/uuid-456.pdf" />
    "12 pages"

  StatsPanel:
    Latency: 8.2 seconds
    Model: demo-service-v1
    Confidence: 92%
    Cost: $0.42
    Pages: 12

User Action: Export OR Customize

═════════════════════════════════════════════════════════════

PHASE 3: OVERRIDE (optional)
═════════════════════════════════════════════════════════════

User Action: Click "Customize Style"

State Change: RESULT_READY → OVERRIDE_ACTIVE

User Customization:
  Style: "minimalist" → "gothic"  ✓ (change detected)
  Tone: "reflective" → "dramatic"  ✓ (change detected)
  Themes: ["magical-realism"] → ["dark-academia", "gothic"]  ✓

Frontend Request (POST /api/override):
  {
    generationId: "uuid-456",  ← From Phase 2
    classification: {
      style: "gothic",  ← CHANGED
      tone: "dramatic",  ← CHANGED
      themes: ["dark-academia", "gothic"],  ← CHANGED
      ... (other fields from original)
    },
    overrides: {
      style: "gothic",
      tone: "dramatic",
      themes: ["dark-academia", "gothic"]
    }
  }

Backend Processing:
  Step 1: Look up original generation by UUID
  Step 2: Calculate cost multiplier based on changes
    - Style change: +40%
    - Tone change: +30%
    - New themes: +20%
    - Total: 90% (1.9x multiplier)
  Step 3: Decide regeneration strategy
    - Full: Recreate from scratch
    - Partial: Reuse some assets
    - Restyling: CSS-only changes
  Step 4: Execute strategy and generate new PDF

Backend Response:
  {
    id: "uuid-789",  ← NEW generation ID
    pdfUrl: "/tmp-exports/uuid-789.pdf",  ← NEW PDF URL
    pageCount: 12,
    costMultiplier: 1.9,  ← Cost impact: 90% increase
    costBreakdown: {
      style: 0.40,      ← Style: +40%
      tone: 0.30,       ← Tone: +30%
      themes: 0.20      ← Themes: +20%
    },
    regenerationStrategy: "full"
  }

Frontend Display:
  ResultsDisplay:
    <iframe src="/tmp-exports/uuid-789.pdf" />  ← NEW PDF

  CostVisualization:
    Cost Impact: 190%  (displayed as "1.9x" or "190%")
    Breakdown:
      Style:  +40%
      Tone:   +30%
      Themes: +20%

User Action: Export (with new customized PDF)

═════════════════════════════════════════════════════════════
```

---

## **6. CONFIGURATION MATRIX**

```
┌────────────────────────────────────────────────────────────────┐
│                  CONFIGURATION LOCKDOWN                        │
│              (Must match between backend & frontend)           │
└────────────────────────────────────────────────────────────────┘

BACKEND (server/.env or server/config.js)
│
├─ CONFIDENCE_THRESHOLD = 0.85
├─ COST_MULTIPLIER_MEDIUM = 1.0
├─ COST_MULTIPLIER_STYLE = 0.4
├─ COST_MULTIPLIER_COLOR = 0.05
├─ CLASSIFY_TIMEOUT_MS = 30000
├─ GENERATE_TIMEOUT_MS = 30000
├─ OVERRIDE_TIMEOUT_MS = 10000
├─ SUPPORTED_MEDIA = ["ebook", "calendar", "poster", "stickers", "card"]
├─ SUPPORTED_STYLES = ["minimalist", "gothic", "abstract", "retro", "modern"]
└─ ... (other config)

                         ↓ (source of truth)

FRONTEND (client/src/lib/config.js)
│
├─ CONFIDENCE_THRESHOLD = 0.85
├─ COST_MULTIPLIER_MEDIUM = 1.0
├─ COST_MULTIPLIER_STYLE = 0.4
├─ COST_MULTIPLIER_COLOR = 0.05
├─ CLASSIFY_TIMEOUT_MS = 30000
├─ GENERATE_TIMEOUT_MS = 30000
├─ OVERRIDE_TIMEOUT_MS = 10000
├─ SUPPORTED_MEDIA = ["ebook", "calendar", "poster", "stickers", "card"]
├─ SUPPORTED_STYLES = ["minimalist", "gothic", "abstract", "retro", "modern"]
└─ ... (other config)

                         ↓ (verify)

TEST SUITE (npm --prefix client run test -- config)
│
├─ ✅ CONFIDENCE_THRESHOLD = 0.85
├─ ✅ COST_MULTIPLIER_* values correct
├─ ✅ SUPPORTED_MEDIA has 5 values
├─ ✅ SUPPORTED_STYLES has 5 values
└─ ✅ All values match backend

                         ↓

✅ SYNCHRONIZED
```

---

## **7. ERROR HANDLING FLOW**

```
Frontend API Call
  ├─ POST /api/classify
  ├─ POST /api/generate
  └─ POST /api/override
                │
                ↓ (response received)

    ┌─────────────────────────────────┐
    │ Check HTTP status code          │
    └─────────────────────────────────┘
              │
    ┌─────────┼─────────┬─────────┬─────────┐
    │         │         │         │         │
    ↓         ↓         ↓         ↓         ↓
  200        400        408       422      500+
  OK      Bad Req    Timeout   Validation  Server
          (client   (backend     Error     Error
           error)    down)

200 OK:
  └─ Parse response
  └─ Update flowStore
  └─ Transition state
  └─ Render success

400 Bad Request:
  └─ Show error message: "Please check your input"
  └─ Stay in current state
  └─ Allow user to retry

408 Timeout:
  └─ Retry immediately (attempt 1)
  └─ If fails again, retry after 1 second (attempt 2)
  └─ If fails again, retry after 2 seconds (attempt 3)
  └─ If fails again, retry after 4 seconds (attempt 4)
  └─ After 4 attempts, show error: "Server is slow. Click Retry"
  └─ Allow user manual retry

422 Validation Error:
  └─ Show error: "Invalid value. Choose from: ..."
  └─ Stay in current state
  └─ Allow user to correct input + retry

500+ Server Error:
  └─ Retry with exponential backoff (1s, 2s, 4s)
  └─ If fails after 3 attempts, show error: "Server error. Retry later"
  └─ Allow manual retry
```

---

## **8. TEST COVERAGE MATRIX**

```
┌──────────────────────────────────────────────────────────────┐
│             FRONTEND TESTING ROADMAP                         │
│                                                              │
│         PHASE 1 INFRASTRUCTURE (60 tests)                   │
│         ────────────────────────────────────                │
│                                                              │
│  Task 1.1: StateManager Store (13 tests)                   │
│    ✓ State transitions (8 states × 2 = 16 combos)         │
│    ✓ Set/get methods (setState, setClassification)        │
│    ✓ Reset functionality                                   │
│    ✓ Edge cases (invalid state, null values)              │
│                                                              │
│  Task 1.2: API Client (14 tests)                           │
│    ✓ classify() success path                               │
│    ✓ classify() error paths (400, 408, 422, 500)          │
│    ✓ generate() success + error paths                      │
│    ✓ override() success + error paths                      │
│    ✓ Timeout handling (AbortController)                    │
│    ✓ Request/response validation                           │
│                                                              │
│  Task 1.3: GenerateFlow Orchestrator (13 tests)            │
│    ✓ State machine transitions (10+ paths)                 │
│    ✓ Event handlers (accept, override, export)            │
│    ✓ API orchestration (classify → generate)              │
│    ✓ Error recovery flows                                  │
│    ✓ Auto-accept logic (confidence threshold)              │
│                                                              │
│  Task 1.4: Mock API (13 tests)                             │
│    ✓ Mock responses match backend schema                   │
│    ✓ Error injection ([error], [timeout])                 │
│    ✓ Realistic latency ranges                              │
│    ✓ Cost calculations                                     │
│                                                              │
│  Task 1.5: Regression Testing (shared)                     │
│    ✓ All 457 existing tests still pass                     │
│    ✓ No breaking changes                                   │
│                                                              │
│         PHASE 2 COMPONENTS (33 tests)                      │
│         ─────────────────────────────────                  │
│                                                              │
│  Task 2.1: MediaSelector + PromptInput (7 tests)           │
│    ✓ Medium button selection                               │
│    ✓ Prompt input validation (≥10 chars)                   │
│    ✓ Character counter                                     │
│    ✓ Keyboard shortcuts (Ctrl+Enter)                       │
│    ✓ Emit events                                           │
│                                                              │
│  Task 2.2: ClassificationFeedback (8 tests)                │
│    ✓ Display classification data                           │
│    ✓ Confidence percentage + color coding                  │
│    ✓ Source badge (rules/ai/hybrid)                        │
│    ✓ Accept/Override button emissions                      │
│    ✓ Edge cases (missing data, 100% confidence)            │
│                                                              │
│  Task 2.3: ResultsDisplay + StatsPanel (18 tests)          │
│    ✓ PDF iframe rendering                                  │
│    ✓ Page count display                                    │
│    ✓ Latency formatting (ms → seconds)                     │
│    ✓ Cost formatting (USD)                                 │
│    ✓ Button emissions                                      │
│    ✓ Model info display                                    │
│                                                              │
│         PHASE 3 OVERRIDE (33 tests)                        │
│         ──────────────────────────────                     │
│                                                              │
│  Task 3.1: OverrideControls (9 tests)                      │
│    ✓ Style dropdown (5 options)                            │
│    ✓ Tone dropdown (5 options)                             │
│    ✓ Theme checkboxes (multi-select)                       │
│    ✓ Apply/Reset button states                             │
│    ✓ Change detection                                      │
│                                                              │
│  Task 3.2: CostVisualization (11 tests)                    │
│    ✓ Cost multiplier display (1.0x → 190%)               │
│    ✓ Cost breakdown by dimension                           │
│    ✓ Formatting (USD, percentages)                         │
│    ✓ Edge cases (0% multiplier, >2x multiplier)            │
│                                                              │
│  Task 3.3: Full Wiring (13 tests)                          │
│    ✓ End-to-end flow (select → classify → generate)       │
│    ✓ State transitions + API calls                         │
│    ✓ Component integration                                 │
│    ✓ Error recovery                                        │
│                                                              │
│    ────────────────────────────────────────────           │
│    TOTAL: 60 (Phase 1) + 33 (Phase 2) + 33 (Phase 3)     │
│           + 104 (existing) = 230+ tests                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## **9. CHECKPOINT ROADMAP (Visual)**

```
Day 1
├─ Morning: Checkpoint 0 — Alignment Kickoff (1h)
│  └─ ✅ COMPLETE (Nov 19)
│     • Read architecture docs
│     • Lock configuration
│     • Verify API schemas
│
├─ Afternoon: Checkpoint 1 — Phase 1-2 Implementation (6h)
│  └─ ✅ COMPLETE (Nov 19)
│     • StateManager store (1.5h) ✅
│     • API client (1.5h) ✅
│     • GenerateFlow orchestrator (2h) ✅
│     • Mock API (1.5h) ✅
│     • Regressions (1h) ✅
│
└─ Result: 60 new + 104 existing = 164 tests ✅

Day 2
├─ Morning: Backend Phase 2-3 (5h)
│  └─ 📋 IN PROGRESS
│     • POST /api/generate endpoint
│     • POST /api/override endpoint
│     • Integration tests
│
├─ Afternoon: Integration Testing (3-4h)
│  └─ 📋 READY
│     • Frontend ↔ Backend validation
│     • E2E flows
│     • Performance testing
│
└─ Result: Full system ready for production ✅

Day 3
├─ Smoke tests
├─ Performance validation
└─ Production deployment ✅
```

---

## **10. QUICK DECISION TREE**

```
User clicks "Generate →"
│
├─ Frontend Action: Call POST /api/classify
│  └─ Response: classification object
│     ├─ If confidence ≥ 0.85:
│     │  └─ Auto-proceed to generation (skip CLASSIFICATION_READY)
│     │
│     └─ If confidence < 0.85:
│        └─ Show ClassificationFeedback (let user decide)
│           ├─ If user clicks "Accept":
│           │  └─ Call POST /api/generate
│           │
│           └─ If user clicks "Override":
│              └─ Show OverrideControls (pick style/tone)
│                 └─ Call POST /api/override
│
└─ Result: PDF displayed in ResultsDisplay
   └─ User can Export OR Customize again
```

---

**END OF VISUAL REFERENCE**
