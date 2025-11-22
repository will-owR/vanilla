# Phase B Frontend: Option 2 Store-Based Architecture

**Status**: 🎯 IMMEDIATE NEXT (Post Phase B Week 3)  
**Timeline**: 4-5 hours  
**Complexity**: Medium  
**Risk Level**: Low  
**Branch**: `aetherV0/anew-default-ebook` (existing)

---

## Overview

**Option 2** implements a centralized Svelte store pattern for Phase B frontend integration. All Phase B UI state (theme selection, page count, overrides, generation results) flows through a single reactive store, enabling clean component composition, testability, and future scaling.

### Key Principles

1. **Store-Centric**: `ebookStore.js` owns all business logic + API orchestration
2. **Dumb Components**: UI components are presentational, bind directly to store
3. **No Prop Drilling**: Components subscribe to store, zero cascading props
4. **Reactive**: Svelte reactivity handles all state updates automatically
5. **Testable**: Business logic separated from rendering, easy to mock

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        App.svelte                            │
│  (Main orchestrator - renders Phase B section conditionally) │
└──────────────────────────────────────────────────────────────┘
                              │
                              ├─ subscribe to ebookStore
                              └─ renders Phase B UI section
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
   ┌────▼──────────┐          ┌─────────▼─────────┐          ┌──────────▼───────┐
   │ ThemeSelector │          │ PageCountSlider   │          │  OverrideForm    │
   │               │          │                   │          │                  │
   │ Emits:        │          │ Emits:            │          │ Emits:           │
   │ - onChange    │          │ - onChange        │          │ - onApply        │
   └───────────────┘          └───────────────────┘          └──────────────────┘
        │                             │                              │
        └─────────────────────────────┼──────────────────────────────┘
                                      │
                    Calls ebookStore methods:
                    - setTheme(theme)
                    - setPageCount(count)
                    - applyOverride(overrides)
                                      │
        ┌─────────────────────────────▼──────────────────────────────┐
        │           ebookStore.js (Svelte Store)                     │
        │                                                            │
        │  State:                                                    │
        │  - config: { theme, pageCount, colorPalette, ... }         │
        │  - result: { content, html, metadata, pages, ... }         │
        │  - loading: boolean                                        │
        │  - error: string | null                                    │
        │  - history: [ ...previousConfigs ]                         │
        │                                                            │
        │  Methods:                                                  │
        │  - setTheme(theme)                                         │
        │  - setPageCount(count)                                     │
        │  - applyOverride(overrides)                                │
        │  - generate()  ← orchestrates API call                     │
        │  - reset()                                                 │
        │  - undo()                                                  │
        └─────────────────────────────┬──────────────────────────────┘
                                      │
                        Calls backend APIs:
                                      │
        ┌─────────────────────────────┼──────────────────────────────┐
        │                             │                              │
   ┌────▼─────────────┐    ┌──────────▼─────────┐   ┌────────────────▼──┐
   │ POST /api/ebook/ │    │ POST /api/override │   │ GET /api/themes   │
   │ generate         │    │                    │   │ (metadata)        │
   │                  │    │ Req: {             │   │                   │
   │ Req: {           │    │   ebookId,         │   │ Returns:          │
   │   prompt,        │    │   overrides: {...} │   │ { themes: [...] } │
   │   theme,         │    │ }                  │   │                   │
   │   pageCount,     │    │                    │   │ NEW: Phase B      │
   │   options: {}    │    │ Returns: { html,   │   │ endpoint          │
   │ }                │    │   metadata, ... }  │   │                   │
   │                  │    │                    │   │                   │
   │ Returns:         │    │ NEW: Phase B       │   │                   │
   │ { content,       │    │ endpoint           │   │                   │
   │   html,          │    │                    │   │                   │
   │   metadata,      │    │ Uses:              │   │                   │
   │   pages,         │    │ OverrideService    │   │                   │
   │   ... }          │    │ (fast-path)        │   │                   │
   │                  │    │                    │   │                   │
   │ Uses:            │    └────────────────────┘   │                   │
   │ - ContentChunker │                             │                   │
   │ - ThemeEngine    │                             │                   │
   │ - PageLayout     │                             └───────────────────┘
   │ - TOCGenerator   │
   │ - ImageService   │
   └──────────────────┘

   Phase B Backend Modules (already exist)
```

---

## Data Flow

### 1. Initial Load

```
App.svelte mounts
  ↓
Subscribe to ebookStore
  ↓
ebookStore queries GET /api/themes (metadata)
  ↓
Store initialized with default config:
  - theme: "dark"
  - pageCount: 8
  - colorPalette: "standard"
  - fontSizeScale: 1.0
  ↓
Components render with initial values
```

### 2. User Selects Theme

```
ThemeSelector: user clicks theme button
  ↓
Component calls onChange(themeId)
  ↓
ebookStore.setTheme(themeId)
  ↓
Store updates state.config.theme
  ↓
All subscribed components reactively update (especially ThemePreview)
  ↓
ThemePreview re-renders showing new theme colors/fonts
```

### 3. User Clicks Generate

```
App.svelte: user submits prompt + config
  ↓
Call ebookStore.generate(prompt)
  ↓
Store sets loading=true, error=null
  ↓
POST /api/ebook/generate with:
{
  prompt: "...",
  theme: store.config.theme,
  pageCount: store.config.pageCount,
  options: { colorPalette, ... }
}
  ↓
Backend executes Phase B pipeline:
  ContentChunker → ThemeEngine → PageLayout
  → TOCGenerator → ImageService
  ↓
Response: { content, html, metadata, pages, ... }
  ↓
Store updates state.result = response
  ↓
Components (ThemePreview, ExportButton) reactively enable/show results
```

### 4. User Applies Override

```
OverrideForm: user changes theme / color / font
  ↓
Component calls onApply(overrides)
  ↓
ebookStore.applyOverride(overrides, ebookId)
  ↓
Store sets loading=true
  ↓
POST /api/override with:
{
  ebookId: store.result.id,
  overrides: { theme, colorPalette, fontSizeScale }
}
  ↓
Backend OverrideService applies changes (fast-path, <2s)
  ↓
Response: { html, metadata (updated) }
  ↓
Store updates state.result (preserves content, updates HTML/CSS)
  ↓
ThemePreview re-renders with new visual
```

---

## Store Interface

### State Schema

```typescript
interface EbookStore {
  // Configuration
  config: {
    theme: "dark" | "light" | "corporate" | "bold";
    pageCount: number; // 3-20
    colorPalette: "standard" | "vibrant" | "muted" | "grayscale";
    fontSizeScale: number; // 0.8-1.2
    density?: "sparse" | "standard" | "dense" | "very-dense"; // computed
  };

  // Generation Result
  result: {
    id: string; // ebookId for future overrides
    content: { title: string; body: string };
    html: string; // Full HTML/CSS for preview
    metadata: {
      model: string;
      pages_count: number;
      theme: string;
      density: string;
      generated_at: string;
      contrast_ratios?: object; // WCAG info
    };
    pages: Array<{ id: string; title: string; blocks: Array<{}> }>;
    can_export: boolean;
    can_override: boolean;
  } | null;

  // UI State
  loading: boolean;
  error: string | null;
  status: "idle" | "generating" | "success" | "error";

  // History for undo/redo
  history: {
    configs: Array<{ timestamp: number; config: typeof config }>;
    currentIndex: number;
  };

  // Metadata
  themes: Array<{ id: string; label: string; wcag: string }>;
  colorPalettes: Array<{ id: string; label: string; description: string }>;
}
```

### Methods

```typescript
// Configuration setters
setTheme(theme: string): void
setPageCount(count: number): void
setColorPalette(palette: string): void
setFontSizeScale(scale: number): void

// Operations
generate(prompt: string): Promise<void>
  // - Validates config
  // - Posts to /api/ebook/generate
  // - Updates result + history
  // - Throws on error

applyOverride(overrides: object, ebookId?: string): Promise<void>
  // - Validates overrides (only theme/palette/fontScale allowed)
  // - Posts to /api/override
  // - Updates result HTML/metadata
  // - Throws on error

// History
undo(): void
  // - Rewind history, restore previous config

redo(): void
  // - Fast-forward history

reset(): void
  // - Clear result, reset config to defaults

// Subscriptions (standard Svelte store)
subscribe(fn: (value: EbookStore) => void): unsubscribe
```

---

## Component Integration Points

### ThemeSelector.svelte

```svelte
<script>
  import { ebookStore } from '../stores/ebookStore.js';
</script>

<ThemeSelector
  selectedTheme={$ebookStore.config.theme}
  onChange={(theme) => ebookStore.setTheme(theme)}
/>
```

### PageCountSlider.svelte

```svelte
<script>
  import { ebookStore } from '../stores/ebookStore.js';
</script>

<PageCountSlider
  pageCount={$ebookStore.config.pageCount}
  onChange={(count) => ebookStore.setPageCount(count)}
/>
```

### OverrideForm.svelte

```svelte
<script>
  import { ebookStore } from '../stores/ebookStore.js';
</script>

<OverrideForm
  isLoading={$ebookStore.loading}
  onApply={(overrides) => ebookStore.applyOverride(overrides, $ebookStore.result?.id)}
/>
```

### ThemePreview.svelte

```svelte
<script>
  import { ebookStore } from '../stores/ebookStore.js';
</script>

<ThemePreview
  theme={$ebookStore.config.theme}
  result={$ebookStore.result}
  loading={$ebookStore.loading}
/>
```

---

## Backend API Requirements

### New Endpoints (Phase 2 - Option 2)

#### 1. POST /api/ebook/generate

**Purpose**: Generate eBook with Phase B pipeline

**Request**:

```json
{
  "prompt": "A guide to sustainable living...",
  "theme": "dark",
  "pageCount": 8,
  "options": {
    "colorPalette": "standard",
    "fontSizeScale": 1.0
  }
}
```

**Response**:

```json
{
  "id": "uuid-...",
  "content": { "title": "...", "body": "..." },
  "html": "<html>...</html>",
  "metadata": {
    "model": "ebook-v1",
    "pages_count": 8,
    "theme": "dark",
    "density": "standard",
    "generated_at": "2025-11-22T...",
    "contrast_ratios": { "text": 5.2, "headings": 7.1, "accent": 4.5 }
  },
  "pages": [
    { "id": "ch1", "title": "Chapter 1", "blocks": [...] }
  ],
  "can_export": true,
  "can_override": true
}
```

**Backend Implementation**:

- Validates pageCount (3-20)
- Validates theme (dark/light/corporate/bold)
- Calls ContentChunker.analyze(prompt)
- Calls ThemeEngine.getTheme(theme)
- Calls PageLayout.calculateLayout(...)
- Calls TOCGenerator.build(...)
- Calls ImageService.findOrGenerate(...)
- Returns normalized response

#### 2. POST /api/override

**Purpose**: Apply fast-path style overrides

**Request**:

```json
{
  "ebookId": "uuid-...",
  "overrides": {
    "theme": "light",
    "colorPalette": "vibrant",
    "fontSizeScale": 1.1
  }
}
```

**Response**:

```json
{
  "id": "uuid-...",
  "html": "<html>...</html>",
  "metadata": {
    "theme": "light",
    "contrast_ratios": { ... }
  }
}
```

**Backend Implementation**:

- Validates overrides (only theme/colorPalette/fontSizeScale)
- Rejects content-changing overrides (returns 400)
- Calls OverrideService.apply(...) (fast-path, <2s)
- Returns updated HTML + metadata

#### 3. GET /api/themes

**Purpose**: Metadata about available themes (colors, fonts, WCAG info)

**Response**:

```json
{
  "themes": [
    {
      "id": "dark",
      "label": "Dark",
      "wcag": "AA",
      "colors": {
        "bg": "#1a1a1a",
        "text": "#e0e0e0",
        "accent": "#00d4ff"
      },
      "contrastRatio": 5.2
    }
  ],
  "colorPalettes": [
    { "id": "standard", "label": "Standard", "description": "Default colors" }
  ]
}
```

**Backend Implementation**:

- Returns hardcoded or cached theme metadata
- Helps frontend pre-populate dropdowns
- Used on app init for validation

---

## Files to Create/Modify

### New Files

1. **client/src/stores/ebookStore.js** (350-400 lines)

   - Central Svelte store with all business logic
   - Orchestrates API calls
   - Manages config, result, history

2. **client/src/lib/ebookApi.js** (150-200 lines)
   - API client helpers for Phase B endpoints
   - POST /api/ebook/generate
   - POST /api/override
   - GET /api/themes

### Modified Files

1. **client/src/App.svelte** (+80 lines)

   - Add Phase B section to UI
   - Import/render ThemeSelector, PageCountSlider, OverrideForm, ThemePreview
   - Connect to ebookStore

2. **client/src/components/ThemeSelector.svelte** (no change)

   - Already stateless, only needs prop binding

3. **client/src/components/PageCountSlider.svelte** (no change)

   - Already stateless, only needs prop binding

4. **client/src/components/OverrideForm.svelte** (no change)

   - Already stateless, only needs prop binding

5. **client/src/components/ThemePreview.svelte** (no change)

   - Already stateless, only needs prop binding

6. **server/index.js** (+150 lines for endpoints)
   - Add POST /api/ebook/generate
   - Add POST /api/override
   - Add GET /api/themes

---

## Implementation Checklist

- [ ] Create `client/src/stores/ebookStore.js`
- [ ] Create `client/src/lib/ebookApi.js`
- [ ] Update `client/src/App.svelte` to include Phase B UI
- [ ] Add server endpoints (POST /api/ebook/generate, POST /api/override, GET /api/themes)
- [ ] Integration test with store + components
- [ ] E2E test via UI
- [ ] Performance profiling (target: store updates <100ms)
- [ ] Accessibility audit (Tab, Arrow keys, Screen readers)
- [ ] Documentation (JSDoc in store + API)

---

## Success Criteria

✅ All 4 Phase B components render correctly in App.svelte  
✅ User can select theme → ThemePreview updates instantly  
✅ User can adjust page count → density label updates  
✅ User submits prompt → generates eBook in <10s  
✅ User applies override → updates in <2s  
✅ Store history supports undo/redo  
✅ Error handling (invalid inputs, API failures) works  
✅ Components pass accessibility tests  
✅ No Phase A regression (existing demo mode still works)

---

## Testing Strategy

### Unit Tests (store logic)

```javascript
// tests/stores/ebookStore.test.js
- setTheme() updates state correctly
- setPageCount() validates range (3-20)
- generate() calls API with correct payload
- applyOverride() validates allowed fields
- undo/redo navigate history correctly
```

### Component Tests (UI binding)

```javascript
// tests/components/ThemeSelector.integration.test.js
- ThemeSelector + ebookStore integration
  - User clicks theme → store updates
  - Store update → ThemeSelector selected state changes
  - ThemePreview re-renders with new colors
```

### E2E Tests (full flow)

```javascript
// tests/e2e/phaseB-flow.test.js
- User enters prompt + selects config → generates eBook
- User applies override → HTML updates
- User clicks export → triggers export flow
```

---

## Performance Targets

| Operation                 | Target | Notes                     |
| ------------------------- | ------ | ------------------------- |
| Store subscription update | <50ms  | Immediate reactive        |
| Theme change (no API)     | <100ms | Update metadata           |
| Generate eBook            | <10s   | Backend bottleneck        |
| Apply override            | <2s    | OverrideService fast-path |
| Undo/redo                 | <50ms  | In-memory history         |

---

## Next Steps (Option 3 Migration)

Once Option 2 is stable, migrate to **Option 3: Dedicated Page** by:

1. Creating `/routes/ebook-generator/` with dedicated layout
2. Moving Phase B UI to separate page
3. Adding project list/dashboard view
4. Implementing save/load project workflows

See `PHASE_B_OPTION3_MIGRATION_ROADMAP.md` for details.
