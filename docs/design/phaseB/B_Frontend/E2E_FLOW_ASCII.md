# Phase B Option 2 - End-to-End Flow (ASCII Diagrams)

## 1. CRITICAL PATH: Generate eBook

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Client-side)                               │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ User Action:                                                            │  │
│  │  1. Switches mode to "ebook"                                           │  │
│  │  2. Selects theme (dark/light/corporate/bold)                          │  │
│  │  3. Adjusts page count (3-20 pages)                                    │  │
│  │  4. Enters prompt: "Write a short story about a wizard"                │  │
│  │  5. Clicks "Generate eBook" button                                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ App.svelte:                                                             │  │
│  │  - Conditionally renders Phase B section (mode === 'ebook')            │  │
│  │  - Stores subscribed to $ebookStore (config, result, loading, error)   │  │
│  │  - Button handler: ebookStore.generate(prompt)                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ebookStore.js (Svelte Writable Store):                                 │  │
│  │  1. Validate prompt (not empty)                                        │  │
│  │  2. Set state: loading = true, error = null                            │  │
│  │  3. Get current config from store:                                     │  │
│  │     { theme, pageCount, colorPalette, fontSizeScale }                  │  │
│  │  4. Build payload:                                                      │  │
│  │     {                                                                   │  │
│  │       prompt: "Write a short story about a wizard",                    │  │
│  │       theme: "dark",                                                    │  │
│  │       pageCount: 8,                                                    │  │
│  │       colorPalette: "standard",                                        │  │
│  │       fontSizeScale: 1.0                                               │  │
│  │     }                                                                    │  │
│  │  5. Call: ebookApi.generateEbook(payload)                              │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ebookApi.js (HTTP Client):                                             │  │
│  │  1. Create AbortController for timeout handling                        │  │
│  │  2. POST to http://localhost:3000/api/ebook/generate                  │  │
│  │     Headers: { "Content-Type": "application/json" }                    │  │
│  │     Body: JSON stringified payload                                     │  │
│  │  3. Timeout: 30 seconds                                                │  │
│  │  4. Handle response or error:                                          │  │
│  │     - Success (200): Parse JSON, return response object                │  │
│  │     - Timeout (AbortError): Throw "Request timeout after 30000ms"      │  │
│  │     - Network error (TypeError): Throw "Network error: ..."            │  │
│  │     - HTTP error (non-200): Throw "API error XXX: ..."                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
└──────────────────────────────────────────────────────────────────────────────┘
                                      ↓ HTTPS POST
┌──────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Server-side)                                │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Express Endpoint: POST /api/ebook/generate                             │  │
│  │  1. Extract request body:                                              │  │
│  │     { prompt, theme, pageCount, colorPalette, fontSizeScale }          │  │
│  │  2. Validate inputs:                                                    │  │
│  │     - prompt: required, non-empty string                               │  │
│  │     - theme: one of [dark, light, corporate, bold]                     │  │
│  │     - pageCount: integer between 3-20                                  │  │
│  │     - fontSizeScale: number between 0.8-1.2                            │  │
│  │  3. If validation fails: Return 400 with error message                 │  │
│  │  4. If validation passes: Continue to orchestrator                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ genieService.process() (Orchestrator):                                 │  │
│  │  1. Receive payload: { mode: "ebook", prompt, metadata: {...} }        │  │
│  │  2. Detect mode: "ebook"                                               │  │
│  │  3. Route to service handler:                                          │  │
│  │     - Call: ebookService.handle(payload, classification)               │  │
│  │  4. Build response envelope with metadata                              │  │
│  │  5. Return result                                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ebookService.handle() (Business Logic - Phase B Pipeline):             │  │
│  │                                                                         │  │
│  │  Step 1: Generate Base Content                                        │  │
│  │  ├─ Call: sampleService.handle(prompt)                                │  │
│  │  └─ Return: { pages: [...], metadata: {...} }                         │  │
│  │                                                                         │  │
│  │  Step 2: Chunk Content                                                │  │
│  │  ├─ Extract text from pages                                           │  │
│  │  ├─ Call: contentChunker.chunk(text, pageCount=8)                     │  │
│  │  └─ Return: Array of content chunks                                   │  │
│  │                                                                         │  │
│  │  Step 3: Apply Theme                                                  │  │
│  │  ├─ Call: themeEngine.applyTheme(chunks, theme="dark", options)       │  │
│  │  ├─ Options: { colorPalette, fontSizeScale }                          │  │
│  │  └─ Return: Theme-colored chunks                                      │  │
│  │                                                                         │  │
│  │  Step 4: Generate Layout                                              │  │
│  │  ├─ Call: pageLayout.generateLayout(chunks, pageCount=8)              │  │
│  │  └─ Return: { pages: [{...}, {...}, ...] }                            │  │
│  │                                                                         │  │
│  │  Step 5: Generate TOC                                                 │  │
│  │  ├─ Call: tocGenerator.generateTOC(chunks, options)                   │  │
│  │  ├─ Options: { includePageNumbers: true, depth: 2 }                   │  │
│  │  └─ Return: { entries: [{id, title, page}, ...] }                     │  │
│  │                                                                         │  │
│  │  Step 6: Generate HTML                                                │  │
│  │  ├─ Call: generateHTML(chunks, layout, toc, options)                  │  │
│  │  ├─ Options: { theme, title, author, fontSizeScale }                  │  │
│  │  └─ Return: HTML string with:                                         │  │
│  │      - Theme colors (background, text, accent, heading)               │  │
│  │      - Font size scaled (16px * fontSizeScale)                        │  │
│  │      - Semantic structure (title, TOC, chapters, footer)              │  │
│  │                                                                         │  │
│  │  Return: {                                                             │  │
│  │    pages: [...],                                                       │  │
│  │    content: "...",                                                     │  │
│  │    html: "<html>...</html>",                                           │  │
│  │    metadata: {                                                         │  │
│  │      pages_count: 8,                                                   │  │
│  │      theme: "dark",                                                    │  │
│  │      colorPalette: "standard",                                         │  │
│  │      fontSizeScale: 1.0,                                               │  │
│  │      density: "standard",                                              │  │
│  │      ...                                                               │  │
│  │    }                                                                    │  │
│  │  }                                                                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Express Endpoint Returns Response:                                     │  │
│  │  {                                                                      │  │
│  │    "id": "ebook_1700766543210_abc123def",                              │  │
│  │    "content": "Generated text content...",                              │  │
│  │    "html": "<html><head>...</head><body>...</body></html>",             │  │
│  │    "metadata": {                                                        │  │
│  │      "title": "Generated E-book",                                      │  │
│  │      "author": "Aether AI",                                            │  │
│  │      "theme": "dark",                                                  │  │
│  │      "pageCount": 8,                                                   │  │
│  │      "colorPalette": "standard",                                       │  │
│  │      "fontSizeScale": 1.0,                                             │  │
│  │      "density": "standard",                                            │  │
│  │      "wordCount": 45                                                   │  │
│  │    },                                                                   │  │
│  │    "pages": 8,                                                          │  │
│  │    "can_export": true,                                                 │  │
│  │    "can_override": true                                                │  │
│  │  }                                                                      │  │
│  │                                                                         │  │
│  │  HTTP 200 OK                                                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
                                      ↓ HTTPS Response
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Client-side)                               │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ebookApi.generateEbook() Response Handler:                             │  │
│  │  1. Response received with status 200                                  │  │
│  │  2. Parse JSON response                                                │  │
│  │  3. Return response object to caller (ebookStore.generate)             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ebookStore.generate() Completion:                                      │  │
│  │  1. Update state:                                                       │  │
│  │     - result = response (with id, html, metadata, pages, ...)          │  │
│  │     - loading = false                                                  │  │
│  │     - error = null                                                     │  │
│  │     - status = "success"                                               │  │
│  │  2. Add current config to history for undo/redo support                │  │
│  │  3. Notify all subscribers of state change (Svelte reactivity)         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ App.svelte Reactivity Triggers:                                        │  │
│  │  1. $ebookResult changes (from null to { id, html, ... })              │  │
│  │  2. $ebookLoading changes (from true to false)                         │  │
│  │  3. Components re-render with new props                                │  │
│  │  4. OverrideForm becomes visible (ebookResult && ebookResult.html)     │  │
│  │  5. ThemePreview renders with generated HTML                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ UI Display:                                                             │  │
│  │  ✅ Loading message disappears                                          │  │
│  │  ✅ ThemePreview component visible with:                               │  │
│  │      - Generated HTML rendered                                         │  │
│  │      - Theme colors applied (dark background, light text)              │  │
│  │      - Font size scaled (16px * 1.0 = 16px)                            │  │
│  │      - All 8 pages visible                                             │  │
│  │  ✅ OverrideForm component visible with:                               │  │
│  │      - Theme selector (currently "dark")                               │  │
│  │      - Color palette selector (currently "standard")                   │  │
│  │      - Font scale slider (currently 1.0)                               │  │
│  │      - "Apply" button enabled                                          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. SECONDARY PATH: Apply Override

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Client-side)                               │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ User Action (after successful generate):                               │  │
│  │  1. OverrideForm visible with current values                           │  │
│  │  2. User changes theme selector to "light"                             │  │
│  │  3. User changes color palette to "vibrant"                            │  │
│  │  4. User changes font scale to 1.1                                     │  │
│  │  5. Clicks "Apply" button                                              │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ OverrideForm.svelte:                                                   │  │
│  │  - Collects overrides: { theme: "light", ... }                         │  │
│  │  - Calls: onApply(overrides)                                           │  │
│  │  - Handler: ebookStore.applyOverride(overrides, ebookResult.id)        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ebookStore.applyOverride() Method:                                     │  │
│  │  1. Validate overrides against allowed fields                          │  │
│  │  2. Set state: loading = true, error = null                            │  │
│  │  3. Extract from current result state:                                 │  │
│  │     - html: current HTML content                                       │  │
│  │     - metadata: current metadata                                       │  │
│  │  4. Build payload:                                                      │  │
│  │     {                                                                   │  │
│  │       ebookId: "ebook_1700766543210_abc123def",                        │  │
│  │       html: "<html>...</html>",                                        │  │
│  │       metadata: { theme: "dark", ... },                                │  │
│  │       overrides: {                                                      │  │
│  │         theme: "light",                                                │  │
│  │         colorPalette: "vibrant",                                       │  │
│  │         fontSizeScale: 1.1                                             │  │
│  │       }                                                                 │  │
│  │     }                                                                    │  │
│  │  5. Call: ebookApi.applyOverride(payload)                              │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ebookApi.applyOverride() (HTTP Client):                                │  │
│  │  1. POST to http://localhost:3000/api/override                         │  │
│  │  2. Timeout: 10 seconds (fast path)                                    │  │
│  │  3. Handle response or error (same as generate)                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
└──────────────────────────────────────────────────────────────────────────────┘
                                      ↓ HTTPS POST
┌──────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Server-side)                                │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Express Endpoint: POST /api/override                                   │  │
│  │  1. Extract request body:                                              │  │
│  │     { ebookId, html, metadata, overrides }                             │  │
│  │  2. Validate inputs (all required)                                     │  │
│  │  3. If validation fails: Return 400                                    │  │
│  │  4. Call: overrideService.applyOverride(html, metadata, overrides)     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ overrideService.applyOverride() (Utility):                             │  │
│  │  1. Takes existing HTML and metadata                                   │  │
│  │  2. Applies CSS overrides for theme changes:                           │  │
│  │     - Background color → Light theme colors                            │  │
│  │     - Text color → Light theme text                                    │  │
│  │     - Accent color → Vibrant palette                                   │  │
│  │  3. Applies font scaling:                                              │  │
│  │     - Multiplies all font sizes by 1.1                                 │  │
│  │  4. Updates metadata with new theme/palette/scale                      │  │
│  │  5. Returns { html: updated_html, metadata: updated_metadata }         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Express Endpoint Returns Response:                                     │  │
│  │  {                                                                      │  │
│  │    "id": "ebook_1700766543210_abc123def",                              │  │
│  │    "html": "<html><!-- updated with light theme --></html>",            │  │
│  │    "metadata": {                                                        │  │
│  │      "theme": "light",          // ← changed                           │  │
│  │      "colorPalette": "vibrant", // ← changed                           │  │
│  │      "fontSizeScale": 1.1,      // ← changed                           │  │
│  │      ...other fields unchanged...                                      │  │
│  │    },                                                                   │  │
│  │    "can_override": true                                                │  │
│  │  }                                                                      │  │
│  │                                                                         │  │
│  │  HTTP 200 OK                                                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
                                      ↓ HTTPS Response
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Client-side)                               │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ebookStore.applyOverride() Completion:                                 │  │
│  │  1. Update state:                                                       │  │
│  │     - result.html = updated HTML (light theme)                         │  │
│  │     - result.metadata = updated metadata                               │  │
│  │     - loading = false                                                  │  │
│  │  2. Notify subscribers (Svelte reactivity)                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ UI Re-renders:                                                          │  │
│  │  ✅ ThemePreview re-renders with:                                      │  │
│  │      - Light background (instead of dark)                              │  │
│  │      - Dark text (instead of light)                                    │  │
│  │      - Vibrant accent colors                                           │  │
│  │      - All fonts 10% larger (1.1x scale)                               │  │
│  │  ✅ OverrideForm still visible for further adjustments                 │  │
│  │  ✅ All 8 pages visible with new styling                               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. STATE TRANSITIONS

```
                           ┌─────────────────────┐
                           │  Initial State      │
                           │  loading: false     │
                           │  error: null        │
                           │  result: null       │
                           │  status: "idle"     │
                           └─────────────────────┘
                                    ↓
                            User clicks "Generate"
                                    ↓
                           ┌─────────────────────┐
                           │  Generating         │
                           │  loading: true      │
                           │  error: null        │
                           │  result: null       │
                           │  status: "generating"│
                           └─────────────────────┘
                                    ↓
                         Backend processing...
                                    ↓
                    ┌────────────────┬─────────────────┐
                    ↓                                   ↓
        ┌──────────────────────┐        ┌──────────────────────┐
        │  Success             │        │  Error               │
        │  loading: false      │        │  loading: false      │
        │  error: null         │        │  error: "..."        │
        │  result: { id, ... } │        │  result: null        │
        │  status: "success"   │        │  status: "error"     │
        └──────────────────────┘        └──────────────────────┘
             ↓                                    ↓
      User sees                          User sees error
      ThemePreview                       message & can retry
             ↓
      User clicks "Apply" (override)
             ↓
        ┌──────────────────────┐
        │  Applying            │
        │  loading: true       │
        │  result: {...}       │ (from previous generate)
        │  status: "applying"  │
        └──────────────────────┘
             ↓
      Backend applies override
             ↓
        ┌──────────────────────┐
        │  Updated             │
        │  loading: false      │
        │  error: null         │
        │  result: { html: updated, ... }
        │  status: "success"   │
        └──────────────────────┘
             ↓
      User sees updated
      ThemePreview with
      new theme/colors
```

---

## 4. ERROR HANDLING FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          ERROR SCENARIO                                       │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Possible Errors in Generate Flow:                                      │  │
│  │                                                                         │  │
│  │  1. CLIENT-SIDE VALIDATION ERROR                                      │  │
│  │     User enters empty prompt → ebookStore.generate() throws error      │  │
│  │     State: error = "Prompt cannot be empty"                            │  │
│  │     UI: Displays error message, Generate button disabled               │  │
│  │                                                                         │  │
│  │  2. SERVER-SIDE VALIDATION ERROR                                      │  │
│  │     Invalid theme value sent → /api/ebook/generate returns 400         │  │
│  │     Response: { error: "Invalid theme. Must be one of: ..." }          │  │
│  │     Client: ebookApi catches error, throws normalized message          │  │
│  │     State: error = "API error 400: Invalid theme..."                   │  │
│  │     UI: Displays error, user can retry                                 │  │
│  │                                                                         │  │
│  │  3. NETWORK ERROR                                                      │  │
│  │     Network disconnects during request → fetch() throws TypeError      │  │
│  │     ebookApi catches and normalizes: "Network error: ..."              │  │
│  │     State: error = "Network error: Failed to fetch"                    │  │
│  │     UI: Displays error, user can retry when connection restored        │  │
│  │                                                                         │  │
│  │  4. TIMEOUT ERROR                                                      │  │
│  │     Request exceeds 30s timeout → AbortController aborts                │  │
│  │     ebookApi catches: "Request timeout after 30000ms"                   │  │
│  │     State: error = "Request timeout after 30000ms"                     │  │
│  │     UI: Displays error, user can increase timeout or optimize backend  │  │
│  │                                                                         │  │
│  │  5. BACKEND SERVICE ERROR                                              │  │
│  │     genieService.process() throws error                                │  │
│  │     Server catches and returns 500                                     │  │
│  │     Response: { error: "Failed to generate e-book", details: "..." }   │  │
│  │     Client: Receives error details                                     │  │
│  │     State: error = "API error 500: Failed to generate e-book"          │  │
│  │     UI: Displays error with details                                    │  │
│  │                                                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Error Recovery:                                                         │  │
│  │                                                                         │  │
│  │  1. User sees error message in UI                                      │  │
│  │  2. ebookError state is populated                                      │  │
│  │  3. User can:                                                           │  │
│  │     - Fix the issue (e.g., enter non-empty prompt)                     │  │
│  │     - Click "Generate eBook" again                                     │  │
│  │     - New request clears previous error                                │  │
│  │     - If successful: result populated, error cleared                   │  │
│  │     - If fails again: error updated with new message                   │  │
│  │                                                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. DATA STRUCTURE SUMMARY

```
REQUEST PAYLOAD (Client → Server)
═════════════════════════════════════════════════════════════════════════════
POST /api/ebook/generate

{
  prompt: string,                    // e.g., "Write a wizard story"
  theme: string,                     // dark | light | corporate | bold
  pageCount: number,                 // 3-20
  colorPalette: string,              // standard | vibrant | muted | grayscale
  fontSizeScale: number              // 0.8-1.2
}

═════════════════════════════════════════════════════════════════════════════

RESPONSE PAYLOAD (Server → Client)
═════════════════════════════════════════════════════════════════════════════
HTTP 200 OK

{
  id: string,                        // "ebook_1700766543210_abc123def"
  content: string,                   // Raw text content
  html: string,                      // Full HTML/CSS for preview
  metadata: {
    title: string,                   // "Generated E-book"
    author: string,                  // "Aether AI"
    theme: string,                   // "dark"
    pageCount: number,               // 8
    wordCount: number,               // 45
    colorPalette: string,            // "standard"
    fontSizeScale: number,           // 1.0
    density: string                  // sparse | standard | dense | very-dense
  },
  pages: number,                     // 8
  can_export: boolean,               // true
  can_override: boolean              // true
}

═════════════════════════════════════════════════════════════════════════════

FRONTEND STORE STATE
═════════════════════════════════════════════════════════════════════════════

config: {
  theme: string,                     // Current theme selection
  pageCount: number,                 // Current page count
  colorPalette: string,              // Current color palette
  fontSizeScale: number,             // Current font scale
  density: string                    // Auto-computed
}

result: {
  id: string,                        // eBook ID
  content: string,                   // Generated content
  html: string,                      // Rendered HTML
  metadata: {...},                   // eBook metadata
  pages: number,                     // Page count
  can_export: boolean,               // Export available
  can_override: boolean              // Override available
} | null

loading: boolean                     // True while request pending

error: string | null                 // Error message if failed

status: string                       // idle | generating | success | error

history: {
  configs: Array<config>,            // Stack of previous configs
  currentIndex: number               // Position in undo/redo chain
}

═════════════════════════════════════════════════════════════════════════════
```

---

## 6. SERVICE LAYER DEPENDENCY MAP

```
                              ┌─────────────────────────────┐
                              │    Frontend (ebookStore)     │
                              │    (State Management)         │
                              └────────────────┬──────────────┘
                                               ↓
                              ┌─────────────────────────────┐
                              │   Frontend (ebookApi.js)     │
                              │   (HTTP Client)              │
                              └────────────────┬──────────────┘
                                               ↓
                              ┌─────────────────────────────┐
                              │   Express Endpoint          │
                              │   POST /api/ebook/generate  │
                              │   POST /api/override        │
                              │   GET /api/themes           │
                              └────────────────┬──────────────┘
                                               ↓
                              ┌─────────────────────────────┐
                              │   genieService.process()     │
                              │   (Orchestrator)             │
                              └────────────────┬──────────────┘
                                               ↓
                              ┌─────────────────────────────┐
                              │   ebookService.handle()      │
                              │   (Business Logic)           │
                              └──────────────────────────────┘
                                   ↓         ↓        ↓
                    ┌───────────────┼────────┼────────┤
                    ↓               ↓        ↓        ↓
           ┌──────────────┐  ┌────────────┐ ┌──────┐ ┌──────────┐
           │ sampleService│  │contentChunk│ │theme │ │pageLayout│
           │   (content)  │  │   (chunk)  │ │engine│ │(layout)  │
           └──────────────┘  └────────────┘ └──────┘ └──────────┘
                    ↓               ↓        ↓        ↓
                    └───────────────┼────────┼────────┤
                                    ↓
                          ┌────────────────────┐
                          │ tocGenerator       │
                          │ (table of contents)│
                          └────────────────────┘
                                    ↓
                          ┌────────────────────┐
                          │ generateHTML()     │
                          │ (HTML generation)  │
                          └────────────────────┘
                                    ↓
                          ┌────────────────────┐
                          │ overrideService    │
                          │ (CSS overrides)    │
                          └────────────────────┘
```
