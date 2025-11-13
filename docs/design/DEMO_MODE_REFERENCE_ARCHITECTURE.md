# Phase A: Demo Mode Reference Architecture

**Date**: November 13, 2025  
**Status**: Implementation Phase  
**Branch**: `aetherV0/anew-default-demo`  
**Mission**: Create polished end-product environment with visual richness (substance deprioritized for Phase A)

**Foundational Design**: See `docs/design/end-to-end_demo-mode.md` for initial brainstorm and complete E2E flow details.

---

## **1. Executive Summary**

Phase A (Demo Mode) focuses on delivering **visually polished, multi-page PDFs** with minimal content complexity. The implementation prioritizes **professional presentation** over sophisticated content algorithms.

**Key Principle**: Single hardcoded dark theme, simplified content distribution (prompt → 5 pages), basic image placement (1 per page), standardized epilogue.

**Target Outcome**: Any prompt becomes a professional-looking book with cover, copyright, TOC, content, epilogue.

---

## **2. Phase A vs. Phase B: Implementation Scope**

### **Phase A: Demo Mode (NOW)**

- ✅ Hardcoded dark theme
- ✅ Fixed 5-page structure
- ✅ Simple prompt distribution (divide by paragraphs)
- ✅ 1 image per page (centered, fixed size)
- ✅ Standard epilogue template ("all" type)
- ✅ Roman numerals (front matter) + Arabic (content)
- ✅ Basic TOC (auto-numbered, flat structure)

### **Phase B: Ebook Mode (FUTURE)**

- 🔮 Multi-theme support (dark/light/corporate)
- 🔮 Intelligent content chunking (extract topics → chapters)
- 🔮 Contextual image generation (content-aware prompts)
- 🔮 Multiple images per page with sophisticated placement
- 🔮 Customizable epilogues (individual templates)
- 🔮 Hierarchical TOC (sections/subsections)
- 🔮 Advanced styling (theme-specific layouts, fonts)
- 🔮 Configurable page structure (2-column, narrow, wide, etc.)

---

## **3. Architecture Layers**

```
┌─────────────────────────────────────────────────────┐
│ HTTP Layer: POST /prompt (mode: "demo")             │
├─────────────────────────────────────────────────────┤
│ Orchestrator (genieService)                         │
│  ├─ Route by mode → demoService.handle()            │
│  ├─ Enrich with metadata                            │
│  └─ Persist to results table                        │
├─────────────────────────────────────────────────────┤
│ Content Generation (demoService)                    │
│  ├─ Parse prompt → 5 pages                          │
│  ├─ Generate page titles from content               │
│  └─ Create standardized blocks                      │
├─────────────────────────────────────────────────────┤
│ PDF Rendering (exportService + themeEngine)         │
│  ├─ Build PDF structure (cover → epilogue)          │
│  ├─ Apply dark theme styling                        │
│  ├─ Embed images (1 per page)                       │
│  ├─ Generate TOC with page numbers                  │
│  ├─ Add page numbers & footers                      │
│  └─ Render epilogue                                 │
├─────────────────────────────────────────────────────┤
│ Job Management (exportQueue + exportProcessor)      │
│  ├─ Queue job (async processing)                    │
│  ├─ Track progress (page by page)                   │
│  └─ Store PDF to filesystem                         │
├─────────────────────────────────────────────────────┤
│ Database (PostgreSQL)                               │
│  ├─ results table (out_envelope)                    │
│  └─ export_jobs table (job tracking)                │
└─────────────────────────────────────────────────────┘
```

---

## **4. Core Components: Phase A**

### **4.1 demoService (Content Generation)**

**Responsibility**: Parse prompt → generate 5-page structure with simple content distribution

**Input**:

```javascript
{
  prompt: "Create a presentation about AI futures",
  metadata: {
    pages: 5,          // Fixed for Phase A
    theme: "dark",     // Hardcoded
    author: "CELS"     // Default
  }
}
```

**Output**: Standardized `out_envelope` with:

- 5 DemoPage objects (p1-p5)
- Each with title, blocks (text, image, callout)
- Metadata with theme: "dark", style: "presentation"
- Actions: generate_pdf, generate_images, etc.

**Algorithm** (Simplified for Phase A):

```
1. Split prompt by paragraphs or sentences
2. Distribute content evenly across 5 pages
3. Generate page titles from first line of each section
4. Create blocks: [text, image placeholder, callout]
5. Return standardized structure
```

**Data Structure**:

```typescript
interface DemoPage {
  id: string; // "p1", "p2", "p3", "p4", "p5"
  title: string; // Auto-generated from content
  blocks: [
    { type: "text"; content: string },
    { type: "image"; url: string; caption: string },
    { type: "callout"; content: string; level: "info" }
  ];
}
```

### **4.2 themeEngine (Dark Theme Application)**

**Responsibility**: Apply dark theme styling to PDF components

**Scope** (Phase A - Dark Theme Only):

- Color palette: Dark background (#1a1a1a), white text (#ffffff), accent (#007bff)
- Fonts: Sans-serif for headers (Helvetica), serif for body (Georgia)
- Spacing: Consistent margins, padding, line-height
- Cover styling: Dark overlay, white text, image as background
- Page styling: Dark background, white text, accent borders

**Exports**:

```javascript
const darkTheme = {
  colors: {
    background: "#1a1a1a",
    text: "#ffffff",
    accent: "#007bff",
    border: "#333333",
  },
  fonts: {
    header: "Helvetica, Arial, sans-serif",
    body: "Georgia, serif",
    mono: "Courier New, monospace",
  },
  spacing: {
    pageMargin: "1in",
    sectionGap: "0.5in",
    lineHeight: 1.6,
  },
  styles: {
    coverPage: {
      /* ... */
    },
    copyrightPage: {
      /* ... */
    },
    contentPage: {
      /* ... */
    },
    epiloguePage: {
      /* ... */
    },
    callout: {
      /* ... */
    },
    quote: {
      /* ... */
    },
  },
};
```

### **4.3 epilogueGenerator (Back Matter)**

**Responsibility**: Generate standardized epilogue section

**Phase A Output** (Single "all" template):

```
[1] Closing Remarks
    "Thank you for exploring the future with us.
     We hope this content has provided valuable insights
     into the opportunities and challenges ahead."

[2] About the Author
    "CELS is dedicated to bridging AI research and practice.
     Contact: contact@cels.com"

[3] Further Resources
    - Research Papers
    - Online Community
    - Additional References
```

**Data Structure**:

```typescript
interface Epilogue {
  type: "epilogue";
  enabled: true;
  epilogueType: "all"; // Phase A: only "all"
  sections: {
    closing: {
      title: "Closing Remarks";
      content: string;
    };
    bio: {
      title: "About the Author";
      content: string;
      contactEmail: string;
    };
    resources: {
      title: "Further Resources";
      items: Array<{ title: string; url: string }>;
    };
  };
}
```

### **4.4 PDF Structure Generator (exportService Enhancement)**

**Responsibility**: Build multi-page PDF with standardized structure

**Phase A Flow**:

```
1. FRONT MATTER
   ├─ Page 1: Cover Page
   │  ├─ Title (from prompt)
   │  ├─ Author ("CELS")
   │  └─ Background Image (generated or placeholder)
   │
   ├─ Page 2: Copyright Page
   │  ├─ "Copyright © 2025 CELS. All rights reserved."
   │  ├─ Disclaimer text
   │  └─ "1st edition 2025"
   │
   └─ Page 3: Table of Contents
      ├─ Chapter 1: Page Title (page 5)
      ├─ Chapter 2: Page Title (page 6)
      ├─ Chapter 3: Page Title (page 7)
      ├─ Chapter 4: Page Title (page 8)
      └─ Chapter 5: Page Title (page 9)

2. CONTENT PAGES (Pages 5-9)
   ├─ Page 5: Chapter 1 + Image + Callout
   ├─ Page 6: Chapter 2 + Image + Callout
   ├─ Page 7: Chapter 3 + Image + Callout
   ├─ Page 8: Chapter 4 + Image + Callout
   └─ Page 9: Chapter 5 + Image + Callout

3. BACK MATTER
   └─ Page 10: Epilogue (Closing + Bio + Resources)
```

**Page Numbering**:

- Front matter: Roman numerals (i, ii, iii)
- Content: Arabic numerals (5, 6, 7, 8, 9)
- Epilogue: Continues (10)

### **4.5 Image Generation Integration**

**Responsibility**: Generate 1 image per content page

**Phase A Constraints**:

- 1 image per page (fixed)
- Size: 4" × 3" (landscape)
- Placement: Top-center (after title, before text)
- Fallback: Gray placeholder if generation fails

**Image Flow**:

```
1. For each content page (p1-p5)
2. Extract key noun/concept from page content
3. Generate image prompt: "Professional illustration of [concept]"
4. Call image generation service (Dall-E / similar)
5. Store to tmp-exports/demo-img-{jobId}-{pageNum}.png
6. Embed in PDF at fixed position
7. Add caption (auto-generated or "Figure {pageNum}")
```

---

## **5. Request/Response Contracts**

### **Generate Demo Content**

```javascript
POST /prompt

Request:
{
  mode: "demo",
  prompt: "Create a presentation about AI futures",
  metadata: {
    pages: 5,              // Fixed for Phase A
    theme: "dark",         // Hardcoded
    author: "CELS",        // Default
    includeImages: true
  }
}

Response 201:
{
  resultId: "uuid-...",
  out_envelope: {
    pages: [               // 5 pages, p1-p5
      { id: "p1", title: "...", blocks: [...] },
      // ... p2-p5
    ],
    metadata: {
      model: "demo-1",
      pages_count: 5,
      theme: "dark",
      style: "presentation",
      pdfStructure: { /* ... */ }
    },
    actions: { /* ... */ }
  }
}
```

### **Request Export (Same as Export Architecture)**

```javascript
POST /api/export/generate { resultId }
Response 202: { jobId, status: "queued" }
```

### **Check Status (Demo-Specific Progress)**

```javascript
GET /api/export/status/:jobId

Response 200 (In Progress):
{
  jobId: "...",
  status: "processing",
  progress: 60,
  details: {
    currentPage: 3,
    totalPages: 5,
    stage: "rendering-content",  // cover | copyright | toc | content | epilogue
    estimatedTimeRemaining: 3000
  }
}

Response 200 (Complete):
{
  jobId: "...",
  status: "complete",
  progress: 100,
  pdfUrl: "/api/export/download/:jobId",
  details: {
    fileSize: 2097152,  // ~2MB
    pageCount: 10,
    processingTime: 5234,
    imagesEmbedded: 5,
    theme: "dark"
  }
}
```

---

## **6. Data Structures**

### **Result Envelope (out_envelope)**

```typescript
interface DemoOutEnvelope {
  pages: DemoPage[];
  pdfStructure: {
    cover: CoverPage;
    copyright: CopyrightPage;
    toc: TableOfContents;
    epilogue: Epilogue;
  };
  metadata: DemoMetadata;
  actions: DemoActions;
}

interface DemoPage {
  id: "p1" | "p2" | "p3" | "p4" | "p5";
  title: string;
  blocks: ContentBlock[];
}

type ContentBlock = TextBlock | ImageBlock | CalloutBlock;

interface TextBlock {
  type: "text";
  content: string;
  style: { fontSize: "16px"; color: "#ffffff" };
}

interface ImageBlock {
  type: "image";
  url: string;
  caption: string;
  style: { width: "4in"; height: "3in"; margin: "0.5in auto" };
}

interface CalloutBlock {
  type: "callout";
  content: string;
  level: "info";
  style: {
    backgroundColor: "#333333";
    borderLeft: "4px solid #007bff";
    padding: "1em";
  };
}

interface DemoMetadata {
  model: "demo-1";
  pages_count: 5;
  source: "demo";
  theme: "dark";
  style: "presentation";
  author: "CELS";
  copyright: "2025";
  edition: "1st edition 2025";
  imageCount: 5;
  pdfStructure: {
    hasEpilogue: true;
    hasTableOfContents: true;
    coverImageUrl: string;
    pageNumbering: {
      frontMatter: "roman";
      content: "arabic";
    };
  };
  generatedAt: string;
  contentHash: string;
}

interface DemoActions {
  persist_prompt: true;
  generate_pdf: true;
  can_export: true;
  can_preview: true;
  generate_images: true;
  apply_theme: true;
  generate_cover: true;
  generate_copyright: true;
  generate_epilogue: true;
}
```

### **PDF Structure Components**

```typescript
interface CoverPage {
  type: "cover";
  title: string;
  author: string;
  backgroundImage: string;
  theme: "dark";
  order: 1;
}

interface CopyrightPage {
  type: "copyright";
  copyright: "Copyright © 2025 CELS. All rights reserved.";
  disclaimer: string;
  edition: "1st edition 2025";
  order: 2;
}

interface TableOfContents {
  type: "toc";
  enabled: true;
  entries: Array<{
    pageNumber: 1-5;
    title: string;
    pageCount: number;
  }>;
  order: 3;
  pageNumbering: "roman";  // iii (for TOC page itself)
}

interface Epilogue {
  type: "epilogue";
  enabled: true;
  epilogueType: "all";
  sections: {
    closing: { title: string; content: string };
    bio: { title: string; content: string; email: string };
    resources: { title: string; items: Array<{title, url}> };
  };
  order: 999;  // Last page
}
```

---

## **7. Module Interactions**

### **Request Flow**

```
Client POST /prompt (mode: "demo")
    ↓
genieService.process()
    ├─ Route to demoService.handle()
    ├─ demoService generates 5-page structure
    ├─ Enrich with cover/copyright/epilogue metadata
    ├─ Persist to results table
    └─ Return resultId
    ↓
Client receives resultId
```

### **Export Flow**

```
Client POST /api/export/generate { resultId }
    ↓
Fetch out_envelope from results table
    ↓
exportQueue.enqueue(jobId, resultId)
    ↓
exportProcessor.processJob()
    ├─ Load out_envelope
    ├─ Call exportService.generate(envelope, {theme: "dark"})
    │
    exportService.generate()
    ├─ Call themeEngine.apply("dark")
    ├─ Build PDF:
    │  ├─ Render cover page (+ background image)
    │  ├─ Render copyright page
    │  ├─ Generate & render TOC
    │  ├─ Render 5 content pages (+ 1 image per page)
    │  ├─ Render epilogue
    │  └─ Apply page numbers & footers
    ├─ Return PDF buffer
    │
    └─ Store PDF to filesystem
    ↓
Client polls /api/export/status/:jobId
    └─ Receives pdfUrl when complete
    ↓
Client GET /api/export/download/:jobId
    └─ Receives PDF binary
```

---

## **8. Implementation Dependencies**

### **Phase A Requires**

From Export Architecture (✅ Already Complete):

- ✅ exportQueue (in-memory + SQLite fallback)
- ✅ exportProcessor (background job loop)
- ✅ exportService (PDF generation wrapper)
- ✅ HTTP endpoints (/generate, /status, /download)
- ✅ Database schema (results, export_jobs tables)

New for Phase A:

- 🆕 demoService.handle() enhancement (5-page generation)
- 🆕 themeEngine module (dark theme styling)
- 🆕 epilogueGenerator module (back matter rendering)
- 🆕 PDF structure builder in exportService (cover/copyright/TOC/epilogue)
- 🆕 Image generation integration (1 image per page)

### **External Dependencies**

- Puppeteer (PDF rendering) — already in use
- Image generation API (Dall-E / similar) — needs configuration
- PDF libraries (pdfkit / puppeteer-core) — already available

---

## **9. Success Criteria (Phase A)**

- [ ] `POST /prompt { mode: "demo", prompt, metadata }` generates 5-page structure
- [ ] `resultId` persisted with complete out_envelope
- [ ] `POST /api/export/generate { resultId }` queues demo export job
- [ ] `GET /api/export/status/:jobId` returns demo-specific progress (stage: cover/content/epilogue)
- [ ] PDF includes: cover page, copyright page, TOC, 5 content pages (each with 1 image), epilogue
- [ ] All pages styled with dark theme (dark background, white text, blue accents)
- [ ] Page numbering: Roman (i, ii, iii for front matter) → Arabic (5-10 for content/epilogue)
- [ ] `GET /api/export/download/:jobId` returns professional-looking 10-page PDF
- [ ] End-to-end: prompt → polished PDF in <10 seconds
- [ ] All 42 existing tests still pass (backward compatibility)

---

## **10. Performance Targets (Phase A)**

| Metric                           | Target | Notes                         |
| -------------------------------- | ------ | ----------------------------- |
| Content generation (demoService) | <500ms | Simple distribution algorithm |
| Image generation (5 images)      | <3s    | External API call             |
| PDF rendering                    | <2s    | Puppeteer multi-page          |
| Total export time                | <8s    | Queue + process + render      |
| PDF file size                    | 1-3MB  | ~200KB per page               |
| Concurrent jobs                  | 3-5    | Limit due to image generation |

---

## **11. Phase B (Ebook Mode) Roadmap**

### **Where Phase B Differs from Phase A**

| Aspect               | Phase A (Demo)                | Phase B (Ebook)                               |
| -------------------- | ----------------------------- | --------------------------------------------- |
| **Themes**           | Dark (hardcoded)              | Dark / Light / Corporate (selectable)         |
| **Content chunking** | Simple division by paragraphs | Intelligent topic extraction & chapter naming |
| **Page count**       | Fixed 5 pages                 | Variable (3-20 pages configurable)            |
| **Images per page**  | 1 (fixed)                     | 1-3 (contextual placement)                    |
| **Image prompts**    | Generic                       | Content-aware, extracted from text            |
| **Epilogue**         | Single "all" template         | Individual templates (closing/bio/resources)  |
| **TOC**              | Flat, auto-numbered           | Hierarchical (sections/subsections)           |
| **Page layout**      | Single column                 | Configurable (1/2/3 column)                   |
| **Styling**          | Theme-aware                   | Theme + layout combination                    |
| **Metadata**         | Minimal                       | Rich (reading time, section metadata)         |

### **Phase B Implementation Strategy**

- Extend demoService → ebookService with advanced algorithms
- Extend themeEngine with light/corporate themes
- Enhance epilogueGenerator with individual templates
- Update PDF structure for hierarchical nesting
- Add content analysis for smart image placement

---

## **12. Risk Mitigation (Phase A)**

| Risk                                 | Mitigation                                           |
| ------------------------------------ | ---------------------------------------------------- |
| Image generation API unavailable     | Fallback to gray placeholders                        |
| PDF rendering timeout (large prompt) | Limit prompt length or split into multiple exports   |
| Theme styling bugs                   | Hardcoded dark theme minimizes complexity            |
| Page break issues                    | Test with various prompt lengths (short/medium/long) |
| File size explosion                  | Monitor and optimize image encoding                  |

---

## **13. Testing Strategy (Phase A)**

### **Unit Tests**

- demoService.handle() with various prompt lengths
- themeEngine.apply() with dark theme
- epilogueGenerator.generate() with standard template
- PDF structure builder (cover, copyright, TOC, epilogue)

### **Integration Tests**

- Full flow: prompt → PDF (short, medium, long prompts)
- Image generation integration
- Page numbering and footer consistency
- Backward compatibility (42 existing tests pass)

### **Manual QA**

- Visual inspection of PDF (alignment, spacing, styling)
- Theme application (colors, fonts match spec)
- Page breaks at logical points
- TOC accuracy (page numbers correct)

---

## **14. Glossary**

| Term                  | Definition                                                           |
| --------------------- | -------------------------------------------------------------------- |
| **out_envelope**      | Canonical data structure containing pages, metadata, actions         |
| **DemoPage**          | Single page in 5-page structure (p1-p5) with blocks                  |
| **ContentBlock**      | Atomic content unit (text, image, callout)                           |
| **themeEngine**       | Module applying dark/light/corporate styling                         |
| **epilogueGenerator** | Module creating back matter (closing, bio, resources)                |
| **PDF structure**     | Standardized front (cover/copyright/TOC) + content + back (epilogue) |
| **Phase A**           | Demo mode: polished, minimal complexity                              |
| **Phase B**           | Ebook mode: intelligent, configurable                                |

---

**Document Version**: 1.0 (Phase A Implementation)  
**Last Updated**: November 13, 2025  
**Status**: Ready for Implementation  
**Next Step**: Begin demoService and themeEngine module development
