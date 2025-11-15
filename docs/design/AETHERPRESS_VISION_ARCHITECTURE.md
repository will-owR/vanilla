# AetherPress Vision Architecture

**Strategic Blueprint for Multi-Service Creative Generation**

**Date**: November 15, 2025  
**Status**: 🎯 **VISION DOCUMENT — STRATEGIC ALIGNMENT**  
**Branch**: `aetherV0/anew-default-demo`  
**Scope**: Complete system architecture from Phase A (demo eBook) through Phase D (multi-service platform)

---

## **1. Current State: Phase A (demoService)**

### **What Exists Now**

✅ **demoService**: Transforms any prompt → 5-page dark-themed eBook PDF

- Generic, medium-agnostic pipeline
- Hardcoded dark theme (single color palette)
- Fixed 5-page structure
- 1 image per page (basic placeholders or generated)
- Standardized epilogue template
- Roman numerals (front matter) + Arabic (content) numbering

✅ **Demo Goal** (per README):

- A4 eBook of public-domain summer poems
- One poem per page + decorative poem-describing background image

### **Current Gap**

❌ demoService is **blind to medium**—it treats all prompts identically

- Poetry prompt → same styling as tutorial
- Tutorial prompt → same styling as children's story
- No differentiation by medium, audience, or intent

---

## **2. The Larger Vision: Multi-Service Architecture**

### **Core Insight**

Phase A is **not the end goal**—it's the **proof of concept**. The true ambition is to create **concept-aware content generation** that expands a single prompt into **multiple media deliverables**, each optimized for its medium.

### **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                   USER INTERFACE                        │
│                                                         │
│  What do you want to create?                            │
│  [📖 eBook] [📅 Calendar] [🖼️ Wall Art] [📱 Other]    │
├─────────────────────────────────────────────────────────┤
│                  PROMPT ENRICHMENT                      │
│                                                         │
│  "Create summer poem eBook"                             │
│         ↓                                               │
│  Hybrid Classifier (Rule Engine + LLM)                  │
│         ↓                                               │
│  Classification: {                                      │
│    medium: "ebook",                                     │
│    style: "minimalist",                                 │
│    theme: "nostalgic",                                  │
│    audience: "adults",                                  │
│    genre: "poetry",                                     │
│    tone: "reflective",                                  │
│    confidence: 0.92                                     │
│  }                                                      │
├─────────────────────────────────────────────────────────┤
│              SERVICE ROUTING LAYER                      │
│                                                         │
│  genieService.route(medium, classification)             │
│         ↓                                               │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│              SERVICE EXECUTION LAYER                    │
│  (Each service pluggable, independent testing)         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✅ ebookService (Phase B)                              │
│  ├─ Multi-chapter intelligent chunking (NLP)           │
│  ├─ Multiple themes (dark/light/corporate/bold)        │
│  ├─ Variable page count (3-20 configurable)            │
│  ├─ 1-3 images per page (contextual placement)         │
│  └─ Hierarchical TOC (sections/subsections)            │
│                                                         │
│  🔄 calendarService (Phase C — NEXT PRIORITY)          │
│  ├─ Extract dates/themes from prompt                   │
│  ├─ Generate 12+ monthly spreads                       │
│  ├─ 1 contextual image per month                       │
│  ├─ Dates + mini calendar grid per page                │
│  └─ Export: PDF + printable formats                    │
│                                                         │
│  🔮 wallartService (Phase D)                            │
│  ├─ Extract visual concept & composition               │
│  ├─ Generate poster variants (1-3 compositions)        │
│  ├─ Multiple sizes (11x14, 16x20, 18x24)               │
│  ├─ Style-aware typography overlay                     │
│  └─ Export: PDF + PNG + SVG                            │
│                                                         │
│  🔮 storyService (Phase E)                              │
│  ├─ Illustrated narrative (1+ images per scene)        │
│  ├─ Title card + body pages + ending                   │
│  ├─ Character-aware styling                            │
│  └─ Export: PDF + web-viewable format                  │
│                                                         │
│  🔮 greetingCardService, journalService,               │
│      appService, stickers, et al. (Phase F+)           │
│                                                         │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│           SHARED RENDERING & EXPORT LAYER              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  • themeEngine (style injection, color palettes)        │
│  • SVG Image Library (query-first, fallback to AI)      │
│  • PDF Renderer (Puppeteer)                            │
│  • Export Manager (format selection, multi-file)        │
│                                                         │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│              USER OUTPUT & OPTIONS                      │
│                                                         │
│  ✅ eBook PDF (ready to download)                       │
│  ✅ Preview (live HTML, edit styles)                    │
│  ✅ Alternate Formats (EPUB, Mobi for ebooks)          │
│  ✅ Share/Publish Options                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## **3. Strategic Insight: Why This Architecture Matters**

### **Problem with Single-Service Approach**

- ❌ One service can't excel at eBooks AND calendars AND posters
- ❌ Styling/layout that works for eBooks breaks calendars
- ❌ Image strategy for poetry ≠ image strategy for calendars
- ❌ Hard to scale: each new medium requires massive rework

### **Solution: Pluggable Services**

- ✅ Each service owns its domain (ebook layout, calendar grid, poster composition)
- ✅ Shared classification layer informs all services
- ✅ Shared image library reduces AI costs
- ✅ Easy to add new services without touching core
- ✅ Independent testing & iteration

### **Real Value Proposition**

**Today**: "Turn any prompt into an eBook" (useful but limited)

**Tomorrow**:

```
User: "Summer reflection poems"
  ↓
"What would you like to create?"
  [📖 eBook with 8 pages]
  [📅 Calendar with monthly themes]
  [🖼️ 3 Poster designs]
  [📱 Sticker pack]
  ↓
User gets all 4 variants from same prompt
Each styled perfectly for its medium
All images sourced from SVG library (cheap!)
```

---

## **4. Recommended Strategy**

### **4.1 Classification Taxonomy: Extended Dimensions**

Current (Phase A):

```typescript
{
  medium: string;      // ebook | calendar | poster | ...
  style: string;       // minimalist | gothic | whimsical | ...
  theme: string[];     // [magical, sparse, etc.]
}
```

**Extended (Phase A-B onwards)**:

```typescript
interface PromptClassification {
  // CORE DIMENSIONS
  medium: "ebook" | "calendar" | "poster" | "stickers" |
          "greeting-card" | "journal" | "app-ui" | "wall-art" | "other";

  // VISUAL DIMENSIONS
  style: "minimalist" | "gothic" | "whimsical" | "folk-art" |
         "surrealist" | "retro-vintage" | "modern-flat" | "other";

  theme: string[];  // ["magical-realism", "playful-colors", etc.]

  // CONTENT DIMENSIONS
  audience: "children" | "teens" | "adults" | "educators" | "professionals" | "general";
  genre: "poetry" | "tutorial" | "narrative" | "reference" | "journal" |
         "creative-writing" | "educational" | "commercial" | "other";
  tone: "whimsical" | "serious" | "reflective" | "energetic" |
        "sarcastic" | "inspirational" | "academic" | "casual" | "other";

  // METADATA
  confidence: 0-1;
  source: "rules" | "ai" | "hybrid" | "user-override";

  // COLOR INTELLIGENCE
  colorPalette: "vibrant" | "muted" | "dark" | "earthy" | "pastel" | "nostalgic";

  // SERVICE-SPECIFIC HINTS
  hints: {
    ebook?: { preferredChapters?: number; multiImage?: boolean };
    calendar?: { holidays?: string[]; theme?: string };
    poster?: { aspectRatio?: "16:9" | "11:14" | "1:1" };
    [key: string]: any;
  }
}
```

**Why Extended?**

- Audience affects tone, layout, image selection
- Genre influences content chunking (poetry → stanzas, tutorial → steps)
- Tone informs color palette, callout styling, typography
- Hints allow services to optimize rendering

---

### **4.2 Service Priority: Calendar is NEXT**

**Why Calendar (Phase C) after eBook (Phase B)?**

1. **Domain Overlap**: Both need text + images + styling
2. **Complexity Scaling**: Calendar is mid-complexity (harder than demo, easier than intelligent ebook)
3. **Revenue Potential**: Calendars are evergreen product (12 months/year)
4. **Visual Distinctiveness**: Clear ≠ ebook, easy to validate
5. **Technical Stack Reuse**: Puppeteer, themeEngine, classification all transferable

**Phase B → C Progression**:

```
Phase B (eBook):
  ✅ Multi-theme support (preparation for services)
  ✅ Intelligent content chunking (NLP-based)
  ✅ Image library integration (foundation)

Phase C (Calendar):
  ✅ Apply multi-theme to calendar grid
  ✅ Apply image library (12 images/year)
  ✅ Prove service architecture is sound
  ✅ Measure ROI (user engagement, retention)
```

---

### **4.3 User Control: Frontend Media Selection + Manual Overrides**

#### **Medium Selection: Frontend Buttons (User Decision)**

**Flow**:

```
User enters prompt: "Summer poem collection"
    ↓
Frontend shows: "What would you like to create?"
    ├─ [📖 eBook] ← User clicks
    ├─ [📅 Calendar]
    ├─ [🖼️ Wall Art]
    └─ [More...]
    ↓
POST /prompt {
  prompt: "Summer poem collection",
  medium: "ebook"  ← USER CHOICE, not auto-detected
}
```

**Implementation**:

```javascript
// genieService.process()
async process(prompt, options = {}) {

  // ALWAYS use user's medium choice if provided
  const medium = options.medium || "ebook";  // Default fallback

  // Enrich with classification (for styling)
  const classification = await this.enrichPrompt(prompt);

  // Route to service
  const service = this.getService(medium);
  return await service.handle(prompt, classification);
}
```

**Frontend Implementation**:

```svelte
<!-- MediaSelector.svelte -->
<script>
  const media = [
    { id: "ebook", icon: "📖", label: "eBook" },
    { id: "calendar", icon: "📅", label: "Calendar" },
    { id: "poster", icon: "🖼️", label: "Wall Art" },
    { id: "stickers", icon: "✨", label: "Stickers" },
  ];

  let selectedMedium = "ebook";

  function handleSubmit() {
    // POST /prompt with selectedMedium
  }
</script>

<div class="media-selector">
  {#each media as item}
    <button
      class:active={selectedMedium === item.id}
      on:click={() => selectedMedium = item.id}
    >
      {item.icon} {item.label}
    </button>
  {/each}
</div>
```

#### **Style/Theme Override: Post-Generation UI**

**Flow**:

```
Generated eBook (minimalist style, muted palette)
    ↓
User views preview
    ↓
User clicks: "I want gothic whimsy instead"
    ↓
POST /override {
  resultId: "uuid",
  overrides: {
    style: "gothic",
    theme: ["dark-tones", "ornate-details"],
    colorPalette: "dark"
  }
}
    ↓
Re-render PDF with new styling (fast path)
```

**Why This Matters**:

- ✅ Spontaneity: Users can experiment with styles
- ✅ Ad-hoc factor: "What if it were retro instead?"
- ✅ No re-generation: Only styling changes (fast)
- ✅ User agency: Not locked into auto-detected style

---

### **4.4 AI Integration: Per README Architecture**

From application root README:

> **AI:** Default: Use Google's Gemini for both text and image generation. Leverage best-in-class third-party APIs for core GenAI (image generation, possibly LLM for assistant). Build custom logic for agent orchestration and workflow, not foundational models. Support use of GitHub Models for discovery and experimentation with AI models (for free).

**Implementation in AetherPress**:

```typescript
// aiService.ts
interface AIServiceConfig {
  provider: "gemini" | "github-models" | "custom";
  mode: "text" | "image" | "hybrid";
}

class AIService {
  // Text classification (enrichment)
  async enrichPrompt(prompt: string): Promise<Classification> {
    // Use Gemini for prompt classification (fast, cheap)
    return await this.geminiClient.classify(prompt);
  }

  // Image generation (cached-first strategy)
  async generateImage(concept: string, style: string): Promise<ImageResult> {
    // STEP 1: Query SVG library first
    const cached = await this.svgLibrary.search(concept, style);
    if (cached) {
      return cached; // Cost: $0 ✅
    }

    // STEP 2: Generate via Gemini
    const generated = await this.geminiClient.generateImage(concept, style);

    // STEP 3: Cache with prompt description
    await this.svgLibrary.store(generated, {
      concept,
      style,
      prompt: `${concept} in ${style} style`,
      sourceProvider: "gemini",
      createdAt: new Date(),
    });

    return generated; // Cost: $0.02-0.05 per image
  }

  // Fallback for GitHub Models (experimental)
  async experimentWithGitHubModels(task: string) {
    // For discovery and prototyping (free tier)
    return await this.githubModelsClient.execute(task);
  }
}
```

**Cost Optimization Strategy**:
| Operation | Cost | Frequency | Mitigation |
|-----------|------|-----------|-----------|
| Prompt classification (LLM) | ~$0.0001/call | 1 per prompt | Rule engine (fast path, free) |
| Image generation (Gemini) | ~$0.05/image | 5-12 per asset | SVG library (reuse, cache) |
| Service orchestration | Free | N/A | Custom agent (no LLM calls) |

---

### **4.5 Image Generation Strategy: SVG Library First, AI Fallback**

**Key Innovation: Searchable, Reusable SVG Library**

#### **Problem**: AI image generation is expensive

- 5 images per eBook × 100 eBooks/month = 500 API calls = $25/month
- 12 images per calendar × 50 calendars/month = 600 API calls = $30/month
- **Total**: ~$1000+/month for small-scale usage

#### **Solution: SVG Library with Semantic Search**

**Architecture**:

```
┌─────────────────────────────────────────────────────────┐
│           IMAGE GENERATION REQUEST                      │
│  "decorative background for summer poem"                │
├─────────────────────────────────────────────────────────┤
│                    QUERY SVG LIBRARY                    │
│                                                         │
│  Search index:                                          │
│    {"concept": "summer", "style": "whimsical", ...}    │
│                                                         │
│  Query: "summer + whimsical"                            │
│    ↓                                                    │
│  [✓ Match found] → Return cached SVG + metadata        │
│                    Cost: $0 ✅                          │
│                                                         │
│  [✗ No match] → Proceed to AI generation               │
├─────────────────────────────────────────────────────────┤
│                 AI GENERATION (Gemini)                  │
│                                                         │
│  Prompt: "Decorative summer background in whimsical    │
│           style: flowers, butterflies, warm colors"    │
│                                                         │
│  Generate: Image PNG/SVG                               │
│  Cost: $0.05 per image                                 │
├─────────────────────────────────────────────────────────┤
│               LIBRARY STORAGE & INDEXING                │
│                                                         │
│  Store:                                                 │
│  {                                                      │
│    id: "uuid-xxx",                                      │
│    svgData: "<svg>...</svg>",                           │
│    metadata: {                                          │
│      concept: "summer",                                 │
│      style: "whimsical",                                │
│      theme: ["playful-colors", "magical"],             │
│      audience: "general",                              │
│      sourcePrompt: "Decorative summer background...",  │
│      generatedPrompt: "summer flowers butterflies...", │
│      sourceProvider: "gemini",                          │
│      createdAt: "2025-11-15T10:30:00Z",                │
│      usageCount: 0,                                     │
│      tags: ["summer", "nature", "whimsical"]           │
│    }                                                    │
│  }                                                      │
│                                                         │
│  Index: Searchable by concept + style + theme          │
│                                                         │
│  Cost: $0 (stored in PostgreSQL JSONB)                 │
└─────────────────────────────────────────────────────────┘
```

#### **SVG Library Data Structure**

```typescript
interface SVGLibraryItem {
  id: string; // UUID

  // Visual asset
  svgData: string; // Full SVG markup
  pngUrl?: string; // Rasterized fallback

  // Searchable metadata
  metadata: {
    // Generation parameters
    concept: string; // "summer", "reflection", "nature"
    style: string; // "whimsical", "gothic", "minimalist"
    theme: string[]; // ["playful-colors", "magical-realism"]
    audience?: string; // "children", "adults", etc.

    // Prompts for replication
    sourcePrompt: string; // User's original request
    generatedPrompt: string; // AI-refined prompt sent to Gemini

    // Tracking
    sourceProvider: "gemini" | "github-models" | "manual" | "template";
    createdAt: Date;
    usageCount: number;
    tags: string[];

    // Licensing
    license: "cc0" | "proprietary" | "custom";

    // Performance
    fileSize: number; // bytes
    renderTime: number; // ms
  };

  // Audit trail
  createdBy?: string;
  modifiedAt?: Date;
  deletedAt?: null | Date;
}
```

#### **SVG Library API**

```typescript
class SVGLibrary {
  // Query library
  async search(
    concept: string,
    style: string,
    options?: {
      theme?: string;
      audience?: string;
      limit?: number;
    }
  ): Promise<SVGLibraryItem | null> {
    const query = `
      SELECT * FROM svg_library
      WHERE metadata->>'concept' ILIKE $1
        AND metadata->>'style' ILIKE $2
        AND deletedAt IS NULL
      ORDER BY usageCount DESC
      LIMIT 1
    `;

    return await db.query(query, [concept, style]);
  }

  // Store generated image
  async store(svgData: string, metadata: any): Promise<string> {
    const id = uuid();

    const query = `
      INSERT INTO svg_library (id, svg_data, metadata)
      VALUES ($1, $2, $3)
      RETURNING id
    `;

    await db.query(query, [id, svgData, JSON.stringify(metadata)]);
    return id;
  }

  // Semantic search (future: embeddings)
  async semanticSearch(query: string): Promise<SVGLibraryItem[]> {
    // Use vector embeddings (Phase B+) for fuzzy matching
    // "summer vibes" → matches "summer", "vacation", "warmth"
  }

  // Analytics: track reuse
  async incrementUsage(id: string): Promise<void> {
    await db.query(
      `UPDATE svg_library 
       SET metadata = jsonb_set(metadata, '{usageCount}', 
           to_jsonb((metadata->>'usageCount')::int + 1))
       WHERE id = $1`,
      [id]
    );
  }

  // Cleanup: remove unused items
  async pruneUnused(olderThan: Date, threshold: number = 0): Promise<number> {
    const query = `
      DELETE FROM svg_library
      WHERE createdAt < $1
        AND (metadata->>'usageCount')::int <= $2
    `;
    const result = await db.query(query, [olderThan, threshold]);
    return result.rowCount;
  }
}
```

#### **Service-Specific Image Strategies**

Each service tailors image prompting:

```typescript
// ebookService
async getImageForPage(concept: string, classification: Classification) {
  const imageConcept = `Illustration of ${concept}`;
  const style = `${classification.style} style for book`;

  return await imageService.generate(imageConcept, style);
}

// calendarService
async getImageForMonth(month: string, theme: string, classification: Classification) {
  const imageConcept = `${month} themed illustration with seasonal elements`;
  const style = `${classification.style} calendar illustration`;

  return await imageService.generate(imageConcept, style);
}

// wallartService
async getImageForPoster(concept: string, composition: string, classification: Classification) {
  const imageConcept = `${composition} composition poster artwork of ${concept}`;
  const style = `${classification.style} poster art, high-impact visual`;

  return await imageService.generate(imageConcept, style);
}
```

#### **Cost Projections**

**Monthly usage (100 eBooks + 50 Calendars + 20 Posters)**:

| Scenario                            | AI Calls       | SVG Hits     | Cost     |
| ----------------------------------- | -------------- | ------------ | -------- |
| No caching                          | 1,200 images   | 0            | ~$60     |
| **With SVG Library (60% hit rate)** | **480 images** | **720 hits** | **~$24** |
| **With SVG Library (80% hit rate)** | **240 images** | **960 hits** | **~$12** |

**ROI**: SVG library pays for itself within 1 month of operation.

---

## **5. Phased Implementation Path**

### **Phase A: Demo Mode ✅ COMPLETE**

**Deliverables**:

- ✅ demoService: 5-page dark eBook
- ✅ Hardcoded styling, basic image placeholders
- ✅ E2E validation report (71/71 tests passing)
- ✅ Production-ready for beta launch

**Timeline**: Complete (November 2025)  
**Status**: ✅ Launched

---

### **Phase A-B: Classification & Routing Layer** (NEXT 2 Weeks)

**Objective**: Build the intelligence layer that enables all future services

**Deliverables**:

- Classification enrichment (hybrid rule engine + LLM fallback)
- Extended taxonomy: medium → 7+ services
- genieService routing logic (medium → service selection)
- Enhanced out_envelope with classification metadata
- Frontend media selector (buttons for medium choice)
- SVG library schema (PostgreSQL JSONB)
- Zero regressions in Phase A tests

**Acceptance Criteria**:

- [ ] Rule engine achieves >80% accuracy on 50-prompt test set
- [ ] LLM fallback triggered <20% of time
- [ ] System latency <100ms (95th percentile)
- [ ] Classification metadata in all responses
- [ ] Frontend buttons wired to backend routing
- [ ] SVG library queryable and insertable
- [ ] All 179 existing tests pass

**Timeline**: 2 weeks  
**Resources**: 1 backend engineer, 1 frontend engineer

---

### **Phase B: Intelligent eBook Service** (3 Weeks, Dec 2025)

**Objective**: Transform demoService into production-grade ebookService

**Deliverables**:

- Multi-theme support (dark/light/corporate/bold)
- Intelligent content chunking via NLP (extract topics → chapters)
- Variable page counts (3-20 pages, user-configurable)
- 1-3 images per page with contextual placement
- Hierarchical TOC (sections/subsections)
- SVG library integration (image search-first strategy)
- Style/theme override UI (post-generation customization)
- Comprehensive test suite (>50 tests)

**Technical Deep Dives**:

- NLP tokenization & topic extraction (use compromise.js)
- Dynamic layout engine (adapt spacing by page count)
- Color palette injection (theme-aware styling)
- Hierarchical page structure (nesting support)

**Acceptance Criteria**:

- [ ] eBook with 3, 8, 15, 20 pages all render correctly
- [ ] TOC properly links to chapters (verified in PDF)
- [ ] Multiple themes visually distinct (dark vs. light vs. corporate)
- [ ] SVG library hit rate >60% on test prompts
- [ ] Style/theme override works without regenerating content
- [ ] E2E time: prompt → polished eBook <10 seconds
- [ ] All Phase A + A-B tests still pass

**Timeline**: 3 weeks  
**Resources**: 1 backend engineer (PDF/content focus), 0.5 NLP specialist

---

### **Phase C: Calendar Service** (2 Weeks, Jan 2026)

**Objective**: Prove service architecture with second major medium

**Deliverables**:

- calendarService: prompt → 12-month calendar PDF
- Date/theme extraction from prompt ("Summer 2026 family calendar")
- Monthly spread layout (mini calendar grid + 1-3 images)
- Configurable features (weekends highlighted, holidays marked)
- Export formats: PDF + printable PNG per month
- SVG library integration (month-specific images)
- Integration tests with ebookService (shared components)

**Technical Deep Dives**:

- Calendar grid generation (CSS/HTML templates)
- Date parsing & holiday detection
- Image placement for monthly spreads
- Multi-file export (12 PDFs or single bundled)

**Acceptance Criteria**:

- [ ] Calendar PDF has 12+ pages (one per month)
- [ ] Dates correctly positioned in grid
- [ ] 12 unique images (1 per month) sourced from SVG library
- [ ] Holidays (US national, user-specified) marked
- [ ] Export: single PDF or 12 individual PDFs
- [ ] E2E time: prompt → calendar <15 seconds
- [ ] All Phase A + A-B + B tests still pass

**Timeline**: 2 weeks  
**Resources**: 1 backend engineer (layout focus)

---

### **Phase D: Wall Art Service** (2 Weeks, Jan 2026)

**Objective**: Scale to visual-first medium (poster/wall art)

**Deliverables**:

- wallartService: prompt → 1-3 poster design variants
- Visual composition extraction (dominant image + text overlay)
- Multiple aspect ratios: 11"×14", 16"×20", 18"×24"
- Typography overlay (style-aware fonts & colors)
- Export: PDF + high-res PNG + SVG templates
- Print-ready optimization (CMYK color profile, bleed settings)

**Technical Deep Dives**:

- Canvas composition (dominant focal point calculation)
- Typography rendering (font sizing for print)
- Print-specific exports (bleed, crop marks, resolution)

**Acceptance Criteria**:

- [ ] 1-3 poster variants generated per prompt
- [ ] All aspect ratios render without distortion
- [ ] Typography readable at print sizes (300 DPI minimum)
- [ ] Export: PDF (print-ready) + PNG (web) + SVG (editable)
- [ ] Color profiles correct (CMYK for print, RGB for web)
- [ ] E2E time: prompt → posters <15 seconds

**Timeline**: 2 weeks  
**Resources**: 1 backend engineer (design/layout focus)

---

### **Phase E+: Additional Services** (Ongoing)

**Future Services** (priority order):

1. **Sticker Pack Service**: Extracted illustrations → 6-12 sticker designs
2. **Greeting Card Service**: Prompt → card front + back + envelope design
3. **Journal Service**: Prompt → structured journal (prompts, quotes, images)
4. **App UI Service**: Concept → mobile app mockup (screens, flows)
5. **Story Service**: Narrative → illustrated picture book

Each follows same pattern:

1. Extend classification taxonomy for medium-specific dimensions
2. Build service (handle + render)
3. Integrate with SVG library for image reuse
4. Add to frontend media selector
5. Launch with A/B testing

---

## **6. Technology Stack Alignment**

### **Backend** (per README)

| Component         | Technology                                       | Why                            | Status          |
| ----------------- | ------------------------------------------------ | ------------------------------ | --------------- |
| API Server        | Express/Node.js                                  | Lightweight orchestration      | ✅ In use       |
| PDF Rendering     | Puppeteer                                        | Production-grade HTML→PDF      | ✅ In use       |
| Database          | PostgreSQL + JSONB                               | Structured + flexible          | ✅ Configured   |
| AI Classification | Gemini API                                       | Fast, cost-effective           | ✅ Integrated   |
| AI Image Gen      | Gemini API (primary) + GitHub Models (discovery) | Per README guidance            | 🔄 To integrate |
| SVG Library       | PostgreSQL JSONB index                           | Semantic search + caching      | 🔄 To build     |
| Content Analysis  | compromise.js (NLP)                              | JavaScript-native tokenization | 🔄 To evaluate  |

### **Frontend** (per README)

| Component      | Technology        | Why                       | Status        |
| -------------- | ----------------- | ------------------------- | ------------- |
| UI Framework   | Svelte + Vite     | Fast, reactive components | ✅ In use     |
| State Mgmt     | Stores (built-in) | Lightweight, sufficient   | ✅ In use     |
| Media Selector | Custom component  | Simple button array       | 🔄 To build   |
| Live Preview   | PDF.js or iframe  | Real-time feedback        | 🔄 To enhance |
| Style Override | Dynamic form      | Theme/style selection     | 🔄 To build   |

---

## **7. Risk Mitigation & Contingencies**

| Risk                                       | Impact | Mitigation                                                                 |
| ------------------------------------------ | ------ | -------------------------------------------------------------------------- |
| LLM cost overruns (image generation)       | High   | SVG library caches 80%+ hits within 2 months                               |
| Service routing complexity                 | Medium | Start with 2 services (eBook + calendar); pattern proven = easier to scale |
| SVG library search performance             | Medium | Use PostgreSQL JSONB indexes + pagination; future: vector embeddings       |
| User confusion (too many media options)    | Low    | Progressive disclosure: start with eBook + calendar; add others gradually  |
| Cross-service regressions                  | High   | Comprehensive test suite; semantic versioning; CI/CD gates                 |
| UI complexity (media selector + overrides) | Medium | Iterative UX testing; start simple (radio buttons); evolve to cards        |

---

## **8. Success Metrics (Overall Vision)**

### **Phase A-B** (Short-term):

- [ ] Classification accuracy >80%
- [ ] SVG library hit rate >60%
- [ ] System latency <100ms
- [ ] Zero regressions in existing tests

### **Phase B** (Medium-term):

- [ ] eBook users report satisfaction >4.0/5.0
- [ ] Avg. generation time <10 seconds
- [ ] Support tickets <5% of user base
- [ ] Monthly active users >100

### **Phase C+** (Long-term):

- [ ] 3+ services launched (eBook, calendar, wall art)
- [ ] Revenue per user >$5 (multi-medium adoption)
- [ ] Churn rate <5%
- [ ] NPS score >50

---

## **9. Next Immediate Actions**

### **Week 1 of Phase A-B**

- [ ] **Design Review**: Validate classification taxonomy with design team
- [ ] **Keyword Database**: Crowdsource keywords for 100-200 core terms
- [ ] **Test Prompts**: Create 50 diverse prompts across all mediums
- [ ] **SVG Schema**: Design PostgreSQL schema for svg_library table
- [ ] **Frontend Sketch**: Wireframe media selector UI

### **Week 2 of Phase A-B**

- [ ] **Rule Engine**: Implement extraction + scoring
- [ ] **Decision Rules**: Build 20-30 semantic rules
- [ ] **LLM Integration**: Wire up Gemini enrichment + confidence routing
- [ ] **SVG Library**: Implement search + store functions
- [ ] **Frontend Build**: Code media selector component

### **Go-Live Phase A-B**

- [ ] Deploy to staging; run full test suite
- [ ] A/B test classification accuracy (manual vs. auto)
- [ ] Monitor LLM costs (target: <$0.0001/prompt)
- [ ] Gather user feedback on media selection UX
- [ ] Plan Phase B kickoff

---

## **10. Document Control**

| Version | Date       | Status     | Changes                                         |
| ------- | ---------- | ---------- | ----------------------------------------------- |
| 0.1     | 2025-11-15 | 🎯 CURRENT | Strategic vision + taxonomy + services + phases |

---

**Document Version**: 0.1 (Strategic Vision)  
**Last Updated**: November 15, 2025  
**Status**: 🎯 **VISION ALIGNMENT COMPLETE — READY FOR PHASE A-B KICKOFF**

---

## **Appendix A: Service Interface Template**

Every service (eBook, calendar, poster, etc.) implements this interface:

```typescript
interface ContentService {
  // Analyze prompt and extract service-specific metadata
  analyze(prompt: string): ServiceAnalysis;

  // Generate service-specific content structure
  handle(
    prompt: string,
    classification: PromptClassification,
    options?: ServiceOptions
  ): Promise<out_envelope>;

  // Render envelope to final format(s)
  render(
    envelope: out_envelope,
    options: RenderOptions
  ): Promise<RenderedOutput>;

  // Override styling without full regeneration
  override(
    envelope: out_envelope,
    overrides: Partial<PromptClassification>
  ): Promise<out_envelope>;
}

// Example: ebookService
class ebookService implements ContentService {
  analyze(prompt: string) {
    return {
      estimatedChapters: 5,
      contentDensity: "medium",
      imageCount: 8,
      readingTime: 15, // minutes
    };
  }

  async handle(prompt, classification, options = {}) {
    // Chunk content into chapters
    // Generate images for each chapter
    // Build hierarchical structure
    // Return out_envelope
  }

  async render(envelope, options = {}) {
    // Apply theme styling
    // Generate PDF via Puppeteer
    // Optional: also generate EPUB, Mobi
    // Return buffer(s)
  }

  async override(envelope, overrides) {
    // Update classification metadata
    // Re-apply styling
    // Re-render (fast path, no content regeneration)
    // Return updated envelope
  }
}
```

---

**END OF VISION ARCHITECTURE DOCUMENT**
