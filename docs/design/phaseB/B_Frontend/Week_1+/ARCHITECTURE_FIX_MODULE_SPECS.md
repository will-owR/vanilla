# Architecture Fix: Module Specifications

**Date**: November 28-29, 2025  
**Reference**: ARCHITECTURE_FIX_ARCHITECTURE.md  
**Purpose**: Detailed function signatures and module contracts  
**Status**: Implementation Ready

---

## Module Inventory

### New Files (Create)

1. `server/exportPipeline.js` - Unified export abstraction
2. `server/contracts.js` - Service contract validation
3. `server/dataTransforms.js` - Consolidated data transformations
4. `server/inputRouter.js` - PDF rendering path routing
5. `server/renderStrategies.js` - Three rendering implementations
6. `server/puppeteerBridge.js` - Browser lifecycle management
7. `server/pdfConfigurator.js` - PDF options configuration

### Modified Files (Refactor)

1. `server/pdfGenerator.js` - Thin orchestrator (currently 400+ lines → 50 lines)
2. `server/genieService.js` - Use exportPipeline + contracts
3. `server/exportService.js` - Use dataTransforms
4. `server/index.js` - Route endpoints to exportPipeline

### Test Files (Enhance)

1. `scripts/test-export-roundtrip.js` - Enhanced validation

---

## 1. exportPipeline.js (NEW)

**Purpose**: Single export abstraction for all export endpoints  
**Location**: `/server/exportPipeline.js` (NEW)  
**Size**: ~80 lines  
**Dependencies**: ebookService, contracts, dataTransforms, pdfGenerator

### Interface

```javascript
// ==============================================================
// FUNCTION: exportEbook
// ==============================================================
// PURPOSE: Unified export pipeline (replaces dual paths)
// INPUT:
//   - prompt (string): User's content request
//   - options (object, optional):
//       * theme (string): 'dark' | 'light' | 'corporate' | 'bold'
//       * pageCount (number): Target page count
//       * quality (string): 'low' | 'medium' | 'high'
//
// OUTPUT: Promise<Buffer> - PDF file content
//
// THROWS:
//   - Error if ebookService fails
//   - Error if contract validation fails
//   - Error if pdfGenerator fails
//
// EXAMPLE USAGE:
//   const pdf = await exportPipeline.exportEbook(
//     "Write a mystery novel",
//     { theme: 'dark', pageCount: 50 }
//   );
//   res.set('Content-Type', 'application/pdf');
//   res.send(pdf);

export const exportEbook = async (prompt, options = {}) => {
  // Step 1: Generate ebook content
  const ebook = await ebookService.generate(prompt);

  // Step 2: Validate contract (throws if invalid)
  contracts.EbookContract.validate(ebook);

  // Step 3: Transform pages to PDF-ready format
  const transformed = {
    title: ebook.title,
    chapters: ebook.chapters,
    pages: dataTransforms.transformPages(ebook.pages),
  };

  // Step 4: Generate PDF
  return pdfGenerator.generate(transformed, options);
};

// ==============================================================
// FUNCTION: exportEbookHTML
// ==============================================================
// PURPOSE: Export as HTML instead of PDF (for preview)
// INPUT: Same as exportEbook
// OUTPUT: Promise<string> - HTML content
// THROWS: Same as exportEbook

export const exportEbookHTML = async (prompt, options = {}) => {
  const ebook = await ebookService.generate(prompt);
  contracts.EbookContract.validate(ebook);

  const transformed = {
    title: ebook.title,
    chapters: ebook.chapters,
    pages: dataTransforms.transformPages(ebook.pages),
  };

  // Generate HTML instead of PDF
  return genieService.compose(transformed);
};
```

### Implementation Notes

- Both `/export` and `/api/export` endpoints call `exportEbook()`
- No branching logic - single happy path
- All error handling delegated to called services
- Options passed through to pdfGenerator for customization

---

## 2. contracts.js (NEW)

**Purpose**: Service contract validation  
**Location**: `/server/contracts.js` (NEW)  
**Size**: ~60 lines  
**Dependencies**: None (pure validation)

### Interface

```javascript
// ==============================================================
// CLASS: EbookContract
// ==============================================================
// PURPOSE: Validates ebook data structure
// PATTERN: Validate-at-boundary pattern
//
// VALIDATES:
//   - Required fields present (title, chapters, pages)
//   - Data types correct (string, array, array)
//   - Non-empty constraints
//   - Structure integrity

export const EbookContract = {
  // Required fields that must be present
  required: ["title", "chapters", "pages"],

  // Validates complete ebook structure
  validate: (data) => {
    if (!data || typeof data !== "object") {
      throw new Error(`Expected ebook object, got ${typeof data}`);
    }

    // Check required fields
    for (const field of this.required) {
      if (!(field in data)) {
        throw new Error(
          `Invalid ebook data: missing required field "${field}". ` +
            `Expected shape: { title, chapters, pages, metadata?, ... }`
        );
      }
    }

    // Validate field types
    if (typeof data.title !== "string" || !data.title.trim()) {
      throw new Error("ebook.title must be a non-empty string");
    }

    if (!Array.isArray(data.chapters)) {
      throw new Error("ebook.chapters must be an array");
    }

    if (!Array.isArray(data.pages)) {
      throw new Error("ebook.pages must be an array");
    }

    // Validate each chapter has required fields
    for (let i = 0; i < data.chapters.length; i++) {
      const ch = data.chapters[i];
      if (typeof ch.title !== "string" || !ch.title.trim()) {
        throw new Error(`ebook.chapters[${i}].title must be non-empty string`);
      }
      if (typeof ch.content !== "string" || !ch.content.trim()) {
        throw new Error(
          `ebook.chapters[${i}].content must be non-empty string`
        );
      }
    }

    // Validate each page has required fields
    for (let i = 0; i < data.pages.length; i++) {
      const p = data.pages[i];
      if (typeof p.title !== "string") {
        throw new Error(`ebook.pages[${i}].title must be string`);
      }
      if (typeof p.content !== "string") {
        throw new Error(`ebook.pages[${i}].content must be string`);
      }
    }

    return data; // Return data if valid
  },

  // Validates page array specifically
  validatePages: (pages) => {
    if (!Array.isArray(pages)) {
      throw new Error("pages must be an array");
    }
    for (let i = 0; i < pages.length; i++) {
      if (typeof pages[i] !== "object") {
        throw new Error(`pages[${i}] must be object`);
      }
    }
    return pages;
  },
};

// ==============================================================
// CLASS: PDFEnvelopeContract
// ==============================================================
// PURPOSE: Validates PDF-ready data format

export const PDFEnvelopeContract = {
  required: ["title", "pages"],

  validate: (data) => {
    if (!data || typeof data !== "object") {
      throw new Error(`Expected envelope object, got ${typeof data}`);
    }

    for (const field of this.required) {
      if (!(field in data)) {
        throw new Error(
          `Invalid PDF envelope: missing required field "${field}". ` +
            `Expected: { title, pages, chapters?, html? }`
        );
      }
    }

    if (typeof data.title !== "string") {
      throw new Error("envelope.title must be string");
    }

    if (!Array.isArray(data.pages)) {
      throw new Error("envelope.pages must be array");
    }

    return data;
  },
};
```

### Usage Pattern

```javascript
// In services - validate on input
const ebookService = {
  generate: async (prompt) => {
    const result = {
      /* ... */
    };
    return contracts.EbookContract.validate(result);
  },
};

// In exportPipeline - validate after each step
const ebook = await ebookService.generate(prompt);
contracts.EbookContract.validate(ebook); // Throws if invalid
```

---

## 3. dataTransforms.js (NEW)

**Purpose**: Consolidated data transformation functions  
**Location**: `/server/dataTransforms.js` (NEW)  
**Size**: ~50 lines  
**Dependencies**: None (pure transforms)

### Interface

```javascript
// ==============================================================
// FUNCTION: transformPages
// ==============================================================
// PURPOSE: Transform page array to stack-based format for PDF
// SINGLE SOURCE OF TRUTH for this transformation
// (Previously defined in 2 places: genieService + exportService)
//
// INPUT: pages (array)
//   [
//     { title: "Page 1", content: "..." },
//     { title: "Page 2", content: "..." }
//   ]
//
// OUTPUT: transformed (array)
//   [
//     { title: "Page 1", blocks: [{ type: "content", content: "..." }] },
//     { title: "Page 2", blocks: [{ type: "content", content: "..." }] }
//   ]
//
// WHY: PDF rendering expects { blocks[] } not { content }
//      This transformation bridges ebookService → pdfGenerator
//
// EXAMPLE:
//   const pages = [{ title: "Ch1", content: "Lorem ipsum" }];
//   const transformed = transformPages(pages);
//   // Result: [{ title: "Ch1", blocks: [{type: "content", content: "..."}] }]

export const transformPages = (pages) => {
  return pages.map((page) => ({
    title: page.title || "",
    blocks: [
      {
        type: "content",
        content: page.content || "",
      },
    ],
  }));
};

// ==============================================================
// FUNCTION: transformChapters
// ==============================================================
// PURPOSE: Transform chapter array to pages array
// (May be needed for future rendering modes)
//
// INPUT: chapters (array)
//   [
//     { title: "Chapter 1", content: "...", subsections: [] },
//     { title: "Chapter 2", content: "...", subsections: [] }
//   ]
//
// OUTPUT: pages (array)
//   [
//     { title: "Chapter 1", content: "..." },
//     { title: "Chapter 2", content: "..." }
//   ]

export const transformChapters = (chapters) => {
  return chapters.map((ch) => ({
    title: ch.title,
    content: ch.content,
  }));
};

// ==============================================================
// FUNCTION: transformEnvelope
// ==============================================================
// PURPOSE: Build complete PDF envelope from ebook data
//
// INPUT: ebook (object)
//   { title, chapters, pages, metadata }
//
// OUTPUT: envelope (object)
//   { title, chapters, pages: [{title, blocks}], html?, ... }
//
// CONSOLIDATES: ebookService → exportPipeline → pdfGenerator flow

export const transformEnvelope = (ebook) => {
  return {
    title: ebook.title,
    chapters: ebook.chapters,
    pages: transformPages(ebook.pages),
    metadata: ebook.metadata,
  };
};
```

### Usage Pattern

```javascript
// OLD: Transform logic scattered in genieService.js + exportService.js
// NEW: Single import, single source of truth
import * as transforms from "./dataTransforms.js";

const transformed = {
  title: ebook.title,
  pages: transforms.transformPages(ebook.pages),
};
```

---

## 4. inputRouter.js (NEW)

**Purpose**: Route PDF input to correct rendering strategy  
**Location**: `/server/inputRouter.js` (NEW)  
**Size**: ~80 lines  
**Dependencies**: renderStrategies

### Interface

```javascript
// ==============================================================
// FUNCTION: routeInput
// ==============================================================
// PURPOSE: Determine rendering strategy based on input format
// PRIORITY: Full HTML > Stack-based > Wrapped > Error
//
// INPUT: data (object) - could be any format
// OUTPUT: strategy (function) - chosen renderer
// THROWS: Error if no valid rendering path
//
// LOGIC:
//   IF data.html exists
//     → use renderFullHTML strategy
//   ELSE IF data.pages array exists
//     → use renderStackBased strategy
//   ELSE IF data.body string exists
//     → use renderWrapped strategy
//   ELSE
//     → throw error

export const routeInput = (data) => {
  // Priority 1: Full HTML (complete, best quality)
  if (data.html && typeof data.html === "string") {
    return {
      strategy: "full-html",
      renderer: renderStrategies.renderFullHTML,
      input: data.html,
    };
  }

  // Priority 2: Stack-based pages (reconstruct from parts)
  if (data.pages && Array.isArray(data.pages) && data.pages.length > 0) {
    return {
      strategy: "stack-based",
      renderer: renderStrategies.renderStackBased,
      input: data.pages,
    };
  }

  // Priority 3: Body wrapper (legacy fallback)
  if (data.body && typeof data.body === "string") {
    return {
      strategy: "wrapped",
      renderer: renderStrategies.renderWrapped,
      input: data.body,
    };
  }

  // Priority 4: No valid path
  throw new Error(
    "Invalid PDF input: no valid rendering path. " +
      "Expected one of: data.html (string), data.pages (array), or data.body (string)"
  );
};

// ==============================================================
// FUNCTION: getRoutingInfo
// ==============================================================
// PURPOSE: Describe routing logic for debugging/logging
// RETURNS: Object describing all possible routes

export const getRoutingInfo = () => {
  return {
    priority: [
      { order: 1, format: "html", description: "Full HTML rendering" },
      { order: 2, format: "pages", description: "Stack-based reconstruction" },
      { order: 3, format: "body", description: "Body wrapper (legacy)" },
    ],
    reason: "Prefer complete over partial, specific over generic",
  };
};
```

### Implementation Notes

- No rendering logic here - purely decision-making
- Clean error messages show what was expected
- Routing priorities clearly documented
- Easy to reorder priorities if needed

---

## 5. renderStrategies.js (NEW)

**Purpose**: Three PDF rendering implementations  
**Location**: `/server/renderStrategies.js` (NEW)  
**Size**: ~150 lines  
**Dependencies**: puppeteerBridge, pdfConfigurator

### Interface

```javascript
// ==============================================================
// FUNCTION: renderFullHTML
// ==============================================================
// PURPOSE: Render complete HTML string to PDF
// STRATEGY: Full HTML is most complete, best quality
//
// INPUT:
//   - html (string): Complete valid HTML
//   - options (object, optional): PDF configuration
//
// OUTPUT: Promise<Buffer> - PDF file content
//
// THROWS: Error if rendering fails
//
// FLOW: html → validate → browser.render → PDF
//
// EXAMPLE:
//   const html = '<html><body><h1>Title</h1>...</body></html>';
//   const pdf = await renderFullHTML(html, { theme: 'dark' });

export const renderFullHTML = async (html, options = {}) => {
  try {
    // Validate HTML structure
    if (!html || typeof html !== "string") {
      throw new Error("renderFullHTML: html must be non-empty string");
    }

    if (!html.includes("<html") && !html.includes("<body")) {
      throw new Error(
        "renderFullHTML: html must include <html> or <body> tags"
      );
    }

    // Get PDF config (margins, colors, etc)
    const config = pdfConfigurator.getDefaultOptions();
    Object.assign(config, options);

    // Render via Puppeteer
    const pdf = await puppeteerBridge.renderToPDF(html, config);

    return pdf;
  } catch (error) {
    throw new Error(`renderFullHTML failed: ${error.message}`);
  }
};

// ==============================================================
// FUNCTION: renderStackBased
// ==============================================================
// PURPOSE: Reconstruct and render from page stack
// STRATEGY: Build HTML from pages array, then render
//
// INPUT:
//   - pages (array): [{ title, blocks: [{type, content}] }, ...]
//   - options (object, optional): PDF configuration
//
// OUTPUT: Promise<Buffer> - PDF file content
//
// THROWS: Error if rendering fails
//
// FLOW: pages → buildHTML → validate → browser.render → PDF
//
// EXAMPLE:
//   const pages = [
//     { title: "Page 1", blocks: [{ type: "content", content: "..." }] }
//   ];
//   const pdf = await renderStackBased(pages, { theme: 'dark' });

export const renderStackBased = async (pages, options = {}) => {
  try {
    // Validate pages
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error("renderStackBased: pages must be non-empty array");
    }

    // Build HTML from page stack
    const html = buildHTMLFromPages(pages);

    // Get PDF config
    const config = pdfConfigurator.getDefaultOptions();
    Object.assign(config, options);

    // Render via Puppeteer
    const pdf = await puppeteerBridge.renderToPDF(html, config);

    return pdf;
  } catch (error) {
    throw new Error(`renderStackBased failed: ${error.message}`);
  }
};

// ==============================================================
// FUNCTION: renderWrapped
// ==============================================================
// PURPOSE: Wrap body content in HTML and render
// STRATEGY: Legacy fallback - minimal processing
//
// INPUT:
//   - body (string): HTML body content
//   - options (object, optional): PDF configuration
//
// OUTPUT: Promise<Buffer> - PDF file content
//
// THROWS: Error if rendering fails
//
// FLOW: body → wrapHTML → browser.render → PDF

export const renderWrapped = async (body, options = {}) => {
  try {
    // Validate body
    if (!body || typeof body !== "string") {
      throw new Error("renderWrapped: body must be non-empty string");
    }

    // Wrap in basic HTML structure
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          ${body}
        </body>
      </html>
    `;

    // Get PDF config
    const config = pdfConfigurator.getDefaultOptions();
    Object.assign(config, options);

    // Render via Puppeteer
    const pdf = await puppeteerBridge.renderToPDF(html, config);

    return pdf;
  } catch (error) {
    throw new Error(`renderWrapped failed: ${error.message}`);
  }
};

// ==============================================================
// HELPER: buildHTMLFromPages
// ==============================================================
// PURPOSE: Construct HTML from page stack
// INTERNAL: Used only by renderStackBased

const buildHTMLFromPages = (pages) => {
  const pageHTML = pages
    .map(
      (page) => `
      <div class="page">
        ${page.title ? `<h2>${page.title}</h2>` : ""}
        ${page.blocks
          .map((block) => `<div class="block">${block.content}</div>`)
          .join("")}
      </div>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          .page { page-break-after: always; padding: 20px; }
          h2 { margin-top: 0; }
          .block { margin: 10px 0; line-height: 1.6; }
        </style>
      </head>
      <body>
        ${pageHTML}
      </body>
    </html>
  `;
};
```

---

## 6. puppeteerBridge.js (NEW)

**Purpose**: Browser lifecycle and rendering  
**Location**: `/server/puppeteerBridge.js` (NEW)  
**Size**: ~100 lines  
**Dependencies**: puppeteer (npm package)

### Interface

```javascript
// ==============================================================
// CLASS: PuppeteerBridge (Singleton Pattern)
// ==============================================================
// PURPOSE: Centralized browser lifecycle management
// PATTERN: Singleton - one browser instance per process
//
// WHY: Reusing browser is faster than starting new instance each time
// WARNING: Do not create multiple bridges

export class PuppeteerBridge {
  constructor() {
    this.browser = null;
    this.isConnected = false;
  }

  // ==============================================================
  // METHOD: initBrowser
  // ==============================================================
  // PURPOSE: Start Puppeteer browser instance
  // CALLED: Once on server startup
  // RETURNS: Promise<Browser>
  // THROWS: Error if startup fails

  async initBrowser() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      this.isConnected = true;
      console.log("✓ Puppeteer browser initialized");
      return this.browser;
    } catch (error) {
      throw new Error(`Failed to init browser: ${error.message}`);
    }
  }

  // ==============================================================
  // METHOD: closeBrowser
  // ==============================================================
  // PURPOSE: Gracefully shutdown browser
  // CALLED: On server shutdown
  // RETURNS: Promise<void>

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.isConnected = false;
      console.log("✓ Puppeteer browser closed");
    }
  }

  // ==============================================================
  // METHOD: renderToPDF
  // ==============================================================
  // PURPOSE: Render HTML to PDF using Puppeteer
  //
  // INPUT:
  //   - html (string): HTML content to render
  //   - options (object): PDF options
  //       { format: 'A4', margin: { top, bottom, left, right }, ... }
  //
  // OUTPUT: Promise<Buffer> - PDF file content
  // THROWS: Error if rendering fails
  //
  // FLOW:
  //   1. Create new page
  //   2. Set HTML content
  //   3. Apply options
  //   4. Generate PDF
  //   5. Close page
  //   6. Return buffer

  async renderToPDF(html, options = {}) {
    if (!this.isConnected) {
      throw new Error("Browser not initialized. Call initBrowser() first");
    }

    let page;
    try {
      // Create new page
      page = await this.browser.newPage();

      // Set HTML content
      await page.setContent(html, { waitUntil: "networkidle0" });

      // Generate PDF with options
      const pdf = await page.pdf(options);

      return pdf;
    } catch (error) {
      throw new Error(`PDF rendering failed: ${error.message}`);
    } finally {
      // Always close page
      if (page) {
        await page.close();
      }
    }
  }

  // ==============================================================
  // METHOD: getMetrics
  // ==============================================================
  // PURPOSE: Return performance metrics
  // USED: For benchmarking and monitoring
  // RETURNS: Object with timing data

  getMetrics() {
    return {
      isConnected: this.isConnected,
      browser: this.browser ? "active" : "inactive",
    };
  }
}

// ==============================================================
// SINGLETON INSTANCE
// ==============================================================
export const puppeteerBridge = new PuppeteerBridge();
```

### Usage Pattern

```javascript
// Server startup
import { puppeteerBridge } from "./puppeteerBridge.js";

app.listen(3000, async () => {
  await puppeteerBridge.initBrowser();
});

// Server shutdown
process.on("SIGTERM", async () => {
  await puppeteerBridge.closeBrowser();
  process.exit(0);
});

// In render strategies
const pdf = await puppeteerBridge.renderToPDF(html, config);
```

---

## 7. pdfConfigurator.js (NEW)

**Purpose**: PDF options and configuration  
**Location**: `/server/pdfConfigurator.js` (NEW)  
**Size**: ~60 lines  
**Dependencies**: None (pure configuration)

### Interface

```javascript
// ==============================================================
// CLASS: PDFConfigurator
// ==============================================================
// PURPOSE: Centralized PDF configuration management
// CONSOLIDATES: All PDF tweaking in one place

export const pdfConfigurator = {
  // ==============================================================
  // FUNCTION: getDefaultOptions
  // ==============================================================
  // PURPOSE: Return default PDF rendering options
  // RETURNS: Object with Puppeteer PDF options

  getDefaultOptions: () => ({
    format: "A4",
    margin: {
      top: "1cm",
      bottom: "1cm",
      left: "1.5cm",
      right: "1.5cm",
    },
    displayHeaderFooter: false,
    printBackground: true,
    timeout: 30000,
  }),

  // ==============================================================
  // FUNCTION: applyTheme
  // ==============================================================
  // PURPOSE: Apply theme-specific PDF options
  //
  // THEMES: 'dark', 'light', 'corporate', 'bold'
  //
  // INPUT:
  //   - options (object): Current options
  //   - theme (string): Theme name
  //
  // OUTPUT: Modified options with theme applied
  //
  // EXAMPLE:
  //   let opts = getDefaultOptions();
  //   opts = applyTheme(opts, 'dark');
  //   // Now has dark theme colors/styles

  applyTheme: (options, theme = "light") => {
    const themes = {
      dark: {
        printBackground: true,
        cssOptions: { mediaType: "screen" },
      },
      light: {
        printBackground: false,
        cssOptions: { mediaType: "print" },
      },
      corporate: {
        format: "A4",
        margin: { top: "2cm", bottom: "2cm", left: "2cm", right: "2cm" },
        headerTemplate: "<h3>Corporate Template</h3>",
      },
      bold: {
        printBackground: true,
        scale: 1.1,
      },
    };

    const themeOptions = themes[theme] || themes.light;
    return { ...options, ...themeOptions };
  },

  // ==============================================================
  // FUNCTION: validateOptions
  // ==============================================================
  // PURPOSE: Ensure options are valid
  // RETURNS: true if valid, throws if invalid

  validateOptions: (options) => {
    const validFormats = ["A4", "Letter", "A3", "A5"];
    if (options.format && !validFormats.includes(options.format)) {
      throw new Error(
        `Invalid PDF format: ${options.format}. ` +
          `Expected one of: ${validFormats.join(", ")}`
      );
    }

    if (options.scale && (options.scale < 0.1 || options.scale > 2)) {
      throw new Error("PDF scale must be between 0.1 and 2");
    }

    return true;
  },
};
```

---

## 8. pdfGenerator.js (REFACTORED)

**Purpose**: Unified PDF orchestration (thin layer)  
**Location**: `/server/pdfGenerator.js` (EXISTING - REFACTOR)  
**Size**: 400+ lines → 50 lines  
**Dependencies**: inputRouter, renderStrategies, puppeteerBridge, pdfConfigurator

### Interface

```javascript
// ==============================================================
// CLASS: PDFGenerator (Refactored Orchestrator)
// ==============================================================
// PURPOSE: Thin orchestration layer
// BEFORE: 400+ lines of mixed concerns
// AFTER: 50 lines of pure orchestration
//
// WORKFLOW:
//   1. Route input → inputRouter
//   2. Apply config → pdfConfigurator
//   3. Render → chosen strategy
//   4. Return PDF

export const pdfGenerator = {
  // ==============================================================
  // FUNCTION: generate
  // ==============================================================
  // PURPOSE: Main export function
  // INPUT:
  //   - data (object): PDF input (html, pages, or body)
  //   - options (object, optional): Rendering options
  //
  // OUTPUT: Promise<Buffer> - PDF content
  // THROWS: Error with clear message
  //
  // EXAMPLE:
  //   const pdf = await pdfGenerator.generate(
  //     { html: '<html>...</html>' },
  //     { theme: 'dark' }
  //   );

  generate: async (data, options = {}) => {
    try {
      // Step 1: Route to appropriate strategy
      const route = inputRouter.routeInput(data);

      // Step 2: Apply configuration
      const config = pdfConfigurator.getDefaultOptions();
      Object.assign(config, options);
      pdfConfigurator.validateOptions(config);

      // Step 3: Render using chosen strategy
      const pdf = await route.renderer(route.input, config);

      return pdf;
    } catch (error) {
      console.error("PDF generation failed:", error);
      throw error;
    }
  },

  // ==============================================================
  // FUNCTION: getStatus
  // ==============================================================
  // PURPOSE: Return generation status/metrics
  // RETURNS: Object with current state

  getStatus: () => ({
    browser: puppeteerBridge.getMetrics(),
    routing: inputRouter.getRoutingInfo(),
  }),
};
```

### Migration Notes

- Keep old pdfGenerator.js as backup initially
- All logic delegates to focused modules
- Easier to test, understand, extend
- Explicit separation of concerns

---

## Contract Summary

### Data Flow Contracts

```
ebookService.generate()
  OUTPUT: { title, chapters, pages, metadata? }
  VALIDATED: EbookContract.validate()

exportPipeline.exportEbook()
  INPUT: promise from ebookService
  OUTPUT: { title, chapters, pages: [{title, blocks}] }
  VALIDATED: EbookContract.validate()

pdfGenerator.generate()
  INPUT: { html?, pages?, body? } OR { title, pages }
  OUTPUT: PDF Buffer
  VALIDATED: PDFEnvelopeContract.validate()
```

### Error Handling Contracts

- Every function throws on invalid input
- Error messages include expected shape
- No silent failures (all errors surfaced)
- Stack traces preserved for debugging

---

## Import Map

### File Import Dependencies

```
exportPipeline.js
  ├─ import ebookService from './ebookService.js'
  ├─ import * as contracts from './contracts.js'
  ├─ import * as dataTransforms from './dataTransforms.js'
  └─ import { pdfGenerator } from './pdfGenerator.js'

pdfGenerator.js (refactored)
  ├─ import { inputRouter } from './inputRouter.js'
  ├─ import * as renderStrategies from './renderStrategies.js'
  ├─ import { puppeteerBridge } from './puppeteerBridge.js'
  └─ import { pdfConfigurator } from './pdfConfigurator.js'

renderStrategies.js
  ├─ import { puppeteerBridge } from './puppeteerBridge.js'
  └─ import { pdfConfigurator } from './pdfConfigurator.js'

index.js (routes)
  ├─ import { exportPipeline } from './exportPipeline.js'
  ├─ import genieService from './genieService.js'
  └─ import exportService from './exportService.js'
```

---

## Testing Interfaces

### Unit Test Patterns

```javascript
// Testing contracts.js
import { EbookContract } from './contracts.js';

test('EbookContract rejects missing title', () => {
  expect(() => {
    EbookContract.validate({ chapters: [], pages: [] });
  }).toThrow('missing required field "title"');
});

// Testing dataTransforms.js
import * as transforms from './dataTransforms.js';

test('transformPages converts format', () => {
  const pages = [{ title: 'P1', content: 'text' }];
  const result = transforms.transformPages(pages);
  expect(result[0].blocks).toBeDefined();
});

// Testing inputRouter.js
import { routeInput } from './inputRouter.js';

test('routeInput prioritizes full HTML', () => {
  const data = {
    html: '<html>...</html>',
    pages: [...]  // Both present
  };
  const route = routeInput(data);
  expect(route.strategy).toBe('full-html');
});
```

---

**Status**: Ready for implementation  
**Next Step**: Review ARCHITECTURE_FIX_IMPLEMENTATION.md for step-by-step guide
