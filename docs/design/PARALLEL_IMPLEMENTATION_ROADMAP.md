# Parallel Implementation Roadmap: Phase A-B Frontend + Backend

**Document Version**: 1.0  
**Date**: November 18, 2025  
**Status**: 🟢 **EXECUTION PLAN — READY TO START**  
**Audience**: Backend lead, Frontend lead, Project manager  
**Scope**: Coordinated parallel execution with synchronized checkpoints to activate Phase A-B

---

## **Executive Summary**

This document coordinates **backend** and **frontend** teams working in parallel with **3 synchronized checkpoints** to minimize blocking and maximize efficiency.

### **Key Metrics**

- **Total effort**: 20-25 engineering hours (distributed)
- **Timeline**: 3-4 calendar days (with parallel work)
- **Checkpoint 1**: Backend Phase 1 complete (1 day) → Frontend begins Phase 2
- **Checkpoint 2**: Backend + Frontend Phase 2 complete (1.5 days) → Full integration testing
- **Checkpoint 3**: All testing complete (1 day) → Launch Phase A-B to production

### **Success Criteria**

✅ All 3 API endpoints working  
✅ All frontend components receiving + displaying data correctly  
✅ All 457 existing tests pass (zero regressions)  
✅ All new 220+ tests pass (backend + frontend combined)  
✅ End-to-end flow: classify → generate → override → export works seamlessly  
✅ Error recovery: timeout + network failures handled gracefully  
✅ Performance: classify <5s, generate <20s, override <2s

---

## **Phase Overview**

### **Timeline View**

```
Day 1 (8 hours)
├─ Checkpoint 0 (Morning): Alignment kickoff (1h)
├─ PARALLEL:
│  ├─ Backend: Implement Phase 1 (6h)
│  └─ Frontend: Prepare Phase 2 infrastructure (6h)
└─ Checkpoint 1 (EOD): Backend Phase 1 COMPLETE ✅

Day 2 (8 hours)
├─ PARALLEL:
│  ├─ Backend: Implement Phase 2 + Unit tests (5h)
│  └─ Frontend: Implement Phase 2 + Unit tests (5h)
└─ Checkpoint 2 (EOD): Both phases COMPLETE, ready for integration ✅

Day 3 (6 hours)
├─ Backend: Phase 3 override + integration tests (2h)
├─ Frontend: Phase 3 override integration + E2E setup (2h)
├─ QA: Parallel integration + E2E testing (4h)
└─ Checkpoint 3 (EOD): All tests passing, ready for launch ✅

Day 4 (2 hours)
├─ Smoke test on staging
├─ Final performance validation
└─ Ready for production deployment
```

---

## **Checkpoint 0: Alignment Kickoff** (1 hour, Day 1 Morning)

**Goal**: Ensure both teams have identical understanding of contracts + configuration

### **Backend Lead Tasks**

- [ ] **Review alignment checklist**:

  - [ ] Read ORCHESTRATOR_ARCHITECTURE.md § 5 (integration points)
  - [ ] Read BACKEND_MODULARITY_ARCHITECTURE.md § API Layer Integration
  - [ ] Read FRONTEND_BACKEND_INTEGRATION_SPEC.md § API Endpoint Specifications
  - [ ] Confirm all 3 utility modules available + tested

- [ ] **Lock configuration values** (in `server/config.js` or `.env`):

  ```javascript
  CONFIDENCE_THRESHOLD = 0.85;
  COST_MULTIPLIER_COLOR = 0.05;
  COST_MULTIPLIER_STYLE = 0.4;
  COST_MULTIPLIER_MEDIUM = 1.0;
  CLASSIFY_TIMEOUT_MS = 30000;
  GENERATE_TIMEOUT_MS = 30000;
  OVERRIDE_TIMEOUT_MS = 10000;
  ```

- [ ] **Verify API response schemas** match FRONTEND_BACKEND_INTEGRATION_SPEC exactly:
  - [ ] POST /api/classify response: `{ id, medium, confidence, style, themes, audience, genre, tone, source, metadata }`
  - [ ] POST /api/generate response: `{ id, pdfUrl, pageCount, medium, style, classification, metadata, latency, costEstimate }`
  - [ ] POST /api/override response: `{ id, pdfUrl, costMultiplier, costBreakdown, regenerationStrategy, metadata }`

### **Frontend Lead Tasks**

- [ ] **Review alignment checklist**:

  - [ ] Read FRONTEND_PROGRESSIVE_DISCLOSURE_ARCHITECTURE.md (state machine)
  - [ ] Read FRONTEND_BACKEND_INTEGRATION_SPEC.md § State-to-API Mapping
  - [ ] Read FRONTEND_BACKEND_INTEGRATION_SPEC.md § Component-to-Backend Binding
  - [ ] Confirm all 12 components planned + ready to implement

- [ ] **Lock configuration values** (match backend exactly in `client/src/lib/config.js`):

  ```javascript
  CONFIDENCE_THRESHOLD = 0.85; // MUST match backend
  COST_MULTIPLIER_COLOR = 0.05;
  COST_MULTIPLIER_STYLE = 0.4;
  COST_MULTIPLIER_MEDIUM = 1.0;
  CLASSIFY_TIMEOUT_MS = 30000;
  GENERATE_TIMEOUT_MS = 30000;
  OVERRIDE_TIMEOUT_MS = 10000;
  SUPPORTED_MEDIA = ["ebook", "calendar", "poster", "stickers", "card"];
  SUPPORTED_STYLES = ["minimalist", "gothic", "abstract", "retro", "modern"];
  ```

- [ ] **Verify API request schemas** that backend expects:
  - [ ] POST /api/classify expects: `{ prompt, selectedMedium }`
  - [ ] POST /api/generate expects: `{ prompt, medium, classification }`
  - [ ] POST /api/override expects: `{ generationId, classification, overrides }`

### **Joint Tasks** (Backend + Frontend Leads Together)

- [ ] **Sign-off**: Both leads review + agree on:

  - [ ] Configuration lockdown (no changes during implementation)
  - [ ] API contracts (request/response schemas final)
  - [ ] Error codes + recovery strategies (408, 422, 500, etc.)
  - [ ] Checkpoint dates + deliverables

- [ ] **Establish communication**:
  - [ ] Set up daily standups (15 min, same time)
  - [ ] Create shared Slack channel (#phase-a2b-impl)
  - [ ] Schedule checkpoint reviews (EOD Days 1-3)

**Deliverable**: Configuration + API contract document (signed off by both leads)

---

## **Backend Phase 1: Foundation** (6 hours, Day 1 Afternoon)

**Owner**: Backend Lead + 1-2 backend engineers

### **Task 1.1: Add classifyPrompt() to genieService.js** (1.5 hours)

**Acceptance Criteria**:

- [ ] Method signature: `async classifyPrompt(prompt: string): Promise<Classification>`
- [ ] Returns Classification with all required fields: id, medium, confidence, style, themes, audience, genre, tone, source, metadata
- [ ] Pipeline: ruleEngine → llmClassifier (if confidence < 0.85) → classificationValidator
- [ ] Error handling: Returns safe default if any step fails
- [ ] **Unit test**: 5+ tests (high confidence, low confidence, LLM timeout, LLM unavailable, rule engine only)

**Code location**: `server/genieService.js` (new method, ~80 lines)

**Testing**: 5 unit tests added to `server/__tests__/genieService.classifyPrompt.test.js`

**Definition of Done**:

```bash
npm --prefix server run test -- genieService.classifyPrompt ✅ 5/5 passing
```

---

### **Task 1.2: Create POST /api/classify endpoint** (1 hour)

**Acceptance Criteria**:

- [ ] Endpoint validates request: `{ prompt, selectedMedium }`
- [ ] Calls `genieService.classifyPrompt(prompt)`
- [ ] Returns response with all required fields
- [ ] Error handling: 400 (bad request), 408 (timeout), 500 (server error)
- [ ] **Unit test**: 5+ tests (valid prompt, short prompt, timeout, server error)

**Code location**: `server/index.js` (new endpoint, ~30 lines)

**Testing**: 5 unit tests added to `server/__tests__/api.classify.test.js`

**Definition of Done**:

```bash
npm --prefix server run test -- api.classify ✅ 5/5 passing
curl -X POST http://localhost:3000/api/classify -d '{"prompt":"summer poetry"}' ✅ Returns valid classification
```

---

### **Task 1.3: Verify Phase A-B utilities** (1.5 hours)

**Acceptance Criteria**:

- [ ] All 6 Phase A-B utility modules present:

  - [ ] `server/utils/ruleEngine.js` ✅
  - [ ] `server/utils/llmClassifier.js` ✅
  - [ ] `server/utils/classificationValidator.js` ✅
  - [ ] `server/utils/svgLibrary.js` ✅
  - [ ] `server/utils/overrideSystem.js` ✅
  - [ ] `server/utils/imageGenerator.js` (existing) ✅

- [ ] All utility tests passing:

  - [ ] RuleEngine: 45+ tests ✅
  - [ ] LLMClassifier: 35+ tests ✅
  - [ ] ClassificationValidator: 40+ tests ✅
  - [ ] SVGLibrary: 30+ tests ✅
  - [ ] OverrideSystem: 30+ tests ✅

- [ ] Integration: Each utility callable from classifyPrompt()

**Testing**: Run full Phase A-B module test suite

**Definition of Done**:

```bash
npm --prefix server run test -- utils/ ✅ 180+/180+ passing
```

---

### **Task 1.4: Enhance genieService.process()** (1 hour)

**Acceptance Criteria**:

- [ ] Add classification parameter: `async process(prompt, mode, classification?)`
- [ ] If classification not provided, call `this.classifyPrompt(prompt)`
- [ ] Pass classification to `service.handle(prompt, classification)`
- [ ] Add classification to response envelope metadata
- [ ] Backward compatible: existing `/prompt` endpoint still works
- [ ] **Unit test**: 5+ tests (with classification, without classification, backward compat)

**Code location**: `server/genieService.js` (modify existing method, ~20 line change)

**Testing**: 5 unit tests added to `server/__tests__/genieService.process.test.js`

**Definition of Done**:

```bash
npm --prefix server run test -- genieService.process ✅ 5/5 passing
```

---

### **Task 1.5: Ensure zero regressions** (1 hour)

**Acceptance Criteria**:

- [ ] All 413 existing backend tests pass ✅
- [ ] No new console errors or warnings
- [ ] No breaking changes to Phase A endpoints

**Testing**: Full test suite

**Definition of Done**:

```bash
npm --prefix server run test:run ✅ 413/413 passing (0 regressions)
```

---

### **Checkpoint 1: Backend Phase 1 COMPLETE** (EOD Day 1)

**What's Working**:

- ✅ POST /api/classify callable and returning valid classifications
- ✅ classifyPrompt() method in genieService works
- ✅ process() method enhanced to accept classification
- ✅ 25+ new backend unit tests passing
- ✅ Zero regressions in existing tests

**Blockers Removed for Frontend**:

- ✅ Frontend can now mock /api/classify responses
- ✅ Frontend knows exact response schema
- ✅ Frontend can begin Phase 2 without waiting for Phase 2 backend code

**Frontend Team Notified**: "Backend Phase 1 complete. /api/classify ready for mocking. You can proceed with Phase 2 development."

---

## **Frontend Phase 1: Infrastructure Setup** (Parallel with Backend Phase 1)

**Owner**: Frontend Lead + 1-2 frontend engineers

**Goal**: Prepare state management, routing, and API client so that Phase 2 components can plug in immediately

### **Task 1.1: Create StateManager store** (1.5 hours)

**Acceptance Criteria**:

- [ ] Svelte store with all 8 states: INITIAL, MEDIUM_SELECTED, GENERATING, CLASSIFICATION_READY, RESULT_READY, OVERRIDE_ACTIVE, COMPLETE, ERROR
- [ ] State transitions clearly defined (per FRONTEND_PROGRESSIVE_DISCLOSURE_ARCHITECTURE.md)
- [ ] Methods: `setState()`, `setClassification()`, `setResult()`, `setError()`, `reset()`
- [ ] Properties: `state`, `selectedMedium`, `prompt`, `classification`, `result`, `latency`, `overrideCost`, `error`
- [ ] **Unit test**: 8+ tests (state transitions, setters, reset)

**Code location**: `client/src/lib/stores/flowStore.js` (new file, ~80 lines)

**Testing**: 8 unit tests added to `client/src/lib/stores/flowStore.test.js`

**Definition of Done**:

```bash
npm --prefix client run test -- flowStore ✅ 8/8 passing
```

---

### **Task 1.2: Create API client wrapper** (1.5 hours)

**Acceptance Criteria**:

- [ ] Functions: `classify(prompt, selectedMedium)`, `generate(prompt, medium, classification)`, `applyOverride(generationId, overrides)`
- [ ] Each function: validates input, makes fetch call, handles errors
- [ ] Error handling: returns error object with `status`, `message`, `retryable`
- [ ] Timeout handling: aborts request after CLASSIFY_TIMEOUT_MS, GENERATE_TIMEOUT_MS, OVERRIDE_TIMEOUT_MS
- [ ] **Unit test**: 10+ tests (success paths, error paths, timeout)

**Code location**: `client/src/lib/api.js` (new/enhanced file, ~150 lines)

**Testing**: 10 unit tests added to `client/src/lib/api.test.js`

**Definition of Done**:

```bash
npm --prefix client run test -- api ✅ 10/10 passing
```

---

### **Task 1.3: Create GenerateFlow orchestrator component** (2 hours)

**Acceptance Criteria**:

- [ ] Component handles all state transitions
- [ ] Methods:

  - [ ] `handleGenerateClick()` → POST /api/classify → decide CLASSIFICATION_READY vs auto-advance
  - [ ] `handleAcceptClassification()` → POST /api/generate → RESULT_READY
  - [ ] `handleApplyOverride(overrides)` → POST /api/override → RESULT_READY
  - [ ] `transition(nextState)` → update flowStore
  - [ ] `reset()` → return to INITIAL

- [ ] Props: None (reads/writes flowStore directly)
- [ ] Emits: (none - manages all state internally)
- [ ] **Unit test**: 10+ tests (state transitions, API calls, error handling)

**Code location**: `client/src/components/GenerateFlow.svelte` (new file, ~200 lines)

**Testing**: 10 unit tests added

**Definition of Done**:

```bash
npm --prefix client run test -- GenerateFlow ✅ 10/10 passing
```

---

### **Task 1.4: Create mock API responses** (1.5 hours)

**Acceptance Criteria**:

- [ ] Mock responses for all 3 endpoints
- [ ] Each mock: success, 400 error, 408 timeout, 500 error variants
- [ ] Can be toggled on/off for testing vs. real backend
- [ ] Located: `client/src/lib/mockApi.js` (optional utility, helps frontend develop without backend)

**Code location**: `client/src/lib/mockApi.js` (utility file, ~150 lines)

**Usage**: Frontend can import and use during Phase 2 if backend not ready

**Definition of Done**:

```bash
// Frontend can use mock API during Phase 2 development
import { classify as mockClassify } from './lib/mockApi.js';
const result = await mockClassify("summer poetry");
// Returns valid classification object
```

---

### **Task 1.5: Ensure zero regressions** (1 hour)

**Acceptance Criteria**:

- [ ] All 457 existing frontend tests pass ✅
- [ ] No breaking changes to existing components
- [ ] New components fully tested

**Testing**: Full test suite

**Definition of Done**:

```bash
npm --prefix client run test ✅ 457+/457+ passing (0 regressions)
```

---

## **Checkpoint 1 Synchronized Review** (EOD Day 1, 30 min)

**Backend Lead Reports**:

- ✅ POST /api/classify endpoint complete and tested
- ✅ classifyPrompt() method complete
- ✅ All 413 existing tests pass
- ✅ Ready for frontend integration

**Frontend Lead Reports**:

- ✅ StateManager, API client, GenerateFlow orchestrator complete
- ✅ All 30+ new unit tests passing
- ✅ Ready to implement Phase 2 components against mocked/real API

**Joint Decision**:

- ✅ Proceed to Day 2 Phase 2 (parallel development)
- ✅ Frontend continues with real /api/classify from backend
- ✅ No blockers identified

---

## **Day 2 Phase 2: Core Implementation** (8 hours, Day 2)

### **Backend Phase 2: Generate Endpoint + Service Enhancement** (5 hours)

**Owner**: Backend Lead + 1-2 backend engineers

#### **Task 2.1: Create POST /api/generate endpoint** (1 hour)

**Acceptance Criteria**:

- [ ] Endpoint validates request: `{ prompt, medium, classification }`
- [ ] Calls `genieService.process(prompt, medium, classification)`
- [ ] Returns response with: id, pdfUrl, pageCount, medium, style, classification, metadata, latency, costEstimate
- [ ] Error handling: 400, 408, 500 with appropriate messages
- [ ] **Unit test**: 8+ tests (success, timeout, service error, missing fields)

**Code location**: `server/index.js` (new endpoint, ~40 lines)

**Testing**: 8 unit tests

**Definition of Done**:

```bash
npm --prefix server run test -- api.generate ✅ 8/8 passing
curl -X POST http://localhost:3000/api/generate \
  -d '{"prompt":"poetry","medium":"ebook","classification":{...}}' ✅ Returns valid generation
```

---

#### **Task 2.2: Enhance service interfaces** (1.5 hours)

**Acceptance Criteria**:

- [ ] demoService.handle() accepts classification parameter
- [ ] ebookService.handle() accepts classification parameter
- [ ] sampleService.handle() accepts classification parameter
- [ ] Each service uses classification.style, classification.themes for generation
- [ ] Backward compatible: services work without classification (use defaults)
- [ ] **Unit test**: 5+ tests per service (with classification, without classification)

**Code location**:

- [ ] `server/demoService.js` (modify handle(), ~30 lines)
- [ ] `server/ebookService.js` (modify handle(), ~50 lines)
- [ ] `server/sampleService.js` (modify handle(), ~50 lines)

**Testing**: 15 unit tests total

**Definition of Done**:

```bash
npm --prefix server run test -- services ✅ 15/15 passing
```

---

#### **Task 2.3: Integrate classifyPrompt into process flow** (1 hour)

**Acceptance Criteria**:

- [ ] genieService.process() calls classifyPrompt() if classification not provided
- [ ] Classification passed to all service.handle() calls
- [ ] Response includes classification metadata
- [ ] **Unit test**: 8+ tests (all service types, error paths)

**Code location**: `server/genieService.js` (modify process(), ~20 lines)

**Testing**: 8 unit tests

**Definition of Done**:

```bash
npm --prefix server run test -- genieService.process ✅ 8/8 passing
```

---

#### **Task 2.4: Add integration tests** (1.5 hours)

**Acceptance Criteria**:

- [ ] End-to-end flow: /api/classify → /api/generate → valid PDF returned
- [ ] All 3 services work with classification
- [ ] Cost estimate calculated correctly
- [ ] Latency measured and returned
- [ ] **Integration test**: 10+ tests (all services, all error scenarios)

**Code location**: `server/__tests__/phase-a2b.integration.test.js` (new file, ~200 lines)

**Testing**: 10+ integration tests

**Definition of Done**:

```bash
npm --prefix server run test -- phase-a2b.integration ✅ 10+/10+ passing
```

---

### **Frontend Phase 2: Core UI Components** (5 hours, parallel)

**Owner**: Frontend Lead + 1-2 frontend engineers

#### **Task 2.1: Implement PromptInput + MediaSelector** (1.5 hours)

**Acceptance Criteria**:

- [ ] MediaSelector component: 6 medium buttons (ebook, calendar, poster, stickers, card, demo)
- [ ] PromptInput component: textarea + "Generate →" button
- [ ] Validation: prompt must be >= 10 characters
- [ ] Emits: `on:generate` event with { prompt, selectedMedium }
- [ ] Props from store: selectedMedium, isLoading
- [ ] **Unit test**: 8+ tests (input validation, button states, emissions)

**Code location**:

- [ ] `client/src/components/MediaSelector.svelte` (new file, ~100 lines)
- [ ] `client/src/components/PromptInput.svelte` (new file, ~120 lines)

**Testing**: 8 unit tests

**Definition of Done**:

```bash
npm --prefix client run test -- MediaSelector,PromptInput ✅ 8/8 passing
```

---

#### **Task 2.2: Implement ClassificationFeedback component** (1.5 hours)

**Acceptance Criteria**:

- [ ] Displays classification data: medium, confidence, style, themes, audience, genre, tone, source
- [ ] Shows confidence as percentage (0.92 → 92%)
- [ ] Shows source badge (rules/ai/hybrid)
- [ ] Buttons: "Accept", "Override"
- [ ] Emits: `on:accept`, `on:override`
- [ ] Props: classification object from store
- [ ] **Unit test**: 8+ tests (data display, button emissions, edge cases)

**Code location**: `client/src/components/ClassificationFeedback.svelte` (new file, ~150 lines)

**Testing**: 8 unit tests

**Definition of Done**:

```bash
npm --prefix client run test -- ClassificationFeedback ✅ 8/8 passing
```

---

#### **Task 2.3: Implement ResultsDisplay + StatsPanel** (1.5 hours)

**Acceptance Criteria**:

- [ ] ResultsDisplay shows: PDF preview/iframe, page count, medium, style, export button
- [ ] StatsPanel shows: latency (ms → seconds), model used, confidence, source, pageCount, costEstimate
- [ ] Buttons: "Customize Style", "New Prompt", "Export PDF"
- [ ] Emits: `on:customize`, `on:newPrompt`, `on:export`
- [ ] Props: result, classification, latency from store
- [ ] **Unit test**: 8+ tests (data display, formatting, button emissions)

**Code location**:

- [ ] `client/src/components/ResultsDisplay.svelte` (new file, ~180 lines)
- [ ] `client/src/components/StatsPanel.svelte` (new file, ~100 lines)

**Testing**: 8 unit tests

**Definition of Done**:

```bash
npm --prefix client run test -- ResultsDisplay,StatsPanel ✅ 8/8 passing
```

---

#### **Task 2.4: Wire components to GenerateFlow** (0.5 hours)

**Acceptance Criteria**:

- [ ] PromptInput emits → GenerateFlow.handleGenerateClick() → POST /api/classify
- [ ] ClassificationFeedback emits → GenerateFlow handles accept/override
- [ ] ResultsDisplay emits → GenerateFlow handles customize/export/newPrompt
- [ ] All state transitions work end-to-end

**Code location**: `client/src/components/GenerateFlow.svelte` (modify existing)

**Testing**: 5+ integration tests

**Definition of Done**:

```bash
npm --prefix client run test -- GenerateFlow ✅ integration tests passing
```

---

## **Checkpoint 2: Phase 2 COMPLETE** (EOD Day 2)

**Backend Deliverables**:

- ✅ POST /api/generate endpoint working
- ✅ 3 services enhanced with classification support
- ✅ 30+ new backend unit tests passing
- ✅ 10+ integration tests passing
- ✅ Total: 453 tests passing (413 existing + 40 new)

**Frontend Deliverables**:

- ✅ 5 core UI components complete (MediaSelector, PromptInput, ClassificationFeedback, ResultsDisplay, StatsPanel)
- ✅ 40+ new frontend unit tests passing
- ✅ All 457 existing tests still passing
- ✅ E2E flow works: select → classify → accept → generate → view results

**Next Checkpoint Actions**:

- ✅ Backend: Implement Phase 3 (override endpoint + override system)
- ✅ Frontend: Implement Phase 3 (OverrideControls, CostVisualization)
- ✅ QA: Begin integration + E2E testing

---

## **Day 3 Phase 3: Override System + Integration Testing** (6 hours)

### **Backend Phase 3: Override Endpoint** (2 hours)

**Owner**: Backend Lead + 1 backend engineer

#### **Task 3.1: Implement override() method in genieService** (1 hour)

**Acceptance Criteria**:

- [ ] Method signature: `async override(generationId, classification, overrides)`
- [ ] Looks up previous generation by UUID
- [ ] Calls overrideSystem.calculateCost() to determine multiplier
- [ ] Calls overrideSystem.decide() to determine strategy (full/partial/restyling)
- [ ] Executes strategy: full regen, partial regen, or CSS-only restyling
- [ ] Returns updated envelope with costMultiplier, regenerationStrategy
- [ ] **Unit test**: 6+ tests (full regen, partial regen, CSS-only, error cases)

**Code location**: `server/genieService.js` (new method, ~80 lines)

**Testing**: 6 unit tests

**Definition of Done**:

```bash
npm --prefix server run test -- genieService.override ✅ 6/6 passing
```

---

#### **Task 3.2: Create POST /api/override endpoint** (1 hour)

**Acceptance Criteria**:

- [ ] Endpoint validates request: `{ generationId, classification, overrides }`
- [ ] Calls genieService.override()
- [ ] Returns: id, pdfUrl, costMultiplier, costBreakdown, regenerationStrategy, metadata
- [ ] Error handling: 400 (missing fields), 404 (generation not found), 422 (invalid overrides), 500 (server error)
- [ ] **Unit test**: 8+ tests (success paths, all error scenarios)

**Code location**: `server/index.js` (new endpoint, ~50 lines)

**Testing**: 8 unit tests

**Definition of Done**:

```bash
npm --prefix server run test -- api.override ✅ 8/8 passing
```

---

### **Frontend Phase 3: Override UI Components** (2 hours, parallel)

**Owner**: Frontend Lead + 1 frontend engineer

#### **Task 3.1: Implement OverrideControls component** (1 hour)

**Acceptance Criteria**:

- [ ] Dropdowns for: style, color, tone, theme (user-selectable)
- [ ] Shows current classification values
- [ ] Button: "Apply Override"
- [ ] Emits: `on:apply` with { style, color, tone, theme, ... }
- [ ] Props: classification, result (to determine generation ID)
- [ ] **Unit test**: 8+ tests (dropdown states, form submission, emissions)

**Code location**: `client/src/components/OverrideControls.svelte` (new file, ~200 lines)

**Testing**: 8 unit tests

**Definition of Done**:

```bash
npm --prefix client run test -- OverrideControls ✅ 8/8 passing
```

---

#### **Task 3.2: Implement CostVisualization component** (0.5 hours)

**Acceptance Criteria**:

- [ ] Displays cost multiplier as percentage (0.05 → 5%, 0.40 → 40%, 1.0 → 100%)
- [ ] Shows breakdown: which dimensions triggered cost (color, style, medium)
- [ ] Shows latency estimate for regeneration
- [ ] Props: costMultiplier, costBreakdown
- [ ] **Unit test**: 4+ tests (multiplier display, breakdown display)

**Code location**: `client/src/components/CostVisualization.svelte` (new file, ~80 lines)

**Testing**: 4 unit tests

**Definition of Done**:

```bash
npm --prefix client run test -- CostVisualization ✅ 4/4 passing
```

---

#### **Task 3.3: Wire override flow to GenerateFlow** (0.5 hours)

**Acceptance Criteria**:

- [ ] ResultsDisplay "Customize" button → transition to OVERRIDE_ACTIVE
- [ ] OverrideControls "Apply" button → POST /api/override → transition to RESULT_READY
- [ ] Error handling: 422 → show validation error, stay in OVERRIDE_ACTIVE
- [ ] **Unit test**: 6+ integration tests

**Code location**: `client/src/components/GenerateFlow.svelte` (modify existing)

**Testing**: 6 integration tests

**Definition of Done**:

```bash
npm --prefix client run test -- GenerateFlow.override ✅ 6/6 passing
```

---

### **QA: Integration + E2E Testing** (4 hours, parallel with backend + frontend)

**Owner**: QA Lead + 2 QA engineers

#### **Task 3.1: Integration Testing** (2 hours)

**Scope**: Backend + Frontend together

**Test scenarios**:

1. **Happy Path**: select → classify → accept → generate → override → export

   ```
   [ ] User selects medium (ebook)
   [ ] User enters prompt ("summer poetry")
   [ ] User clicks Generate → /api/classify returns classification
   [ ] User clicks Accept → /api/generate returns PDF
   [ ] User clicks Customize → transition to OVERRIDE_ACTIVE
   [ ] User changes style to "gothic" → /api/override returns new PDF
   [ ] User clicks Export → PDF downloads
   ```

2. **Auto-Accept Path**: high confidence classification skips CLASSIFICATION_READY

   ```
   [ ] Classification confidence > 0.85 → skip user review
   [ ] Go straight from classify to generate
   [ ] Display results immediately
   ```

3. **Error Recovery**: timeout → retry

   ```
   [ ] /api/classify times out (408)
   [ ] Show error message + Retry button
   [ ] User clicks Retry
   [ ] Request succeeds on retry
   [ ] Continue to classification review
   ```

4. **Network Failure**: exponential backoff
   ```
   [ ] Network error on /api/classify
   [ ] Auto-retry with 1s delay
   [ ] Auto-retry with 2s delay
   [ ] Auto-retry with 4s delay (give up)
   [ ] Show persistent error panel
   [ ] User can click "Retry Now"
   ```

**Test count**: 15+ integration test cases

**Definition of Done**:

```bash
npm --prefix client run test -- integration ✅ 15+/15+ passing
```

---

#### **Task 3.2: E2E Testing** (1.5 hours)

**Tool**: Playwright or Cypress (against real backend)

**Test scenarios**:

```gherkin
Feature: Full user journey

Scenario: User generates and customizes ebook
  Given the app is loaded
  When user clicks "📖 eBook" medium
  And user enters "A magical summer in a small village"
  And user clicks "Generate →"
  Then "Confidence" should be displayed
  And user can see classification metadata
  When user clicks "Accept"
  Then PDF should be generated
  And stats should show latency + model + pageCount
  When user clicks "Customize Style"
  And user selects style "gothic"
  And user clicks "Apply Override"
  Then new PDF should be generated
  And cost multiplier should be displayed
  When user clicks "Download PDF"
  Then PDF file should download
```

**Test count**: 5+ E2E scenarios

**Definition of Done**:

```bash
npx playwright test ✅ 5+/5+ scenarios passing
```

---

#### **Task 3.3: Performance Testing** (0.5 hours)

**Metrics**:

- [ ] Classify latency: <5 seconds (95th percentile)
- [ ] Generate latency: <20 seconds (95th percentile)
- [ ] Override latency: <2 seconds (95th percentile)
- [ ] Overall flow: <30 seconds (95th percentile)
- [ ] No memory leaks
- [ ] Cache hit rate > 80% (SVG searches)

**Tools**: Lighthouse, DevTools profiler, k6 (load testing)

**Definition of Done**:

```bash
✅ classify: p95 = 4.2s
✅ generate: p95 = 18.5s
✅ override: p95 = 1.8s
✅ overall: p95 = 28.3s
✅ memory stable (no growth over 10 requests)
✅ cache hit: 82%
```

---

## **Checkpoint 3: Launch Ready** (EOD Day 3)

**Backend Status**:

- ✅ All 3 endpoints complete + tested
- ✅ Override system working
- ✅ 50+ new tests passing
- ✅ 463 total tests passing (413 existing + 50 new)
- ✅ No regressions

**Frontend Status**:

- ✅ 12 UI components complete + tested
- ✅ All state transitions working
- ✅ Error recovery implemented
- ✅ 60+ new tests passing
- ✅ 517 total tests passing (457 existing + 60 new)
- ✅ No regressions

**QA Status**:

- ✅ 15+ integration tests passing
- ✅ 5+ E2E scenarios passing
- ✅ Performance targets met
- ✅ Zero blockers identified

**Production Readiness**:

- ✅ All Phase A-B features implemented
- ✅ All tests passing
- ✅ Performance validated
- ✅ Error recovery tested
- ✅ Zero regressions from Phase A

---

## **Day 4: Launch** (2 hours)

### **Pre-Launch Checklist**

**Backend**:

- [ ] Config values locked + documented
- [ ] All endpoints responding correctly
- [ ] Error messages clear + actionable
- [ ] Logging enabled for debugging
- [ ] Monitoring/alerts configured

**Frontend**:

- [ ] Config values match backend
- [ ] All API calls use correct endpoints
- [ ] Error messages match backend errors
- [ ] Loading states clear + accessible
- [ ] Keyboard navigation works

**Infrastructure**:

- [ ] Deploy to staging first
- [ ] Run smoke tests
- [ ] Monitor error rates (should be 0%)
- [ ] Check performance metrics
- [ ] Get sign-off from product + QA

**Post-Launch**:

- [ ] Monitor error logs
- [ ] Track classification accuracy
- [ ] Monitor generation latency
- [ ] Gather user feedback
- [ ] Plan Phase B (intelligent eBook service)

---

## **Critical Success Factors**

### **1. Configuration Lockdown**

**Must be synchronized between backend + frontend**:

```javascript
CONFIDENCE_THRESHOLD = 0.85;
COST_MULTIPLIER_COLOR = 0.05;
COST_MULTIPLIER_STYLE = 0.4;
COST_MULTIPLIER_MEDIUM = 1.0;
CLASSIFY_TIMEOUT_MS = 30000;
GENERATE_TIMEOUT_MS = 30000;
OVERRIDE_TIMEOUT_MS = 10000;
SUPPORTED_MEDIA = ["ebook", "calendar", "poster", "stickers", "card"];
SUPPORTED_STYLES = ["minimalist", "gothic", "abstract", "retro", "modern"];
```

**How to ensure**:

- [ ] Create single source of truth: `shared/config.ts`
- [ ] Both backend + frontend import from shared location
- [ ] Add test to verify values match on both sides
- [ ] CI/CD validates before deployment

---

### **2. API Contract Integrity**

**Every response must match spec exactly**:

**POST /api/classify response**:

```json
{
  "id": "uuid",
  "medium": "ebook",
  "confidence": 0.92,
  "style": "minimalist",
  "themes": ["zen"],
  "audience": "general",
  "genre": "poetry",
  "tone": "reflective",
  "source": "hybrid",
  "metadata": { "rulesMatched": [...], "aiModel": "...", "processingTimeMs": 450 }
}
```

**How to ensure**:

- [ ] Frontend has TypeScript interfaces matching response
- [ ] Add JSON schema validation on backend
- [ ] Add JSON schema validation on frontend
- [ ] CI/CD runs contract tests before deployment

---

### **3. Error Recovery Consistency**

**All 3 endpoints must handle errors identically**:

| Error Code | Cause                            | Recovery                       | User Message                          |
| ---------- | -------------------------------- | ------------------------------ | ------------------------------------- |
| 400        | Bad request (missing fields)     | None                           | "Please check your input"             |
| 408        | Timeout (LLM API)                | Exponential backoff (1,2,4,8s) | "Server is busy. Retrying..."         |
| 422        | Invalid value (style: "invalid") | Show valid options             | "Style not supported. Choose from..." |
| 500        | Server error                     | Retry same request             | "Server error. Retrying..."           |

**How to ensure**:

- [ ] Create error handling standard (both backend + frontend)
- [ ] Document each error + recovery path
- [ ] Test all error scenarios
- [ ] Add monitoring/alerts for 500 errors

---

### **4. Performance Targets**

**Must be met or execution plan delays**:

| Operation  | Target | Measurement | Pass Criteria |
| ---------- | ------ | ----------- | ------------- |
| classify   | <5s    | P95 latency | 4.2s ✅       |
| generate   | <20s   | P95 latency | 18.5s ✅      |
| override   | <2s    | P95 latency | 1.8s ✅       |
| end-to-end | <30s   | P95 latency | 28.3s ✅      |

**How to ensure**:

- [ ] Measure early + often (daily checkpoints)
- [ ] Profile bottlenecks immediately
- [ ] Add caching where appropriate (SVG library)
- [ ] Load test with 10-20 concurrent users

---

### **5. Zero Regressions**

**Phase A must continue working unchanged**:

```bash
npm --prefix server run test:run ✅ 413/413 passing (existing)
npm --prefix client run test ✅ 457/457 passing (existing)
```

**How to ensure**:

- [ ] Run full test suite daily (before any merge)
- [ ] CI/CD gates on test passing
- [ ] Manual smoke test of Phase A flow daily
- [ ] Monitor error rates in production

---

## **Communication & Escalation**

### **Daily Standups** (15 min, 9am)

**Participants**: Backend lead, Frontend lead, QA lead, PM

**Agenda**:

1. Yesterday's completion status
2. Today's blockers
3. Checkpoint readiness

**Format**:

```
Backend: "API /classify + classifyPrompt() complete ✅. No blockers. Ready for checkpoint."
Frontend: "StateManager + API client complete ✅. Using mocks for /api/classify. On track."
QA: "Unit tests passing. Integration testing ready after both phases complete."
PM: "Timeline on track. No scope changes."
```

---

### **Checkpoint Reviews** (30 min, 5pm)

**Participants**: Backend lead, Frontend lead, QA lead, tech lead, PM

**Checklist**:

- [ ] All deliverables complete?
- [ ] All tests passing?
- [ ] Any blockers for next phase?
- [ ] Performance targets on track?
- [ ] Any scope adjustments needed?

**Format**:

```
CHECKPOINT 1 (EOD Day 1)
✅ Backend: /api/classify endpoint working
✅ Frontend: StateManager + GenerateFlow ready
✅ Tests: 25 new backend tests passing, 413 existing tests passing
✅ Decision: Proceed to Day 2 Phase 2 without changes
```

---

### **Escalation Path**

**If blockers identified**:

1. **First response** (same day): Standup team discusses solution
2. **If unresolved** (next AM): Escalate to tech lead / architect
3. **If still blocked** (10am): Emergency sync with full team

**Examples**:

- "LLM API unavailable" → Use rule engine only, defer LLM phase
- "Performance target missed" → Identify bottleneck, optimize, retest
- "Scope creep identified" → Park feature, proceed with Phase A-B as-is

---

## **Risk Mitigation**

### **Risk 1: Backend Phase 1 Not Complete By EOD Day 1**

**Likelihood**: Low (only 6 hours of work)  
**Impact**: High (blocks Frontend Phase 2 integration)

**Mitigation**:

- [ ] Pre-work: Verify all Phase A-B utilities present + tested
- [ ] Clear blocking dependencies (none should exist)
- [ ] Have backup engineer assigned
- [ ] If behind: defer Phase 1.5 (enhance process()) to Day 2 morning

**Contingency**: Frontend continues with mocked /api/classify responses

---

### **Risk 2: Performance Targets Missed**

**Likelihood**: Medium (LLM API latency unpredictable)  
**Impact**: Medium (may need optimization)

**Mitigation**:

- [ ] Measure early + often (Day 2, not Day 3)
- [ ] Profile bottlenecks immediately
- [ ] Have optimization plan ready (caching, batching, etc.)
- [ ] Fallback: use rule engine only (lower confidence, <10ms)

**Contingency**: Extend timeline by 1 day for optimization

---

### **Risk 3: Frontend Components Blocked on Backend Response Schema**

**Likelihood**: Low (API contract locked at Checkpoint 0)  
**Impact**: High (can't complete Phase 2)

**Mitigation**:

- [ ] Use mock API responses for frontend development
- [ ] Create TypeScript interfaces from API contract
- [ ] Frontend can test against mocks until backend ready
- [ ] Swap mocks for real API once backend ready (no code changes)

**Contingency**: Frontend uses mocks for full Phase 2 development

---

### **Risk 4: Integration Testing Reveals API Contract Mismatch**

**Likelihood**: Low (both teams review contract together)  
**Impact**: High (must fix before launch)

**Mitigation**:

- [ ] Lock API contract at Checkpoint 0 (both leads sign off)
- [ ] Any changes must go through both leads
- [ ] Add contract tests (JSON schema validation)
- [ ] Test integration early (Day 2, not Day 3)

**Contingency**: Fix contract issue + retest (1-2 hours)

---

## **Success Metrics: Post-Launch Monitoring**

### **Week 1 Dashboard**

Track these metrics to ensure Phase A-B healthy:

| Metric                  | Target | Good   | OK      | Bad  |
| ----------------------- | ------ | ------ | ------- | ---- |
| Classification accuracy | >80%   | >85%   | 75-85%  | <75% |
| LLM fallback rate       | <20%   | <15%   | 15-20%  | >20% |
| PDF generation success  | >99%   | >99.5% | 98-99%  | <98% |
| Classify latency (p95)  | <5s    | <4s    | 4-5s    | >5s  |
| Generate latency (p95)  | <20s   | <18s   | 18-20s  | >20s |
| Override latency (p95)  | <2s    | <1.5s  | 1.5-2s  | >2s  |
| Error rate              | <1%    | <0.5%  | 0.5-1%  | >1%  |
| User satisfaction       | >4/5   | >4.5/5 | 3.5-4.5 | <3.5 |

**Action if metric goes bad**:

- [ ] Investigate root cause (error logs, profiling)
- [ ] Post incident review + fix
- [ ] Monitor for recurrence
- [ ] Update playbook

---

## **Document Control**

| Version | Date       | Status   | Notes                                              |
| ------- | ---------- | -------- | -------------------------------------------------- |
| 1.0     | 2025-11-18 | 🟢 READY | Parallel implementation roadmap with 3 checkpoints |

---

## **Related Documents**

- `ORCHESTRATOR_ARCHITECTURE.md` - Backend architecture + integration points
- `PHASE_A-B_INTEGRATION_CHECKLIST.md` - Backend implementation details
- `BACKEND_MODULARITY_ARCHITECTURE.md` - Module specifications + testing
- `FRONTEND_BACKEND_INTEGRATION_SPEC.md` - API contracts + component bindings
- `FRONTEND_PROGRESSIVE_DISCLOSURE_ARCHITECTURE.md` - Frontend state machine

---

**Status**: 🟢 **READY TO EXECUTE** — Parallel teams can start immediately with synchronized checkpoints

**Next Action**: Checkpoint 0 alignment kickoff (1 hour, tomorrow morning)

**Timeline**:

- Day 1 (8h): Backend Phase 1 + Frontend Phase 1 → Checkpoint 1
- Day 2 (8h): Backend + Frontend Phase 2 → Checkpoint 2
- Day 3 (6h): Backend + Frontend Phase 3 + QA Integration/E2E → Checkpoint 3
- Day 4 (2h): Launch + monitoring

**Total**: 3-4 calendar days, 24 engineering hours distributed

---

**END OF PARALLEL IMPLEMENTATION ROADMAP**
