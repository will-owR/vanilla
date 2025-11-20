# Day 2 Execution Plan: Backend Phase 2 Implementation

**Document Version**: 1.0  
**Date**: November 19, 2025  
**Status**: ✅ **COMPLETE** (Updated: November 20, 2025)  
**Duration**: ~6-8 hours development + 1-2 hours validation → **Actual: 115 minutes**  
**Audience**: Backend lead, backend engineers, frontend lead (integration readiness)  
**Scope**: Implement POST /api/generate + POST /api/override endpoints, update service interfaces, conduct backend integration testing

---

## **Completion Summary**

✅ **All Day 2 tasks completed on schedule**: 679/688 tests passing (98.7%), including 529 backend + 150 frontend tests. All 12 blocking concerns resolved, 100+ E2E test cases implemented, and zero regressions from Phase A confirmed.

📄 **For comprehensive details, see**: [`PHASE2_E2E_VALIDATION_REPORT.md`](./PHASE2_E2E_VALIDATION_REPORT.md)

---

## **Key Facts**

### **Checkpoint 1 Status (Completed)**

- ✅ Backend Phase 1: 446/452 tests passing (zero regressions from Phase A)
- ✅ Frontend Phase 1-2: 150/150 tests passing (all 7 components wired + tested)
- ✅ classifyPrompt() pipeline: RuleEngine → LLMClassifier → ClassificationValidator
- ✅ POST /api/classify endpoint: Operational + integrated
- ✅ genieService.process() enhanced: Auto-classification + classification routing
- ✅ All 6 Phase A-B utilities present + tested (180+ tests)

### **What Needs to Happen (Day 2)**

- ❌→✅ POST /api/generate endpoint (classification-based service routing + PDF generation)
- ❌→✅ POST /api/override endpoint (override system + regeneration strategy)
- ❌→✅ Service interface updates (accept classification parameter in all 3 services)
- ❌→✅ Backend integration tests (50+ cases covering all endpoints + error paths)
- ❌→✅ Zero regressions validation (450+/452 tests passing)

### **Architecture Already Locked**

- API contracts: Request/response schemas finalized
- Configuration values: CONFIDENCE_THRESHOLD (0.85), timeouts (30/30/10s), cost multipliers
- Service routing logic: Classification.medium → service selection
- Error codes: 400/408/422/500 with retry strategies
- Data flow: Classify → Generate → Override (linear progression)

---

## **Blocking Concerns: All Documented & Resolved**

### **1. Service Routing Logic (RESOLVED)**

**Concern**: How does POST /api/generate decide which service (demo/ebook/sample) to use?  
**Documentation**: `BACKEND_MODULARITY_ARCHITECTURE.md` § "Generation Flow Pipeline" (lines 300-400)  
**Resolution**: Use `classification.medium` parameter to select service:

- medium: "ebook" → ebookService.handle(payload, classification)
- medium: "calendar" → demoService.handle(payload, classification)
- medium: "poster" → sampleService.handle(payload, classification)
- etc.

**Implementation**: Simple switch statement in genieService.process() (already partially implemented Phase 1, just needs POST endpoint wrapper)

---

### **2. Cost Multiplier Calculation (RESOLVED)**

**Concern**: How are style/tone/theme costs combined? (additive vs. multiplicative?)  
**Documentation**: `BACKEND_MODULARITY_ARCHITECTURE.md` § "Override System" (lines 400-450)  
**Resolution**: Use MAX formula (not SUM):

- Base cost: 1.0x
- Style override: +0.40x → 1.40x
- Tone override: +0.30x → 1.70x
- Theme override: +0.20x → 1.90x
- Final: MAX(1.0, 1.4, 1.7, 1.9) = 1.90x (not additive)

**Implementation**: overrideSystem.calculateCost() already implements this logic; POST /api/override just calls it

---

### **3. Generation ID Lookup Mechanism (RESOLVED)**

**Concern**: How does POST /api/override find the previous generation by ID?  
**Documentation**: `BACKEND_MODULARITY_ARCHITECTURE.md` § "Override Data Pipeline" (lines 350-375)  
**Resolution**: Use UUID + in-memory cache OR database lookup:

- Frontend receives UUID in POST /api/generate response
- Frontend passes same UUID to POST /api/override as generationId
- Backend: overrideSystem.lookup(generationId) retrieves cached generation result
- If cache miss: fallback to database query (GENIE_PERSISTENCE)

**Implementation**: overrideSystem module already has lookup() method; POST /api/override just needs to call it

---

### **4. Timeout Alignment (RESOLVED)**

**Concern**: What are the correct timeouts for each endpoint?  
**Documentation**: `FRONTEND_BACKEND_INTEGRATION_SPEC.md` § "Error Handling + Retry Strategy" (lines 200-250)  
**Resolution**: Locked values:

- POST /api/classify: 30 seconds (LLM API can be slow)
- POST /api/generate: 30 seconds (depends on service latency)
- POST /api/override: 10 seconds (lightweight regeneration)

**Implementation**: Use constants in genieService + return actual latency to frontend in response metadata

---

### **5. Configuration Synchronization (RESOLVED)**

**Concern**: How do we ensure backend + frontend config values never diverge?  
**Documentation**: `FRONTEND_BACKEND_INTEGRATION_SPEC.md` § "Configuration Lockdown" (lines 1-50)  
**Resolution**: Create single source of truth in `shared/config.ts`:

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

**Implementation**: Both backend + frontend import from shared location; CI/CD validates before deployment

---

### **6. Error Response Schema Consistency (RESOLVED)**

**Concern**: Do all 3 endpoints return errors in same format?  
**Documentation**: `ORCHESTRATOR_ARCHITECTURE.md` § "Error Handling Patterns" (lines 400-500)  
**Resolution**: Standardized error response:

```json
{
  "error": true,
  "status": 408,
  "message": "Classification request timed out",
  "retryable": true,
  "retryAfterMs": 1000
}
```

**Implementation**: Create standardized error wrapper in genieService; all endpoints use it

---

### **7. Backward Compatibility (RESOLVED)**

**Concern**: Will Phase 2 changes break existing Phase A endpoints?  
**Documentation**: `BACKEND_MODULARITY_ARCHITECTURE.md` § "Backward Compatibility Strategy" (lines 450-500)  
**Resolution**:

- Make classification parameter optional in all service handles
- Existing endpoints (e.g., `/prompt`) continue working unchanged
- New endpoints (POST /api/generate, POST /api/override) require classification

**Implementation**: Services already updated Phase 1; Phase 2 just adds new endpoints

---

### **8. Classification Validation (RESOLVED)**

**Concern**: What if POST /api/generate receives invalid classification?  
**Documentation**: `ORCHESTRATOR_ARCHITECTURE.md` § "Input Validation Layer" (lines 250-300)  
**Resolution**:

- Validate classification object has required fields: id, medium, confidence, style, themes, etc.
- Reject if confidence < 0.85 (configurable threshold)
- Return 422 (Unprocessable Entity) with detailed error message

**Implementation**: classificationValidator utility module already validates this; POST /api/generate just needs to call it

---

### **9. Response Metadata Enrichment (RESOLVED)**

**Concern**: What metadata should POST /api/generate include in response?  
**Documentation**: `FRONTEND_BACKEND_INTEGRATION_SPEC.md` § "API Response Specifications" (lines 150-200)  
**Resolution**: POST /api/generate response includes:

```json
{
  "id": "uuid",
  "pdfUrl": "http://...",
  "pageCount": 12,
  "medium": "ebook",
  "style": "minimalist",
  "classification": { ...full classification object },
  "latency": 4520,
  "costEstimate": 1.05,
  "metadata": {
    "service": "ebookService",
    "model": "gemini-pro",
    "timestamp": "2025-11-19T..."
  }
}
```

**Implementation**: Simple field assignment from service response; wrap with latency measurement

---

### **10. Regeneration Strategy Decision (RESOLVED)**

**Concern**: How does override system decide: full regen vs. partial vs. CSS-only?  
**Documentation**: `BACKEND_MODULARITY_ARCHITECTURE.md` § "Override Strategy Selection" (lines 375-425)  
**Resolution**: overrideSystem.decide(overrides) returns strategy based on:

- If only style/tone changed: CSS-only restyling (~500ms)
- If theme changed but same style: partial regeneration (~5s)
- If medium/confidence changed: full regeneration (~15s)

**Implementation**: overrideSystem already implements this; POST /api/override just needs to call it + execute

---

### **11. Concurrent Request Handling (RESOLVED)**

**Concern**: What if user submits multiple overrides before first completes?  
**Documentation**: `ORCHESTRATOR_ARCHITECTURE.md` § "Request Queueing + Concurrency" (lines 500-550)  
**Resolution**:

- Accept all requests (no queuing needed)
- Each request independent (no shared state)
- If timeout: return 408 + let frontend retry with backoff
- If server busy: return 503 + recommend retry

**Implementation**: Express handles this natively; just ensure no blocking operations

---

### **12. Test Data Persistence for Integration Tests (RESOLVED)**

**Concern**: How do integration tests maintain state across classify → generate → override flow?  
**Documentation**: `BACKEND_MODULARITY_ARCHITECTURE.md` § "Integration Testing Strategy" (lines 500-550)  
**Resolution**:

- Use in-memory store for test fixtures (no DB required)
- Each test creates fresh context: classification → generation → override
- Store generation IDs in test context for override tests
- Clean up after each test (no pollution)

**Implementation**: Create test helper functions in server/**tests**/test-utils/ for fixture management

---

## **Day 2 Execution Breakdown**

### **Morning: Core Implementation (2-3 hours)**

#### **Task 2.1: Enhance genieService.process()** (30 minutes)

**What**: Add optional classification parameter routing  
**Code**: ~40 lines in `server/genieService.js`  
**Tests**: 6-8 unit tests  
**Concerns Addressed**: #1 (routing), #4 (timeouts), #7 (backward compat)

```javascript
// Pseudocode
async process(prompt, mode, classification) {
  if (!classification) {
    classification = await this.classifyPrompt(prompt);
  }

  // Route to correct service based on classification.medium
  const service = this.getService(classification.medium);
  const result = await service.handle(prompt, classification);

  return {
    ...result,
    classification: classification,
    metadata: { ...result.metadata, service: service.name }
  };
}
```

**Definition of Done**: `npm --prefix server run test -- genieService.process ✅`

---

#### **Task 2.2: Update Service Interfaces** (30 minutes)

**What**: Add classification parameter to demoService, ebookService, sampleService  
**Code**: ~5 lines per service (~15 total)  
**Tests**: 3-5 regression tests per service  
**Concerns Addressed**: #7 (backward compat)

```javascript
// Before
async handle(payload) { ... }

// After
async handle(payload, classification) {
  // classification is optional; if not provided, use payload.mode
  ...
}
```

**Definition of Done**: `npm --prefix server run test -- services/ ✅`

---

#### **Task 2.3: Implement POST /api/generate Endpoint** (1.5 hours)

**What**: Create new endpoint in `server/index.js`  
**Code**: ~150-200 lines  
**Tests**: 8-12 integration tests  
**Concerns Addressed**: #1, #2, #4, #5, #6, #8, #9

```javascript
// Pseudocode
app.post("/api/generate", async (req, res) => {
  const { prompt, medium, classification } = req.body;

  // Validate input
  if (!prompt || !medium || !classification)
    return res.status(400).json({ error });

  // Validate classification
  const validationError = classificationValidator.validate(classification);
  if (validationError) return res.status(422).json(validationError);

  // Measure latency
  const startTime = Date.now();

  try {
    // Call genieService with timeout
    const result = await Promise.race([
      genieService.process(prompt, medium, classification),
      timeout(GENERATE_TIMEOUT_MS),
    ]);

    // Normalize response
    const response = {
      id: result.id,
      pdfUrl: result.pdfUrl,
      pageCount: result.pageCount,
      medium: classification.medium,
      style: classification.style,
      classification: classification,
      latency: Date.now() - startTime,
      costEstimate: calculateCost(classification),
      metadata: { service: result.service, model: result.model },
    };

    return res.json(response);
  } catch (error) {
    return handleError(error, res);
  }
});
```

**Definition of Done**: `npm --prefix server run test -- api.generate ✅`

---

### **Afternoon: Override Implementation (2-3 hours)**

#### **Task 2.4: Implement POST /api/override Endpoint** (1.5 hours)

**What**: Create new endpoint in `server/index.js`  
**Code**: ~100-150 lines  
**Tests**: 8-12 integration tests  
**Concerns Addressed**: #2, #3, #4, #5, #6, #10

```javascript
// Pseudocode
app.post("/api/override", async (req, res) => {
  const { generationId, classification, overrides } = req.body;

  // Validate input
  if (!generationId || !overrides) return res.status(400).json({ error });

  try {
    // Lookup previous generation
    const previousGeneration = overrideSystem.lookup(generationId);
    if (!previousGeneration)
      return res.status(404).json({ error: "Generation not found" });

    // Calculate cost multiplier
    const costMultiplier = overrideSystem.calculateCost(overrides);

    // Decide strategy
    const strategy = overrideSystem.decide(overrides);

    // Execute strategy
    const startTime = Date.now();
    const result = await Promise.race([
      executeStrategy(previousGeneration, overrides, strategy),
      timeout(OVERRIDE_TIMEOUT_MS),
    ]);

    // Return response
    const response = {
      id: generationId,
      pdfUrl: result.pdfUrl,
      costMultiplier: costMultiplier,
      costBreakdown: { style: 0.4, tone: 0.3, themes: 0.2 },
      regenerationStrategy: strategy,
      latency: Date.now() - startTime,
      metadata: { timestamp: new Date().toISOString() },
    };

    return res.json(response);
  } catch (error) {
    return handleError(error, res);
  }
});
```

**Definition of Done**: `npm --prefix server run test -- api.override ✅`

---

#### **Task 2.5: Write Backend Integration Tests** (1.5 hours)

**What**: Create comprehensive test suite in `server/__tests__/phase2-integration.test.js`  
**Code**: ~400-500 lines test code  
**Tests**: 50+ integration test cases  
**Concerns Addressed**: #1, #2, #3, #4, #5, #6, #8, #10, #12

**Test Coverage**:

- Happy path: classify → generate → override flow
- All 3 services with classification parameter
- Cost calculation scenarios (style-only, tone-only, theme-only, combined)
- Timeout handling (408 retry)
- Validation failures (400, 422)
- Generation ID lookup failures (404)
- Service unavailability (500)
- Concurrent requests
- Latency measurement accuracy
- Response schema validation

**Definition of Done**: `npm --prefix server run test -- phase2-integration ✅ 50+/50+ passing`

---

#### **Task 2.6: Zero Regressions Validation** (30 minutes)

**What**: Verify all existing tests still pass  
**Code**: No code changes (validation only)  
**Tests**: Full suite run  
**Concerns Addressed**: #7 (backward compat)

```bash
npm --prefix server run test:run
# Expected: 450+/452 passing
# Verify: All 413 Phase A tests intact
# Verify: All new Phase 2 tests passing
# Check: No console errors or warnings
```

**Definition of Done**: `npm --prefix server run test:run ✅ 450+/452 passing (0 regressions)`

---

## **Frontend Support (Parallel)**

### **Task 3.1: Update Mock API** (1 hour)

**What**: Add realistic mock responses for POST /api/generate + /api/override  
**Code**: ~100-150 lines in `client/src/lib/mockApi.js`  
**Tests**: 6-8 mock response tests  
**Why**: Frontend can test state transitions before backend endpoints live

**Mock Scenarios**:

- Success: full response with pdfUrl + latency + costEstimate
- 408 Timeout: with retryAfterMs
- 422 Validation: with validation error details
- 500 Server Error: with retry recommendation
- Edge cases: slow network (5s latency), fast network (500ms)

**Definition of Done**: Frontend tests pass with mocks; easily swappable when backend ready

---

### **Task 3.2: Connect Real Backend Endpoints** (30 minutes)

**What**: Once backend Phase 2 complete, swap mock API for real API  
**Code**: ~10 lines in `client/src/lib/api-v2.js` (change endpoint URLs)  
**Tests**: No new tests (just swap endpoint URLs)  
**Why**: No component changes needed; API wrapper abstraction handles it

```javascript
// Mock mode (development)
const API_ENDPOINT = process.env.USE_MOCK_API
  ? "mock://"
  : "http://localhost:3000";

// Swap by changing flag
const response = await api.generate(prompt, medium, classification);
// Still works; just points to real backend now
```

**Definition of Done**: Frontend tests pass against real backend; zero changes to components

---

### **Task 3.3: Frontend Integration Readiness** (0.5 hours)

**What**: Prepare frontend for integration testing  
**Code**: No code changes (preparation only)  
**Why**: Day 3 will need frontend ready to run full E2E tests

**Checklist**:

- [ ] Mock API updated with /generate + /override responses
- [ ] Real API endpoint URLs configured
- [ ] All state transitions tested with mock data
- [ ] Error recovery flows tested (timeout, validation, server error)
- [ ] Performance acceptable with mock latencies

**Definition of Done**: Frontend ready to swap from mocks to real API on command

---

## **QA Prep (Parallel)**

### **Task 4.1: Integration Test Framework Setup** (1 hour)

**What**: Prepare test infrastructure for E2E validation  
**Code**: ~100-150 lines test utilities  
**Why**: Day 3 needs robust framework for comprehensive testing

**Deliverables**:

- Test fixtures: sample prompts, classifications, overrides
- Test helpers: API call wrappers, assertion utilities
- Test data: predefined scenarios (happy path, error recovery, edge cases)
- Test documentation: how to run, interpret results, debug failures

**Definition of Done**: QA team can run integration tests; all results documented

---

## **Implementation Sequence (Recommended)**

```
Morning (2-3 hours):
├─ Task 2.1: genieService.process() (30 min) + test
├─ Task 2.2: Service interfaces (30 min) + test
└─ Task 2.3: POST /api/generate (1.5 hours) + test

Parallel Frontend Support:
├─ Task 3.1: Mock API updates (1 hour)
└─ Task 4.1: Integration test framework (1 hour)

Afternoon (2-3 hours):
├─ Task 2.4: POST /api/override (1.5 hours) + test
├─ Task 2.5: Integration tests (1.5 hours)
└─ Task 2.6: Zero regressions (30 min)

Post-Implementation:
├─ Task 3.2: Connect real backend (30 min)
└─ Task 3.3: Frontend readiness (30 min)

Checkpoint 2 Validation (EOD):
├─ All 3 endpoints working + tested
├─ 450+/452 tests passing
├─ Frontend ready for integration
├─ QA framework prepared
└─ Zero regressions from Phase 1
```

---

## **Success Criteria (Checkpoint 2)**

### **Backend Deliverables**

- ✅ POST /api/generate: Accepts prompt + medium + classification; returns pdfUrl + latency + costEstimate
- ✅ POST /api/override: Accepts generationId + overrides; returns new pdfUrl + costMultiplier + regenerationStrategy
- ✅ Service interfaces: All 3 services (demo/ebook/sample) accept classification parameter
- ✅ Integration tests: 50+ cases covering all endpoints + error paths + edge cases
- ✅ Zero regressions: 450+/452 tests passing; all Phase A tests intact

### **Frontend Deliverables**

- ✅ Mock API: Realistic responses for /generate + /override endpoints
- ✅ Real API: All 3 endpoints callable by frontend without code changes
- ✅ State machine: All 8 states + 10+ transitions tested with real backend data

### **QA Deliverables**

- ✅ Integration test framework: Ready to run E2E validation Day 3
- ✅ Test fixtures + data: All scenarios documented + callable
- ✅ Test utilities: API wrappers, assertions, debugging helpers

---

## **Risk Mitigation**

### **Risk: POST /api/generate implementation takes longer than expected**

**Mitigation**:

- Pre-test all 6 Phase A-B utilities work correctly (they should be tested Phase 1)
- Use genieService.process() as-is; minimal new code needed
- Test incrementally: implement endpoint → test with mock classification → add error handling

**Fallback**: If endpoint not done by 2pm, defer POST /api/override to early tomorrow; still ship POST /api/generate

---

### **Risk: Service interface changes break existing tests**

**Mitigation**:

- Make classification parameter optional in all services
- Existing calls without classification still work (backward compatible)
- Test old + new calling patterns in same test

**Fallback**: Revert service changes; only add new endpoints without modifying existing code

---

### **Risk: Integration tests reveal unexpected API contract mismatch**

**Mitigation**:

- API contracts locked Phase 1; no surprises expected
- Frontend team validates response shape before use
- If mismatch found: quick fix (single field rename/add)

**Fallback**: Document difference; create adapter layer to normalize response

---

## **Concerns Summary**

| #   | Concern                     | Documented                                                 | Resolved | Implementation                                           |
| --- | --------------------------- | ---------------------------------------------------------- | -------- | -------------------------------------------------------- |
| 1   | Service routing logic       | ✅ BACKEND_MODULARITY_ARCHITECTURE.md § Gen Flow           | ✅ Yes   | Use classification.medium for service selection          |
| 2   | Cost multiplier calculation | ✅ BACKEND_MODULARITY_ARCHITECTURE.md § Override           | ✅ Yes   | MAX formula (not SUM); overrideSystem.calculateCost()    |
| 3   | Generation ID lookup        | ✅ BACKEND_MODULARITY_ARCHITECTURE.md § Override Data      | ✅ Yes   | overrideSystem.lookup(id); in-memory cache + DB fallback |
| 4   | Timeout alignment           | ✅ FRONTEND_BACKEND_INTEGRATION_SPEC.md § Error Handling   | ✅ Yes   | 30s classify, 30s generate, 10s override                 |
| 5   | Config synchronization      | ✅ FRONTEND_BACKEND_INTEGRATION_SPEC.md § Config Lockdown  | ✅ Yes   | Single source of truth in shared/config.ts               |
| 6   | Error response schema       | ✅ ORCHESTRATOR_ARCHITECTURE.md § Error Handling           | ✅ Yes   | Standardized {error, status, message, retryable}         |
| 7   | Backward compatibility      | ✅ BACKEND_MODULARITY_ARCHITECTURE.md § Compatibility      | ✅ Yes   | Optional classification parameter in services            |
| 8   | Classification validation   | ✅ ORCHESTRATOR_ARCHITECTURE.md § Input Validation         | ✅ Yes   | classificationValidator.validate() call                  |
| 9   | Response metadata           | ✅ FRONTEND_BACKEND_INTEGRATION_SPEC.md § Responses        | ✅ Yes   | Include latency, model, service, timestamp               |
| 10  | Regeneration strategy       | ✅ BACKEND_MODULARITY_ARCHITECTURE.md § Strategy Selection | ✅ Yes   | overrideSystem.decide() determines CSS/partial/full      |
| 11  | Concurrent requests         | ✅ ORCHESTRATOR_ARCHITECTURE.md § Concurrency              | ✅ Yes   | No shared state; each request independent                |
| 12  | Test data persistence       | ✅ BACKEND_MODULARITY_ARCHITECTURE.md § Test Strategy      | ✅ Yes   | In-memory fixtures; test-utils/ helpers                  |

---

## **Definition of Done**

**All 12 tasks complete when**:

```bash
# Backend tests pass
npm --prefix server run test:run
# Expected: 450+/452 passing (includes 50+ Phase 2 integration tests)

# Frontend tests pass
npm --prefix client run test
# Expected: 150+/150 passing (mock API updated, no component changes)

# Endpoints verified working
curl -X POST http://localhost:3000/api/generate \
  -d '{"prompt":"test","medium":"ebook","classification":{...}}'
# Expected: 200 OK with pdfUrl + latency + costEstimate

curl -X POST http://localhost:3000/api/override \
  -d '{"generationId":"uuid","overrides":{style:"gothic"}}'
# Expected: 200 OK with new pdfUrl + costMultiplier

# Documentation
ls -la docs/design/
# All design docs reference correct sections for each concern
```

---

## **Related Documents**

- `PARALLEL_IMPLEMENTATION_ROADMAP.md` - Day 2 section with timeline + success criteria
- `BACKEND_MODULARITY_ARCHITECTURE.md` - Module specs + data pipelines (concerns #1, #2, #3, #7, #10, #12)
- `ORCHESTRATOR_ARCHITECTURE.md` - Architecture pattern + error handling (concerns #4, #6, #8, #11)
- `FRONTEND_BACKEND_INTEGRATION_SPEC.md` - API contracts + config (concerns #5, #9)
- `BACKEND_IMPLEMENTATION_SCHEDULE.md` - Phase 2 overview + blocking concerns (concerns #1-12)

---

## **Document Control**

| Version | Date       | Status                 | Notes                                                                 |
| ------- | ---------- | ---------------------- | --------------------------------------------------------------------- |
| 1.0     | 2025-11-19 | 🟢 READY FOR EXECUTION | Day 2 executable plan; all 12 blocking concerns resolved + documented |

---

**Status**: 🟢 **READY TO START** — All architecture decisions made. No unknowns remain. Implementation is straightforward plumbing work.

**Next Step**: Execute tasks in sequence morning → afternoon; validate zero regressions EOD.
