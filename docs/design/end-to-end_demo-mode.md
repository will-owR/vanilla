# End-to-End Demo Mode Flow — demoService Implementation

**Date**: November 13, 2025  
**Status**: Brainstorming / Design Phase  
**Branch**: `aetherV0/anew-default-demo`  
**Purpose**: Document the complete flow for 'demo' mode content generation, persistence, and PDF export. Define architectural patterns, data structures, and integration points for multi-page, richly-styled content generation.

---

## **1. Overview: Demo Mode vs. Basic Mode**

### **Basic Mode (✅ Complete)**

- Single-page, text-only content
- Instant generation (<500ms)
- Minimal PDF (~50KB)
- Simple linear flow

### **Demo Mode (🚀 Starting)**

- Multi-page (3-5+), styled content
- Generated images and rich blocks
- Richer metadata and theme support
- 2-5s processing time
- Larger PDFs (~500KB+)

---

## **1.5. Demo PDF Structure (With Defaults)**

All demo PDFs follow a standardized structure with mandatory front matter and back matter:

### **PDF Structure (In Order)**

1. **Cover Page** (Default)

   - Title (from prompt)
   - Author (from metadata or "CELS")
   - Descriptive image as background (generated or provided)
   - Optional: Subtitle, date, edition

2. **Copyright Page** (Default - Always Included)

   - Copyright notice: `Copyright © 2025 CELS. All rights reserved.`
   - Disclaimer text
   - Licensing information
   - Edition: `1st edition 2025`

3. **Table of Contents** (Auto-Generated)

   - Chapter titles with page numbers
   - Hierarchical outline if nested sections
   - Only auto-generated if content > 3 pages

4. **Content Area** (Main Body - User-Defined)

   - Chapters/Sections (pages from demoService)
   - Multi-page layout with styling
   - Images, callouts, quotes embedded
   - Page numbers and running headers

5. **Epilogue** (Default - Optional)
   - Closing remarks or call-to-action
   - Author bio/contact information
   - Additional resources or links
   - Back cover design

### **Example PDF Flow**

```
[1] Cover Page
    ├─ Title: "AI Futures"
    ├─ Author: "CELS"
    └─ Background Image

[2] Copyright Page
    ├─ Copyright © 2025 CELS. All rights reserved.
    ├─ No portion of this book may be reproduced...
    └─ 1st edition 2025

[3] Table of Contents
    ├─ Chapter 1: Introduction (page 5)
    ├─ Chapter 2: Current Landscape (page 8)
    ├─ Chapter 3: Future Trends (page 11)
    └─ Chapter 4: Implications (page 14)

[4-N] Content Pages
    ├─ Page 5: Chapter 1 with text + images
    ├─ Page 6-7: Chapter 2
    ├─ Page 8-9: Chapter 3
    └─ Page 10: Chapter 4

[N+1] Epilogue
    ├─ Closing thoughts
    ├─ Author bio
    └─ Call-to-action
```

### **Metadata for PDF Structure**

```javascript
metadata: {
  title: "AI Futures",
  author: "CELS",          // Default if not provided
  copyright: "2025",
  edition: "1st edition 2025",

  // Cover customization
  coverImage: "file:///tmp/cover-bg-001.png",  // Required for cover
  coverColor: "#1a1a1a",   // Fallback if no image

  // Epilogue customization
  epilogue: {
    enabled: true,         // Default: true
    type: "closing",       // closing | bio | resources | all
    closingText: "Thank you for reading...",
    authorBio: "CELS is dedicated to...",
    contactInfo: "contact@cels.com",
    resources: [
      { title: "Further Reading", url: "..." },
      { title: "Contact Us", url: "..." }
    ]
  }
}
```

---

## **2. End-to-End Flow: Demo Mode**

### **Phase 1: Request Generation**

**Endpoint**: `POST /prompt`

**Request Structure**:

```javascript
{
  mode: "demo",
  prompt: "Create a presentation about AI futures",

  // Demo-specific metadata
  metadata: {
    pages: 5,                          // Custom page count (default: 3)
    theme: "dark",                     // Visual theme (dark/light/corporate)
    includeImages: true,               // Generate visual assets
    imageCount: 5,                     // Number of images to generate
    style: "presentation",             // Content style (presentation/article/report)

    // PDF Structure Customization
    author: "CELS",                    // For cover & copyright (default: "CELS")
    coverImage: "file:///path/to/img", // Background image URL (auto-generated if not provided)
    epilogueType: "closing",           // Type: closing | bio | resources | all (default: all)
    includeEpilogue: true              // Include epilogue section (default: true)
  },

  // Generation options
  options: {
    generateImages: true,        // Enable Dall-E or similar
    includeBackgrounds: true,    // Styled page backgrounds
    imageQuality: "high",        // Image generation quality
    estimatedReadTime: true      // Calculate reading time
  }
}
```

**Response**: `201 Created`

```javascript
{
  resultId: "550e8400-e29b-41d4-a716-446655440000",
  out_envelope: {
    pages: [ /* see Phase 2 */ ],
    metadata: { /* see Phase 2 */ },
    actions: { /* see Phase 2 */ }
  }
}
```

---

### **Phase 2: Route & Enrich (genieService)**

**Flow**:

1. Receive payload with `mode: "demo"`
2. Route to `demoService.handle(payload)`
3. demoService validates metadata (pages, theme, style)
4. Generate multi-page structure with rich content
5. Enrich with orchestrator metadata (timestamps, mode, resultId)
6. Persist to `results` table
7. Return `resultId` to client

**demoService Output Structure**:

```javascript
{
  // PDF Structure Components (Auto-Generated)
  pdfStructure: {
    coverPage: {
      type: "cover",
      title: "AI Futures",
      author: "CELS",
      backgroundImage: "file:///tmp/cover-bg-001.png",
      order: 1
    },

    copyrightPage: {
      type: "copyright",
      copyright: "Copyright © 2025 CELS. All rights reserved.",
      disclaimer: "No portion of this book may be reproduced in any form without written permission from the publisher or author, except as permitted by U.S. copyright law.",
      edition: "1st edition 2025",
      order: 2
    },

    tableOfContents: {
      type: "toc",
      enabled: true,
      entries: [
        { title: "Chapter 1: Introduction", pageNumber: 5 },
        { title: "Chapter 2: Landscape", pageNumber: 8 },
        { title: "Chapter 3: Trends", pageNumber: 11 },
        { title: "Chapter 4: Implications", pageNumber: 14 }
      ],
      order: 3
    }
  },

  // Content Pages (User-Provided)
  pages: [
    {
      id: "p1",
      title: "Chapter 1: Introduction",
      order: 4,
      blocks: [
        {
          type: "text",
          content: "Introduction to AI landscape...",
          style: { fontSize: "16px", color: "#333" }
        },
        {
          type: "image",
          url: "file:///tmp/demo-img-001.png",
          caption: "AI adoption curve",
          style: { width: "100%", margin: "20px 0" }
        },
        {
          type: "callout",
          content: "Key insight: AI adoption accelerating",
          style: { backgroundColor: "#f0f0f0", borderLeft: "4px solid #007bff" }
        }
      ]
    },
    {
      id: "p2",
      title: "Chapter 2: Current Landscape",
      order: 5,
      blocks: [
        { type: "text", content: "..." },
        { type: "image", url: "...", caption: "..." },
        { type: "quote", content: "...", author: "..." }
      ]
    },
    // ... p3, p4, p5
  ],

  // Epilogue (Auto-Generated or Custom)
  epilogue: {
    type: "epilogue",
    enabled: true,
    epilogueType: "all",  // closing | bio | resources | all
    sections: {
      closing: {
        title: "Closing Remarks",
        content: "Thank you for exploring the future of AI with us..."
      },
      bio: {
        title: "About the Author",
        content: "CELS is dedicated to bridging AI research and practice...",
        contactEmail: "contact@cels.com"
      },
      resources: {
        title: "Further Resources",
        items: [
          { title: "Research Papers", url: "..." },
          { title: "Online Community", url: "..." }
        ]
      }
    },
    order: 999
  },

  metadata: {
    model: "demo-2",
    pages_count: 5,
    source: "demo",

    // PDF Structure Metadata
    pdfStructure: {
      hasEpilogue: true,
      hasTableOfContents: true,
      coverImageUrl: "file:///tmp/cover-bg-001.png",
      author: "CELS",
      copyright: "2025",
      edition: "1st edition 2025"
    },

    // Demo-specific metadata
    theme: "dark",
    style: "presentation",
    imageCount: 5,
    estimatedReadTime: "8 min",
    generatedAt: "2025-11-13T20:30:00Z",
    contentHash: "abc123def456"
  },

  actions: {
    persist_prompt: true,
    generate_pdf: true,
    can_export: true,
    can_preview: true,
    generate_images: true,
    apply_theme: true,
    generate_cover: true,      // ← New: Generate cover page
    generate_copyright: true,  // ← New: Generate copyright page
    generate_epilogue: true    // ← New: Generate epilogue
  }
}
```

**Database Entry** (`results` table):

```sql
INSERT INTO results (resultId, out_envelope, mode, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '{...out_envelope...}',  -- JSONB
  'demo',
  NOW(),
  NOW()
)
```

---

### **Phase 3: Export Request & Queueing**

**Endpoint**: `POST /api/export/generate`

**Request**:

```javascript
{
  resultId: "550e8400-e29b-41d4-a716-446655440000";
}
```

**Server Actions**:

1. Validate `resultId` exists in `results` table
2. Fetch full `out_envelope` from database
3. Create `export_jobs` record with demo-specific metadata
4. Enqueue to `exportQueue`
5. Return `202 Accepted` with `jobId`

**Queue Entry Structure**:

```javascript
{
  jobId: "e8d4d8f0-a9c7-11eb-b4b2-0242ac130002",
  resultId: "550e8400-e29b-41d4-a716-446655440000",
  status: "queued",
  createdAt: Date.now(),

  // Demo-specific metadata
  metadata: {
    pageCount: 5,
    hasImages: true,
    theme: "dark",
    style: "presentation",
    estimatedProcessingTime: 4500,  // ms
    priority: "normal"              // normal | urgent | batch
  }
}
```

**Response**: `202 Accepted`

```javascript
{
  jobId: "e8d4d8f0-a9c7-11eb-b4b2-0242ac130002",
  status: "queued",
  estimatedWait: 2000  // ms until processing starts
}
```

**Database Entry** (`export_jobs` table):

```sql
INSERT INTO export_jobs (jobId, resultId, status, created_at)
VALUES (
  'e8d4d8f0-a9c7-11eb-b4b2-0242ac130002',
  '550e8400-e29b-41d4-a716-446655440000',
  'queued',
  NOW()
)
```

---

### **Phase 4: Background Processing (exportProcessor)**

**Flow**:

1. `exportProcessor` polls queue every 1000ms
2. Respects `MAX_CONCURRENT: 5` limit
3. For each job:
   - Update status → `processing`
   - Fetch result from database
   - Generate PDF via `exportService`
   - Store to filesystem
   - Update status → `complete` or `failed`
   - Persist to database

**Processing Steps for Demo**:

```javascript
async function processJob(job) {
  // 1. Mark as processing
  await exportQueue.updateJob(job.jobId, {
    status: "processing",
    progress: 0,
    startedAt: Date.now(),
  });

  // 2. Fetch full envelope from DB
  const result = await db.results.findByResultId(job.resultId);
  if (!result) {
    return setJobFailed(job.jobId, "Result not found");
  }

  // 3. Generate PDF (multi-page with styling)
  try {
    const { buffer, metadata } = await exportService.generate(
      result.out_envelope,
      {
        validate: true,
        theme: result.out_envelope.metadata.theme,
        includeTableOfContents: result.out_envelope.pages.length > 3,
        pageNumbers: true,
      }
    );

    // 4. Progress updates (demo-specific)
    for (let page = 1; page <= result.out_envelope.pages.length; page++) {
      await exportQueue.updateJob(job.jobId, {
        progress: Math.floor((page / result.out_envelope.pages.length) * 90),
        details: {
          currentPage: page,
          totalPages: result.out_envelope.pages.length,
          stage: "rendering-page",
        },
      });
      // Simulate rendering delay
      await delay(500);
    }

    // 5. Store to filesystem
    const filename = `export_${job.jobId}.pdf`;
    const filepath = path.join(process.cwd(), "tmp-exports", filename);
    await fs.writeFile(filepath, buffer);

    // 6. Mark complete
    await exportQueue.updateJob(job.jobId, {
      status: "complete",
      progress: 100,
      pdfPath: filepath,
      completedAt: Date.now(),
      details: {
        fileSize: buffer.length,
        pageCount: result.out_envelope.pages.length,
        processingTime: Date.now() - job.metadata.createdAt,
        imagesEmbedded: result.out_envelope.metadata.imageCount || 0,
        theme: result.out_envelope.metadata.theme,
      },
    });

    // 7. Persist to DB
    await db.exportJobs.update(job.jobId, {
      status: "complete",
      pdf_path: filepath,
      progress: 100,
      completed_at: NOW(),
    });
  } catch (error) {
    // Failed job handling
    await setJobFailed(job.jobId, error.message);
  }
}
```

**Concurrency Management**:

```javascript
MAX_CONCURRENT: 5; // Prevent Puppeteer resource exhaustion

// Demo jobs are more resource-intensive than basic:
// - Basic: 5 simultaneous acceptable
// - Demo: Consider reducing to 3-4 if images are generated
```

---

### **Phase 5: Status Polling**

**Endpoint**: `GET /api/export/status/:jobId`

**In-Progress Response**:

```javascript
{
  jobId: "e8d4d8f0-a9c7-11eb-b4b2-0242ac130002",
  status: "processing",
  progress: 45,

  // Demo-specific progress details
  details: {
    currentPage: 3,
    totalPages: 5,
    stage: "rendering-images",
    estimatedTimeRemaining: 2500  // ms
  },

  pdfUrl: null
}
```

**Complete Response**:

```javascript
{
  jobId: "e8d4d8f0-a9c7-11eb-b4b2-0242ac130002",
  status: "complete",
  progress: 100,
  pdfUrl: "/api/export/download/e8d4d8f0-a9c7-11eb-b4b2-0242ac130002",

  // Demo-specific completion metadata
  details: {
    fileSize: 524288,           // bytes
    pageCount: 5,
    processingTime: 3847,       // ms
    imagesEmbedded: 5,
    theme: "dark",
    downloadUrl: "...pdfUrl..."
  }
}
```

**Failed Response**:

```javascript
{
  jobId: "e8d4d8f0-a9c7-11eb-b4b2-0242ac130002",
  status: "failed",
  progress: 0,
  error: "PDF generation failed: image rendering timeout",
  errorCode: "IMAGE_RENDER_TIMEOUT",
  details: {
    stage: "rendering-images",
    failedAt: "2025-11-13T20:32:45Z",
    retryable: true
  }
}
```

---

### **Phase 6: PDF Download**

**Endpoint**: `GET /api/export/download/:jobId`

**Success Response**: `200 OK`

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="export-demo-<timestamp>.pdf"
Content-Length: 524288

[PDF binary stream]
```

**PDF Contents (Demo-specific)**:

- Cover page with title and metadata
- Table of contents (if >3 pages)
- Multi-page content with:
  - Styled text blocks
  - Embedded images
  - Callouts and highlights
  - Quotes and citations
- Page numbers and footers
- Theme applied (dark/light/corporate)
- Metadata in PDF info

**Not Ready Response**: `202 Accepted`

```javascript
{
  error: "PDF not ready yet",
  status: "processing",
  progress: 65,
  estimatedWait: 1500  // ms
}
```

**Expired Response**: `410 Gone`

```javascript
{
  error: "Export expired (>24h old)",
  code: "EXPORT_EXPIRED"
}
```

---

## **3. Data Structures**

### **Result Envelope (out_envelope)**

```typescript
interface DemoOutEnvelope {
  pages: DemoPage[];
  metadata: DemoMetadata;
  actions: DemoActions;
}

interface DemoPage {
  id: string; // "p1", "p2", etc.
  title: string;
  blocks: ContentBlock[];
}

type ContentBlock =
  | TextBlock
  | ImageBlock
  | CalloutBlock
  | QuoteBlock
  | CodeBlock
  | TableBlock;

interface TextBlock {
  type: "text";
  content: string;
  style?: {
    fontSize?: string;
    color?: string;
    fontWeight?: string;
    alignment?: "left" | "center" | "right";
  };
}

interface ImageBlock {
  type: "image";
  url: string;
  caption?: string;
  altText?: string;
  style?: {
    width?: string;
    height?: string;
    margin?: string;
    borderRadius?: string;
  };
}

interface CalloutBlock {
  type: "callout";
  content: string;
  level?: "info" | "warning" | "success" | "error";
  style?: {
    backgroundColor?: string;
    borderLeft?: string;
    padding?: string;
  };
}

interface QuoteBlock {
  type: "quote";
  content: string;
  author?: string;
  style?: {
    fontSize?: string;
    fontStyle?: "italic";
    color?: string;
  };
}

interface CodeBlock {
  type: "code";
  language?: string;
  content: string;
  lineNumbers?: boolean;
}

interface TableBlock {
  type: "table";
  headers: string[];
  rows: (string | number)[][];
}

interface DemoMetadata {
  model: string; // "demo-2"
  pages_count: number;
  source: "demo";
  theme: "dark" | "light" | "corporate";
  style: "presentation" | "article" | "report";
  imageCount: number;
  estimatedReadTime: string; // "8 min"
  generatedAt: string; // ISO8601
  contentHash: string; // SHA256 for deduplication
}

interface DemoActions {
  persist_prompt: boolean;
  generate_pdf: boolean;
  can_export: boolean;
  can_preview: boolean;
  generate_images: boolean;
  apply_theme: boolean;
}
```

### **Queue Job Metadata (Demo-specific)**

```typescript
interface DemoQueueJob {
  jobId: string;
  resultId: string;
  status: "queued" | "processing" | "complete" | "failed" | "expired";
  createdAt: number;

  metadata: {
    pageCount: number;
    hasImages: boolean;
    theme: string;
    style: string;
    estimatedProcessingTime: number; // ms
    priority: "normal" | "urgent" | "batch";
  };

  progress?: number;
  startedAt?: number;
  completedAt?: number;

  details?: {
    currentPage?: number;
    totalPages?: number;
    stage?: string;
    fileSize?: number;
    processingTime?: number;
    imagesEmbedded?: number;
    downloadUrl?: string;
  };

  error?: string;
  errorCode?: string;
}
```

---

## **4. Integration Points**

### **With demoService**

- Input: `{ mode: "demo", prompt, metadata, options }`
- Output: Structured `out_envelope` with pages, blocks, metadata
- Validation: Verify page count, theme, style are valid

### **With exportService (PDF Generation)**

- Input: `out_envelope` + theme + includeTableOfContents
- Output: PDF buffer with multi-page, styled layout
- Considerations: Images embedded, TOC generated, page numbers added

### **With exportProcessor (Background Loop)**

- Input: Queue job with demo metadata
- Output: PDF written to disk, job status updated
- Concurrency: Respect `MAX_CONCURRENT` limits
- Progress: Emit progress updates per page rendered

### **With Database**

- `results`: Store `out_envelope` as JSONB
- `export_jobs`: Track job status, PDF path, processing time
- Queries: By `resultId`, by `status`, by `created_at` (cleanup)

---

## **5. Key Architectural Patterns**

### **Separation of Concerns**

```
┌─────────────────────────────────────────────────────┐
│ HTTP Layer (request/response)                       │
├─────────────────────────────────────────────────────┤
│ Orchestrator (genieService) - routing, enrichment   │
├─────────────────────────────────────────────────────┤
│ Services (demoService) - pure generation            │
├─────────────────────────────────────────────────────┤
│ Export Layer (exportQueue, exportProcessor)         │
├─────────────────────────────────────────────────────┤
│ PDF Generator (exportService) - rendering           │
├─────────────────────────────────────────────────────┤
│ Database Layer (PostgreSQL + SQLite fallback)       │
└─────────────────────────────────────────────────────┘
```

### **Reference-Based Flow**

- Client sends `resultId` (UUID), not full content
- Backend retrieves from database when needed
- Enables caching, deduplication, audit trail

### **Async Processing with Progress**

- Queue job immediately (202 Accepted)
- Poll status endpoint for progress
- Demo-specific progress details (current page, stage)
- Complete or fail independently of request lifetime

### **Graceful Degradation**

- In-memory queue → SQLite fallback when full
- Demo processing slower than basic but independent
- Concurrent limits prevent resource exhaustion
- Failed jobs can be retried or requeued

---

## **6. Error Handling & Edge Cases**

| Scenario                   | Status | Action                                  |
| -------------------------- | ------ | --------------------------------------- |
| Invalid metadata (pages=0) | 400    | Reject with validation error            |
| Unsupported theme          | 400    | Return list of valid themes             |
| Image generation fails     | 500    | Mark job failed, return error in status |
| PDF rendering timeout      | 504    | Retry up to 3 times, then fail          |
| Result not found           | 404    | Return "Result not found"               |
| Queue full (no fallback)   | 503    | Return "Queue at capacity"              |
| Export expired (>24h)      | 410    | Auto-cleanup, return "Export expired"   |
| Concurrent limit reached   | 202    | Queue and wait turn                     |

---

## **7. Performance Considerations**

### **Demo vs. Basic**

| Metric              | Basic  | Demo                          |
| ------------------- | ------ | ----------------------------- |
| Generation time     | <100ms | <1s                           |
| PDF generation time | <500ms | 2-5s                          |
| PDF size            | 50KB   | 500KB+                        |
| Images              | 0      | 5-10                          |
| Pages               | 1      | 3-5                           |
| Concurrent limit    | 5      | 3-4 (more resource-intensive) |
| Cache effectiveness | Medium | High (more reuse)             |

### **Optimization Opportunities**

1. **Image Caching**: Cache generated images by content hash
2. **Template Caching**: Reuse HTML templates for common themes
3. **Progressive Rendering**: Stream first page while generating rest
4. **Lazy Loading**: Don't generate all images until PDF needed
5. **Batch Processing**: Group demo requests with same theme

---

## **8. Future Enhancements**

### **Phase 6+**

1. **Bull Queue Integration**

   - Replace simple async with Bull for reliability
   - Persist jobs across server restarts
   - Add retry logic with exponential backoff

2. **Streaming PDF Generation**

   - Stream first 2 pages while generating rest
   - Improve perceived performance

3. **WebSocket Progress Updates**

   - Real-time progress instead of polling
   - Better UX for long-running exports

4. **Template Library**

   - Pre-built demo templates (presentation, article, report)
   - User-created custom templates

5. **Batch Exports**

   - Generate light + dark theme simultaneously
   - Export to multiple formats (PDF, HTML, PPTX)

6. **Webhook Notifications**

   - Notify client when PDF ready
   - Support custom callback URLs

7. **Archive to S3**

   - Store PDFs >24h on S3
   - Retrieve archived exports

8. **Priority Queue**
   - Urgent exports jump the queue
   - Batch exports scheduled off-peak

---

## **9. Success Criteria**

- [ ] `POST /prompt { mode: "demo", ... }` generates multi-page, styled content
- [ ] `resultId` persisted to database with full `out_envelope`
- [ ] `POST /api/export/generate { resultId }` queues demo job
- [ ] `GET /api/export/status/:jobId` returns demo-specific progress details
- [ ] PDF generation respects theme, includes images, multi-page layout
- [ ] `GET /api/export/download/:jobId` returns styled PDF
- [ ] Demo jobs processed concurrently with independent lifecycle
- [ ] Progress updates distinguish demo processing stages
- [ ] Images embedded in PDF (not external links)
- [ ] Table of contents generated for >3 page demos
- [ ] End-to-end workflow tested: generate → export → download

---

**Document Version**: 1.0 (Initial Brainstorm)  
**Last Updated**: November 13, 2025  
**Status**: Design Phase - Ready for Implementation Planning
