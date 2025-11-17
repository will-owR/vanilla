# Session 4 Planning Document

**AetherPress Phase A-B: Session 4 Preparation**

**Duration**: 2 hours (Nov 27-28)  
**Modules to Implement**: Module 9 (Integration Tests) + Module 10 (Frontend Integration)  
**Entry Criteria**: All Modules 1-8 complete ✅  
**Exit Criteria**: 75+ tests passing, Phase A locked, frontend wired, 100% Phase A-B complete

---

## Overview

Session 4 completes Phase A-B by integrating the classification + routing + override system with the frontend. It's the final bridge between backend services and user interface.

**Key Deliverables**:

1. **Module 9 (Integration Tests)**: 50+ end-to-end scenarios covering all services and classification paths
2. **Module 10 (Frontend Integration)**: Wire MediaSelector to API, implement classification feedback, show confidence

**Impact**:

- Enables complete end-to-end user workflows (prompt → output)
- Validates all service + classification combinations
- Prepares for Phase C (advanced features)
- Completes Phase A-B at 100% (10/10 modules)

---

## Module 9: Integration Tests (Estimated 400-500 lines)

### Purpose

Comprehensive end-to-end testing covering:

- All 8 mediums with all 6 classification dimensions
- All service + classification combinations (8 × 5-7 styles = 40-56 scenarios)
- Error scenarios and edge cases
- Performance benchmarks
- Export quality validation

### Architecture

```
Test Scenarios:
  ├─ Happy Path Tests (30+)
  │   ├─ Each medium with typical classification
  │   ├─ Classification fallback paths (rule→ai→hybrid)
  │   ├─ Override workflows (medium→style→color changes)
  │   └─ Export validation (PDF, PNG quality)
  │
  ├─ Error Scenarios (10+)
  │   ├─ Invalid inputs
  │   ├─ Service failures
  │   ├─ Classification errors
  │   └─ Override incompatibilities
  │
  ├─ Performance Tests (5+)
  │   ├─ End-to-end latency <2s
  │   ├─ Concurrent requests
  │   ├─ Memory usage under load
  │   └─ Classification latency
  │
  └─ Edge Cases (10+)
      ├─ Empty/null prompts
      ├─ Very long prompts (10k+ chars)
      ├─ Special characters/unicode
      ├─ Conflicting dimensions
      └─ Style + medium incompatibilities
```

### Key Components

1. **Happy Path Generator** (100 lines)

   ```javascript
   // Generate all valid medium + style combinations
   const scenarios = generateHappyPathScenarios();
   // Output: 40-60 test cases

   // For each: prompt → classify → route → generate → validate
   ```

2. **Error Injector** (80 lines)

   ```javascript
   // Inject failures at various pipeline stages
   scenarios = generateErrorScenarios();
   // Invalid medium → expect 400
   // Service crash → expect 503
   // Invalid classification → expect graceful fallback
   ```

3. **Performance Monitor** (80 lines)

   ```javascript
   // Track latencies across pipeline
   const metrics = {
     classification: [5-50ms],
     routing: [1-5ms],
     generation: [100-500ms],
     total: [200-600ms],
   };
   ```

4. **Export Validator** (100 lines)

   ```javascript
   // Validate generated exports
   validatePDFQuality(output);
   validatePNGQuality(output);
   validateHTMLStructure(output);
   ```

5. **Override Workflow Tester** (80 lines)

   ```javascript
   // Test override chains
   generate() → override(style) → override(color) → export()
   ```

### Test Plan (~50 tests)

| Category           | Tests | Notes                               |
| ------------------ | ----- | ----------------------------------- |
| Happy Path         | 30    | Each medium + typical styles        |
| Classification     | 5     | All fallback paths (rule/ai/hybrid) |
| Routing            | 4     | All mediums routed correctly        |
| Override Workflows | 6     | Medium→style→color chains           |
| Error Scenarios    | 8     | Invalid inputs, service failures    |
| Performance        | 5     | Latency benchmarks, concurrent load |
| Edge Cases         | 8     | Unicode, long prompts, conflicts    |
| Export Quality     | 4     | PDF, PNG, HTML validation           |

**Total**: 50+ tests

### API Coverage

```javascript
// Full pipeline testing
const result = await generateWithClassification({
  prompt: "Create a spooky calendar for Halloween",
  options: {
    medium: "calendar",
    style: "gothic",
    theme: ["halloween", "spooky"],
    colorPalette: "dark-orange",
  },
});

// Validate: output quality, metrics, confidence
expect(result).toHaveProperty("output");
expect(result).toHaveProperty("confidence");
expect(result).toHaveProperty("latency");

// Override workflow
const overridden = await override(result, {
  style: "modern",
});

// Validate transformation
expect(overridden.costMultiplier).toBeLessThan(0.5);
```

### Implementation Strategy

**Phase 1: Scenario generators (150 lines)**

- Generate all medium + style combinations
- Generate error injection scenarios
- Generate edge case prompts

**Phase 2: Happy path tests (150 lines)**

- Route tests: each medium
- Classification tests: all sources
- Override tests: medium/style/color chains
- Export tests: PDF/PNG/HTML

**Phase 3: Error & performance tests (100 lines)**

- Error scenario validation
- Latency benchmarks
- Concurrent load testing
- Memory profiling

**Phase 4: Edge cases (80 lines)**

- Unicode handling
- Long prompts (>10k chars)
- Conflicting dimensions
- Incompatible combinations

### Success Criteria

- ✅ All 50+ integration tests passing
- ✅ Coverage: all 8 mediums × 5-7 styles
- ✅ All error scenarios handled
- ✅ Performance: P95 latency <2s
- ✅ Export quality validated
- ✅ No regressions to Modules 1-8

---

## Module 10: Frontend Integration (Estimated 300-400 lines)

### Purpose

Wire the MediaSelector UI component to the backend API and implement real-time classification feedback with confidence scoring.

### Architecture

```
User Flow:
  1. User enters prompt in input field
  2. Frontend triggers classification (debounced)
  3. Backend returns classification + confidence
  4. UI shows suggested medium + confidence score
  5. User selects medium (can override)
  6. Frontend calls generate API
  7. Backend routes through router + services
  8. Frontend displays output with override controls
  9. User can re-style (change medium/style/colors)
  10. Frontend calls override API
  11. Output updated with cost multiplier shown
```

### Key Components

1. **Classification Feedback Component** (80 lines)

   ```jsx
   <ClassificationFeedback
     prompt={prompt}
     classification={classification}
     confidence={confidence}
     source={source}
     onConfidenceClick={showExplanation}
   />
   ```

   Features:

   - Show suggested medium + confidence
   - Show classification source (rules/ai/hybrid)
   - Allow user to override selection
   - Visual confidence indicator (0-100%)

2. **MediaSelector Integration** (80 lines)

   ```jsx
   <MediaSelector
     availableMedia={router.getAvailableServices()}
     selectedMedium={selectedMedium}
     onChange={handleMediumChange}
     classification={classification}
     confidence={confidence}
     showConfidence={true}
   />
   ```

   Features:

   - Show all 8 mediums
   - Highlight AI-suggested medium
   - Show confidence % on hover
   - Enable/disable based on compatibility

3. **Override Controls** (80 lines)

   ```jsx
   <OverridePanel
     currentClassification={currentClassification}
     output={output}
     onStyleChange={applyStyleOverride}
     onColorChange={applyColorOverride}
     onMediumChange={applyMediumOverride}
     costMultiplier={costMultiplier}
   />
   ```

   Features:

   - Dropdowns for style, color, medium changes
   - Show cost multiplier (5% color, 40% style, 100% medium)
   - Preview before applying
   - Undo button

4. **API Integration Hook** (80 lines)

   ```javascript
   const useGenieRouter = () => {
     const [classification, setClassification] = useState(null);
     const [confidence, setConfidence] = useState(0);
     const [output, setOutput] = useState(null);
     const [loading, setLoading] = useState(false);

     const generate = async (prompt, options) => {
       // Call router.route() endpoint
       // Update state with output + metrics
     };

     const applyOverride = async (output, oldClass, newClass) => {
       // Call override.applyOverride() endpoint
       // Update output + show cost
     };

     return { classify, generate, applyOverride, output, confidence };
   };
   ```

5. **Error Boundary Component** (40 lines)

   ```jsx
   <GenerationErrorBoundary onError={handleError} fallback={<ErrorMessage />}>
     {/* Generation content */}
   </GenerationErrorBoundary>
   ```

### Frontend Workflow

```
┌─────────────────────────────────────────────────┐
│ 1. User enters prompt                           │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 2. Classification API called (debounced)        │
│    POST /api/classify                           │
│    Returns: { medium, style, confidence, ... }  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 3. Show ClassificationFeedback                  │
│    - Suggested medium + confidence %            │
│    - Source (rules/ai/hybrid)                   │
│    - Option to override                         │
└────────────────┬────────────────────────────────┘
                 │
         ┌───────┴──────┐
         ▼              ▼
    (User approves) (User overrides)
         │              │
         ▼              ▼
    Select medium   Select different medium
         │              │
         └───────┬──────┘
                 ▼
┌─────────────────────────────────────────────────┐
│ 4. Call Generate API                            │
│    POST /api/generate                           │
│    { prompt, medium, style, options }           │
│    Returns: { output, latency, confidence }     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 5. Display Output with Override Controls        │
│    - Show generated content                     │
│    - Enable style/color/medium changes          │
│    - Show cost multiplier on hover              │
└────────────────┬────────────────────────────────┘
                 │
         ┌───────┴─────────────┐
         ▼                     ▼
   (No changes)          (Apply override)
         │                     │
         ▼                     ▼
   Export (PDF/PNG)      Apply Override
                               │
                               ▼
                ┌──────────────────────────────┐
                │ Call Override API            │
                │ POST /api/override           │
                │ Returns: cost multiplier     │
                └──────────────────────────────┘
```

### API Endpoints Required

From backend (already implemented in Modules 7-8):

```javascript
// Module 7 endpoints
POST /api/classify
  Input: { prompt, options? }
  Output: { medium, style, confidence, source }

POST /api/generate
  Input: { prompt, medium, style, options }
  Output: { output, latency, confidence, medium }

GET /api/router/services
  Output: ["ebook", "calendar", ...]

GET /api/router/capabilities/:medium
  Output: { styles: [], themes: [], limits: {} }

// Module 8 endpoints
POST /api/override
  Input: { output, oldClassification, newClassification }
  Output: { output, costMultiplier, changedDimensions }

POST /api/override/can-transform
  Input: { fromMedium, toMedium }
  Output: { can: boolean }

GET /api/override/compatible-styles/:medium
  Output: ["style1", "style2", ...]
```

### Implementation Strategy

**Phase 1: API integration (100 lines)**

- Create useGenieRouter hook
- Implement classify/generate/override calls
- Handle loading states + errors
- Debounce classification calls

**Phase 2: Components (150 lines)**

- ClassificationFeedback component
- Enhanced MediaSelector
- OverridePanel component
- Error boundaries

**Phase 3: Workflows (80 lines)**

- Prompt → classify → select medium → generate
- Generate → override style/color/medium
- Export with preview
- Undo/redo support

**Phase 4: Testing (70 lines)**

- Unit tests: hooks + components
- Integration tests: workflows
- Mock API calls
- Error scenarios

### Test Plan (~20 tests)

| Category           | Tests | Notes                                  |
| ------------------ | ----- | -------------------------------------- |
| API Integration    | 6     | classify, generate, override API calls |
| Classification UI  | 4     | Display feedback, override selection   |
| Override Workflows | 4     | Style/color/medium change flows        |
| Error Handling     | 3     | Failed API calls, validation errors    |
| Performance        | 2     | Debounced calls, concurrent requests   |
| Accessibility      | 1     | ARIA labels, keyboard navigation       |

**Total**: 20 tests

### Success Criteria

- ✅ All 20 frontend tests passing
- ✅ Classification feedback shows on input
- ✅ Confidence score displayed correctly
- ✅ Override workflows work end-to-end
- ✅ Error messages user-friendly
- ✅ No regressions to Modules 1-9

---

## Integration Points

### Backend Endpoints

All implemented in Modules 7-8:

- ✅ router.route(prompt, options) → /api/generate
- ✅ router.classifyPrompt(prompt, options) → /api/classify
- ✅ override.applyOverride(output, old, new) → /api/override
- ✅ override.canTransform(from, to) → /api/override/can-transform
- ✅ override.getCompatibleStyles(medium) → /api/override/compatible-styles/:medium

### Frontend Components (Existing)

From Session 1, Module 6:

- ✅ MediaSelector component (needs integration)
- ✅ Styling + layout
- ✅ Svelte framework ready

### New Frontend Components

To create in Module 10:

- ClassificationFeedback component
- OverridePanel component
- Enhanced MediaSelector wrapper
- Error boundary wrapper

### Database Interactions (Optional)

Store for analytics:

```sql
CREATE TABLE generation_logs (
  id SERIAL PRIMARY KEY,
  prompt TEXT,
  classification JSONB,
  medium VARCHAR(50),
  confidence FLOAT,
  latency_ms INT,
  cost_multiplier FLOAT,
  source VARCHAR(20),
  created_at TIMESTAMP
);
```

---

## Testing Strategy

### Module 9: Integration Tests

**Happy Path** (30+ tests):

- Generate with all 8 mediums
- All style combinations (5-7 per medium)
- Classification fallback paths
- Override workflows
- Export quality

**Error Scenarios** (10+ tests):

- Invalid medium → 400 error
- Service unavailable → 503 error
- Incompatible override → 400 error
- Malformed input → validation error

**Performance** (5+ tests):

- P95 latency <2s
- Concurrent requests
- Memory under load
- Classification <100ms

**Edge Cases** (8+ tests):

- Unicode prompts
- Long prompts (10k+ chars)
- Empty/null inputs
- Conflicting dimensions

### Module 10: Frontend Tests

**API Integration** (6 tests):

- classify() returns correct structure
- generate() handles loading states
- override() shows cost multiplier
- Error handling displays user message
- Debouncing works correctly
- Concurrent requests handled

**UI Components** (4 tests):

- ClassificationFeedback renders correctly
- MediaSelector shows confidence
- OverridePanel displays options
- Error boundaries catch errors

**Workflows** (4 tests):

- Prompt → classify → generate flow
- Override style/color/medium
- Multiple overrides in sequence
- Undo after override

**Error Handling** (3 tests):

- Failed API call shows error
- Validation errors displayed
- Graceful fallback on error

**Performance** (2 tests):

- Debounced classification calls
- Concurrent generate requests

**Accessibility** (1 test):

- ARIA labels present
- Keyboard navigation works

---

## Success Metrics

### Module 9: Integration Tests

- ✅ 50+ integration tests passing
- ✅ Coverage: all 8 mediums × 5-7 styles (40-56 scenarios)
- ✅ All error scenarios handled gracefully
- ✅ Performance: P95 latency <2s
- ✅ Export quality validated
- ✅ Override workflows complete
- ✅ 0 regressions to Modules 1-8

### Module 10: Frontend Integration

- ✅ 20 frontend tests passing
- ✅ Classification feedback functional
- ✅ Confidence scoring displays
- ✅ Override controls work
- ✅ All workflows end-to-end
- ✅ Accessibility compliant
- ✅ 0 regressions to Modules 1-9

### Phase A-B Completion

- ✅ 433 total tests (349 + 64 + 20)
- ✅ 100% modules complete (10/10)
- ✅ Phase A locked: 179/179 (0 regressions)
- ✅ All integration tests passing
- ✅ Frontend fully wired
- ✅ Ready for Phase C

---

## Timeline & Milestones

### Start of Session 4 (Nov 27, 09:00)

- Review this document
- Set up test infrastructure (happy path generator)
- Begin Module 9 core tests

### 30 Minutes

- Module 9 happy path tests: 20/30 passing
- Classification + routing coverage complete

### 60 Minutes

- Module 9 error scenarios + edge cases: 45/50 passing
- Performance tests complete
- Module 10 API integration begins

### 90 Minutes

- Module 10 components: 15/20 tests passing
- Workflows tested
- Override controls working

### End of Session 4 (Nov 28, 18:00)

- Module 9: ✅ 50+/50+ tests
- Module 10: ✅ 20/20 tests
- Full suite: 349 + 64 + 20 = 433 tests
- Phase A-B: ✅ 100% complete (10/10 modules)
- Commit + progress update

---

## Contingency Plans

### If Module 9 runs over

- Focus on happy path tests (30)
- Defer edge cases initially
- Defer performance benchmarks
- Re-score as "medium priority"

### If Module 10 is complex

- Implement basic API calls first
- Skip advanced workflows
- Defer accessibility testing
- Re-score as "medium priority"

### If tests are failing

- Roll back to last known good state
- Debug one scenario at a time
- Re-integrate incrementally
- Check Modules 7-8 still working

### If performance is slow

- Profile classification latency
- Check database queries
- Optimize hot paths
- Consider caching

---

## Pre-Requisites Checklist

Before starting Session 4:

- [✅] All Module 1-8 tests passing (413/413)
- [✅] Phase A locked at 179 tests
- [✅] Module 7 router fully functional
- [✅] Module 8 override system working
- [✅] Existing services accessible
- [✅] Frontend MediaSelector component available
- [✅] Backend API routes defined

---

## Files to Create/Modify

### Module 9 (Integration Tests)

```
/server/__tests__/integration.test.js (400-500 lines)
  - Happy path scenarios (30+ tests)
  - Classification tests (5 tests)
  - Routing tests (4 tests)
  - Override workflows (6 tests)
  - Error scenarios (8+ tests)
  - Performance tests (5 tests)
  - Edge cases (8 tests)
  - Export validation (4 tests)
```

### Module 10 (Frontend Integration)

```
/client/src/hooks/useGenieRouter.js (80 lines)
  - classify() function
  - generate() function
  - applyOverride() function
  - Loading/error states

/client/src/components/ClassificationFeedback.svelte (80 lines)
  - Show suggested medium
  - Display confidence %
  - Show source (rules/ai/hybrid)
  - Allow override

/client/src/components/OverridePanel.svelte (80 lines)
  - Style selector
  - Color selector
  - Medium selector
  - Cost multiplier display
  - Apply/cancel buttons

/client/src/components/MediaSelectorWrapper.svelte (80 lines)
  - Wrap existing MediaSelector
  - Add confidence display
  - Add classification feedback

/client/__tests__/hooks.test.js (80 lines)
  - API integration tests
  - Loading states
  - Error handling

/client/__tests__/components.test.js (80 lines)
  - Component rendering
  - User interactions
  - Workflow tests
```

### Updates

```
/docs/design/PHASE_A-B_PROGRESS_DASHBOARD.md (update to 100%)
SESSION_4_COMPLETION_REPORT.md (create)
```

---

## Notes for Session 4 Executor

1. **Test Order**: Module 9 first (backend validated), then Module 10 (frontend verified)
2. **API Mocking**: Module 10 tests should mock backend responses
3. **Component Testing**: Use Svelte testing utilities + Vitest
4. **Performance Profiling**: Use console.time() for quick measurements
5. **Accessibility**: Run axe-core on components
6. **Browser Compatibility**: Test on latest Chrome/Firefox/Safari
7. **Error Messages**: Match existing message format
8. **Test Isolation**: Each test should reset state

---

## Success Definition

**Session 4 is complete when**:

1. Module 9 tests: ✅ 50+/50+ passing
2. Module 10 tests: ✅ 20/20 passing
3. Full test suite: ✅ 433/433 passing
4. Phase A: ✅ Still locked (0 regressions)
5. Phase A-B: ✅ 100% complete (10/10 modules)
6. Frontend: ✅ Classification feedback working
7. Frontend: ✅ Override controls working
8. Commit: ✅ Pushed with proper message
9. Documentation: ✅ Updated

**Progress reached**: 100% of Phase A-B (10 of 10 modules)

---

## Phase A-B Summary (After Session 4)

| Module    | Type          | Tests    | Status    | Session      |
| --------- | ------------- | -------- | --------- | ------------ |
| 1         | SVG Lib       | 39       | ✅        | Session 1    |
| 4         | LLM Class     | 34       | ✅        | Session 1    |
| 6         | MediaUI       | UI       | ✅        | Session 1    |
| 3         | RuleEngine    | 34       | ✅        | Session 2    |
| 5         | Validator     | 41       | ✅        | Session 2    |
| 7         | Router        | 36       | ✅        | Session 3    |
| 8         | Override      | 28       | ✅        | Session 3    |
| 9         | Integration   | 50+      | ⏳        | Session 4    |
| 10        | Frontend      | 20       | ⏳        | Session 4    |
| **Total** | **Phase A-B** | **~433** | **→100%** | **Complete** |

---

## Ready to Begin Session 4?

✅ All prerequisites met  
✅ Architecture clear  
✅ Test plan defined  
✅ Success criteria explicit  
✅ Previous 3 sessions locked (0 regressions)

**Next Action**: Create test infrastructure → Begin Module 9 happy path scenarios

---

_Document prepared for Session 4 execution_  
_See SESSION_3_COMPLETION_REPORT.md for Session 3 summary_  
_See SESSION_2_COMPLETION_REPORT.md for Session 2 summary_  
_See PHASE_A-B_PROGRESS_DASHBOARD.md for overall progress_

---

## Phase C - Future Directions (Brainstorm)

After Phase A-B completion, consider:

**Module 11**: AI Assistant (conversational refinement)

- NLP for design feedback
- Context-aware suggestions
- Multi-turn conversations

**Module 12**: Advanced Analytics

- User behavior tracking
- Design popularity metrics
- Trend analysis

**Module 13**: Export Pipeline v2

- Direct printing service integration
- Multiple format support (SVG, WebP, HEIC)
- Batch export

**Module 14**: Project Management

- Save/load projects
- Version history
- Collaboration features

**Module 15**: Monetization

- Premium templates
- AI credit system
- Export limits

---

_End of Session 4 Planning_
