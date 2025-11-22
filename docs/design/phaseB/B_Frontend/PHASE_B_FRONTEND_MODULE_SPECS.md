# Phase B Frontend: Option 2 Module Specifications

**Status**: Design Phase (Pre-Implementation)  
**Target**: 4-5 hour implementation  
**Audience**: Frontend engineers, integration team

---

## Module 1: ebookStore.js

**Location**: `client/src/stores/ebookStore.js`  
**Size**: ~350-400 lines  
**Type**: Svelte Store (writable + derived)  
**Dependencies**: `svelte/store`, `ebookApi.js`

### Responsibility

Central state management for Phase B eBook generation workflow. Orchestrates all API calls, manages configuration state, tracks generation history, and provides reactive subscriptions for UI components.

### Interface

#### Exported Store Object

```javascript
export const ebookStore =
  writable <
  EbookStore >
  {
    config: { theme, pageCount, colorPalette, fontSizeScale, density },
    result:
      { id, content, html, metadata, pages, can_export, can_override } | null,
    loading: boolean,
    error: string | null,
    status: "idle" | "generating" | "success" | "error",
    history: { configs: [], currentIndex: 0 },
    themes: [],
    colorPalettes: [],
  };
```

#### Public Methods

```javascript
/**
 * Set selected theme
 * @param {string} theme - 'dark' | 'light' | 'corporate' | 'bold'
 * @throws {Error} Invalid theme
 */
export function setTheme(theme) { ... }

/**
 * Set page count with validation
 * @param {number} count - 3-20
 * @throws {RangeError} If count < 3 or > 20
 */
export function setPageCount(count) { ... }

/**
 * Set color palette
 * @param {string} palette - 'standard' | 'vibrant' | 'muted' | 'grayscale'
 * @throws {Error} Invalid palette
 */
export function setColorPalette(palette) { ... }

/**
 * Set font size scale
 * @param {number} scale - 0.8 to 1.2
 * @throws {RangeError} If scale < 0.8 or > 1.2
 */
export function setFontSizeScale(scale) { ... }

/**
 * Generate eBook from prompt using current config
 * @param {string} prompt - User prompt
 * @returns {Promise<void>}
 * @throws {Error} API error or validation error
 *
 * Side effects:
 * - Sets loading=true, error=null
 * - POSTs to /api/ebook/generate
 * - Updates result, status, history
 * - Sets loading=false
 */
export async function generate(prompt) { ... }

/**
 * Apply style overrides to existing eBook (fast-path)
 * @param {object} overrides - { theme?, colorPalette?, fontSizeScale? }
 * @param {string} ebookId - eBook ID (from result.id)
 * @returns {Promise<void>}
 * @throws {Error} Invalid overrides or API error
 *
 * Validation:
 * - Only theme, colorPalette, fontSizeScale allowed
 * - Rejects pageCount, density changes
 *
 * Side effects:
 * - Sets loading=true
 * - POSTs to /api/override
 * - Updates result HTML + metadata
 * - Sets loading=false
 */
export async function applyOverride(overrides, ebookId) { ... }

/**
 * Undo to previous config state
 * @returns {boolean} True if undo succeeded, false if at history start
 */
export function undo() { ... }

/**
 * Redo to next config state
 * @returns {boolean} True if redo succeeded, false if at history end
 */
export function redo() { ... }

/**
 * Reset to initial state
 * Side effects: Clears result, resets config to defaults
 */
export function reset() { ... }

/**
 * Initialize store on app startup
 * Fetches /api/themes metadata
 * @returns {Promise<void>}
 */
export async function initialize() { ... }
```

### Internal State Management

#### Config Object

```javascript
{
  theme: 'dark',         // Currently selected theme
  pageCount: 8,          // 3-20
  colorPalette: 'standard',
  fontSizeScale: 1.0,    // 0.8-1.2
  density: 'standard'    // Computed from pageCount
}
```

#### Result Object (on success)

```javascript
{
  id: 'uuid-xxxxxx',     // For override calls
  content: { title: '...', body: '...' },
  html: '<html>...</html>',
  metadata: {
    model: 'ebook-v1',
    pages_count: 8,
    theme: 'dark',
    density: 'standard',
    generated_at: '2025-11-22T...',
    contrast_ratios: { text: 5.2, headings: 7.1, accent: 4.5 }
  },
  pages: [
    { id: 'ch1', title: 'Chapter 1', blocks: [...] }
  ],
  can_export: true,
  can_override: true
}
```

#### History Tracking

```javascript
{
  configs: [
    { timestamp: 1700000000, config: { theme: 'dark', pageCount: 8, ... } },
    { timestamp: 1700000100, config: { theme: 'light', pageCount: 8, ... } },
    { timestamp: 1700000200, config: { theme: 'light', pageCount: 10, ... } }
  ],
  currentIndex: 1  // Points to 'light/8'
}
```

### Implementation Details

#### Computed Density

```javascript
function computeDensity(pageCount) {
  if (pageCount <= 5) return "sparse";
  if (pageCount <= 10) return "standard";
  if (pageCount <= 15) return "dense";
  return "very-dense";
}
```

#### Validation Functions

```javascript
function validateTheme(theme) {
  const valid = ["dark", "light", "corporate", "bold"];
  if (!valid.includes(theme)) throw new Error(`Invalid theme: ${theme}`);
}

function validatePageCount(count) {
  if (count < 3 || count > 20) throw new RangeError("Page count must be 3-20");
}

function validateColorPalette(palette) {
  const valid = ["standard", "vibrant", "muted", "grayscale"];
  if (!valid.includes(palette)) throw new Error(`Invalid palette: ${palette}`);
}

function validateFontSizeScale(scale) {
  if (scale < 0.8 || scale > 1.2)
    throw new RangeError("Font scale must be 0.8-1.2");
}

function validateOverrides(overrides) {
  const allowed = ["theme", "colorPalette", "fontSizeScale"];
  const invalid = Object.keys(overrides).filter((k) => !allowed.includes(k));
  if (invalid.length > 0) {
    throw new Error(`Invalid override fields: ${invalid.join(", ")}`);
  }
  // Validate each field if present
  if (overrides.theme) validateTheme(overrides.theme);
  if (overrides.colorPalette) validateColorPalette(overrides.colorPalette);
  if (overrides.fontSizeScale) validateFontSizeScale(overrides.fontSizeScale);
}
```

#### Error Handling

```javascript
async function generate(prompt) {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Prompt cannot be empty");
  }

  updateStore((store) => ({ ...store, loading: true, error: null }));

  try {
    const response = await api.generateEbook({
      prompt,
      theme: current.config.theme,
      pageCount: current.config.pageCount,
      options: {
        colorPalette: current.config.colorPalette,
        fontSizeScale: current.config.fontSizeScale,
      },
    });

    updateStore((store) => ({
      ...store,
      result: response,
      loading: false,
      status: "success",
    }));
  } catch (err) {
    updateStore((store) => ({
      ...store,
      error: err.message,
      loading: false,
      status: "error",
    }));
    throw err;
  }
}
```

### Testing Requirements

```javascript
// Unit tests: src/stores/__tests__/ebookStore.test.js

describe('ebookStore', () => {
  describe('setTheme', () => {
    test('updates config.theme', () => { ... })
    test('throws on invalid theme', () => { ... })
    test('notifies subscribers', () => { ... })
  })

  describe('setPageCount', () => {
    test('validates range 3-20', () => { ... })
    test('updates density automatically', () => { ... })
  })

  describe('generate', () => {
    test('calls POST /api/ebook/generate', () => { ... })
    test('updates result on success', () => { ... })
    test('handles API errors gracefully', () => { ... })
    test('tracks config in history', () => { ... })
  })

  describe('applyOverride', () => {
    test('validates override fields', () => { ... })
    test('calls POST /api/override', () => { ... })
    test('updates only HTML + metadata', () => { ... })
  })

  describe('undo/redo', () => {
    test('undo reverts to previous config', () => { ... })
    test('redo advances to next config', () => { ... })
    test('respects history bounds', () => { ... })
  })
})
```

---

## Module 2: ebookApi.js

**Location**: `client/src/lib/ebookApi.js`  
**Size**: ~150-200 lines  
**Type**: API client  
**Dependencies**: None (pure async functions)

### Responsibility

HTTP client for Phase B backend endpoints. Handles request/response serialization, error normalization, timeout management, and retry logic.

### Interface

```javascript
/**
 * POST /api/ebook/generate
 * @param {object} payload - { prompt, theme, pageCount, options }
 * @returns {Promise<object>} Generated eBook result
 * @throws {Error} Network or API error
 */
export async function generateEbook(payload) { ... }

/**
 * POST /api/override
 * @param {object} payload - { ebookId, overrides }
 * @returns {Promise<object>} Updated eBook result
 * @throws {Error} Validation or API error
 */
export async function applyOverride(payload) { ... }

/**
 * GET /api/themes
 * @returns {Promise<object>} Theme metadata
 * @throws {Error} Network error
 */
export async function fetchThemes() { ... }
```

### Configuration

```javascript
const CONFIG = {
  API_BASE_URL: "/api",
  TIMEOUTS: {
    GENERATE: 30000, // 30s for generate
    OVERRIDE: 10000, // 10s for override
    THEMES: 5000, // 5s for themes
  },
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
};
```

### Error Handling

```javascript
function normalizeError(error, endpoint) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return new Error(
      `${endpoint} timeout after ${CONFIG.TIMEOUTS[endpoint]}ms`
    );
  }
  if (error instanceof TypeError) {
    return new Error(`Network error: ${error.message}`);
  }
  if (error.status) {
    return new Error(`API error ${error.status}: ${error.message}`);
  }
  return error;
}
```

### Implementation

```javascript
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json();
      throw {
        status: response.status,
        message: data.error || response.statusText,
      };
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateEbook(payload) {
  return fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/ebook/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    CONFIG.TIMEOUTS.GENERATE
  );
}
```

---

## Module 3: Updated App.svelte Section

**Location**: `client/src/App.svelte`  
**Changes**: +80-100 lines  
**Impact**: Adds Phase B UI to existing demo mode

### New Section

```svelte
<script>
  import { ebookStore } from './stores/ebookStore.js';
  import ThemeSelector from './components/ThemeSelector.svelte';
  import PageCountSlider from './components/PageCountSlider.svelte';
  import OverrideForm from './components/OverrideForm.svelte';
  import ThemePreview from './components/ThemePreview.svelte';
</script>

{#if $modeStore.current === 'ebook'}
  <section class="ebook-section">
    <h2>Phase B: Intelligent eBook Generator</h2>

    <div class="ebook-controls">
      <ThemeSelector
        selectedTheme={$ebookStore.config.theme}
        onChange={(theme) => ebookStore.setTheme(theme)}
      />

      <PageCountSlider
        pageCount={$ebookStore.config.pageCount}
        onChange={(count) => ebookStore.setPageCount(count)}
      />
    </div>

    <div class="ebook-preview">
      <ThemePreview
        theme={$ebookStore.config.theme}
        result={$ebookStore.result}
        loading={$ebookStore.loading}
      />
    </div>

    {#if $ebookStore.result}
      <div class="ebook-overrides">
        <OverrideForm
          isLoading={$ebookStore.loading}
          onApply={(overrides) =>
            ebookStore.applyOverride(overrides, $ebookStore.result?.id)
          }
        />
      </div>
    {/if}

    {#if $ebookStore.error}
      <div class="error-message">{$ebookStore.error}</div>
    {/if}
  </section>
{/if}
```

---

## Module 4: Backend Endpoint Specifications

### Endpoint: POST /api/ebook/generate

**Handler Location**: `server/index.js` (or `server/routes/ebook.js`)

**Request**:

```javascript
{
  prompt: string,           // Required, min 10 chars
  theme: string,            // Required: dark|light|corporate|bold
  pageCount: number,        // Required: 3-20
  options: {
    colorPalette?: string,  // standard|vibrant|muted|grayscale
    fontSizeScale?: number  // 0.8-1.2
  }
}
```

**Response (200)**:

```javascript
{
  id: string,               // UUID, for later overrides
  content: { title, body },
  html: string,             // Full HTML/CSS
  metadata: {
    model: string,
    pages_count: number,
    theme: string,
    density: string,
    generated_at: ISO8601,
    contrast_ratios: { text, headings, accent }
  },
  pages: Array<{id, title, blocks}>,
  can_export: boolean,
  can_override: boolean
}
```

**Error (400/500)**:

```javascript
{
  error: string,
  code: string
}
```

**Implementation Logic**:

```javascript
app.post('/api/ebook/generate', async (req, res) => {
  const { prompt, theme, pageCount, options } = req.body;

  // Validate inputs
  validateTheme(theme);
  validatePageCount(pageCount);

  try {
    // Call Phase B modules
    const chunks = await ContentChunker.analyze(prompt);
    const themeConfig = ThemeEngine.getTheme(theme);
    const layout = PageLayout.calculateLayout(chunks, pageCount);
    const toc = TOCGenerator.build(chunks, pageCount);
    const images = await ImageService.generate(chunks);

    // Generate HTML
    const html = buildHTML(chunks, themeConfig, layout, toc, images);

    // Validate accessibility
    const contrastRatios = ThemeEngine.validateAccessibility(themeConfig);

    // Persist to DB
    const ebookId = await db.saveEbook({
      prompt,
      theme,
      pageCount,
      html,
      metadata: { ... }
    });

    res.json({
      id: ebookId,
      content: { title: chunks[0].title, body: chunks.map(c => c.text).join() },
      html,
      metadata: { ... },
      pages: chunks.map((c, i) => ({ id: `ch${i}`, title: c.title, blocks: [...] })),
      can_export: true,
      can_override: true
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

### Endpoint: POST /api/override

**Request**:

```javascript
{
  ebookId: string,
  overrides: {
    theme?: string,
    colorPalette?: string,
    fontSizeScale?: number
  }
}
```

**Response (200)**:

```javascript
{
  id: string,
  html: string,           // Updated HTML with new CSS
  metadata: {
    theme: string,
    contrast_ratios: {...}
  }
}
```

**Implementation**:

```javascript
app.post("/api/override", async (req, res) => {
  const { ebookId, overrides } = req.body;

  // Validate overrides
  validateOverrides(overrides);

  try {
    // Fetch existing eBook from DB
    const ebook = await db.getEbook(ebookId);

    // Apply fast-path override (no regeneration)
    const result = await OverrideService.apply(ebook, overrides);

    // Persist override
    await db.updateEbook(ebookId, { metadata: result.metadata });

    res.json({
      id: ebookId,
      html: result.html,
      metadata: result.metadata,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

### Endpoint: GET /api/themes

**Response (200)**:

```javascript
{
  themes: [
    {
      id: 'dark',
      label: 'Dark',
      wcag: 'AA',
      colors: { bg, text, accent },
      contrastRatio: 5.2
    },
    // ... other 3 themes
  ],
  colorPalettes: [
    { id: 'standard', label: 'Standard', description: '...' },
    // ...
  ]
}
```

---

## Implementation Order

1. **Phase 2a** (Session 1): Create `ebookStore.js` + `ebookApi.js`
2. **Phase 2b** (Session 1): Add three endpoints to backend
3. **Phase 2c** (Session 2): Wire components into `App.svelte`
4. **Phase 2d** (Session 2): Integration testing + bug fixes
5. **Phase 2e** (Session 3): Performance optimization + accessibility audit

---

## Success Criteria per Module

### ebookStore.js

- ✅ All store methods implement correct validation
- ✅ History undo/redo works bidirectionally
- ✅ Error handling propagates correctly to UI
- ✅ Subscribers notified on all state changes
- ✅ <100ms update latency

### ebookApi.js

- ✅ Timeout correctly aborts requests
- ✅ Error messages human-readable
- ✅ Retry logic works on transient failures
- ✅ No unhandled promise rejections

### App.svelte Integration

- ✅ All 4 components render without errors
- ✅ Phase A demo mode unchanged
- ✅ Phase B mode switchable via mode selector
- ✅ Responsive layout on mobile/tablet

### Backend Endpoints

- ✅ All Phase B modules orchestrated correctly
- ✅ <10s generate E2E latency
- ✅ <2s override latency
- ✅ Error responses include helpful messages
- ✅ Accessibility validation included
