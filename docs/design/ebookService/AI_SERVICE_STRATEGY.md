# AI Service Strategy: Option A → Option C Roadmap

**Date**: November 24, 2025  
**Status**: Strategic Framework (Pre-Implementation)  
**Branch**: `feat/B_Frontend_option2`  
**Scope**: AI service configuration strategy for ebookService, Options 2/3/5, and beyond

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Context: Mock vs Real](#2-context-mock-vs-real)
3. [The Decision: Option A Now, Option C Later](#3-the-decision-option-a-now-option-c-later)
4. [Why Option A is Optimal](#4-why-option-a-is-optimal)
5. [Integration with Frontend Options](#5-integration-with-frontend-options)
6. [Implementation Timeline](#6-implementation-timeline)
7. [Cost & Performance Considerations](#7-cost--performance-considerations)
8. [Migration Path to Option C](#8-migration-path-to-option-c)
9. [Success Criteria](#9-success-criteria)

---

## 1. Executive Summary

**The Problem**: ebookService currently uses mock AI by default (`MockAIService`), returning placeholder text like "Concept 1", "Concept 2" instead of meaningful content. This defeats the purpose of intelligent content generation and blocks:

- Real image resolution (concepts are meaningless)
- Frontend Option 2 validation (no real data to test against)
- Production-grade testing (mock scaffolding isn't representative)

**The Solution**: Three-phase strategy for AI service configuration:

| Phase       | Timeline       | AI Config | Frontend    | Goal                                     |
| ----------- | -------------- | --------- | ----------- | ---------------------------------------- |
| **Phase 1** | NOW → Dec 8    | Option A  | Options 2/3 | Real content, validate design            |
| **Phase 2** | Dec 9 → Feb 28 | Option A  | Option 5    | Enterprise features with real data       |
| **Phase 3** | Q2 2026        | Option C  | All Options | Production-ready context-aware selection |

**Key Decision**: We have real Gemini credentials (`GEMINI_API_KEY`, `GEMINI_API_URL`) and `RealAIService` already implemented. We're simply **toggling to use them**.

---

## 2. Context: Mock vs Real

### Why Mock Existed

`MockAIService` was introduced in commit `70257e8` for earlier services (`sampleService`, `demoService`) during capability-building phase:

✅ **Advantages (then)**:

- Fast, deterministic testing
- No API costs during development
- Decoupled from Gemini availability
- Predictable test results (no randomness)

❌ **Disadvantages (now for ebookService)**:

- Non-semantic content ("Concept 1" vs "serene forest clearing")
- Defeats intelligent content generation purpose
- Blocks image resolution pipeline (meaningless concepts)
- Mock scaffolding not representative of production

### Current State

**aiService.js** implements both (commit `70257e8`):

```javascript
function createAIService() {
  const useReal =
    process.env.USE_REAL_AI === "1" || process.env.USE_REAL_AI === "true";
  if (useReal) {
    return new RealAIService(); // Calls Gemini
  }
  return new MockAIService(); // Returns "Mock: ..." text
}
```

**Default**: `USE_REAL_AI` is NOT set → `MockAIService` active

**Available Credentials**:

- ✅ `GEMINI_API_KEY` present
- ✅ `GEMINI_API_URL` present
- ✅ `GEMINI_VISION_API_URL` present (for images)

**RealAIService** is production-ready, just disabled by default.

---

## 3. The Decision: Option A Now, Option C Later

### Three Options Evaluated

**Option A: Flip Toggle (USE_REAL_AI=1)**

- **Implementation**: Set environment variable before running
- **Code Changes**: Zero
- **Risk**: Low (toggle exists, tested path)
- **Timeline**: Immediate
- **Cost**: ~$20-30/month dev, ~$0.21/ebook production
- **Decision**: ✅ **CHOSEN FOR NOW**

**Option B: Make Real the Default**

- **Implementation**: Change `createAIService()` to prefer real
- **Code Changes**: ~5 lines
- **Risk**: Medium (breaking change for CI/tests/local)
- **Timeline**: 1 hour
- **Cost**: Same as Option A
- **Decision**: ❌ Rejected (requires coordinating env vars everywhere)

**Option C: Context-Aware Selection**

- **Implementation**: Detect execution context (test vs server)
  - Tests: mock by default (fast)
  - Server: real by default (meaningful)
  - Override: `USE_REAL_AI` or `USE_MOCK_AI` flags
- **Code Changes**: ~30 lines
- **Risk**: Low (sophisticated, handles all cases)
- **Timeline**: 2-3 hours
- **Cost**: Same as Option A
- **Decision**: ⏸️ Defer to Q2 2026 (post-Option 5)

### Why Option A Now?

**Timing**: ebookService needs real content **immediately** to:

1. Generate meaningful image concepts (SVG library queries need descriptive text)
2. Validate Option 2 frontend against real data (not mock placeholders)
3. Match README_ebook.md specification (real structured output)

**Complexity**: Option A requires zero code changes—just set env var. Eliminates friction.

**Future Path**: Option C can be implemented post-Option 5 as a refactoring (no urgency, all features work with Option A).

---

## 4. Why Option A is Optimal

### Unblocks Critical Path

| Blocker                      | Unblocked By                      | Timeline  |
| ---------------------------- | --------------------------------- | --------- |
| Image concepts meaningless   | Option A (real Gemini)            | Immediate |
| Frontend Option 2 untestable | Option A (real content)           | Immediate |
| Production image resolution  | Option A (semantic concepts)      | Immediate |
| ebookService validation      | Option A (README spec compliance) | Immediate |

### Simplicity

- **No code changes**: Just `export USE_REAL_AI=1`
- **Proven path**: Toggle already exists, tested in aiService.js
- **Reversible**: Can disable with `unset USE_REAL_AI`
- **Observable**: Logs show "RealAIService enabled"

### Cost-Effective

- Gemini Flash: $0.0001-$0.001 per API call
- Per ebook: ~$0.21 (50% SVG cache hit)
- Development: ~$20-30/month (100-150 test ebooks)
- ROI: SVG library saves 80% image costs within 2 months

### Validates Architecture

Real data exposes issues mock hides:

- JSON parsing edge cases
- AI response latency
- Rate limiting behavior
- Error handling correctness

---

## 5. Integration with Frontend Options

### Option 2 (MVP): Nov 24 - Dec 8

**Status**: Fully implemented, waiting for backend validation

**AI Requirement**: Real content (Option A)

- Image concepts must be semantic ("serene forest" not "Concept 1")
- Option 2 frontend tests against real ebookService output
- Validation unblocks Option 3 migration

**Why**: Option 2's entire purpose is to prove MVP works end-to-end. Mock data invalidates proof.

### Option 3 (Production): Dec 9 - Jan 26

**Status**: Builds on proven Option 2 (80% code reuse)

**AI Requirement**: Keep Option A enabled

- All new features (routing, dashboard, version history) tested with real data
- Batch generation, project persistence all against real content
- Consistent developer experience

**Why**: Option 3 is "production-grade Option 2". Can't test production features with mock data.

### Option 5 (Enterprise): Feb 1 - Q2 2026

**Status**: Schema-driven UI, server-controlled frontend

**AI Requirement**: Keep Option A enabled

- Schema-driven features depend on realistic content for validation
- A/B testing against real data
- Enterprise customers expect production-grade AI

**Why**: Option 5 is highest-maturity option. Must have real AI.

### After All Options: Option C Refactoring

**Timeline**: Q2 2026 (post-Option 5)

**Rationale**: By then, all features proven with Option A. Option C refactoring is optimization, not necessity.

**Benefit**: Context-aware selection improves dev experience:

- Tests stay fast (mock by default)
- Server uses real (meaningful)
- No feature gaps

---

## 6. Implementation Timeline

### Phase 1: Option A Enablement (NOW)

**Week of Nov 24**:

```bash
# 1. Export variable (local dev)
export USE_REAL_AI=1

# 2. Run tests (real Gemini)
npm --prefix server run test:run

# 3. Start server (real content)
node server/index.js

# 4. Validate ebookService + Option 2 frontend
# - Manual browser testing
# - Verify E2E: prompt → real structured data → HTML
```

**Deliverable**: ✅ Real AI enabled, tests passing, Option 2 frontend validated

---

### Phase 1.5: Option 2 Validation (Nov 24 - Dec 8, ~2 weeks)

**Continues with Option A**:

- ebookService enhancement completion
- genieService.compose() wiring
- Option 2 E2E testing
- Mark Option 2 "production ready"

**Deliverable**: ✅ Option 2 stable with real AI

---

### Phase 2: Option 3 Development (Dec 9 - Jan 26, ~7 weeks)

**Continues with Option A**:

- Build routing + dashboard
- Project CRUD + persistence
- Version history + auto-save
- Batch generation
- 80% code reuse from Option 2

**Deliverable**: ✅ Option 3 production-ready with real AI

---

### Phase 3: Option 5 Development (Feb 1 - Q2 2026, ~16 weeks)

**Continues with Option A**:

- Schema-driven UI architecture
- Server-controlled frontend structure
- A/B testing framework
- Enterprise features

**Deliverable**: ✅ Option 5 enterprise-grade with real AI

---

### Phase 4: Option C Refactoring (Q2 2026, ~2 weeks)

**After all options proven**:

- Implement context-aware selection logic
- Tests default to mock (fast)
- Server defaults to real (meaningful)
- CI/prod configurable either way

**Deliverable**: ✅ Production-ready, optimized developer experience

---

## 7. Cost & Performance Considerations

### Cost Breakdown (Development Phase)

| Scenario                        | Calls/Month      | Cost            | Duration  |
| ------------------------------- | ---------------- | --------------- | --------- |
| Option A dev (150 test ebooks)  | ~1,200 API calls | ~$20-30         | Nov-Jan   |
| SVG library caching ROI         | 80% hit rate     | ~$24/100 ebooks | 2+ months |
| Production estimate (100 users) | ~1,200/month     | ~$20-30         | Ongoing   |

**Cost Management**:

- ✅ SVG library caches 80% of image generation within 2 months
- ✅ Pays for itself after ~1 month of production use
- ✅ Tests can run mock-by-default (Option C) for free after Q2

---

### Performance Impact

| Metric           | Mock | Real       |
| ---------------- | ---- | ---------- |
| Test Duration    | ~2s  | ~10-15s    |
| API Latency      | 0    | ~2-5s      |
| Content Quality  | N/A  | Production |
| Concept Semantic | No   | Yes        |
| Image Resolvable | No   | Yes        |

**During Development (Nov-Feb)**:

- CI tests slightly slower (~5x)
- Worth it: validates production behavior
- Option C (Q2) will optimize tests back to mock speed

---

## 8. Migration Path to Option C

### Why Wait Until Q2?

**Now (Option A)**:

- Toggle works fine
- All features can be built
- Zero friction
- Real data for validation

**Later (Option C)**:

- All features proven
- Tests don't need optimization yet (small codebase)
- Refactoring is cleanup, not critical path
- More context to make smart decisions

### Option C Implementation (Sketch)

```javascript
function createAIService() {
  // 1. Check explicit override
  if (process.env.USE_REAL_AI === "1") return new RealAIService();
  if (process.env.USE_MOCK_AI === "1") return new MockAIService();

  // 2. Context-aware default
  const inTest = process.env.NODE_ENV === "test" || global.vitest;

  if (inTest) {
    // Tests: fast mock by default
    return new MockAIService();
  }

  // 3. Server: real by default (check credentials)
  if (hasGeminiCredentials()) {
    return new RealAIService();
  }

  // 4. Fallback
  return new MockAIService();
}

function hasGeminiCredentials() {
  return !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_URL);
}
```

**Benefits**:

- Tests fast (mock default)
- Server real (meaningful)
- Can override either way
- No feature gaps
- Developer-friendly

---

## 9. Success Criteria

### Option A (Now - Dec 8)

- [x] `USE_REAL_AI=1` enables RealAIService
- [ ] Tests pass with real Gemini (slower, but pass)
- [ ] ebookService generates semantic image concepts
- [ ] Option 2 frontend validates against real data
- [ ] Cost tracking shows ~$20-30/month dev spend
- [ ] Image concepts usable by SVG library queries

### Option 2/3 Validation (Dec 8 - Jan 26)

- [ ] Option 2 E2E works end-to-end
- [ ] Option 3 builds on Option 2 without regression
- [ ] All features tested with real AI
- [ ] SVG library hit rate >60% on test prompts
- [ ] Theme override works against real content

### Option 5 Enterprise (Feb-Q2)

- [ ] Schema-driven UI stable
- [ ] A/B testing framework operational
- [ ] Enterprise customers validate against real AI
- [ ] SVG library hit rate >80%

### Option C Refactoring (Q2 2026)

- [ ] Context-aware selection implemented
- [ ] Tests use mock by default (fast)
- [ ] Server uses real by default (meaningful)
- [ ] Zero feature regressions
- [ ] Developer experience improved (CI faster)

---

## Document Control

| Version | Date         | Status     | Changes                                           |
| ------- | ------------ | ---------- | ------------------------------------------------- |
| 1.0     | Nov 24, 2025 | 🎯 CURRENT | Strategic framework: Option A now, Option C later |

---

## Conclusion

**ebookService requires real AI to fulfill its purpose.** We have credentials, code, and proven toggle—just need to enable it.

**Option A (flip toggle) is optimal**:

- ✅ Zero code changes
- ✅ Immediate unblocking of critical path
- ✅ Validates architecture
- ✅ Enables all frontend options

**Option C (context-aware) is deferred to Q2 2026**:

- ✅ All features proven first
- ✅ No urgency (Option A works fine)
- ✅ Cleaner refactoring after Options 5 complete
- ✅ Developer experience optimization (not critical)

**Next Step**: Execute Option A implementation (see AI_SERVICE_IMPLEMENTATION_GUIDE.md).

---

**Strategic Status**: 🟢 Ready to proceed with Option A  
**Last Updated**: November 24, 2025  
**Next Document**: AI_SERVICE_IMPLEMENTATION_GUIDE.md (tactical details)
