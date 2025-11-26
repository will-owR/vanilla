# Frontend Lead Quick Reference: Checkpoint 0 Alignment

**TL;DR Version** of Frontend Lead responsibilities during alignment kickoff

---

## **Your 3 Main Tasks (1 hour total)**

### **1️⃣ READ 3 DOCUMENTS**

| Document                                                 | What to Understand                            | Key Takeaway                                          |
| -------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| FRONTEND_PROGRESSIVE_DISCLOSURE_ARCHITECTURE.md          | 8-state machine                               | User sees UI progressively as they advance            |
| FRONTEND_BACKEND_INTEGRATION_SPEC.md § State-to-API      | When state changes, which API endpoint called | MEDIUM_SELECTED→GENERATING calls /api/classify        |
| FRONTEND_BACKEND_INTEGRATION_SPEC.md § Component Binding | Which component gets which data from backend  | ClassificationFeedback receives classification object |

**Checklist**:

- [ ] Understand 8 states: INITIAL → ... → COMPLETE
- [ ] Understand 10+ state transitions
- [ ] Understand 3 API endpoints: /api/classify, /api/generate, /api/override

---

### **2️⃣ LOCK 7 CONFIGURATION VALUES**

Create `client/src/lib/config.js` with these values (MUST match backend):

```javascript
CONFIDENCE_THRESHOLD = 0.85; // Auto-accept if >= 85%
COST_MULTIPLIER_MEDIUM = 1.0; // Full regeneration
COST_MULTIPLIER_STYLE = 0.4; // Style change +40%
COST_MULTIPLIER_COLOR = 0.05; // Color change +5%
CLASSIFY_TIMEOUT_MS = 30000; // 30 seconds
GENERATE_TIMEOUT_MS = 30000; // 30 seconds
OVERRIDE_TIMEOUT_MS = 10000; // 10 seconds

SUPPORTED_MEDIA = ["ebook", "calendar", "poster", "stickers", "card"];
SUPPORTED_STYLES = ["minimalist", "gothic", "abstract", "retro", "modern"];
```

**NO CHANGES during Phase 1-2 implementation!**

---

### **3️⃣ VERIFY 3 API REQUEST SCHEMAS**

| Endpoint      | Request                                     | Response                                                                           |
| ------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| /api/classify | `{prompt, selectedMedium}`                  | `{id, medium, confidence, style, themes, audience, genre, tone, source, metadata}` |
| /api/generate | `{prompt, medium, classification}`          | `{id, pdfUrl, pageCount, latency, costEstimate}`                                   |
| /api/override | `{generationId, classification, overrides}` | `{id, pdfUrl, costMultiplier, costBreakdown}`                                      |

---

## **State Machine (Memorize This)**

```
INITIAL
  ↓ [user picks medium]
MEDIUM_SELECTED
  ↓ [user enters prompt]
PROMPT_ENTERED
  ↓ [user clicks Generate] → /api/classify
GENERATING
  ↓ [got classification response]
CLASSIFICATION_READY (if confidence < 85%)
  ├─ [user clicks Accept] → /api/generate → RESULT_READY
  └─ [user clicks Override] → OVERRIDE_ACTIVE
      ↓ [user picks styles]
      ↓ [user clicks Apply] → /api/override → RESULT_READY
RESULT_READY
  ├─ [user clicks Customize] → OVERRIDE_ACTIVE
  └─ [user clicks Export] → COMPLETE
COMPLETE
  ↓ [user clicks New] → INITIAL (reset)
```

---

## **12 Components You'll Build**

| #     | Component                            | Built By   | Purpose                               |
| ----- | ------------------------------------ | ---------- | ------------------------------------- |
| 1     | GenerateFlow                         | You (Lead) | Orchestrator & state machine          |
| 2-3   | StateManager + API client            | You (Lead) | Infrastructure                        |
| 4-5   | Mock API + Config                    | You (Lead) | Testing support                       |
| 6-7   | MediaSelector + PromptInput          | FE Eng 1   | User input                            |
| 8     | ClassificationFeedback               | FE Eng 2   | Show classification + accept/override |
| 9-10  | ResultsDisplay + StatsPanel          | FE Eng 2   | Show PDF + metadata                   |
| 11-12 | OverrideControls + CostVisualization | FE Eng 2   | Customization UI                      |

**Status**: ✅ All 12 components are **implemented & tested** as of Nov 19!

---

## **Sign-Off Checklist**

Print this and have both leads sign:

```
FRONTEND LEAD CHECKLIST:

☐ Have read FRONTEND_PROGRESSIVE_DISCLOSURE_ARCHITECTURE.md
☐ Have read FRONTEND_BACKEND_INTEGRATION_SPEC.md (all sections)
☐ Understand 8-state machine
☐ Understand 10+ state transitions
☐ Created client/src/lib/config.js with locked values
☐ Verified all 3 API request/response schemas
☐ Written test for config synchronization
☐ Catalogued 12 components + ownership

Signature: _________________________ Date: __________

BACKEND LEAD COUNTERSIGN:

☐ Configuration values verified (match backend exactly)
☐ API request schemas verified (backend will accept)
☐ API response schemas verified (frontend will receive)

Signature: _________________________ Date: __________

PROJECT MANAGER APPROVAL:

Proceed to Phase 1 implementation? ☐ YES / ☐ NO

Signature: _________________________ Date: __________
```

---

## **Next Steps: Phase 1 (After Checkpoint 0)**

**Timeline**: 6 hours (parallel with Backend Phase 1)

**Your Tasks** (Frontend Lead):

1. Task 1.1: Create StateManager store (1.5h)

   - 8 states + 10+ transitions
   - Svelte store with setState(), setClassification(), setResult()
   - 13 unit tests

2. Task 1.2: Create API client (1.5h)

   - classify(), generate(), override() functions
   - Timeout handling + error recovery
   - 14 unit tests

3. Task 1.3: Create GenerateFlow orchestrator (2h)

   - Event handlers + state transitions
   - Error handling + retry logic
   - 13 unit tests

4. Task 1.4: Create Mock API (1.5h)

   - Realistic responses for testing
   - Error injection ([error], [timeout] keywords)
   - 13 unit tests

5. Task 1.5: Zero regressions (1h)
   - Run full test suite
   - Verify 457+ existing tests still pass
   - No breaking changes

**Success Criteria**:

- 60+ new tests passing
- 457 existing tests passing
- All configuration values accessible to Phase 2 engineers

---

## **Common Gotchas**

❌ **Don't**: Change configuration values during implementation  
✅ **Do**: Use locked values as source of truth

❌ **Don't**: Assume backend will return different schema than spec  
✅ **Do**: Test against the exact schemas from FRONTEND_BACKEND_INTEGRATION_SPEC.md

❌ **Don't**: Build components before StateManager + API client  
✅ **Do**: Build infrastructure first (Phase 1), then components plug in

❌ **Don't**: Skip mock API — you need it for testing  
✅ **Do**: Build mock responses that match backend schemas exactly

---

## **File Locations**

**Create these files**:

- `client/src/lib/config.js` — Configuration lockdown
- `client/src/lib/api-v2.js` — API client wrapper
- `client/src/lib/mockApi.js` — Mock responses for testing
- `client/src/lib/stores/flowStore.js` — StateManager
- `client/src/components/GenerateFlow-v2.svelte` — Orchestrator
- Component files (Phase 2)

**Read these docs**:

- `/workspaces/strawberry/docs/design/PARALLEL_IMPLEMENTATION_ROADMAP.md`
- `/workspaces/strawberry/docs/design/phaseAB/FRONTEND_PROGRESSIVE_DISCLOSURE_ARCHITECTURE.md`
- `/workspaces/strawberry/docs/design/phaseAB_prep/FRONTEND_BACKEND_INTEGRATION_SPEC.md`

---

## **Emergency Contacts**

- **Blocked on Backend API**: Contact Backend Lead
- **Config question**: Check PARALLEL_IMPLEMENTATION_ROADMAP.md § Checkpoint 0
- **Component design**: Check FRONTEND_PROGRESSIVE_DISCLOSURE_ARCHITECTURE.md § Component Specs
- **API schema question**: Check FRONTEND_BACKEND_INTEGRATION_SPEC.md § API Endpoint Specifications

---

**Status**: 🟢 Ready to sign off on Checkpoint 0!
