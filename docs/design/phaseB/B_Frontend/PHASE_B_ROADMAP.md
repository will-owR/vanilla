# Phase B Frontend: Complete Roadmap & Timeline

**Created**: November 26, 2025  
**Status**: 🎯 Planning & Execution Phase  
**Scope**: Phase B Options 2, 3, 5 (ebookService frontend integration)  
**Target Service**: aetherV0/anew-default-ebook

---

## Executive Summary

**Phase B Frontend is a 3-option progressive implementation strategy**, each with its own feature branch, documentation, and timeline.

- **Option 2** (Current): Store-based MVP - in progress on `feat/B_Frontend_option2`
- **Option 3** (Next): Dashboard + project management - to be executed on `feat/B_Frontend_option3`
- **Option 5** (Long-term): Schema-driven UI - to be executed on `feat/B_Frontend_option5`

All three options build on each other with 80%+ code reuse. Each has three documents (Architecture, Specs, Implementation) created **before coding begins**.

---

## Phase B Option 2: Store-Based MVP

**Branch**: `feat/B_Frontend_option2`  
**Status**: 🔧 Week 1 Fix (In Progress)  
**Timeline**: 2 weeks (Week 1: 40 min fix + testing, Week 2: validation & merge)

### **Documentation** ✅ (Created)

| Document                          | Purpose                      | Status      |
| --------------------------------- | ---------------------------- | ----------- |
| PHASE_B_OPTION2_ARCHITECTURE.md   | High-level design, data flow | ✅ Complete |
| PHASE_B_OPTION2_MODULE_SPECS.md   | Detailed function contracts  | ✅ Complete |
| PHASE_B_OPTION2_IMPLEMENTATION.md | Step-by-step fix guide       | ✅ Complete |

### **Week 1: Logic Adjustments** (40 minutes)

**Issue**: Chapter content exists in backend but not in final HTML

**Root Cause**: `genieService.compose()` never called in pipeline

**Fix** (3 changes):

1. Add compose() call in genieService.process() (5 min)
2. Include html field in envelope (2 min)
3. Update endpoint response (2 min)
4. Frontend verification (5 min)
5. Testing & validation (21 min)

**Acceptance Criteria**:

- ✅ 678/684 tests passing
- ✅ eBooks display full paragraph content (not just titles)
- ✅ PDF export includes all chapters with content

**Deliverable**: feat/B_Frontend_option2 ready for merge

### **Week 2: Validation & Merge**

**Tasks**:

- Final E2E testing (manual: generate → preview → export PDF)
- Merge `feat/B_Frontend_option2` → `aetherV0/anew-default-ebook`
- Tag release: `v0.2.0-beta` (Phase B Option 2 MVP)

**Merge Strategy**:

```
feat/B_Frontend_option2
  → aetherV0/anew-default-ebook (active service branch)
     [Option 2 now integrated with ebookService]
```

**Go/No-Go Decision**:

- Go if: All tests pass + paragraphs visible + no blockers
- No-go if: Critical issues found → investigate, fix, re-test

---

## Phase B Option 3: Dashboard + Project Management

**Branch**: `feat/B_Frontend_option3` (to be created)  
**Status**: 📋 Planning (pending Option 2 merge)  
**Timeline**: 3 weeks (Weeks 3-4: implementation + testing)  
**Estimated Effort**: 6-8 hours

### **Documentation to Create** (Before Implementation Starts)

| Document                          | Purpose                                         | ETA           |
| --------------------------------- | ----------------------------------------------- | ------------- |
| PHASE_B_OPTION3_ARCHITECTURE.md   | Routing, persistence, dashboard design          | Before Week 3 |
| PHASE_B_OPTION3_MODULE_SPECS.md   | projectStore, Dashboard page, Editor page specs | Before Week 3 |
| PHASE_B_OPTION3_IMPLEMENTATION.md | Step-by-step implementation roadmap             | Before Week 3 |

### **What Option 3 Adds** (Building on Option 2)

**Reuses from Option 2** (80% code reuse):

- ✅ ebookStore.js (config + generation state)
- ✅ ebookApi.js (3 endpoints)
- ✅ ThemeSelector, PageCountSlider, OverrideForm, ThemePreview components
- ✅ All backend endpoints unchanged

**New Features** (Option 3 specific):

- **Routing**: `/ebook-generator`, `/ebook-generator/new`, `/ebook-generator/edit/{id}`
- **projectStore.js**: CRUD operations + persistence (localStorage initially)
- **Dashboard page**: List/search/filter saved projects
- **Editor page**: Full-screen dedicated editing interface
- **Version history**: Undo/redo per project + timestamps
- **Auto-save**: Every 2 seconds during editing
- **Batch generation**: Queue multiple eBooks

### **Week 3: Architecture & Dashboard Implementation** (3-4 hours)

**Tasks**:

1. Create routing structure (SvelteKit routes)
2. Design projectStore (state for projects CRUD)
3. Build Dashboard page (list + search + delete)
4. Implement localStorage persistence
5. Unit tests for projectStore

**Deliverable**: Dashboard page functional, can list/create/delete projects

### **Week 4: Editor & Version History** (2-3 hours)

**Tasks**:

1. Build dedicated Editor page
2. Implement auto-save (2s debounce)
3. Add version history UI (timestamps, restore)
4. Integration testing (E2E: create → edit → save → undo)
5. Performance testing

**Deliverable**: Full project workflow (create → edit → save → restore)

**Acceptance Criteria**:

- ✅ All Option 2 tests still passing (678/684+)
- ✅ Dashboard displays all projects
- ✅ Can create/edit/delete projects
- ✅ Auto-save works (2s debounce)
- ✅ Version history navigable
- ✅ No performance degradation
- ✅ localStorage persists across sessions

### **Merge Strategy**

```
feat/B_Frontend_option3 (new branch from aetherV0/anew-default-ebook)
  → aetherV0/anew-default-ebook
     [Option 2 + Option 3 now integrated]
```

**Go/No-Go Criteria**:

- All tests passing
- Dashboard functional (list/search/delete)
- Editor page functional (create/edit/save)
- Version history working
- Auto-save verified

---

## Phase B Option 5: Schema-Driven UI System

**Branch**: `feat/B_Frontend_option5` (to be created)  
**Status**: 📋 Planning (pending Option 3 merge)  
**Timeline**: 4 weeks (Weeks 5-8: design + implementation + rollout)  
**Estimated Effort**: 12-16 hours

### **Documentation to Create** (Before Implementation Starts)

| Document                          | Purpose                                             | ETA           |
| --------------------------------- | --------------------------------------------------- | ------------- |
| PHASE_B_OPTION5_ARCHITECTURE.md   | Schema types, SchemaRenderer, A/B testing design    | Before Week 5 |
| PHASE_B_OPTION5_MODULE_SPECS.md   | UISchema interface, SchemaBuilder, validation specs | Before Week 5 |
| PHASE_B_OPTION5_IMPLEMENTATION.md | Phased migration plan, rollout strategy             | Before Week 5 |

### **What Option 5 Adds** (Revolutionary Architecture)

**Reuses from Option 2 & 3** (as fallback):

- ✅ ebookStore.js (unchanged)
- ✅ Dashboard + Editor (Option 3 features)
- ✅ All endpoints (unchanged)

**New Architecture** (Option 5 specific):

- **Backend generates UI schemas** (JSON describing structure)
- **Frontend is generic renderer** (no hardcoded components)
- **Server controls frontend structure** (zero deploy for UI changes)
- **A/B testing framework** (different schemas per user cohort)
- **Feature flags** (hide/show features server-side)

### **Week 5: Schema Design & Types** (2-3 hours)

**Tasks**:

1. Define UISchema TypeScript types
2. Create schema validation engine
3. Design SchemaRenderer component (generic)
4. Build schema examples (dashboard, editor, etc.)
5. Unit tests for schema validation

**Deliverable**: UISchema types + SchemaRenderer component + examples

### **Week 6: Backend SchemaBuilder** (2-3 hours)

**Tasks**:

1. Implement SchemaBuilder service
2. Create /api/ebook/generate-schema endpoint
3. A/B testing infrastructure (assign schemas to users)
4. Feature flags system (schema.hidden)
5. Schema versioning strategy

**Deliverable**: Backend can generate schemas + assign to users

### **Week 7: Migration to Schema-Driven** (2-3 hours)

**Tasks**:

1. Update frontend to use SchemaRenderer for dashboard
2. Update frontend to use SchemaRenderer for editor
3. Fallback to Option 3 components during transition
4. Gradual rollout (10% → 50% → 100%)
5. Monitoring + metrics

**Deliverable**: Schema-driven UI running alongside Option 3 (canary)

### **Week 8: Stabilization & Rollout** (1-2 hours)

**Tasks**:

1. Gradual migration to 100% schema-driven
2. Performance optimization
3. A/B testing analysis (compare UI versions)
4. Documentation for schema management
5. Deprecation of hardcoded Option 3 components

**Deliverable**: Production schema-driven UI with A/B testing

**Acceptance Criteria**:

- ✅ All tests passing (678/684+ for each schema version)
- ✅ Schema-driven UI renders correctly for all use cases
- ✅ A/B testing framework operational
- ✅ Feature flags functional
- ✅ Zero downtime migration complete
- ✅ Option 3 components deprecated (but fallback available)

### **Merge Strategy**

```
feat/B_Frontend_option5 (new branch from aetherV0/anew-default-ebook)
  → aetherV0/anew-default-ebook
     [Option 2 + Option 3 + Option 5 now integrated]
```

**Go/No-Go Criteria**:

- All tests passing
- Schema-driven UI production stable
- A/B testing validated
- Zero rollback needed

---

## Complete Timeline Overview

```
Week 1:  Option 2 Fix (40 min) + Testing
Week 2:  Option 2 Validation & Merge
         ↓
Week 3:  Option 3 Dashboard (3-4 hours)
Week 4:  Option 3 Editor & History (2-3 hours) + Merge
         ↓
Week 5:  Option 5 Schema Design (2-3 hours)
Week 6:  Option 5 Backend SchemaBuilder (2-3 hours)
Week 7:  Option 5 Migration to Schema (2-3 hours)
Week 8:  Option 5 Stabilization & Rollout (1-2 hours) + Merge
         ↓
Week 8+: Gradual Rollout & Monitoring
         Option 5 production stable
```

**Total Effort**: ~40 min + 6-8 hrs + 12-16 hrs = ~20 hours over 8 weeks

---

## Feature Branch Management

### **Branch Naming Convention**

```
feat/B_Frontend_option{N}

Example:
- feat/B_Frontend_option2  (current, working)
- feat/B_Frontend_option3  (to be created after Week 2)
- feat/B_Frontend_option5  (to be created after Week 4)
```

### **Branch Workflow**

```
main (production)
  ↑
aetherV0/anew-default-ebook (active service branch)
  ↑
feat/B_Frontend_option2 (Option 2 work)
  └─ After Week 2 validation → MERGE to aetherV0/anew-default-ebook

aetherV0/anew-default-ebook (with Option 2)
  ↑
feat/B_Frontend_option3 (Option 3 work)
  └─ After Week 4 validation → MERGE to aetherV0/anew-default-ebook

aetherV0/anew-default-ebook (with Option 2 + 3)
  ↑
feat/B_Frontend_option5 (Option 5 work)
  └─ After Week 8 validation → MERGE to aetherV0/anew-default-ebook

aetherV0/anew-default-ebook (with Option 2 + 3 + 5)
  └─ Ready for production release
```

### **Branch Creation**

**Option 3 branch** (to be created before Week 3):

```bash
git checkout aetherV0/anew-default-ebook
git pull origin aetherV0/anew-default-ebook
git checkout -b feat/B_Frontend_option3
```

**Option 5 branch** (to be created before Week 5):

```bash
git checkout aetherV0/anew-default-ebook
git pull origin aetherV0/anew-default-ebook
git checkout -b feat/B_Frontend_option5
```

---

## Documentation Checklist

### **Option 2** ✅ (Completed)

- [x] PHASE_B_OPTION2_ARCHITECTURE.md
- [x] PHASE_B_OPTION2_MODULE_SPECS.md
- [x] PHASE_B_OPTION2_IMPLEMENTATION.md

### **Option 3** 📋 (To Create Before Week 3)

- [ ] PHASE_B_OPTION3_ARCHITECTURE.md (dashboard design, routing, persistence)
- [ ] PHASE_B_OPTION3_MODULE_SPECS.md (projectStore, pages, endpoints)
- [ ] PHASE_B_OPTION3_IMPLEMENTATION.md (step-by-step, testing, acceptance)

### **Option 5** 📋 (To Create Before Week 5)

- [ ] PHASE_B_OPTION5_ARCHITECTURE.md (schema system, SchemaRenderer)
- [ ] PHASE_B_OPTION5_MODULE_SPECS.md (UISchema types, SchemaBuilder)
- [ ] PHASE_B_OPTION5_IMPLEMENTATION.md (migration plan, A/B testing, rollout)

---

## Key Decisions & Blockers

### **Decision Points**

| Decision                                                  | Impact                   | Timeline      | Owner     |
| --------------------------------------------------------- | ------------------------ | ------------- | --------- |
| Persistence: localStorage vs PostgreSQL?                  | Option 3 data durability | Before Week 3 | Team      |
| A/B Testing: MVP feature or Phase 2?                      | Option 5 scope           | Before Week 5 | Product   |
| Schema Versioning Strategy                                | Option 5 compatibility   | Before Week 5 | Tech Lead |
| Rollout Speed: Gradual (4 weeks) or Aggressive (2 weeks)? | Option 5 timeline        | Before Week 5 | Team      |

### **Potential Blockers**

| Blocker                        | Impact               | Mitigation                                    |
| ------------------------------ | -------------------- | --------------------------------------------- |
| Gemini API latency >180s       | Option 2 timeout     | Increase timeout, optimize prompts            |
| Database schema changes needed | Option 3 persistence | Design schema first, test locally             |
| Schema migration complexity    | Option 5 rollout     | Build comprehensive fallback, gradual rollout |
| Team availability              | All timelines        | Flexible pacing, buffer weeks                 |

---

## Success Criteria by Phase

### **Option 2 Success** (Week 2)

✅ All 678 tests passing  
✅ eBooks show titles + full paragraph content  
✅ PDF export includes all chapters  
✅ No console errors  
✅ Merged to aetherV0/anew-default-ebook

### **Option 3 Success** (Week 4)

✅ All tests passing (678/684+)  
✅ Dashboard lists all projects  
✅ Can create/edit/delete projects  
✅ Auto-save working (2s debounce)  
✅ Version history functional  
✅ localStorage persists data  
✅ Merged to aetherV0/anew-default-ebook

### **Option 5 Success** (Week 8+)

✅ All tests passing  
✅ Schema-driven UI renders correctly  
✅ A/B testing framework operational  
✅ Feature flags working  
✅ Zero downtime migration  
✅ Option 3 deprecated (fallback available)  
✅ Merged to aetherV0/anew-default-ebook

---

## Resource Requirements

### **Developer Time**

| Phase     | Hours         | Weeks       | Pace                   |
| --------- | ------------- | ----------- | ---------------------- |
| Option 2  | 0.67          | 2           | ~20 min/week + testing |
| Option 3  | 6-8           | 2           | ~3-4 hrs/week          |
| Option 5  | 12-16         | 4           | ~3-4 hrs/week          |
| **Total** | **~20 hours** | **8 weeks** | **2-3 hrs/week avg**   |

### **Skills Required**

- **Svelte/SvelteKit** (all options)
- **TypeScript** (all options)
- **Node.js/Express** (endpoints, schema builder)
- **HTML/CSS** (Option 5 SchemaRenderer)
- **A/B Testing/Feature Flags** (Option 5)

---

## Risk Assessment

| Option   | Risk                | Likelihood | Impact | Mitigation                     |
| -------- | ------------------- | ---------- | ------ | ------------------------------ |
| Option 2 | Compose not called  | Low        | High   | Already identified, documented |
| Option 3 | localStorage limits | Medium     | Medium | Add PostgreSQL option later    |
| Option 5 | Schema complexity   | Medium     | High   | Extensive testing, fallback    |

**Overall Risk Level**: 🟢 **Low-Medium** (clear roadmap, documentation-driven)

---

## Related Documents

**Option 2**:

- Architecture: [PHASE_B_OPTION2_ARCHITECTURE.md](PHASE_B_OPTION2_ARCHITECTURE.md)
- Specs: [PHASE_B_OPTION2_MODULE_SPECS.md](PHASE_B_OPTION2_MODULE_SPECS.md)
- Implementation: [PHASE_B_OPTION2_IMPLEMENTATION.md](PHASE_B_OPTION2_IMPLEMENTATION.md)

**Backend**:

- ebookService: [README_ebook.md](../../../design/ebookService/README_ebook.md)
- Phase B Overview: [README_PhaseB.md](to_Come/README_PhaseB.md)

**Option 3 & 5 Docs**: (To be created)

---

## Next Actions

### **Immediate** (Week 1)

- [ ] Execute Option 2 fix (3 code changes, 40 min)
- [ ] Run tests (expect 678/684 passing)
- [ ] Manual validation (generate → preview → export)

### **Week 2**

- [ ] Final E2E testing
- [ ] Merge feat/B_Frontend_option2 → aetherV0/anew-default-ebook
- [ ] Tag v0.2.0-beta

### **Before Week 3**

- [ ] Create feat/B_Frontend_option3 branch
- [ ] Create 3 Option 3 documentation files
- [ ] Plan dashboard UI mockups
- [ ] Decide: localStorage vs PostgreSQL?

### **Before Week 5**

- [ ] Create feat/B_Frontend_option5 branch
- [ ] Create 3 Option 5 documentation files
- [ ] Design UISchema types
- [ ] Plan A/B testing strategy

---

## Version History

| Version | Date         | Status | Changes                                        |
| ------- | ------------ | ------ | ---------------------------------------------- |
| 1.0     | Nov 26, 2025 | Active | Initial roadmap: Option 2 fix + Weeks 2-8 plan |

---

**Last Updated**: November 26, 2025  
**Status**: 🎯 Ready for Execution  
**Next Milestone**: Option 2 merge to aetherV0/anew-default-ebook (Week 2)
