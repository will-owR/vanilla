# ebookService Architecture - QUICK REFERENCE

**Date**: November 23, 2025  
**Status**: 🔄 In Implementation (see README_ebook.md for details)

---

## ⚠️ Note: Documentation Consolidated

This file is now a **quick reference** for the 4 strategic decisions. For complete implementation details, see:

**Full Implementation Guide**: `/docs/design/ebookService/README_ebook.md`

This README includes:

- ✅ Data Flow diagram
- ✅ Service Responsibilities matrix
- ✅ Data Structures (input/output contracts)
- ✅ Sequential AI Conversation Pipeline (detailed)
- ✅ Image Style Determination (with logic)
- ✅ Content Validation Strategy
- ✅ Image Cache Strategy (with code examples)
- ✅ Implementation Checklist (with checkboxes)
- ✅ Cost Analysis ($0.21 per ebook)
- ✅ Quality Checkpoints
- ✅ Testing & Validation framework

---

## 4 Strategic Decisions (Quick Reference)

### 1. ✅ Sequential AI Conversations

**Decision**: Use sequential, multi-turn conversations for greater control

**Implementation**:

- Conversation 1: Request chapter structure and outline
- Conversation 2: For EACH chapter (sequential):
  - Request content (600-800 words)
  - Request image concept for that chapter
  - Store both before proceeding to next chapter

**Benefit**: Maximum control over content quality and coherence

---

### 2. ✅ Image Style Determination

**Decision**: Hybrid approach - Theme-based DEFAULT + AI-guided PER CHAPTER

**Implementation**:

```
Theme Setting (Primary)
  ↓
  ├─ "dark" → gothic, moody, dramatic (default)
  ├─ "light" → bright, airy, clean, whimsical (default)
  ├─ "corporate" → professional, minimal, modern (default)
  └─ "bold" → vibrant, high-contrast, energetic (default)

  ↓ (Optional per-chapter override)

AI Suggestion (Secondary)
  ├─ "This chapter needs playful style"
  ├─ "This chapter should be mysterious"
  └─ "Suggest dramatic for climactic moment"

  ↓ (If AI suggestion differs AND is valid)

Result: Use AI suggestion for THAT chapter ONLY
```

**Benefit**: Visual consistency from theme + visual diversity from AI

---

### 3. ✅ Content Validation Strategy

**Decision**: "Edited Content Pass-Through" - Accept all AI content as-is

**Implementation**:

```
AI generates content → ebookService treats it as "edited" → Passes through unchanged
```

**Rationale**:

- Keeps ebookService focused on STRUCTURE, not content quality
- Allows AI full creative freedom
- User editing interface coming soon (Phase B+)
- Reduces scope for MVP

**Error Handling Only**:

- If AI fails to generate → throw error
- If JSON parsing fails → throw error
- If content is empty → throw error
- Otherwise → accept as valid

---

### 4. ✅ Image Cache Strategy

**Decision**: SVG Library 50% of the time + Gemini fallback

**Implementation**:

```
Query SVG Library
  ↓
  ├─ Cache HIT: 50% probability
  │   └─ Use cached SVG (cost: $0)
  │
  └─ Cache MISS OR 50% pass:
      └─ Generate via Gemini + cache (cost: $0.05)
```

**Logic**:

```javascript
const cached = await svgLibrary.search(concept, style);

if (cached && Math.random() < 0.5) {
  // Use cached SVG (50% of the time)
  return cached;
}

// Generate and cache (50% of the time OR on miss)
const generated = await geminiClient.generateImage(...);
await svgLibrary.store(generated, ...);
return generated;
```

**Benefit**: Cost optimization + visual variety (not repetitive)

---

## Data Flow Summary

```
User Request (Frontend)
  └─ prompt + metadata
       ↓
ebookService.handle()
  ├─ Conversation 1: Structure
  ├─ Conversation 2+: Sequential chapters
  └─ Return: Structured data
       ↓
genieService.compose()
  ├─ Resolve images (SVG library + Gemini)
  └─ Return: Final HTML
       ↓
Frontend (Display + Override + Export)
```

**For detailed flow**: See README_ebook.md "Data Flow & Architecture"

---

## ebookService vs genieService: Responsibilities

| Aspect               | ebookService                        | genieService                   |
| -------------------- | ----------------------------------- | ------------------------------ |
| **Generates**        | Chapter content via AI              | Final HTML with images         |
| **Input**            | User prompt + metadata              | Structured data from ebook     |
| **Output**           | Structured chapters data            | Production-ready ebook HTML    |
| **AI Calls**         | Multiple (structure + chapters)     | Zero (uses cached data)        |
| **Image Generation** | Concepts only                       | Actual images (SVG + Gemini)   |
| **Validation**       | Input validation, AI response check | Output HTML validation         |
| **Scope**            | Content generation logic            | Composition + asset management |

**For detailed responsibilities**: See README_ebook.md "Service Responsibilities"

---

## Key Metrics Summary

### Cost Optimization

| Operation                                  | Cost          | Frequency (100 ebooks) | Total       |
| ------------------------------------------ | ------------- | ---------------------- | ----------- |
| Prompt classification                      | ~$0.0001      | 100                    | ~$0.01      |
| Structure generation                       | ~$0.001       | 100                    | ~$0.10      |
| Chapter content (8 chapters × 100)         | ~$0.0005 each | 800                    | ~$0.40      |
| Image generation (8 images × 100, 50% hit) | ~$0.05 each   | 400                    | ~$20.00     |
| **Total**                                  | —             | —                      | **~$20.51** |

**Per-Ebook Cost**: ~$0.21

---

## Quality Checkpoints

### What's Validated:

- ✅ Input validation (prompt, pageCount, theme)
- ✅ AI response structure (has chapters, has content)
- ✅ Image concept validity (non-empty, descriptive)
- ✅ JSON parsing success

### What's NOT Validated:

- ❌ Content word count
- ❌ Content readability/quality
- ❌ Spelling/grammar
- ❌ Factual accuracy
- ❌ Image concept quality

**Why**: User editing coming soon. MVP focuses on generation speed.

---

## Implementation Checklist

### Phase 1: ebookService Implementation

- [ ] Create `ebookService.handle()` method
- [ ] Conversation 1: Structure generation prompt
- [ ] Conversation 2: Sequential chapter generation loop
- [ ] Image style determination logic
- [ ] Output validation against contract
- [ ] Error handling with descriptive messages
- [ ] Unit tests

### Phase 2: genieService Composition

- [ ] Extract `compose()` method from orchestrator
- [ ] Image resolution with SVG library integration
- [ ] HTML generation (cover, copyright, TOC, content, epilogue)
- [ ] Theme application across all components
- [ ] Integration tests
- [ ] E2E tests

### Phase 3: Frontend Integration

- [ ] Test ebook generation flow
- [ ] Theme switching on preview
- [ ] Override functionality
- [ ] Export to PDF
- [ ] Manual browser testing

---

## Documentation Locations

**Primary Resource** (Complete Implementation):

- **Full Implementation Guide**: `/docs/design/ebookService/README_ebook.md` (850+ lines)
  - Data Flow diagram
  - Service Responsibilities matrix
  - Input/Output contracts
  - Sequential AI conversation pipeline
  - Image style determination
  - Content validation strategy
  - Image cache strategy with code examples
  - Implementation checklist (with progress tracking)
  - Cost analysis & metrics
  - Quality checkpoints
  - Testing framework

**Quick References**:

- **This File**: `/docs/design/ebookService/EBOOK_ARCHITECTURE_FINAL_RECAP.md` (4 strategic decisions + key metrics)
- **Vision Architecture**: `/docs/design/phaseA/AETHERPRESS_VISION_ARCHITECTURE.md`
- **SVG Library Strategy**: `/docs/design/phaseB/SVGLIBRARY_ADDITION.md`

**Frontend Implementation Roadmap**:

- **Complete Roadmap**: `/docs/design/phaseB/B_Frontend/to_Come/README_PhaseB.md`
  - Option 2: Store-based MVP (4-5 hours)
  - Option 3: Dedicated pages with project management (6-8 hours)
  - Option 5: Schema-driven UI system (12-16 hours)

**Master Status Document**:

- **Current Status & Roadmap**: `/docs/design/AETHERPRESS_CURRENT_STATUS_AND_ROADMAP.md`
  - Phase B status (in-progress ebookService enhancement)
  - Current blockers and priorities
  - Next steps for Option 2 validation and Option 3 planning

---

## Cost Summary

**Per-Ebook Cost**: **~$0.21**

- Structure generation: ~$0.001
- Chapter content (8 chapters): ~$0.0005 per chapter
- Image generation (8 images, 50% SVG cache hit): ~$0.025 average
- Overhead: ~$0.0001

**See README_ebook.md "Key Metrics"** for detailed cost breakdown

---

## Success Criteria

✅ ebookService generates structured content via sequential AI conversations  
✅ genieService composes final ebook with resolved images  
✅ All 5 ebook components present (cover, copyright, TOC, content, epilogue)  
✅ Theme system working across all components  
✅ Image cache strategy operational (50% SVG, 50% Gemini)  
✅ Manual browser testing passes (E2E)  
✅ Unit + integration tests passing

---

## Next Steps

### Phase B Backend: ✅ COMPLETE

- ✅ Design finalized and documented
- ✅ Strategic decisions confirmed (4 key decisions)
- ✅ Data contracts specified
- ✅ Cost analysis completed ($0.21 per ebook)
- ✅ Architecture documented in README_ebook.md

### Phase B Frontend: READY TO IMPLEMENT

**Choose your path** (see `/docs/design/phaseB/B_Frontend/to_Come/README_PhaseB.md`):

1. **Option 2 - MVP** (Start here: 4-5 hours)

   - [ ] Implement ebookStore.js (state + business logic)
   - [ ] Implement ebookApi.js (HTTP client)
   - [ ] Wire 4 Phase B components to store
   - [ ] Create 3 backend endpoints
   - [ ] Basic integration testing
   - **Outcome**: Phase B UI fully functional, ready for MVP release

2. **Option 3 - Production** (After Option 2: 6-8 hours)

   - [ ] Add routing (dashboard, editor pages)
   - [ ] Create projectStore.js (CRUD + persistence)
   - [ ] Build Dashboard page (list/search/delete)
   - [ ] Build Editor page (full-screen editing)
   - [ ] Version history + auto-save
   - **Outcome**: Team can manage multiple eBook projects

3. **Option 5 - Enterprise** (Long-term: 12-16 hours)
   - [ ] Define UISchema TypeScript types
   - [ ] Implement SchemaRenderer component
   - [ ] Build SchemaValidator
   - [ ] Create SchemaBuilder (backend)
   - [ ] Add A/B testing + feature flags
   - **Outcome**: UI changes no longer require frontend deploy

---

**Recommended Timeline**:

- **This week**: Implement Option 2 (MVP ready by end of session)
- **Next week**: Migrate to Option 3 (production workflow)
- **January**: Plan Option 5 (enterprise features)

---

**Approved By**: Design Team  
**Ready For**: Implementation  
**Target Completion**: End of Phase B

---

_For questions, see `/docs/design/bug_report/` or contact design team._
