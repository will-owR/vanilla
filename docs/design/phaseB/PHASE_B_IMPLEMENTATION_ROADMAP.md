# Phase B: Implementation Roadmap & Timeline

**Date**: November 21, 2025  
**Status**: 🎯 **IMPLEMENTATION TIMELINE (3 WEEKS)**  
**Branch**: `aetherV0/anew-default-ebook`  
**Scope**: Week-by-week breakdown, file manifest, testing strategy, PR process
**Audience**: Project Managers

---

## **Timeline Overview**

| Week       | Focus                                 | Modules                                     | Test Count    | PR     |
| ---------- | ------------------------------------- | ------------------------------------------- | ------------- | ------ |
| **Week 1** | Core modules (chunker, theme, layout) | ContentChunker, ThemeEngine, PageLayout     | 15+15+12 = 42 | #PR-B1 |
| **Week 2** | Integration (TOC, images, override)   | TOCGenerator, ImageService, OverrideService | 8+15+10 = 33  | #PR-B2 |
| **Week 3** | Polish, perf, E2E, frontend           | Integration tests, performance tuning, UI   | 15+           | #PR-B3 |

**Total**: 70+ new tests  
**Timeline**: 3 weeks (Nov 24 - Dec 12, 2025)  
**Team Capacity**: 1 developer (primary)

---

## **WEEK 1: Core Modules (Nov 24-28)**

### **Objectives**

- ✅ Implement ContentChunker (NLP + topic extraction)
- ✅ Implement ThemeEngine (4 theme variants)
- ✅ Implement PageLayout (scaling + image distribution)
- ✅ 42+ tests (unit + integration within modules)
- ✅ No regressions (Phase A tests pass)

### **Detailed Breakdown**

#### **Day 1-2: ContentChunker (Nov 24-25)**

**Deliverables:**

- `server/utils/contentChunker.js` (150+ lines)
- `server/__tests__/contentChunker.test.js` (15+ tests)

**File Manifest:**

```
server/
  utils/
    contentChunker.js          [NEW]
  __tests__/
    contentChunker.test.js     [NEW]
```

**Implementation Checklist:**

- [ ] Install/validate compromise.js dependency
- [ ] Implement `analyze()` method (main entry point)
- [ ] Implement `_extractTopics()` (NLP via compromise.js)
- [ ] Implement `_classifyDensity()` (light/medium/dense logic)
- [ ] Implement `_distributeChapters()` (chapter distribution)
- [ ] Input validation (prompt type, pageCount range 3-20)
- [ ] Error handling (NLP failure, validation errors)
- [ ] Write unit tests (15 test cases from MODULE_SPECS)

**Code Structure:**

```javascript
// server/utils/contentChunker.js
class ContentChunker {
  async analyze(prompt, options = {}) {
    // Validate inputs
    if (!prompt || typeof prompt !== 'string') throw new Error("...");

    // Extract topics via compromise.js
    const topics = this._extractTopics(prompt);

    // Classify density
    const density = this._classifyDensity(prompt.split(' ').length, topics.length);

    // Distribute chapters
    const pageCount = options.targetPageCount || 8;
    const chapters = this._distributeChapters(topics, pageCount, density);

    return {
      chapters,
      structure: this._buildStructure(chapters),
      totalPages: pageCount,
      density,
      metadata: { wordCount: prompt.split(' ').length, ... }
    };
  }

  _extractTopics(text) {
    const doc = compromise(text);
    const topics = doc.topics().out('array');
    return [...new Set(topics)].slice(0, 8); // Max 8 topics
  }

  // ... other methods
}

export default new ContentChunker();
```

**Dependencies to Add:**

```bash
# Already in package.json (if not, add):
npm install compromise
```

**Test File Template:**

```javascript
// server/__tests__/contentChunker.test.js
import { describe, it, expect } from "vitest";
import ContentChunker from "../utils/contentChunker.js";

describe("ContentChunker", () => {
  it("CC-001: analyzes short prompt", async () => {
    const result = await ContentChunker.analyze("Short text.");
    expect(result.density).toBe("light");
  });

  it("CC-002: analyzes medium prompt", async () => {
    const result = await ContentChunker.analyze("Lorem ipsum... (1000 words)");
    expect(result.density).toBe("medium");
  });

  // ... 13 more tests
});
```

**PR Checklist (Day 2 end):**

- [ ] All 15 tests passing
- [ ] No Phase A test regressions
- [ ] Code review: linting clean (eslint)
- [ ] Commit message: "feat(chunker): implement NLP-based content chunking"

---

#### **Day 3-4: ThemeEngine (Nov 26-27)**

**Deliverables:**

- `server/utils/themeEngine.js` (200+ lines)
- `server/__tests__/themeEngine.test.js` (10+ tests)

**File Manifest:**

```
server/
  utils/
    themeEngine.js             [NEW]
  __tests__/
    themeEngine.test.js        [NEW]
```

**Implementation Checklist:**

- [ ] Define 4 theme objects (dark, light, corporate, bold)
- [ ] Implement `getTheme()` method
- [ ] Implement `listThemes()` method
- [ ] Implement `generateCSS()` method (full CSS string)
- [ ] Implement `validateAccessibility()` (WCAG AA contrast check)
- [ ] Implement `_buildTheme()` helper
- [ ] Write unit tests (10 test cases)

**Code Structure:**

```javascript
// server/utils/themeEngine.js
const THEMES = {
  dark: {
    name: 'dark',
    colors: { background: '#1a1a1a', text: '#e0e0e0', ... },
    fonts: { body: "'Georgia', serif", ... },
    spacing: { pageMargin: '1.5in', ... }
  },
  light: { ... },
  corporate: { ... },
  bold: { ... }
};

class ThemeEngine {
  getTheme(themeName) {
    if (!THEMES[themeName]) throw new Error(`Theme not found: ${themeName}`);
    return THEMES[themeName];
  }

  generateCSS(themeName) {
    const theme = this.getTheme(themeName);
    const cssVars = Object.entries(theme.colors)
      .map(([key, value]) => `--color-${key}: ${value}`)
      .join('; ');
    return `:root { ${cssVars} ... }`;
  }

  validateAccessibility(themeName) {
    const theme = this.getTheme(themeName);
    const ratio = calculateContrastRatio(theme.colors.text, theme.colors.background);
    return { valid: ratio > 4.5, contrastRatio: ratio };
  }
}

export default new ThemeEngine();
```

**Accessibility Helper (utility):**

```javascript
// server/utils/helpers.js (add function)
function calculateContrastRatio(color1, color2) {
  // Convert hex to RGB
  // Calculate relative luminance
  // Return WCAG contrast ratio
  // Target: > 4.5:1 (AA standard)
}
```

**Test File:**

```javascript
// server/__tests__/themeEngine.test.js
describe("ThemeEngine", () => {
  it("TE-001: getTheme returns dark theme", () => {
    const theme = ThemeEngine.getTheme("dark");
    expect(theme.name).toBe("dark");
    expect(theme.colors.background).toBeDefined();
  });

  it("TE-005: validates accessibility (dark)", () => {
    const result = ThemeEngine.validateAccessibility("dark");
    expect(result.valid).toBe(true);
    expect(result.contrastRatio).toBeGreaterThan(4.5);
  });

  // ... 8 more tests
});
```

**PR Checklist (Day 4 end):**

- [ ] All 10 tests passing
- [ ] All 4 themes validated for accessibility
- [ ] CSS generation produces valid CSS
- [ ] No Phase A regressions
- [ ] Commit: "feat(theme): implement 4-theme engine with accessibility"

---

#### **Day 5: PageLayout (Nov 28)**

**Deliverables:**

- `server/utils/pageLayout.js` (150+ lines)
- `server/__tests__/pageLayout.test.js` (12+ tests)

**File Manifest:**

```
server/
  utils/
    pageLayout.js              [NEW]
  __tests__/
    pageLayout.test.js         [NEW]
```

**Implementation Checklist:**

- [ ] Implement `generateLayout()` method (main entry)
- [ ] Implement `_calculateImagePlacement()` (1-3 images per page logic)
- [ ] Implement `_calculateScaling()` (margin/text/image scaling)
- [ ] Implement page type distribution (cover/TOC/chapter/content/conclusion)
- [ ] Handle all pageCount ranges (3-5, 6-10, 11-15, 16-20)
- [ ] Write unit tests (12 test cases)

**Code Structure:**

```javascript
// server/utils/pageLayout.js
class PageLayout {
  generateLayout(pageCount, contentDensity, classification) {
    if (pageCount < 3 || pageCount > 20) throw new Error("Invalid pageCount");

    const layouts = this._createPageLayouts(pageCount);
    const scaling = this._calculateScaling(pageCount, contentDensity);

    return { layouts, scaling };
  }

  _createPageLayouts(pageCount) {
    // Page 1: cover (hero image)
    // Page 2: TOC (no image)
    // Pages 3-N-1: chapter/content (1-2 images based on count)
    // Page N: conclusion (hero or solo)

    const layouts = [];
    layouts.push({
      pageNumber: 1,
      type: "cover",
      imageCount: 1,
      imageType: "hero",
    });
    layouts.push({
      pageNumber: 2,
      type: "toc",
      imageCount: 0,
      imageType: "none",
    });

    for (let i = 3; i < pageCount; i++) {
      const imageCount = this._calculateImageCount(i, pageCount, "medium");
      layouts.push({
        pageNumber: i,
        type: "chapter",
        imageCount,
        imageType: this._selectImageType(imageCount, i, pageCount),
      });
    }

    layouts.push({
      pageNumber: pageCount,
      type: "conclusion",
      imageCount: 1,
      imageType: "hero",
    });

    return layouts;
  }

  _calculateImageCount(pageIndex, totalPages, density) {
    if (totalPages <= 5) return 1;
    if (totalPages <= 10) return pageIndex % 2 === 0 ? 2 : 1;
    return 1; // Tighter spacing
  }

  _calculateScaling(pageCount, density) {
    let imageScale = 1.0;
    let textScale = 1.0;
    let marginScale = 1.0;

    if (pageCount >= 16) {
      imageScale = 0.8;
      marginScale = 0.75;
    } else if (pageCount >= 11) {
      imageScale = 0.9;
      marginScale = 0.85;
    }

    return { imageScale, textScale, marginScale };
  }
}

export default new PageLayout();
```

**Test File:**

```javascript
// server/__tests__/pageLayout.test.js
describe("PageLayout", () => {
  it("PL-001: generates sparse layout for 3 pages", () => {
    const result = PageLayout.generateLayout(3, "light");
    expect(result.layouts).toHaveLength(3);
    expect(result.layouts[0].type).toBe("cover");
  });

  it("PL-004: generates dense layout for 20 pages", () => {
    const result = PageLayout.generateLayout(20, "dense");
    expect(result.scaling.marginScale).toBeLessThan(1.0);
  });

  // ... 10 more tests
});
```

**PR Checklist (Day 5 end):**

- [ ] All 12 tests passing
- [ ] Layout distribution covers all pageCount ranges
- [ ] Scaling factors within expected ranges (0.75-1.0)
- [ ] No Phase A regressions
- [ ] Commit: "feat(layout): implement dynamic page layout + image placement"

---

### **Week 1 Completion Criteria**

- ✅ 42+ tests passing (contentChunker + themeEngine + pageLayout)
- ✅ 679/688 Phase A tests still passing (zero regressions)
- ✅ Code quality: No eslint errors
- ✅ All three PR comments resolved (code review)
- ✅ Branch: `aetherV0/anew-default-ebook` up-to-date with main

---

## **WEEK 2: Integration & Advanced Modules (Dec 1-5)**

### **Objectives**

- ✅ Implement TOCGenerator (hierarchical TOC + PDF anchors)
- ✅ Implement OverrideService (fast-path style changes)
- ✅ Wire SVG library integration (query + fallback)
- ✅ 33+ integration tests
- ✅ No regressions

### **Detailed Breakdown**

#### **Day 1-2: TOCGenerator (Dec 1-2)**

**File Manifest:**

```
server/
  utils/
    tocGenerator.js            [NEW]
  __tests__/
    tocGenerator.test.js       [NEW]
```

**Implementation:**

- Implement hierarchy building (level 1 → level 2)
- Generate PDF anchors (sanitize titles → kebab-case)
- Track page numbers from pageMap
- Write 8+ unit tests

**Code Structure:**

```javascript
// server/utils/tocGenerator.js
class TOCGenerator {
  generate(chapters, pageMap) {
    const entries = this._buildHierarchy(chapters, pageMap);
    const anchors = this._generateAnchors(chapters);
    return { entries, anchors };
  }

  _buildHierarchy(chapters, pageMap) {
    const result = [];
    let currentParent = null;

    for (const chapter of chapters) {
      const pageNumber = pageMap.get(chapter.id);
      const entry = {
        level: chapter.level,
        title: chapter.title,
        pageNumber,
        anchor: this._generateAnchor(chapter.title, chapter.id),
        children: [],
      };

      if (chapter.level === 1) {
        result.push(entry);
        currentParent = entry;
      } else if (chapter.level === 2 && currentParent) {
        currentParent.children.push(entry);
      }
    }

    return result;
  }

  _generateAnchor(title, id) {
    // "Summer's Golden Hour" → "ch1-summers-golden-hour"
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
}

export default new TOCGenerator();
```

**PR: "feat(toc): implement hierarchical TOC generation"**

---

#### **Day 3: OverrideService (Dec 3)**

**File Manifest:**

```
server/
  utils/
    overrideService.js         [NEW]
  __tests__/
    overrideService.test.js    [NEW]
```

**Implementation:**

- Implement `apply()` method (retrieve result, apply overrides, re-render)
- Validate override feasibility (allow theme/colors only)
- Inject CSS variables into HTML
- Write 10+ unit tests
- Mock database interaction

**Code Structure:**

```javascript
// server/utils/overrideService.js
class OverrideService {
  async apply(resultId, overrides) {
    // Validate overrides
    if (!this._canOverride(overrides)) {
      throw new Error("Override requires content regeneration");
    }

    // Retrieve result from DB
    const result = await db.result.findUnique({ where: { id: resultId } });
    if (!result) throw new Error("Result not found");

    // Build new HTML with CSS overrides
    const newHTML = this._buildOverrideHTML(result.html, overrides);

    // Re-render PDF
    const newPDF = await pdfGenerator.generateFromHTML(newHTML);

    // Store updated result
    await db.result.update({
      where: { id: resultId },
      data: {
        html: newHTML,
        pdf: newPDF,
        metadata: {
          ...result.metadata,
          appliedAt: new Date(),
          regenerated: false,
        },
      },
    });

    return { resultId, status: "completed", pdf: newPDF };
  }

  _canOverride(overrides) {
    const allowed = ["theme", "colorPalette", "fontSize"];
    const requested = Object.keys(overrides);
    return requested.every((key) => allowed.includes(key));
  }

  _buildOverrideHTML(originalHTML, overrides) {
    const themeConfig = ThemeEngine.getTheme(overrides.theme);
    const css = themeConfig.cssVariables;

    // Inject CSS into <head>
    return originalHTML.replace("</head>", `<style>${css}</style></head>`);
  }
}

export default new OverrideService();
```

**PR: "feat(override): implement fast-path style override service"**

---

#### **Day 4-5: Image Service & SVG Library Integration (Dec 4-5)**

**File Manifest:**

```
server/
  utils/
    imageService.js            [NEW]
  __tests__/
    imageService.test.js       [NEW]
```

**Implementation:**

- Query SVG library first (PostgreSQL JSONB)
- Fallback to Gemini API if miss
- Store new images in library
- Track usage statistics (for pruning)
- Write 15+ integration tests (SVG hits, misses, cache)

**Code Structure:**

```javascript
// server/utils/imageService.js
class ImageService {
  async getImage(topic, style, pageCount) {
    // STEP 1: Query SVG library
    const cached = await this._querySVGLibrary(topic, style);
    if (cached) {
      await this._incrementUsage(cached.id);
      return cached.svg;
    }

    // STEP 2: Fallback to Gemini
    const generated = await geminiClient.generateImage({
      prompt: `${topic} in ${style} style`,
      size: "512x512",
    });

    // STEP 3: Store in library
    const stored = await this._storeSVGLibrary(generated, { topic, style });
    return generated;
  }

  async _querySVGLibrary(topic, style) {
    // PostgreSQL query with JSONB
    return await db.$queryRaw`
      SELECT * FROM svg_library
      WHERE metadata->>'topic' = ${topic}
        AND metadata->>'style' = ${style}
      ORDER BY usage DESC
      LIMIT 1
    `;
  }

  async _storeSVGLibrary(svg, metadata) {
    // Store: 60%+ hit rate target → $24/mo (vs. $60 baseline)
    return await db.svgLibrary.create({
      data: {
        svg,
        metadata,
        usage: 1,
        createdAt: new Date(),
      },
    });
  }

  async _incrementUsage(id) {
    await db.svgLibrary.update({
      where: { id },
      data: { usage: { increment: 1 } },
    });
  }
}

export default new ImageService();
```

**PR: "feat(images): implement SVG library + Gemini fallback"**

---

### **Week 2 Completion Criteria**

- ✅ 33+ new tests passing (TOC + override + image service)
- ✅ TOC hierarchy validated in PDF
- ✅ Override service fast-path working (<2s re-render)
- ✅ SVG library integrated (60%+ hit rate projected)
- ✅ 679/688 Phase A tests still passing
- ✅ All 3 modules wired together

---

## **WEEK 3: Polish, Performance & Frontend (Dec 8-12)**

### **Objectives**

- ✅ E2E integration testing (all 5 modules together)
- ✅ Performance tuning (<10s E2E)
- ✅ Frontend components (ThemeSelector, PageCountSlider)
- ✅ Accessibility validation (all themes WCAG AA)
- ✅ Documentation + examples

### **Deliverables**

#### **Backend Integration Tests (15+)**

```javascript
// server/__tests__/ebookService.integration.test.js
describe('ebookService (E2E)', () => {
  it('INT-001: generates valid PDF (3 pages, dark)', async () => {
    const result = await ebookService.handle(
      'Summer poem collection',
      { medium: 'ebook', style: 'minimalist' },
      { pageCount: 3, theme: 'dark' }
    );

    expect(result.pdf).toBeDefined();
    expect(result.metadata.pages).toBe(3);
    expect(result.classification.theme).toContain('dark');
  });

  it('INT-003: override changes theme correctly', async () => {
    const initial = await ebookService.handle(...);
    const overridden = await overrideService.apply(initial.id, { theme: 'light' });

    expect(overridden.pdf).toBeDefined();
    expect(overridden.metadata.regenerated).toBe(false); // Fast path
  });

  // ... 13 more E2E tests
});
```

#### **Performance Tests**

```javascript
it('INT-009: E2E completes in <10s', async () => {
  const start = Date.now();
  const result = await ebookService.handle('Long prompt (1000 words)', ...);
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(10000); // 10 seconds
  expect(result.pdf).toBeDefined();
});
```

#### **Frontend Components**

**New Files:**

```
client/
  src/
    components/
      ThemeSelector.svelte       [NEW]
      PageCountSlider.svelte     [NEW]
      OverrideForm.svelte        [NEW]
      ThemePreview.svelte        [NEW]

    __tests__/
      ThemeSelector.test.js      [NEW]
      PageCountSlider.test.js    [NEW]
```

**Component: ThemeSelector**

```svelte
<!-- client/src/components/ThemeSelector.svelte -->
<script>
  export let themes = ['dark', 'light', 'corporate', 'bold'];
  export let selectedTheme = 'dark';
  export let onChange;
</script>

<div class="theme-selector">
  {#each themes as theme}
    <button
      class="theme-btn"
      class:active={selectedTheme === theme}
      on:click={() => onChange(theme)}
    >
      {theme.toUpperCase()}
    </button>
  {/each}
</div>

<style>
  .theme-selector { display: flex; gap: 1rem; }
  .theme-btn { padding: 0.5rem 1rem; border-radius: 4px; }
  .theme-btn.active { background: var(--color-accent); }
</style>
```

**Component: PageCountSlider**

```svelte
<!-- client/src/components/PageCountSlider.svelte -->
<script>
  export let pageCount = 8;
  export let minPages = 3;
  export let maxPages = 20;
  export let onChange;
</script>

<div class="slider">
  <label>Pages: <strong>{pageCount}</strong></label>
  <input
    type="range"
    min={minPages}
    max={maxPages}
    bind:value={pageCount}
    on:change={() => onChange(pageCount)}
  />
</div>

<style>
  .slider { display: flex; flex-direction: column; gap: 0.5rem; }
</style>
```

#### **Documentation**

**New Files:**

```
docs/
  PHASE_B_README.md             [NEW - theme guide + examples]
  PHASE_B_TESTING_RESULTS.md    [NEW - test report]
```

**PHASE_B_README.md Outline:**

```markdown
# Phase B: Intelligent eBook Service

## Overview

- 5-module architecture
- 4 theme variants
- 3-20 page scaling
- SVG library integration

## Theme Guide

- Dark Theme: Minimalist, elegant
- Light Theme: Clean, professional
- Corporate Theme: Business-ready
- Bold Theme: Eye-catching, vibrant

## Examples

- [Link to example 1: Summer poem, 8 pages, dark]
- [Link to example 2: Recipe collection, 20 pages, light]
- [Link to example 3: Tutorial, 15 pages, corporate]

## API Usage

- POST /api/generate (with theme, pageCount options)
- POST /api/override (apply style changes)

## Cost Analysis

- SVG library hit rate: 60%+
- Cost per eBook: $0.05-$0.10 (with caching)
- ROI: Payoff within first month
```

### **Week 3 Completion Criteria**

- ✅ 15+ E2E integration tests passing
- ✅ Performance: E2E <10s (verified)
- ✅ Frontend components wired (ThemeSelector, PageCountSlider, OverrideForm)
- ✅ 4 example eBooks generated + reviewed
- ✅ Zero regressions (all 679/688 Phase A tests pass)
- ✅ Documentation complete (README + examples)
- ✅ Code review complete (2+ team members)

---

## **File Manifest (Complete)**

### **New Files (Backend)**

```
server/utils/
  contentChunker.js                [150 lines]
  themeEngine.js                   [200 lines]
  pageLayout.js                    [150 lines]
  tocGenerator.js                  [120 lines]
  overrideService.js               [150 lines]
  imageService.js                  [180 lines]

server/__tests__/
  contentChunker.test.js           [250+ lines]
  themeEngine.test.js              [200+ lines]
  pageLayout.test.js               [280+ lines]
  tocGenerator.test.js             [150+ lines]
  overrideService.test.js          [200+ lines]
  imageService.test.js             [300+ lines]
  ebookService.integration.test.js [400+ lines]
```

### **Modified Files (Backend)**

```
server/ebookService.js             [100+ new lines - orchestration]
server/prisma/schema.prisma        [Updated - if needed for image tracking]
```

### **New Files (Frontend)**

```
client/src/components/
  ThemeSelector.svelte             [50 lines]
  PageCountSlider.svelte           [60 lines]
  OverrideForm.svelte              [80 lines]
  ThemePreview.svelte              [100 lines]

client/src/__tests__/
  ThemeSelector.test.js            [100+ lines]
  PageCountSlider.test.js          [100+ lines]
  OverrideForm.test.js             [120+ lines]
```

### **Documentation**

```
docs/design/phaseB/
  PHASE_B_ARCHITECTURE.md          [This file - 250+ lines]
  PHASE_B_MODULE_SPECS.md          [Previous - 600+ lines]
  PHASE_B_IMPLEMENTATION_ROADMAP.md [This file - 400+ lines]
  PHASE_B_README.md                [Week 3 - 200+ lines]
  PHASE_B_TESTING_RESULTS.md       [Week 3 - 150+ lines]
```

**Total New Code**: ~2500 lines (backend) + ~1500 lines (tests) + ~300 lines (frontend) + ~600 lines (docs)

---

## **Testing Strategy**

### **Test Pyramid**

```
                    ▲
                   /|\
                  / | \
                 /  |  \  E2E Integration Tests (15+)
                /   |   \
               -----+-----
              /     |     \
             /      |      \ Module Integration Tests (50+)
            /       |       \
           ---------------------
          /         |         \
         /          |          \ Unit Tests (70+)
        /           |           \
       /            |            \
      /             |             \
     /______________|______________\
               (Foundation)

Total: 135+ tests
Target: >85% code coverage
Performance: All tests <5 minutes
```

### **Test Categories**

| Category               | Count   | Tools                            |
| ---------------------- | ------- | -------------------------------- |
| Unit (module isolated) | 42      | vitest                           |
| Module integration     | 33      | vitest (mocked dependencies)     |
| E2E integration        | 15      | vitest (real services)           |
| Performance            | 5       | vitest + timer                   |
| Frontend               | 20      | vitest + @testing-library/svelte |
| **Total**              | **115** | **vitest**                       |

---

## **PR Strategy**

### **3 Major PRs**

#### **PR #PR-B1: Core Modules (Week 1)**

```
Title: Phase B Week 1: Core modules (chunker, theme, layout)
Description:
  - ContentChunker: NLP-based content extraction + topic analysis
  - ThemeEngine: 4-theme variants with accessibility validation
  - PageLayout: Dynamic scaling for 3-20 pages

  Tests: 42+ (all passing)
  Regressions: 0 (679/688 Phase A tests pass)

Files Changed: +1200 -0
- server/utils/contentChunker.js
- server/utils/themeEngine.js
- server/utils/pageLayout.js
- server/__tests__/contentChunker.test.js
- server/__tests__/themeEngine.test.js
- server/__tests__/pageLayout.test.js
```

#### **PR #PR-B2: Integration Modules (Week 2)**

```
Title: Phase B Week 2: Integration modules (TOC, override, images)
Description:
  - TOCGenerator: Hierarchical TOC with PDF anchors
  - OverrideService: Fast-path style override (no regeneration)
  - ImageService: SVG library query + Gemini fallback

  Tests: 33+ (all passing)
  Cost Savings: 60%+ SVG library hit rate → $24/mo

Files Changed: +1200 -0
```

#### **PR #PR-B3: Polish & Frontend (Week 3)**

```
Title: Phase B Week 3: E2E integration, performance, frontend
Description:
  - 15+ E2E integration tests
  - Performance tuning (<10s E2E confirmed)
  - Frontend components (ThemeSelector, PageCountSlider, etc.)
  - Documentation + examples

  Tests: 70+ total (115+ with frontend)
  Coverage: >85% of ebookService

Files Changed: +1500 -0
```

---

## **Success Metrics**

| Metric               | Target       | Success Criteria                   |
| -------------------- | ------------ | ---------------------------------- |
| Test Pass Rate       | 100%         | All 115+ tests passing             |
| Code Coverage        | >85%         | ebookService fully covered         |
| E2E Performance      | <10s         | Typical prompt: 1000 words → PDF   |
| SVG Library Hit Rate | 60%+         | Cost: $24/month (vs. $60 baseline) |
| Zero Regressions     | Yes          | All 679/688 Phase A tests pass     |
| Theme Accessibility  | WCAG AA      | All 4 themes validated             |
| PR Review            | 2+ approvals | 2 team members signed off          |
| Documentation        | Complete     | README + examples + specs          |

---

## **Risk Mitigation**

| Risk                           | Probability | Impact | Mitigation                                                |
| ------------------------------ | ----------- | ------ | --------------------------------------------------------- |
| Compromise.js NLP accuracy     | Medium      | Low    | Unit tests for common topics; fallback to prompt keywords |
| PDF rendering performance      | Low         | Medium | Puppeteer optimization (headless, connection pooling)     |
| Gemini API rate limits         | Low         | Medium | SVG library caching (60%+ hit rate); exponential backoff  |
| Theme accessibility fails WCAG | Low         | High   | Pre-validate all 4 themes; automated contrast checker     |
| E2E exceeds 10s                | Medium      | Medium | Performance profiling; optimize Gemini calls              |

---

## **Deployment Checklist**

### **Pre-Deployment (Week 3 Friday)**

- [ ] All 115+ tests passing on main branch
- [ ] Code review approved (2+ reviewers)
- [ ] Performance validated (<10s E2E)
- [ ] Accessibility validated (WCAG AA)
- [ ] Documentation complete
- [ ] Zero Phase A regressions confirmed
- [ ] SVG library tested with real data

### **Deployment (Dec 13)**

- [ ] Merge PR #PR-B3 to main
- [ ] Tag v0.2.0 (Phase B complete)
- [ ] Build Docker image
- [ ] Deploy to staging
- [ ] Smoke test (3 PDF generations)
- [ ] Deploy to production
- [ ] Monitor error rates (24h)

---

## **Cross-References**

- **Architecture Overview**: `PHASE_B_ARCHITECTURE.md`
- **Module Specifications**: `PHASE_B_MODULE_SPECS.md`
- **Full Project Status**: `AETHERPRESS_CURRENT_STATUS_AND_ROADMAP.md`

---

**Document Version**: 1.0  
**Last Updated**: November 21, 2025  
**Status**: 🎯 **READY FOR EXECUTION**
