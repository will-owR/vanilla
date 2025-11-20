# Session 3 Planning Document

**AetherPress Phase A-B: Session 3 Preparation**

**Duration**: 2 hours (Nov 25-26)  
**Modules to Implement**: Module 7 (genieService Router) + Module 8 (Override System)  
**Entry Criteria**: All Modules 1-6 complete ✅  
**Exit Criteria**: 60+ tests passing, Phase A locked, integrated router working

---

## Overview

Session 3 integrates the classification pipeline (Modules 1-6) with the core service architecture. It's the bridge between "smart classification" and "service-specific generation".

**Key Deliverables**:

1. **Module 7 (genieService Router)**: Route classified prompts to correct service
2. **Module 8 (Override System)**: Allow users to re-style without regeneration

**Impact**:

- Enables end-to-end prompt → classification → service → output
- Prepares for frontend integration (Module 10)
- Completes intelligent routing layer

---

## Module 7: genieService Router (Estimated 400-500 lines)

### Purpose

Route a classified prompt to the appropriate service (eBook, Calendar, Poster, etc.) based on the medium selection. Orchestrate the full pipeline.

### Architecture

```
Input: { prompt, medium, classification, style }
  ↓
[Router Logic]
  ├─ Validate inputs
  ├─ Route to service: services[medium]
  ├─ Inject classification context
  └─ Call service.generate(context)
  ↓
Output: Generated content (HTML, PDF, etc.)
```

### Key Responsibilities

1. **Service Mapping** (Dict lookup, O(1))

   ```javascript
   const services = {
     ebook: ebookService,
     calendar: calendarService,
     poster: posterService,
     // ... 8 mediums total
   };
   ```

2. **Context Building** (Prepare data for service)

   ```javascript
   const context = {
     prompt,
     classification: {
       medium,
       style,
       theme,
       colorPalette,
       audience,
       genre,
       tone,
     },
     metadata: {
       confidence,
       source, // "rules", "ai", or "hybrid"
       timestamp,
     },
   };
   ```

3. **Error Handling** (Graceful fallback)

   - Invalid medium → 400 Bad Request
   - Service unavailable → 503 Service Unavailable
   - Generation failure → 500 Internal Server Error

4. **Logging & Observability**
   - Log routing decision + classification confidence
   - Track which service was used
   - Record generation latency

### API Design

```javascript
router.route(prompt, (options = {}));
// Input: { prompt, medium?, style? }
// Returns: { output, medium, style, confidence }
// Errors: ValidationError, ServiceError

router.getAvailableServices();
// Returns: ["ebook", "calendar", "poster", ...]

router.getServiceCapabilities(medium);
// Returns: { supports: ["style", "theme"], limits: {...} }
```

### Implementation Strategy

**Phase 1: Core routing (50 lines)**

- Service lookup & validation
- Context building
- Basic error handling

**Phase 2: Classification integration (100 lines)**

- Wire up Modules 3, 4, 5 (Rule Engine + LLM + Validator)
- Implement fallback classification if medium not specified
- Handle confidence-based routing decisions

**Phase 3: Observability (50 lines)**

- Logging infrastructure
- Metrics collection (latency, success rate)
- Error tracking

**Phase 4: Testing (150+ lines)**

- Unit tests: Each service routing path
- Integration tests: Full pipeline
- Error scenarios: Invalid medium, service failures
- Performance: <500ms end-to-end

### Test Plan (~25 tests)

| Category       | Tests | Notes                                   |
| -------------- | ----- | --------------------------------------- |
| Routing        | 8     | Each medium gets routed correctly       |
| Validation     | 4     | Invalid medium, missing prompt          |
| Classification | 5     | Fallback classification, confidence     |
| Error handling | 4     | Service unavailable, generation failure |
| Performance    | 2     | <500ms latency                          |
| Integration    | 2     | Full pipeline with real services        |

### Dependencies

- ✅ Module 3 (Rule Engine)
- ✅ Module 4 (LLM Classifier)
- ✅ Module 5 (Validator)
- ✅ Existing services: ebookService, calendarService, etc.

### Success Criteria

- ✅ All 25 routing tests passing
- ✅ Route to all 8 mediums correctly
- ✅ Fallback classification works
- ✅ Error handling graceful
- ✅ Latency <500ms

---

## Module 8: Override System (Estimated 300-400 lines)

### Purpose

Allow users to re-style content without regenerating expensive AI components. E.g., user changes medium from "ebook" to "poster" after generation - reuse prompt, change layout only.

### Use Cases

1. **Medium Switch** (ebook → calendar)

   - Keep prompt + content
   - Regenerate layout for new medium
   - Cost: 10% (layout only, no AI)

2. **Style Switch** (gothic → retro)

   - Keep prompt + layout structure
   - Regenerate colors + fonts
   - Cost: 20% (styling, no content AI)

3. **Color Override** (vibrant → muted)
   - Keep everything
   - Apply color remapping
   - Cost: 5% (local only)

### Architecture

```
Input: { originalOutput, newClassification }
  ↓
[Override Logic]
  ├─ Detect what changed (medium/style/colors)
  ├─ Determine cost (% of original cost)
  ├─ Apply transformation
  └─ Return new output
  ↓
Output: Restyled content (minimal cost)
```

### Key Components

1. **Override Detector** (30 lines)

   ```javascript
   detectChanges(oldClassification, newClassification);
   // Returns: { changedMedium, changedStyle, changedColors }
   ```

2. **Transform Strategies** (150 lines)

   - **LayoutTransform**: Change medium (ebook → poster)
   - **StyleTransform**: Change style (gothic → retro)
   - **ColorTransform**: Remap colors (vibrant → muted)

3. **Cost Calculator** (30 lines)

   ```javascript
   estimateCost(change);
   // medium change: 0.1 (10%)
   // style change: 0.2 (20%)
   // color change: 0.05 (5%)
   ```

4. **Validation** (40 lines)
   - Can medium be changed? (Check if layout compatible)
   - Can style be changed? (Check theme compatibility)
   - Can colors be changed? (Always allowed)

### API Design

```javascript
override.canTransform(medium1, medium2);
// Returns: boolean

override.applyOverride(output, oldClassification, newClassification);
// Returns: { output, costMultiplier, changedDimensions }

override.estimateCost(change);
// Returns: 0.05-1.0 (cost as % of original)
```

### Implementation Strategy

**Phase 1: Change detection (40 lines)**

- Compare old vs new classification
- Identify what changed

**Phase 2: Transform strategies (150 lines)**

- Layout transform (medium-specific)
- Style transform (colors + fonts)
- Color transform (simple remapping)

**Phase 3: Validation & safety (60 lines)**

- Compatibility checks
- Fallback if transform fails
- Error handling

**Phase 4: Testing (120+ lines)**

- Unit tests: Each transform type
- Compatibility matrix: All medium pairs
- Cost estimation accuracy
- Edge cases: Invalid transitions

### Test Plan (~20 tests)

| Category    | Tests | Notes                             |
| ----------- | ----- | --------------------------------- |
| Detection   | 4     | Detect medium/style/color changes |
| Transforms  | 8     | Each transform type + edge cases  |
| Validation  | 4     | Compatibility checks              |
| Cost        | 2     | Cost calculation accuracy         |
| Integration | 2     | Full override pipeline            |

### Compatibility Matrix

```
ebook    → calendar    ✅ (compatible)
         → poster      ✅ (compatible)
         → stickers    ✅ (compatible)

calendar → ebook      ✅ (compatible)
         → poster      ⚠️  (layout differs)
         → stickers    ⚠️  (size constraints)

poster   → ebook      ⚠️  (aspect ratio change)
         → calendar    ⚠️  (multi-page)
         → stickers    ✅ (compatible)
```

### Success Criteria

- ✅ All 20 override tests passing
- ✅ Compatibility matrix complete
- ✅ Cost estimates within 10% accuracy
- ✅ All transforms maintain quality
- ✅ Fallback works reliably

---

## Integration Points

### With Existing Code

**Module 3 (Rule Engine)**

- Used for fallback classification when medium not specified
- Extract classification from prompt if needed

**Module 4 (LLM Classifier)**

- Fallback when rule engine confidence < 0.8
- Re-classify if override changes context

**Module 5 (Validator)**

- Validate new classification before routing
- Validate override compatibility

**Module 6 (Media Selector)**

- Triggered when user clicks "Change Medium"
- Routes back through override system

**Existing Services**

- ebookService, calendarService, posterService, etc.
- Router calls these with context

### Database Interactions

**New Tables** (if needed)

```sql
-- Audit trail for overrides
CREATE TABLE classification_overrides (
  id SERIAL PRIMARY KEY,
  output_id INTEGER,
  old_classification JSONB,
  new_classification JSONB,
  change_type VARCHAR(20),
  cost_multiplier FLOAT,
  created_at TIMESTAMP
);
```

**Existing Tables** (use existing)

- `outputs`: Store generated content
- `classifications`: Store classification results

---

## Testing Strategy

### Unit Tests (35 tests total)

- Module 7 (25 tests): Routing, classification, errors
- Module 8 (10 tests): Overrides, transforms

### Integration Tests

- Full pipeline: prompt → classification → routing → service
- Override pipeline: output → detect change → transform
- Both tested with real services (not mocks)

### E2E Test Scenarios

- Generate ebook, override to calendar
- Generate poster, override to sticker
- Generate with different styles, override colors
- Latency measurements
- Cost accuracy validation

---

## Success Metrics

### Router (Module 7)

- ✅ Route 100% of requests to correct service
- ✅ Classification fallback works
- ✅ Error handling: 0 unhandled exceptions
- ✅ Latency: <500ms P95

### Override (Module 8)

- ✅ Detect changes: 100% accuracy
- ✅ Transform quality: Visually equivalent
- ✅ Cost accuracy: Within 10%
- ✅ Compatibility: Correct for all pairs

### Phase A-B Progress

- ✅ 60 new tests passing
- ✅ Phase A still locked (0 regressions)
- ✅ 70% modules complete (7 of 10)

---

## Timeline & Milestones

### Start of Session 3 (Nov 25, 09:00)

- Review this document
- Set up feature branches
- Begin Module 7 core routing

### 30 Minutes

- Module 7 routing + validation complete
- Module 7 tests: 15/25 passing

### 60 Minutes

- Module 7 classification integration
- Module 7 all 25 tests passing
- Module 8 implementation begins

### 90 Minutes

- Module 8 transforms complete
- Module 8 tests: 15/20 passing

### End of Session 3 (Nov 26, 18:00)

- Module 7: ✅ 25/25 tests
- Module 8: ✅ 20/20 tests
- Full suite: 349 + 45 = 394 tests
- Commit + progress update

---

## Contingency Plans

### If Module 7 runs over

- Focus on core routing (50 lines)
- Skip logging infrastructure initially
- Re-score as "medium priority"

### If Module 8 is complex

- Implement simple transforms first
- Defer compatibility validation
- Re-score as "low priority"

### If tests are failing

- Roll back to last known good state
- Debug in isolation first
- Re-integrate incrementally

---

## Pre-Requisites Checklist

Before starting Session 3:

- [ ] All Module 1-6 tests passing ✅
- [ ] Phase A locked at 179 tests ✅
- [ ] Feature branches created
- [ ] ebookService, calendarService, etc. accessible
- [ ] Database migrations up-to-date
- [ ] Keyword Database (Module 2) verified

---

## Files to Create/Modify

### Module 7 (genieService Router)

```
/server/utils/genieRouter.js (400-500 lines)
/server/__tests__/genieRouter.test.js (200+ lines)
```

### Module 8 (Override System)

```
/server/utils/overrideSystem.js (300-400 lines)
/server/__tests__/overrideSystem.test.js (150+ lines)
```

### Updates

```
/docs/design/PHASE_A-B_PROGRESS_DASHBOARD.md (update progress)
SESSION_3_COMPLETION_REPORT.md (create)
```

---

## Notes for Session 3 Executor

1. **Dependency Graph**: Module 7 doesn't strictly depend on Module 8 - can parallelize if needed
2. **Service Integration**: Existing services already have `.generate(context)` interface
3. **Backwards Compatibility**: Route existing prompts that predate modules 1-5
4. **Logging**: Use existing logger at `/server/utils/logger.js` or similar
5. **Error Messages**: Match existing error format for consistency
6. **Test Isolation**: Unit tests should mock services; integration tests use real services

---

## Success Definition

**Session 3 is complete when**:

1. Module 7 tests: ✅ 25/25 passing
2. Module 8 tests: ✅ 20/20 passing
3. Full test suite: ✅ 394/394 passing
4. Phase A: ✅ Still locked (0 regressions)
5. Commit: ✅ Pushed with proper message
6. Documentation: ✅ Updated

**Progress reached**: 70% of Phase A-B (7 of 10 modules)

---

## Ready to Begin Session 3?

✅ All prerequisites met  
✅ Architecture clear  
✅ Test plan defined  
✅ Success criteria explicit

**Next Action**: Review feature branches → Begin Module 7 core routing

---

_Document prepared for Session 3 execution_  
_See SESSION_2_COMPLETION_REPORT.md for Session 2 summary_  
_See PHASE_A-B_PROGRESS_DASHBOARD.md for overall progress_
