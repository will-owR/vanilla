# Phase B Option 2: Store-Based MVP - Architecture

**Status**: ✅ **CLOSED - WEEK 1 COMPLETE** (November 28, 2025)  
**Resolution Date**: November 28, 2025  
**Branch**: `feat/B_Frontend_option2`  
**Timeline**: Week 1 (Complete + Verified) → Ready for Week 2 Merge  
**Risk Level**: 🟢 Low (isolated fix - verified working)  
**Production Target**: Week 2 (aetherV0/anew-default-ebook)

---

## Executive Summary

**Option 2 is a store-based, frontend-agnostic MVP for intelligent content generation.**

Architecture is **complete and tested** (678/684 tests passing). Only issue: `genieService.compose()` is never called in the pipeline, so chapter content exists in data but not in final HTML. **Week 1 fix**: Add compose() call in orchestration layer. Result: Full HTML with all paragraphs properly rendered.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Svelte + Reactive Stores)                             │
│                                                                 │
│ User Input Layer                                                │
│  └─ PromptInput (text)                                          │
│  └─ ThemeSelector (dark|light|corporate|bold)                   │
│  └─ PageCountSlider (3-20 pages)                                │
│                                                                 │
│ Configuration Management                                        │
│  └─ ebookStore.js (central state: config, result, history)      │
│      ├─ setTheme() | setPageCount() | setColorPalette() | ... │
│      ├─ generate(prompt) → calls ebookApi                       │
│      ├─ applyOverride(overrides) → style override fast-path     │
│      └─ undo/redo history (up to 50 states)                     │
│                                                                 │
│ HTTP Client                                                     │
│  └─ ebookApi.js                                                 │
│      ├─ generateEbook(payload) → POST /api/ebook/generate       │
│      ├─ applyOverride(payload) → POST /api/override             │
│      └─ fetchThemes() → GET /api/themes                         │
│      (with 180s timeout for Gemini latency)                     │
│                                                                 │
│ Display Components                                              │
│  ├─ ThemeSelector (4 themes)                                    │
│  ├─ PageCountSlider (3-20 dynamic)                              │
│  ├─ OverrideForm (style reapplication)                          │
│  └─ ThemePreview (color visualization)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓↑ (HTTPS)
            (Content Request / HTML Response)
                            ↓↑
┌─────────────────────────────────────────────────────────────────┐
│ ORCHESTRATION LAYER (genieService)                              │
│                                                                 │
│ genieService.process(payload)                                   │
│  │                                                              │
│  ├─ 1. Route by mode (ebook, demo, basic)                       │
│  │                                                              │
│  ├─ 2. Call service handler:                                    │
│  │   ebookService.handle() → { pages, metadata, actions }       │
│  │                                                              │
│  ├─ 3. [WEEK 1 FIX] Call compose():                             │
│  │   genieService.compose(result) → HTML string                 │
│  │   (include in envelope)                                      │
│  │                                                              │
│  ├─ 4. Build envelope:                                          │
│  │   {                                                          │
│  │     out_envelope: {                                          │
│  │       pages: [{id, title, content, image}...],               │
│  │       html: "complete HTML with paragraphs",  ← NEW          │
│  │       metadata: {...},                                       │
│  │       actions: {...}                                         │
│  │     },                                                       │
│  │     resultId: uuid                                           │
│  │   }                                                          │
│  │                                                              │
│  └─ 5. Return to endpoint                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓↑
┌─────────────────────────────────────────────────────────────────┐
│ CONTENT GENERATION LAYER (ebookService)                         │
│                                                                 │
│ ebookService.handle(payload, classification)                    │
│                                                                 │
│  ├─ Conversation 1: Structure                                   │
│  │  └─ AI generates: { title, chapters, outline }               │
│  │                                                              │
│  ├─ Conversation 2+: Per-Chapter Content (loop)                 │
│  │  └─ AI generates: { title, content, image_concept }          │
│  │  └─ Store: { id, chapter, title, content, image }            │
│  │                                                              │
│  └─ Return: { pages, metadata, actions }                        │
│     pages[0] = { id, title, content, image }                    │
│                 └─ content exists in data                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓↑
┌─────────────────────────────────────────────────────────────────┐
│ HTML COMPOSITION LAYER (genieService.compose)                   │
│                                                                 │
│ INPUT: { pages: [{title, content, image}...], metadata }        │
│                                                                 │
│ PROCESS:                                                        │
│  1. Generate Cover Page (theme colors)                          │
│  2. Generate Copyright Page                                     │
│  3. Generate Table of Contents                                  │
│  4. Generate Content Pages:                                     │
│     - Chapter heading                                           │
│     - Image concept block                                       │
│     - <div class="chapter-content">                             │
│        { content.replace(/\n/g, "<br />") }  ← CONTENT HERE     │
│       </div>                                                    │
│     - Page break                                                │
│  5. Generate Epilogue                                           │
│  6. Assemble complete HTML                                      │
│                                                                 │
│ OUTPUT: Complete HTML string with theme styles + all paragraphs │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓↑
┌─────────────────────────────────────────────────────────────────┐
│ HTTP ENDPOINT LAYER                                             │
│                                                                 │
│ POST /api/ebook/generate                                        │
│  ├─ Input: { prompt, theme, pageCount, colorPalette, ... }     │
│  ├─ Calls: genieService.process(payload)                        │
│  ├─ Response includes:                                          │
│  │  ├─ id: ebookId                                              │
│  │  ├─ chapters: array of pages                                 │
│  │  ├─ html: complete HTML string  ← [WEEK 1 NEW]               │
│  │  ├─ metadata: theme, density, etc.                           │
│  │  └─ actions: { can_export, can_override, ... }               │
│  └─ Returns: 200 success or 400/500 error                       │
│                                                                 │
│ POST /api/override                                              │
│  ├─ Input: { ebookId, html, metadata, overrides }               │
│  ├─ Process: Apply CSS changes (fast-path)                      │
│  └─ Returns: Updated { html, metadata }                         │
│                                                                 │
│ GET /api/themes                                                 │
│  └─ Returns: { themes[], colorPalettes[] }                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Complete Request → Response

### **1. User Initiates Generation**

**Frontend (ebookStore.generate)**:

```javascript
await ebookApi.generateEbook({
  prompt: "A detective story...",
  theme: "dark",
  pageCount: 8,
  colorPalette: "standard",
  fontSizeScale: 1.0,
});
```

### **2. Backend: Orchestration (genieService.process)**

**Input to process()**:

```javascript
{
  mode: "ebook",
  prompt: "A detective story...",
  metadata: {
    theme: "dark",
    pageCount: 8,
    colorPalette: "standard",
    fontSizeScale: 1.0
  }
}
```

**Route Decision**: `case "ebook"` → call `ebookService.handle()`

### **3. Backend: Content Generation (ebookService.handle)**

**Conversation 1** (Structure):

```
AI Input: "Create structure for 8-page ebook: A detective story..."
AI Output: {
  title: "Detective's Mystery",
  chapters: 4,
  outline: [
    { chapter: 1, title: "The Case Begins", topics: [...] },
    ...
  ]
}
```

**Conversation 2a-d** (Per-Chapter Content):

```
AI Input: "Write Chapter 1: The Case Begins. 600-800 words..."
AI Output: {
  chapter: 1,
  title: "The Case Begins",
  content: "Detective Sarah arrived at the scene... The victim lay still...",
  image: { concept: "noir detective...", style: "gothic", tone: "mysterious" }
}
```

**ebookService Returns**:

```javascript
{
  pages: [
    {
      id: "ch_1",
      title: "The Case Begins",
      content: "Detective Sarah arrived at the scene...",  ← DATA EXISTS
      image: { concept: "...", style: "gothic", ... }
    },
    // ... more chapters
  ],
  metadata: {
    model: "ebook-v1",
    pages_count: 8,
    theme: "dark",
    colorPalette: "standard",
    fontSizeScale: 1.0,
    density: "medium"
  },
  actions: {
    persist_prompt: true,
    generate_pdf: true,
    can_export: true,
    can_preview: true,
    can_override: true
  }
}
```

### **4. Backend: Orchestration Wraps Result [WEEK 1 FIX HERE]**

**Before Week 1 Fix** ❌:

```javascript
const envelope = {
  out_envelope: {
    pages: result.pages, // ← has content
    metadata: result.metadata,
    actions: result.actions,
    // ❌ html field missing
  },
  resultId: uuid,
};
return envelope; // → sent to endpoint without HTML generation
```

**After Week 1 Fix** ✅:

```javascript
// NEW: Call compose to generate HTML
const html = await this.compose(result);

const envelope = {
  out_envelope: {
    pages: result.pages,
    html: html, // ← HTML with all paragraphs
    metadata: result.metadata,
    actions: result.actions,
  },
  resultId: uuid,
};
return envelope;
```

### **5. Backend: Endpoint Transforms Response**

**POST /api/ebook/generate Response**:

```javascript
{
  id: "ebook_...",
  resultId: uuid,
  chapters: [
    {
      id: "ch_1",
      title: "The Case Begins",
      content: "Detective Sarah arrived...",
      image: { ... }
    },
    // ...
  ],
  html: "<div class='page cover-page'>...</div>
          <div class='page toc-page'>...</div>
          <div class='page content-page'>
            <h2>Chapter 1: The Case Begins</h2>
            <div class='chapter-content'>
              <p>Detective Sarah arrived at the scene...</p>
              ...
            </div>
          </div>
          ...",  // ← Full HTML with paragraphs
  metadata: {
    title: "Detective's Mystery",
    theme: "dark",
    density: "medium",
    pageCount: 8,
    ...
  },
  actions: { ... }
}
```

### **6. Frontend: Display Results**

**ebookStore receives response**:

- Stores `html` in `result.html`
- Stores `chapters` in `result.chapters`
- Stores `metadata`

**Frontend renders**:

```svelte
{#if ebookResult && ebookResult.html}
  <div class="preview">
    {@html ebookResult.html}  ← Render full HTML with paragraphs
  </div>
{/if}
```

### **7. User Exports to PDF**

**ExportButton calls**:

```javascript
await exportToPdf({
  pages: ebookResult.chapters,  ← Structural data
  metadata: ebookResult.metadata,
  actions: ebookResult.actions,
  html: ebookResult.html  ← Complete HTML
});
```

**PDF includes**: Cover + copyright + TOC + all chapters with content + epilogue

---

## Core Modules

### **1. Frontend State (ebookStore.js)**

**Responsibility**: Central state management for all ebook operations

**State Shape**:

```javascript
{
  config: {
    theme: "dark",
    pageCount: 8,
    colorPalette: "standard",
    fontSizeScale: 1.0,
    density: "medium"  // computed from pageCount
  },
  result: {
    id: "ebook_...",
    html: "<complete HTML>",
    chapters: [{id, title, content, image}...],
    metadata: {...},
    actions: {...}
  },
  loading: false,
  error: null,
  status: "idle" | "generating" | "success" | "error",
  history: {
    configs: [{...}, {...}...],
    currentIndex: 5
  }
}
```

**Key Methods**:

- `setTheme(theme)` - Update theme + add to history
- `setPageCount(count)` - Update count + compute density + history
- `generate(prompt)` - Orchestrate full generation
- `applyOverride(overrides, ebookId)` - Fast-path style changes
- `undo()` / `redo()` - Navigate history
- `reset()` - Clear to initial state

---

### **2. Frontend HTTP Client (ebookApi.js)**

**Responsibility**: Network layer with timeout + error handling

**Endpoints**:

| Method | Path                | Timeout | Purpose               |
| ------ | ------------------- | ------- | --------------------- |
| POST   | /api/ebook/generate | 180s    | Generate full ebook   |
| POST   | /api/override       | 10s     | Apply style overrides |
| GET    | /api/themes         | 5s      | Fetch theme metadata  |

**Error Handling**: Network errors, API errors, timeouts → user-friendly messages

---

### **3. Backend Orchestration (genieService.process)**

**Responsibility**: Route requests to appropriate service + build response envelope

**Flow**:

1. Accept payload with mode
2. Auto-classify if needed
3. Route to service (ebook, demo, basic)
4. **[WEEK 1 NEW]** Call compose() for ebook mode
5. Build envelope with resultId
6. Persist to result DB
7. Return envelope

---

### **4. Content Generation (ebookService.handle)**

**Responsibility**: Sequential AI conversations to generate structured chapter data

**Process**:

1. Conversation 1: Request structure (title, chapters, outline)
2. Conversation 2+: Per-chapter loop (content + image concepts)
3. Return: { pages, metadata, actions }

**AI Calls**:

- Conversation 1: ~$0.001 (structure)
- Conversation 2+: ~$0.0005 each (per chapter)

---

### **5. HTML Composition (genieService.compose)**

**Responsibility**: Transform structured data → production-ready HTML

**Input**: `{ pages, metadata }`

**Process**:

1. Define theme colors based on metadata.theme
2. Generate cover page (title + date)
3. Generate copyright page
4. Generate table of contents
5. **For each page**:
   - Chapter heading
   - Image concept block (if present)
   - **Chapter content block** (content.replace(/\n/g, "<br />"))
   - Page break
6. Generate epilogue
7. Assemble complete HTML with doctype

**Output**: String (complete valid HTML for rendering/PDF)

---

### **6. Frontend Components**

| Component              | Purpose               | Wiring                               |
| ---------------------- | --------------------- | ------------------------------------ |
| ThemeSelector.svelte   | 4 theme radio buttons | onChange → ebookStore.setTheme()     |
| PageCountSlider.svelte | 3-20 page slider      | onChange → ebookStore.setPageCount() |
| OverrideForm.svelte    | Style override form   | onApply → ebookStore.applyOverride() |
| ThemePreview.svelte    | Color visualization   | Display theme colors + page count    |

---

## Week 1 Fix: Compose Integration

### **Current Issue** ❌

```
ebookService.handle()
  → returns { pages: [...content...] }
  → wrapped in envelope
  → sent to endpoint
  → returned to frontend
  → [MISSING STEP: compose() never called]
  → frontend receives raw pages (no HTML)
  → user sees title only (no paragraphs)
```

### **Week 1 Solution** ✅

**3 Changes**:

1. **genieService.process()** - Add compose() call
2. **genieService.process()** - Include HTML in envelope
3. **POST /api/ebook/generate** - Include HTML in response

**Result**:

```
ebookService.handle()
  → returns { pages: [...content...] }
  → wrapped in envelope
  → [NEW] compose() generates HTML
  → HTML includes all chapter content
  → endpoint sends HTML in response
  → frontend renders HTML
  → user sees title + full paragraphs ✅
```

---

## Related Documents

- **[Module Specs](PHASE_B_OPTION2_MODULE_SPECS.md)** - Detailed function signatures and contracts
- **[Implementation Guide](PHASE_B_OPTION2_IMPLEMENTATION.md)** - Step-by-step Week 1 fix
- **[Backend Spec](../../../design/ebookService/README_ebook.md)** - ebookService details
- **[Phase B Overview](README_PhaseB.md)** - Options 2, 3, 5 comparison

---

## Timeline

### **Week 1: Logic Adjustments (30 minutes)**

- [ ] Add compose() call in genieService.process() (5 min)
- [ ] Include HTML in envelope (2 min)
- [ ] Update endpoint response (2 min)
- [ ] Update frontend to use HTML (5 min)
- [ ] Validate: Tests pass + paragraphs visible (15 min)

**Acceptance**: All 678 tests passing + eBook displays full paragraph content

### **Week 2: Validate & Merge**

- [ ] Final E2E testing
- [ ] Merge to `aetherV0/anew-default-ebook`
- [ ] Tag: `v0.2.0-beta` (Phase B Option 2)

### **Weeks 3-4: Option 3 (Dashboard + Project Management)**

- Implement in `feat/B_Frontend_option3` branch
- Reuse 80% of Option 2 code
- Add routing, persistence, version history

### **Weeks 5-8: Option 5 (Schema-Driven UI)**

- Implement in `feat/B_Frontend_option5` branch
- Backend returns UI schemas
- Server controls frontend structure
- A/B testing + feature flags

---

## Success Criteria

✅ Compose called for all ebook requests  
✅ HTML generated with all chapter content  
✅ Frontend receives html field in response  
✅ eBooks display full paragraphs (not just titles)  
✅ All 678 tests passing  
✅ PDF export includes all content  
✅ Performance: Generate <3min, Override <2s  
✅ Error handling graceful

---

## Key Architectural Principles

### **Separation of Concerns**

- **ebookService**: Content generation only (AI calls, data structure)
- **genieService**: Orchestration + composition (routing, HTML generation)
- **Endpoint**: Request validation + response transformation
- **Frontend**: User interaction + state management + display

### **Service-Agnostic Patterns**

Option 2 architecture is designed to be **reusable for future services**:

- Store pattern (ebookStore) → works for any content type
- API client pattern (ebookApi) → works for any service endpoints
- Component pattern (ThemeSelector, etc.) → composable, reusable
- Composition layer (compose) → applicable to any structured data

### **No Hardcoding, All Data-Driven**

- Theme colors from metadata
- Font sizes from fontSizeScale
- Density classification from pageCount
- Content placement from pages array structure

---

**Last Updated**: November 26, 2025  
**Status**: 🔧 IN PROGRESS - Week 1 Fix  
**Next**: Implementation Guide (PHASE_B_OPTION2_IMPLEMENTATION.md)
