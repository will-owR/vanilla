# ebookService Architecture - FINAL RECAP

**Date**: November 23, 2025  
**Status**: ✅ DESIGN FINALIZED - READY FOR IMPLEMENTATION

---

## Strategic Decisions (Confirmed)

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
  └─ prompt: "A detective story..."
  └─ metadata: { theme, pageCount, colorPalette, fontSizeScale }
       ↓
genieService.process(payload, mode="ebook")
       ↓
ebookService.handle(payload)
  ├─ Conversation 1: Request structure
  │   AI → { title, chapters: 4, outline: [...] }
  │
  ├─ Conversation 2a: Chapter 1 content + image concept
  │   AI → { title, content, image: { concept, style, tone } }
  │
  ├─ Conversation 2b: Chapter 2 content + image concept
  │   AI → { ... }
  │
  ├─ Conversation 2c: Chapter 3 content + image concept
  │   AI → { ... }
  │
  ├─ Conversation 2d: Chapter 4 content + image concept
  │   AI → { ... }
  │
  └─ Return: Structured data { title, chapters[], metadata, actions }
       ↓
genieService.compose(structuredData)
  ├─ For each chapter:
  │   ├─ Resolve image: SVG library query (50/50 with Gemini)
  │   └─ Store in imageMap
  │
  ├─ Generate final HTML:
  │   ├─ Cover page
  │   ├─ Copyright page
  │   ├─ TOC (with resolved image IDs)
  │   ├─ Content pages (with embedded images)
  │   └─ Epilogue
  │
  └─ Return: Complete ebook HTML
       ↓
Frontend
  └─ Display HTML preview
  └─ Options: Override theme, export PDF, etc.
```

---

## ebookService Responsibilities

### ✅ DO:

- Generate prompt structure via AI
- Request chapter content via sequential AI calls
- Request image concepts per chapter
- Determine image style (theme-based + AI flexibility)
- Treat all content as "edited" and pass through
- Return structured data (chapters, metadata, actions)
- Throw descriptive errors on AI failures

### ❌ DON'T:

- Generate final HTML
- Embed images (only store concepts/references)
- Validate content quality
- Call other services (only geminiClient)
- Manage database persistence
- Handle HTTP requests

---

## genieService Responsibilities

### ✅ DO:

- Receive structured data from ebookService
- Resolve image concepts:
  - Query SVG library (50% hit strategy)
  - Generate via Gemini on miss/pass
  - Cache all Gemini-generated images
- Compose final ebook:
  - Create cover, copyright, TOC, content pages, epilogue
  - Embed resolved image IDs
  - Apply theme styling
- Return production-ready HTML

### ❌ DON'T:

- Generate chapter content (ebookService does)
- Make initial chapter outline decisions (ebookService does)

---

## Key Metrics

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

- **Full Design**: `/server/README_ebook_REVISED.md`
- **Vision Architecture**: `/docs/design/AETHERPRESS_VISION_ARCHITECTURE.md`
- **SVG Library**: `/docs/design/phaseB/SVGLIBRARY_ADDITION.md`
- **This Recap**: This file

---

## Success Criteria

### Phase B (MVP) Complete When:

✅ ebookService generates structured content via sequential AI conversations  
✅ genieService composes final ebook with resolved images  
✅ All 5 ebook components present (cover, copyright, TOC, content, epilogue)  
✅ Theme system working across all components  
✅ Image cache strategy operational (50% SVG, 50% Gemini)  
✅ Manual browser testing passes (E2E)  
✅ Unit + integration tests passing

---

## Next Steps

1. **Review** this recap with team
2. **Implement** ebookService.handle() using README_ebook_REVISED.md
3. **Implement** genieService.compose()
4. **Test** end-to-end in browser
5. **Deploy** Phase B to staging

---

**Approved By**: Design Team  
**Ready For**: Implementation  
**Target Completion**: End of Phase B

---

_For questions, see `/docs/design/bug_report/` or contact design team._
