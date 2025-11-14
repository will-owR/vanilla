# Phase A (Demo Mode) — Modularity Breakdown

**Date**: November 13, 2025  
**Purpose**: Define independent, parallelizable modules for Phase A implementation with clear dependencies, test requirements, and merge order.  
**Audience**: Development team coordinating parallel feature branches.

---

## **1. Module Overview**

Phase A consists of **5 independent modules** that can be developed in parallel with careful merge ordering.

| Module                           | Branch                           | Developer | Status  | Dependencies |
| -------------------------------- | -------------------------------- | --------- | ------- | ------------ |
| Content Generation (demoService) | `feature/demo-demoService`       | —         | Planned | None         |
| Theme Engine (Dark Theme)        | `feature/demo-themeEngine`       | —         | Planned | None         |
| Epilogue Generator               | `feature/demo-epilogueGenerator` | —         | Planned | None         |
| Image Generation                 | `feature/demo-imageGeneration`   | —         | Planned | None         |
| PDF Structure Builder            | `feature/demo-pdfStructure`      | —         | Planned | 1, 2, 3, 5   |

---

## **2. Module Dependencies Graph**

```
┌─────────────────────────────────────────────────────────────┐
│ INDEPENDENT MODULES (Can start immediately)                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  demoService (1)          themeEngine (2)                   │
│       ↓                         ↓                            │
│  [5-page generation]    [Dark theme styling]               │
│                                                              │
│  epilogueGenerator (3)    imageGeneration (5)               │
│       ↓                         ↓                            │
│  [Back matter]           [1 image per page]                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↑                        ↑
         └────────────┬───────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ DEPENDENT MODULE (Merge only after 1-3)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│        pdfStructureBuilder (4)                              │
│  [Combines all into 10-page PDF]                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## **3. Module 1: Content Generation (demoService)**

**Branch**: `feature/demo-demoService`  
**Files to Modify**: `server/demoService.js`  
**Estimated Time**: 3-4 hours

### **Responsibility**

Parse user prompt → generate 5-page structure with consistent blocks

### **Input**

```javascript
{
  prompt: "Create a presentation about AI futures",
  metadata: {
    pages: 5,
    theme: "dark",
    author: "CELS"
  }
}
```

### **Output**

```javascript
{
  pages: [
    { id: "p1", title: "...", blocks: [{type: "text", ...}, {type: "image", ...}, {type: "callout", ...}] },
    { id: "p2", title: "...", blocks: [...] },
    // ... p3, p4, p5
  ],
  metadata: { model: "demo-1", pages_count: 5, theme: "dark", ... },
  actions: { generate_pdf: true, generate_images: true, ... }
}
```

### **Algorithm**

```
1. Split prompt by sentences/paragraphs
2. Distribute evenly across 5 pages (p1-p5)
3. Generate page title from first sentence of section
4. Create 3 blocks per page:
   - TextBlock: main content
   - ImageBlock: placeholder with caption
   - CalloutBlock: key insight/summary
5. Return standardized out_envelope
```

### **Success Criteria**

- [ ] demoService.handle() returns valid 5-page structure
- [ ] Each page has id (p1-p5), title, and 3 blocks
- [ ] All blocks have proper types and content
- [ ] Metadata includes pages_count: 5, theme: "dark"
- [ ] Actions include generate_pdf, generate_images, generate_cover, generate_copyright, generate_epilogue

### **Unit Tests** (in `server/__tests__/demo-demoService.test.js`)

```javascript
test("generates 5 pages from prompt");
test("distributes content evenly across pages");
test("each page has id, title, blocks");
test("blocks have correct types: text, image, callout");
test("metadata includes pages_count: 5");
test("handles short prompts without crashing");
test("handles long prompts by truncating/distributing");
```

### **Acceptance Criteria**

- All tests pass: `npm --prefix server test -- demo-demoService`
- Output is valid per DEMO_MODE_REFERENCE_ARCHITECTURE.md Section 6 (DemoOutEnvelope)
- No dependencies on other Phase A modules

### **Notes**

- Keep algorithm simple (no AI/NLP)
- Focus on consistency, not intelligence
- Can merge independently

---

## **4. Module 2: Theme Engine (Dark Theme)**

**Branch**: `feature/demo-themeEngine`  
**Files to Create**: `server/utils/themeEngine.js`  
**Estimated Time**: 2-3 hours

### **Responsibility**

Define and export dark theme styling configuration

### **Input**

```javascript
const theme = themeEngine.getTheme("dark");
```

### **Output**

```javascript
{
  colors: { background: "#1a1a1a", text: "#ffffff", accent: "#007bff", ... },
  fonts: { header: "Helvetica", body: "Georgia", mono: "Courier New" },
  spacing: { pageMargin: "1in", sectionGap: "0.5in", lineHeight: 1.6 },
  styles: {
    coverPage: { /* CSS-like styling */ },
    copyrightPage: { /* ... */ },
    contentPage: { /* ... */ },
    epiloguePage: { /* ... */ },
    callout: { /* ... */ },
    quote: { /* ... */ }
  }
}
```

### **Structure**

```javascript
// server/utils/themeEngine.js

const themes = {
  dark: {
    colors: { ... },
    fonts: { ... },
    spacing: { ... },
    styles: { ... }
  }
};

function getTheme(name) {
  return themes[name] || themes.dark;
}

function applyTheme(component, themeName) {
  // Return styled component with theme applied
}

module.exports = { getTheme, applyTheme, themes };
```

### **Success Criteria**

- [ ] darkTheme object exports color palette (background, text, accent, border)
- [ ] Exports font definitions (header, body, monospace)
- [ ] Exports spacing rules (margins, padding, gaps)
- [ ] Includes component styles (coverPage, copyrightPage, contentPage, epiloguePage, callout, quote)
- [ ] All CSS properties valid and consistent
- [ ] No hardcoded colors outside theme object

### **Unit Tests** (in `server/__tests__/demo-themeEngine.test.js`)

```javascript
test("getTheme('dark') returns valid theme object");
test("theme has colors section with all required keys");
test("theme has fonts section with header, body, mono");
test("theme has spacing section");
test("theme has styles section with all components");
test("coverPage style includes background properties");
test("contentPage style includes text color properties");
test("callout style includes accent border properties");
```

### **Acceptance Criteria**

- All tests pass: `npm --prefix server test -- demo-themeEngine`
- Theme object matches DEMO_MODE_REFERENCE_ARCHITECTURE.md Section 6 (DemoMetadata)
- No dependencies on other Phase A modules

### **Notes**

- Focus on dark theme only (Phase A hardcoded)
- Colors should be accessible (WCAG AA minimum)
- Can merge independently

---

## **5. Module 3: Epilogue Generator**

**Branch**: `feature/demo-epilogueGenerator`  
**Files to Create**: `server/utils/epilogueGenerator.js`  
**Estimated Time**: 2-3 hours

### **Responsibility**

Generate standardized epilogue (back matter) structure

### **Input**

```javascript
{
  author: "CELS",
  contactEmail: "contact@cels.com",
  resources: [
    { title: "Research Papers", url: "..." },
    { title: "Online Community", url: "..." }
  ]
}
```

### **Output**

```javascript
{
  type: "epilogue",
  enabled: true,
  epilogueType: "all",  // Phase A: only "all"
  sections: {
    closing: {
      title: "Closing Remarks",
      content: "Thank you for exploring..."
    },
    bio: {
      title: "About the Author",
      content: "CELS is dedicated to...",
      email: "contact@cels.com"
    },
    resources: {
      title: "Further Resources",
      items: [
        { title: "Research Papers", url: "..." },
        { title: "Online Community", url: "..." }
      ]
    }
  }
}
```

### **Structure**

```javascript
// server/utils/epilogueGenerator.js

function generateEpilogue(metadata) {
  return {
    type: "epilogue",
    enabled: true,
    epilogueType: "all",
    sections: {
      closing: generateClosing(),
      bio: generateBio(metadata.author, metadata.contactEmail),
      resources: generateResources(metadata.resources),
    },
  };
}

function generateClosing() {
  /* ... */
}
function generateBio(author, email) {
  /* ... */
}
function generateResources(items) {
  /* ... */
}

module.exports = { generateEpilogue };
```

### **Success Criteria**

- [ ] generateEpilogue() returns valid epilogue object
- [ ] Epilogue includes closing, bio, resources sections
- [ ] Closing section has default or custom text
- [ ] Bio section includes author name and email
- [ ] Resources section formats items as array of {title, url}
- [ ] epilogueType is "all" for Phase A
- [ ] Metadata matches DEMO_MODE_REFERENCE_ARCHITECTURE.md Section 6

### **Unit Tests** (in `server/__tests__/demo-epilogueGenerator.test.js`)

```javascript
test("generateEpilogue() returns valid epilogue object");
test("epilogue has type: 'epilogue'");
test("epilogue has enabled: true");
test("epilogue has epilogueType: 'all'");
test("epilogue.sections includes closing, bio, resources");
test("closing section has title and content");
test("bio section includes author name and email");
test("resources section formats items correctly");
test("handles missing metadata gracefully with defaults");
```

### **Acceptance Criteria**

- All tests pass: `npm --prefix server test -- demo-epilogueGenerator`
- Output matches Epilogue interface from DEMO_MODE_REFERENCE_ARCHITECTURE.md
- No dependencies on other Phase A modules

### **Notes**

- Phase A: Single "all" template (no individual templates yet)
- Use sensible defaults for CELS author bio
- Can merge independently

---

## **6. Module 4: Image Generation**

**Branch**: `feature/demo-imageGeneration`  
**Files to Create/Enhance**: `server/utils/imageGenerator.js` (may already exist)  
**Estimated Time**: 3-4 hours

### **Responsibility**

Generate or provide placeholder images (1 per page)

### **Input**

```javascript
{
  pageContent: "Introduction to AI landscape...",
  pageNumber: 1,
  totalPages: 5,
  theme: "dark"
}
```

### **Output**

```javascript
{
  url: "file:///tmp/demo-img-{jobId}-1.png",
  caption: "AI adoption curve",
  altText: "Professional illustration of AI adoption trends"
}
```

### **Algorithm**

```
1. Extract key concept from page content (first noun/noun phrase)
2. Generate image prompt: "Professional illustration of [concept]"
3. Call image generation API (Dall-E / similar)
4. If success: return image URL + caption
5. If failure: return gray placeholder + caption
6. Store to tmp-exports/ with jobId-pageNum naming
```

### **Structure**

```javascript
// server/utils/imageGenerator.js

async function generateImageForPage(pageContent, pageNumber, jobId) {
  try {
    const concept = extractConcept(pageContent);
    const prompt = `Professional illustration of ${concept}`;
    const imageBuffer = await callImageAPI(prompt);
    const filename = `demo-img-${jobId}-${pageNumber}.png`;
    const filepath = await saveToDisk(filename, imageBuffer);
    return {
      url: filepath,
      caption: `Figure ${pageNumber}: ${concept}`,
      altText: `Illustration of ${concept}`,
    };
  } catch (error) {
    return createPlaceholder(pageNumber);
  }
}

function extractConcept(text) {
  /* ... */
}
async function callImageAPI(prompt) {
  /* ... */
}
async function saveToDisk(filename, buffer) {
  /* ... */
}
function createPlaceholder(pageNumber) {
  /* ... */
}

module.exports = { generateImageForPage };
```

### **Success Criteria**

- [ ] generateImageForPage() returns image object with url, caption, altText
- [ ] Extracts concept from page content (not just generic)
- [ ] Calls image generation API successfully
- [ ] Falls back to placeholder if API fails
- [ ] Stores images to tmp-exports/ with jobId-pageNum naming
- [ ] Returns valid file paths

### **Unit Tests** (in `server/__tests__/demo-imageGeneration.test.js`)

```javascript
test("extractConcept() extracts key term from text");
test("generateImageForPage() returns valid image object");
test("image object has url, caption, altText");
test("url points to valid file path");
test("caption includes figure number");
test("fallback creates placeholder when API fails");
test("placeholder has valid file path");
test("stores image to tmp-exports/ with correct naming");
```

### **Acceptance Criteria**

- All tests pass: `npm --prefix server test -- demo-imageGeneration`
- Mock API calls in tests (don't call real API during CI)
- Image generation can fallback gracefully
- No hard dependencies on other Phase A modules (soft: uses demoService output)

### **Notes**

- API key management: use environment variables
- Fallback important: never crash if image API down
- Phase A: 1 image per page only
- Can start immediately with mock data

---

## **7. Module 5: PDF Structure Builder**

**Branch**: `feature/demo-pdfStructure`  
**Files to Modify**: `server/utils/exportService.js`  
**Estimated Time**: 6-8 hours (most complex)

### **Responsibility**

Build complete 10-page PDF structure from all components

### **Input**

```javascript
{
  out_envelope: { pages: [...], metadata: {...}, actions: {...} },
  theme: "dark",
  includeTableOfContents: true
}
```

### **Output**

```javascript
PDF Buffer (10 pages total):
  [i]   Cover Page
  [ii]  Copyright Page
  [iii] Table of Contents
  [5-9] Content Pages (p1-p5 with images)
  [10]  Epilogue
```

### **Structure**

```javascript
// server/utils/exportService.js (enhanced)

async function generate(envelope, options = {}) {
  const { theme = "dark" } = options;

  const pages = [];

  // 1. Add cover page
  pages.push(await renderCoverPage(envelope, theme));

  // 2. Add copyright page
  pages.push(await renderCopyrightPage(envelope, theme));

  // 3. Add table of contents
  pages.push(await renderTableOfContents(envelope, theme));

  // 4. Add content pages (p1-p5)
  for (const page of envelope.pages) {
    pages.push(await renderContentPage(page, theme));
  }

  // 5. Add epilogue
  pages.push(await renderEpilogue(envelope.epilogue, theme));

  // 6. Apply page numbers & footers
  applyPageNumbers(pages);
  applyFooters(pages);

  // 7. Combine into PDF
  const buffer = await combineToPDF(pages);

  return { buffer, metadata: { pageCount: pages.length, ... } };
}

async function renderCoverPage(envelope, theme) { /* ... */ }
async function renderCopyrightPage(envelope, theme) { /* ... */ }
async function renderTableOfContents(envelope, theme) { /* ... */ }
async function renderContentPage(page, theme) { /* ... */ }
async function renderEpilogue(epilogue, theme) { /* ... */ }
function applyPageNumbers(pages) { /* ... */ }
function applyFooters(pages) { /* ... */ }
async function combineToPDF(pages) { /* ... */ }

module.exports = { generate };
```

### **Page Numbering**

```
Front Matter: Roman numerals
  Page 1 (Cover): i
  Page 2 (Copyright): ii
  Page 3 (TOC): iii

Content: Arabic numerals
  Page 4 (Content p1): 5
  Page 5 (Content p2): 6
  Page 6 (Content p3): 7
  Page 7 (Content p4): 8
  Page 8 (Content p5): 9

Back Matter: Arabic (continues)
  Page 9 (Epilogue): 10
```

### **Success Criteria**

- [ ] generate() produces valid PDF buffer
- [ ] PDF has 10 pages total
- [ ] Cover page includes title, author, background image
- [ ] Copyright page includes standard CELS text and "1st edition 2025"
- [ ] TOC auto-generated with chapter titles and page numbers
- [ ] Content pages render with dark theme styling
- [ ] Images embedded in each content page
- [ ] Epilogue renders with closing, bio, resources
- [ ] Page numbering correct (Roman for front matter, Arabic for content/back)
- [ ] Footers consistent across all pages
- [ ] PDF renders without errors

### **Integration Tests** (in `server/__tests__/demo-pdfStructure.test.js`)

```javascript
test("generate() produces valid PDF buffer");
test("PDF contains 10 pages");
test("Cover page rendered correctly");
test("Copyright page rendered correctly");
test("TOC generated with page numbers");
test("Content pages rendered with theme applied");
test("Images embedded in content pages");
test("Epilogue rendered correctly");
test("Page numbers correct (Roman + Arabic)");
test("Footers consistent across pages");
test("full workflow: envelope → PDF → file");
```

### **Acceptance Criteria**

- All tests pass: `npm --prefix server test -- demo-pdfStructure`
- **REQUIRES**: Modules 1, 2, 3 already merged
- PDF output validates against expected structure
- No errors when rendering with images or without

### **Notes**

- Most complex module (integrates all others)
- Start ONLY after Modules 1-3 merged
- Merge 5 (image) before or after doesn't matter for this module
- Heavy testing required
- Consider manual PDF validation (visual inspection)

---

## **8. Merge Strategy & Timeline**

### **Week 1: Parallel Development**

**Day 1-2: Module Setup**

- Create all 5 feature branches from `aetherV0/anew-default-demo`
- Each developer clones their branch locally
- Set up skeleton test files

**Day 3-5: Parallel Implementation**

```
Developer A: Module 1 (demoService)          — Branch: feature/demo-demoService
Developer B: Module 2 (themeEngine)          — Branch: feature/demo-themeEngine
Developer C: Module 3 (epilogueGenerator)    — Branch: feature/demo-epilogueGenerator
Developer D: Module 4 (imageGeneration)      — Branch: feature/demo-imageGeneration
Developer E: Waits for modules 1-3 to merge, then Module 5
```

### **Week 2: Merge Sequence**

**Day 1: Merge Modules 1-3**

```bash
# Merge in order:
1. feature/demo-demoService → aetherV0/anew-default-demo
2. feature/demo-themeEngine → aetherV0/anew-default-demo
3. feature/demo-epilogueGenerator → aetherV0/anew-default-demo
```

**Day 1-2: Merge Module 4 (can be parallel with above)**

```bash
4. feature/demo-imageGeneration → aetherV0/anew-default-demo
```

**Day 3: Merge Module 5 (requires 1-3, 5 optional)**

```bash
5. feature/demo-pdfStructure → aetherV0/anew-default-demo
```

**Day 4-5: Integration Testing**

- Full end-to-end: prompt → 10-page PDF
- Visual QA (inspect PDF output)
- Performance testing (<10s target)
- Backward compatibility (42 existing tests pass)

### **Merge Criteria (All Modules)**

Before merging each module:

- [ ] All unit tests pass locally
- [ ] No linting errors (`npm lint`)
- [ ] PR created with clear description
- [ ] Code reviewed by 1+ team member
- [ ] No conflicts with `aetherV0/anew-default-demo`
- [ ] Tests added to CI/CD pipeline
- [ ] Success criteria from above met

---

## **9. Testing Strategy by Module**

### **Unit Testing**

Each module must have standalone unit tests that don't depend on other Phase A modules:

- Module 1: `npm --prefix server test -- demo-demoService`
- Module 2: `npm --prefix server test -- demo-themeEngine`
- Module 3: `npm --prefix server test -- demo-epilogueGenerator`
- Module 4: `npm --prefix server test -- demo-imageGeneration`
- Module 5: `npm --prefix server test -- demo-pdfStructure`

### **Integration Testing**

After all modules merged:

- Full workflow test: `npm --prefix server test -- demo-full-workflow`
- End-to-end: prompt → PDF in <10s
- Visual inspection: PDF matches expected structure

### **Backward Compatibility**

After each merge:

- Run existing tests: `npm --prefix server test`
- Verify 42 tests still pass (from basic mode)
- No regression in export functionality

---

## **10. Branch Naming Convention**

All feature branches follow pattern:

```
feature/demo-{component}

Examples:
  feature/demo-demoService
  feature/demo-themeEngine
  feature/demo-epilogueGenerator
  feature/demo-imageGeneration
  feature/demo-pdfStructure
```

---

## **11. Dependency Checklist**

### **Before Module 1 Merge**

- [ ] Verify demoService tests pass
- [ ] Output structure matches Section 6 (DemoOutEnvelope)
- [ ] Can be called independently (no genieService integration yet)

### **Before Module 2 Merge**

- [ ] Theme object exports all required keys
- [ ] Colors are accessible (WCAG AA)
- [ ] No conflicts with existing exports

### **Before Module 3 Merge**

- [ ] Epilogue generator produces valid object
- [ ] Sections are correctly formatted
- [ ] No dependencies on other modules

### **Before Module 4 Merge**

- [ ] Image generation handles failures gracefully
- [ ] Placeholder images work as fallback
- [ ] API key configuration is documented

### **Before Module 5 Merge**

- [ ] **Modules 1, 2, 3 must be merged first**
- [ ] Module 4 preferred but not required (can use placeholder)
- [ ] All existing tests (42) still pass
- [ ] Integration tests written and passing

---

## **12. Continuity Plan**

If development pauses and resumes later:

**To Resume**:

1. Check which modules are merged to `aetherV0/anew-default-demo`
2. Resume from next un-merged module (see merge sequence)
3. Use this document to understand dependencies
4. Check tests for acceptance criteria

**If Branch Gets Stale**:

```bash
git fetch origin
git rebase origin/aetherV0/anew-default-demo
git push -f origin feature/demo-{component}
```

**If Conflict During Merge**:

- Refer to module test requirements
- Validate output structure matches spec
- Check DEMO_MODE_REFERENCE_ARCHITECTURE.md for correct format

---

## **13. Success Metrics**

### **Phase A Complete When**:

- [ ] All 5 modules merged to `aetherV0/anew-default-demo`
- [ ] All 5 module tests passing (suite: demo-\*)
- [ ] All 42 existing tests passing (basic mode backward compatibility)
- [ ] Full E2E test passing (prompt → 10-page PDF)
- [ ] PDF visual inspection passes QA
- [ ] Performance: <10s from prompt to PDF
- [ ] Zero blocking issues in implementation

---

**Document Version**: 1.0 (Initial Breakdown)  
**Last Updated**: November 13, 2025  
**Status**: ✅ **ALL MODULES IMPLEMENTED & MERGED**

---

## **Implementation Status**

✅ **All 5 modules have been implemented, tested, and merged.**

For detailed test results, performance metrics, and validation data, see:

- `docs/design/PHASE_A_VALIDATION_REPORT.md` — Comprehensive test results and metrics
- `docs/design/PHASE_A_VALIDATION_CHECKLIST.md` — Point-by-point validation checklist

```

```
