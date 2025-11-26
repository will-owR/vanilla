# Phase B Option 2: Store-Based MVP - Module Specifications

**Status**: 🔧 **IN PROGRESS - WEEK 1 FIX** (November 26, 2025)  
**Branch**: `feat/B_Frontend_option2`  
**Document Purpose**: Detailed specifications for all modules in the pipeline

---

## Module Dependency Map

```
ebookStore.js ──┐
                ├─→ ebookApi.js ──→ POST /api/ebook/generate
                ├─→ ebookApi.js ──→ POST /api/override
                └─→ ebookApi.js ──→ GET /api/themes

genieService.process() ──→ ebookService.handle()
                      ──→ [WEEK 1] genieService.compose()
                      ──→ Return envelope to endpoint

Endpoint: POST /api/ebook/generate ──→ Response with html field [NEW]

Frontend: ebookStore.result.html ──→ Display via {@html}
```

---

## Frontend Module Specifications

### **1. ebookStore.js (Svelte Store)**

**File**: `/client/src/stores/ebookStore.js`

**Type**: Writable Svelte Store with custom methods

#### **State Type Definition**

```typescript
interface EbookStoreState {
  config: {
    theme: "dark" | "light" | "corporate" | "bold";
    pageCount: number; // 3-20
    colorPalette: "standard" | "vibrant" | "muted" | "grayscale";
    fontSizeScale: number; // 0.8-1.2
    density: "sparse" | "standard" | "dense" | "very-dense"; // computed
  };
  result: {
    id: string; // ebookId
    html: string; // WEEK 1: Added HTML
    chapters: Array<{
      id: string; // "ch_1", "ch_2"
      title: string;
      content: string;
      image: {
        concept: string;
        style: string;
        tone: string;
        palette_hint: string;
        size_hint: string;
      };
    }>;
    metadata: Record<string, any>;
    actions: {
      persist_prompt: boolean;
      generate_pdf: boolean;
      can_export: boolean;
      can_preview: boolean;
      can_override: boolean;
    };
  } | null;
  loading: boolean;
  error: string | null;
  status: "idle" | "generating" | "success" | "error";
  history: {
    configs: EbookConfig[];
    currentIndex: number;
  };
}
```

#### **Method Specifications**

##### **setTheme(theme: string): void**

**Purpose**: Update selected theme + add to history

**Input**:

- `theme` - Must be one of: "dark", "light", "corporate", "bold"

**Behavior**:

- Validate theme (throw RangeError if invalid)
- Update store.config.theme
- Add current config to history
- Truncate future history on redo

**Validation**:

```javascript
const valid = ["dark", "light", "corporate", "bold"];
if (!valid.includes(theme)) {
  throw new Error(`Invalid theme: ${theme}...`);
}
```

---

##### **setPageCount(count: number): void**

**Purpose**: Update page count + auto-compute density + add to history

**Input**:

- `count` - Must be integer 3-20

**Behavior**:

- Validate count (throw RangeError if invalid)
- Compute density:
  - 3-5 pages → "sparse"
  - 6-10 pages → "standard"
  - 11-15 pages → "dense"
  - 16-20 pages → "very-dense"
- Update store.config.pageCount and density
- Add to history

**Validation**:

```javascript
const num = Number(count);
if (num < 3 || num > 20 || !Number.isInteger(num)) {
  throw new RangeError("Page count must be integer between 3 and 20");
}
```

---

##### **setColorPalette(palette: string): void**

**Purpose**: Update color palette selection

**Input**:

- `palette` - Must be one of: "standard", "vibrant", "muted", "grayscale"

**Validation**:

```javascript
const valid = ["standard", "vibrant", "muted", "grayscale"];
if (!valid.includes(palette)) {
  throw new Error(`Invalid palette: ${palette}...`);
}
```

---

##### **setFontSizeScale(scale: number): void**

**Purpose**: Update font size scaling factor

**Input**:

- `scale` - Must be between 0.8 and 1.2

**Validation**:

```javascript
const num = Number(scale);
if (num < 0.8 || num > 1.2) {
  throw new RangeError("Font scale must be between 0.8 and 1.2");
}
```

---

##### **async generate(prompt: string): Promise<void>**

**Purpose**: Orchestrate full eBook generation from prompt

**Input**:

- `prompt` - Non-empty string (required)

**Process**:

1. Validate prompt (throw Error if empty)
2. Set loading = true, error = null, status = "generating"
3. Call ebookApi.generateEbook({ prompt, ...config })
4. Await 180s timeout
5. Set result, loading = false, status = "success"
6. Add config to history
7. Throw on error (catch in component)

**Error Handling**:

- Network error → set error message
- API 400/500 → set error message
- Timeout → "Request timeout after 180000ms"

**Example**:

```javascript
try {
  await ebookStore.generate("A detective story...");
} catch (err) {
  console.error(err.message);
}
```

---

##### **async applyOverride(overrides: Object, ebookId: string): Promise<void>**

**Purpose**: Apply fast-path style overrides without regeneration

**Input**:

- `overrides` - Object with subset of: { theme?, colorPalette?, fontSizeScale? }
- `ebookId` - Required ID from generated result

**Validation**:

```javascript
const allowed = ["theme", "colorPalette", "fontSizeScale"];
const invalid = Object.keys(overrides).filter((k) => !allowed.includes(k));
if (invalid.length > 0) {
  throw new Error(`Invalid override fields: ${invalid.join(", ")}`);
}
```

**Process**:

1. Validate ebookId (throw if missing)
2. Validate overrides (throw if invalid fields)
3. Set loading = true
4. Call ebookApi.applyOverride({ ebookId, html, metadata, overrides })
5. Update result with new html + metadata
6. Set loading = false

---

##### **undo(): boolean**

**Purpose**: Navigate history to previous config state

**Return**: `true` if undo succeeded, `false` if at beginning

**Behavior**:

- Check if currentIndex > 0
- If yes: decrement currentIndex, restore config, return true
- If no: return false (no-op)

---

##### **redo(): boolean**

**Purpose**: Navigate history to next config state

**Return**: `true` if redo succeeded, `false` if at end

**Behavior**:

- Check if currentIndex < configs.length - 1
- If yes: increment currentIndex, restore config, return true
- If no: return false (no-op)

---

##### **reset(): void**

**Purpose**: Clear store to initial state

**Behavior**:

- Reset config to defaults (theme="dark", pageCount=8, ...)
- Clear result (set to null)
- Clear loading, error
- Clear history (configs=[], currentIndex=-1)

---

##### **async initialize(): Promise<void>**

**Purpose**: Fetch theme metadata on app startup

**Process**:

1. Call ebookApi.fetchThemes()
2. Update store.themes and store.colorPalettes
3. Log error but don't throw (non-fatal)

---

### **2. ebookApi.js (HTTP Client)**

**File**: `/client/src/lib/ebookApi.js`

**Type**: Module with async functions

#### **Configuration**

```javascript
const CONFIG = {
  API_BASE_URL: "/api",
  TIMEOUTS: {
    GENERATE: 180000, // 180s (3min) for full generation
    OVERRIDE: 10000, // 10s for style override
    THEMES: 5000, // 5s for metadata
  },
};
```

#### **Function Specifications**

##### **async fetchWithTimeout(url: string, options: Object, timeoutMs: number): Promise<Object>**

**Purpose**: Fetch with AbortController timeout + comprehensive error handling

**Input**:

- `url` - Full URL string
- `options` - Standard fetch options (method, headers, body)
- `timeoutMs` - Timeout in milliseconds

**Process**:

1. Create AbortController
2. Set timeout to abort after timeoutMs
3. Fetch with abort signal
4. Check response.ok
5. Parse JSON
6. Clear timeout
7. Return parsed data

**Error Handling**:

- DOMException (AbortError) → "Request timeout after Xms"
- TypeError (network) → "Network error: ..."
- Response not ok → API error message
- JSON parse error → generic error

**Return**: Parsed JSON response object

---

##### **async generateEbook(payload: Object): Promise<Object>**

**Purpose**: POST /api/ebook/generate

**Input**:

```javascript
{
  prompt: string,              // User input
  theme: "dark" | "light" | "corporate" | "bold",
  pageCount: number,           // 3-20
  colorPalette: string,        // "standard" | "vibrant" | ...
  fontSizeScale: number        // 0.8-1.2
}
```

**Process**:

- Call fetchWithTimeout(CONFIG.API_BASE_URL + "/ebook/generate", {...}, 180000)
- Return response

**Response** (200 OK):

```javascript
{
  id: string,           // ebookId
  resultId: string,     // UUID for reference
  chapters: Array<{     // formerly "pages"
    id: string,
    title: string,
    content: string,
    image: {...}
  }>,
  html: string,         // [WEEK 1 NEW] Complete HTML
  metadata: {
    title: string,
    theme: string,
    pageCount: number,
    density: string,
    ...
  },
  actions: {...}
}
```

**Error Response** (400/500):

```javascript
{
  error: string,        // Error message
  details?: string      // Additional context
}
```

---

##### **async applyOverride(payload: Object): Promise<Object>**

**Purpose**: POST /api/override

**Input**:

```javascript
{
  ebookId: string,              // From generation response
  html: string,                 // Current HTML
  metadata: Object,             // Current metadata
  overrides: {
    theme?: string,
    colorPalette?: string,
    fontSizeScale?: number
  }
}
```

**Process**:

- Call fetchWithTimeout(".../override", {...}, 10000)
- Return response

**Response** (200 OK):

```javascript
{
  html: string,         // Updated HTML with new styles
  metadata: {           // Updated metadata
    theme: string,
    colorPalette: string,
    fontSizeScale: number,
    ...
  }
}
```

**Performance**: <2 seconds (no AI calls, CSS-only)

---

##### **async fetchThemes(): Promise<Object>**

**Purpose**: GET /api/themes

**Process**:

- Call fetchWithTimeout(".../themes", { method: "GET" }, 5000)
- Return response

**Response** (200 OK):

```javascript
{
  themes: [
    {
      id: "dark",
      name: "Dark",
      background: "#1a1a1a",
      text: "#ffffff",
      accent: "#00d4ff"
    },
    // ... light, corporate, bold
  ],
  colorPalettes: [
    {
      id: "standard",
      name: "Standard",
      colors: [...]
    },
    // ... vibrant, muted, grayscale
  ]
}
```

---

## Backend Module Specifications

### **3. genieService.process() (Orchestration)**

**File**: `/server/genieService.js` (lines 645-760)

#### **Method Signature**

```typescript
async process(payload: {
  mode?: "ebook" | "demo" | "basic" | "auto";
  prompt: string;
  metadata?: Object;
  _classification?: Object;
  _classify?: boolean;
}): Promise<{
  out_envelope: {
    pages: Array<{id, title, content, image}>;
    html: string;  // [WEEK 1 NEW]
    metadata: Object;
    actions: Object;
  };
  resultId: string;
}>
```

#### **Process Flow (Current + Week 1)**

**Step 1: Classify (if needed)**

```javascript
if (!mode || mode === "auto") {
  classification = await this.classifyPrompt(prompt);
  mode = classification.medium;
} else if (payload._classify === true) {
  classification = await this.classifyPrompt(prompt);
}
```

**Step 2: Route to Service**

```javascript
switch (mode) {
  case "ebook": {
    const ebookService = require("./ebookService");
    result = await ebookService.handle(payload, classification);
    break;
  }
  case "demo": { ... }
  case "basic":
  default: { ... }
}
```

**Step 3: [WEEK 1] Call Compose for eBook**

```javascript
// NEW: Add this after service returns result
if (mode === "ebook") {
  const html = await this.compose(result);
  result.html = html; // Include HTML in result
}
```

**Step 4: Build Envelope**

```javascript
const envelope = {
  out_envelope: {
    pages: result.pages || [],
    html: result.html || null, // Include HTML field
    metadata: {
      ...result.metadata,
      generated_at: new Date().toISOString(),
      mode: mode,
      ...(classification && { classification }),
    },
    actions: result.actions || {},
    ...(result.epilogue && { epilogue: result.epilogue }),
  },
};
```

**Step 5: Persist Result**

```javascript
const resultId = uuidv4();
try {
  await resultDb.saveResult(resultId, envelope.out_envelope, mode);
  envelope.resultId = resultId;
} catch (err) {
  console.warn("Result persistence failed", err?.message);
  envelope.resultId = resultId; // Best-effort
}
```

**Step 6: Process Actions**

```javascript
if (result.actions?.persist_prompt === true) {
  saveContentToFile(prompt).catch((err) => {
    console.warn("persist_prompt action failed", err?.message);
  });
}
```

---

### **4. genieService.compose() (HTML Generation)**

**File**: `/server/genieService.js` (lines 764-950)

#### **Method Signature**

```typescript
async compose(structuredData: {
  pages: Array<{
    title: string;
    content: string;
    image?: { concept: string; style: string; tone: string; ... };
  }>;
  metadata?: {
    theme?: "dark" | "light" | "corporate" | "bold";
    colorPalette?: string;
    fontSizeScale?: number;
    density?: string;
  };
}): Promise<string>  // Returns complete HTML
```

#### **Theme Color System**

```javascript
const themeColors = {
  dark: {
    bg: "#1a1a1a",
    text: "#ffffff",
    accent: "#00d4ff",
    heading: "#ffffff",
  },
  light: {
    bg: "#ffffff",
    text: "#000000",
    accent: "#0066cc",
    heading: "#000000",
  },
  corporate: {
    bg: "#f5f5f5",
    text: "#2c3e50",
    accent: "#34495e",
    heading: "#2c3e50",
  },
  bold: {
    bg: "#000000",
    text: "#ffff00",
    accent: "#ff6b35",
    heading: "#ff6b35",
  },
};
```

#### **HTML Generation Steps**

**1. Cover Page**

- Title (fontSizeScale \* 2.5)
- Subtitle "Generated by Aether AI"
- Date
- Theme-based colors

**2. Copyright Page**

- Standard copyright notice
- Generation timestamp
- Theme + density info
- Disclaimer: "AI-generated content, may contain inaccuracies"

**3. Table of Contents**

- List of all chapter titles with links
- Page numbers (formatted for printing)

**4. Content Pages** (for each chapter)

```html
<div class="page content-page" id="ch_1">
  <h2>Chapter 1: {chapter.title}</h2>

  {if chapter.image?.concept}
  <div class="image-concept">
    <strong>Image Concept:</strong> {chapter.image.concept}
  </div>
  {/if}

  <div class="chapter-content">{chapter.content.replace(/\n/g, "<br />")}</div>
</div>
```

**5. Epilogue**

- Closing remarks
- Link back to title
- Theme-styled closing

#### **Output**

Complete valid HTML document:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>...</title>
    <style>
      /* Global styles for all pages */
      body { font-family: Georgia, serif; ... }
      .page { page-break-after: always; ... }
      /* Theme-specific styles */
      body.theme-dark { ... }
      body.theme-light { ... }
      /* Font scaling */
      body { font-size: {fontSize}px; }
    </style>
  </head>
  <body class="theme-{theme}">
    {coverHtml} {copyrightHtml} {tocHtml} {contentHtml} ← All chapters with
    paragraphs {epilogueHtml}
  </body>
</html>
```

---

### **5. ebookService.handle() (Content Generation)**

**File**: `/server/ebookService.js` (lines 1-300)

#### **Method Signature**

```typescript
async handle(payload: {
  mode: "ebook";
  prompt: string;
  metadata: {
    theme: string;
    pageCount: number;
    colorPalette: string;
    fontSizeScale: number;
  };
}, classification?: Object): Promise<{
  pages: Array<{
    id: string;
    chapter: number;
    title: string;
    content: string;  // ← AI-generated, 600-800 words
    image: {
      concept: string;
      style: string;
      tone: string;
      palette_hint: string;
      size_hint: string;
    };
  }>;
  metadata: Object;
  actions: Object;
}>
```

#### **Conversation 1: Structure Generation**

**AI Prompt**:

```
Create a detailed structure for a {pageCount}-page eBook based on:
"{prompt}"

Return as JSON:
{
  title: string,
  chapters: number,
  outline: [
    {
      chapter: number,
      title: string,
      estimated_topics: [string...]
    }
  ]
}
```

**AI Response Parsing**:

- Parse JSON (3-tier fallback: direct → regex → mock)
- Extract title, chapters, outline
- Validate: has chapters, has titles

---

#### **Conversation 2+: Per-Chapter Loop**

**For each chapter in outline**:

**AI Prompt**:

```
Write Chapter {chapter}: "{title}"

Context:
- Total eBook: {pageCount} pages
- This chapter: #{chapter} of {chapters}
- Key topics: {topics.join(", ")}
- Audience: general
- Tone: creative

Requirements:
- 600-800 words
- Expands on topics
- Sets up next chapter

Also provide image concept.

Return as JSON:
{
  chapter: number,
  title: string,
  content: string,  ← 600-800 words minimum
  image: {
    concept: string,
    suggested_style: string,
    tone: string
  }
}
```

**Response Parsing**:

- Parse JSON (3-tier fallback)
- Extract: chapter, title, content, image
- Validate: content non-empty, image descriptive

**Image Style Determination**:

```javascript
const themeDefaults = {
  dark: "gothic",
  light: "bright",
  corporate: "professional",
  bold: "vibrant",
};

const style =
  aiSuggestedStyle && isValidStyle(aiSuggestedStyle)
    ? aiSuggestedStyle
    : themeDefaults[theme];
```

#### **Return Structure**

```javascript
{
  pages: [  // (formerly chapters)
    {
      id: "ch_1",
      chapter: 1,
      title: "...",
      content: "...",
      image: { concept, style, tone, palette_hint, size_hint }
    },
    // ... for each chapter
  ],
  metadata: {
    model: "ebook-v1",
    pages_count: pageCount,
    source: "ebook",
    theme,
    colorPalette,
    fontSizeScale,
    density: "light" | "medium" | "dense" | "very-dense"
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

---

### **6. POST /api/ebook/generate (Endpoint)**

**File**: `/server/index.js` (lines 2822-2970)

#### **Request Contract**

```javascript
{
  prompt: string,              // Required
  theme?: "dark" | "light" | "corporate" | "bold"  // Default: "dark"
  pageCount?: number,          // 3-20, Default: 10
  colorPalette?: string,       // Default: "default"
  fontSizeScale?: number       // 0.8-1.2, Default: 1.0
}
```

#### **Validation**

```javascript
// Prompt: required, non-empty string
if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
  return res.status(400).json({ error: "Prompt is required..." });
}

// Theme: must be one of valid values
const validThemes = ["dark", "light", "corporate", "bold"];
if (!validThemes.includes(theme)) {
  return res.status(400).json({ error: "Invalid theme..." });
}

// PageCount: integer 3-20
const pageCountNum = parseInt(pageCount, 10);
if (isNaN(pageCountNum) || pageCountNum < 3 || pageCountNum > 20) {
  return res.status(400).json({ error: "Page count must be between 3 and 20" });
}

// FontScale: float 0.8-1.2
const fontScaleNum = parseFloat(fontSizeScale);
if (isNaN(fontScaleNum) || fontScaleNum < 0.8 || fontScaleNum > 1.2) {
  return res
    .status(400)
    .json({ error: "Font scale must be between 0.8 and 1.2" });
}
```

#### **Process**

```javascript
1. Validate inputs (400 on fail)
2. Call genieService.process({ mode: "ebook", prompt, metadata })
3. Extract envelope from response
4. Validate envelope structure (500 on fail)
5. Build response object with:
   - id: ebookId
   - resultId: from envelope
   - chapters: from envelope.pages
   - html: from envelope.html  ← [WEEK 1 NEW]
   - metadata: enriched with density, wordCount
   - actions: from envelope
6. Return 200 with JSON response
7. Log timing and errors
```

#### **Response Contract** (200 OK)

```javascript
{
  id: string,           // ebookId_timestamp_random
  resultId: string,     // UUID for persistence reference
  chapters: Array<{
    id: string,         // "ch_1", "ch_2"
    title: string,
    content: string,
    image: {
      concept: string;
      style: string;
      tone: string;
      palette_hint: string;
      size_hint: string;
    }
  }>,
  html: string,         // [WEEK 1 NEW] Complete HTML with all content
  metadata: {
    title: string,
    author: "Aether AI",
    theme: string,
    pageCount: number,
    wordCount: number,
    colorPalette: string,
    fontSizeScale: number,
    density: string,
    ...
  },
  actions: {
    persist_prompt: boolean,
    generate_pdf: boolean,
    can_export: boolean,
    can_preview: boolean,
    can_override: boolean
  }
}
```

#### **Error Responses**

**400 Bad Request**: Invalid prompt, theme, pageCount, fontScale

```javascript
{
  error: "Descriptive error message";
}
```

**500 Internal Server Error**: AI failure, envelope invalid, composition error

```javascript
{ error: "Failed to generate e-book", details: "..." }
```

---

## Cross-Module Data Flow

### **Happy Path: Generation**

```
Frontend: ebookStore.generate(prompt)
    ↓
ebookApi.generateEbook({prompt, theme, pageCount, ...})
    ↓
POST /api/ebook/generate
    ↓
genieService.process({mode: "ebook", prompt, metadata})
    ├─ ebookService.handle() returns {pages: [content...], ...}
    ├─ [WEEK 1] genieService.compose(result) returns HTML
    ├─ Build envelope with html field
    └─ Save to resultDb
    ↓
Endpoint builds response {chapters, html, metadata, actions}
    ↓
Frontend receives response
    ↓
ebookStore.result = {html, chapters, metadata, actions}
    ↓
Component renders: {@html ebookStore.result.html}
    ↓
User sees: Title + full paragraph content ✅
```

### **Override Flow**

```
Frontend: ebookStore.applyOverride(overrides, ebookId)
    ↓
ebookApi.applyOverride({ebookId, html, metadata, overrides})
    ↓
POST /api/override
    ↓
Backend applies CSS to html
    ↓
Returns {html: updated, metadata: updated}
    ↓
ebookStore updates result
    ↓
Component re-renders with new styles
```

---

## Related Documents

- **[Architecture](PHASE_B_OPTION2_ARCHITECTURE.md)** - High-level design and data flow
- **[Implementation](PHASE_B_OPTION2_IMPLEMENTATION.md)** - Step-by-step Week 1 fix

---

**Last Updated**: November 26, 2025  
**Status**: 🔧 IN PROGRESS - Week 1 Fix  
**Next**: Implementation Guide (PHASE_B_OPTION2_IMPLEMENTATION.md)
