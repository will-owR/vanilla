# ebookService - Core Business Logic Service

**Date**: November 23, 2025  (Sunday)

**Purpose**: Generate structured ebook content data from user prompts via sequential AI conversations.

**Scope**: `ebookService` is a **core business logic service** that implements the intelligent content generation for ebooks. It receives a prompt and metadata, orchestrates sequential AI conversations to generate structured chapter data, and returns it for composition by `genieService`.

---

## Design Philosophy

`ebookService` follows the **separated concerns** pattern:

### ebookService Responsibility (Content Generation Logic)

- **Input**: User prompt + metadata (theme, pageCount, colorPalette, fontSizeScale)
- **Process**: Sequential multi-turn AI conversations for greater control
- **Output**: Structured data with chapters, content, and image concepts (NO images or HTML)
- **Business Logic**: Content structure, chapter breakdown, image concept identification
- **Communication**: Only with AI (via geminiClient)

### genieService Responsibility (Composition & Asset Management)

- Takes structured data from ebookService
- Resolves image concepts → SVG library → Gemini (cache-first + fallback)
- Composes final ebook: cover, copyright, TOC, content pages, epilogue
- Manages all asset embedding and HTML generation
- Returns production-ready ebook

---

## Data Structures

### ebookService Input Contract

```javascript
// From genieService.process() when mode === "ebook"
{
  prompt: string,              // User's input text
  metadata: {
    theme: string,             // "dark" | "light" | "corporate" | "bold"
    pageCount: number,         // 3-20 pages of content
    colorPalette: string,      // "standard" | "vibrant" | "muted" | "grayscale"
    fontSizeScale: number,     // 0.8-1.2
  },
  classification?: object      // Optional classification from genieService
}
```

### ebookService Output Contract

```javascript
// Returned to genieService for composition
{
  title: string,               // Extracted from prompt
  chapters: [
    {
      id: string,              // "ch_1", "ch_2", etc.
      chapter: number,         // 1, 2, 3, ...
      title: string,           // Chapter title
      content: string,         // AI-generated (treated as "edited" by ebookService)
      image: {
        concept: string,       // "serene forest clearing at dawn"
        style: string,         // Theme-based default + AI flexibility
        tone: string,          // "peaceful" | "energetic" | "mysterious"
        palette_hint: string,  // "warm-earth" | "cool-blue" | etc.
        size_hint: string      // "full-width" | "half-width" | "inline"
      }
    }
    // ... more chapters
  ],
  metadata: {
    model: "ebook-v1",
    pages_count: number,
    source: "ebook",
    theme: string,
    colorPalette: string,
    fontSizeScale: number,
    density: string,           // "light" | "medium" | "dense"
    classification?: object,
  },
  actions: {
    persist_prompt: true,
    generate_pdf: true,
    can_export: true,
    can_preview: true,
    can_override: true,
  },
}
```

---

## Sequential AI Conversation Pipeline

ebookService uses **sequential conversations** for maximum control over content quality and structure.

### Conversation 1: Determine Structure

**Purpose**: Get chapter outline and structure

```javascript
const structurePrompt = `
Create a detailed structure for a ${pageCount}-page eBook based on:
"${userPrompt}"

The eBook will be for: ${audience || "general"}
Style/Genre: ${genre || "creative"}

Return as JSON:
{
  title: string (compelling title for the ebook),
  chapters: number (number of chapters, 3-10),
  outline: [
    { 
      chapter: number,
      title: string (compelling chapter title),
      estimated_topics: [string, ...] (3-5 key topics)
    },
    ...
  ]
}

Requirements:
- Structure should flow logically
- Chapter titles should be compelling
- Total content should fill ${pageCount} pages
`;

// AI returns structured outline
```

**ebookService Action**: Parse and validate structure

```javascript
const structure = await geminiClient.generateStructure(structurePrompt);

if (!structure.chapters || structure.chapters.length < 2) {
  throw new Error("ebookService: AI failed to provide valid chapter structure");
}

return structure; // Use for next conversation
```

---

### Conversation 2: Generate Content + Image Concepts (Per Chapter)

**Purpose**: For EACH chapter, request content AND image concept (sequential)

```javascript
for (let i = 0; i < structure.outline.length; i++) {
  const chapter = structure.outline[i];

  const contentPrompt = `
You are writing Chapter ${chapter.chapter}: "${chapter.title}"

Context:
- Total eBook: ${pageCount} pages
- This chapter #${chapter.chapter} of ${structure.outline.length}
- Key topics: ${chapter.estimated_topics.join(", ")}
- Audience: ${audience}
- Tone/Style: ${tone}
${i > 0 ? `- Previous chapter ended with: "${chapters[i - 1].summary}"` : ""}

Write the chapter content (600-800 words) that:
1. Expands on the key topics
2. Builds on any previous chapter
3. Sets up the next chapter (if applicable)

ALSO provide an image concept that would visually illustrate this chapter.

Return as JSON:
{
  chapter: ${chapter.chapter},
  title: "${chapter.title}",
  content: string (600-800 word chapter content),
  summary: string (1-sentence summary for context),
  image: {
    concept: string (vivid, descriptive visual concept),
    suggested_style: string (whimsical|gothic|minimalist|modern|elegant|playful|serious),
    tone: string (peaceful|energetic|mysterious|playful|serious|adventurous|calm)
  }
}
`;

  const chapterData = await geminiClient.generateChapter(contentPrompt);

  // Store chapter
  chapters.push({
    id: `ch_${i + 1}`,
    chapter: chapterData.chapter,
    title: chapterData.title,
    content: chapterData.content, // ← Treated as "edited" - passed through as-is
    image: {
      concept: chapterData.image.concept,
      style: determineImageStyle(
        metadata.theme, // Primary: theme default
        chapterData.image.suggested_style // Secondary: AI suggestion
      ),
      tone: chapterData.image.tone,
      palette_hint: metadata.colorPalette,
      size_hint: "full-width",
    },
  });
}
```

---

## Image Style Determination

Image style is determined by **hierarchy**:

### Strategy: Theme-Based + AI-Guided

```javascript
function determineImageStyle(userTheme, aiSuggestedStyle) {
  // PRIORITY 1: User's theme setting (primary guidance)
  const themeDefaults = {
    dark: ["gothic", "moody", "dramatic"],
    light: ["bright", "airy", "clean", "whimsical"],
    corporate: ["professional", "minimal", "modern"],
    bold: ["vibrant", "high-contrast", "energetic"],
  };

  const defaultStyle = themeDefaults[userTheme][0];

  // PRIORITY 2: AI can suggest alternative for visual diversity
  if (aiSuggestedStyle && shouldUseAlternativeStyle(aiSuggestedStyle)) {
    return aiSuggestedStyle; // E.g., "playful" instead of "gothic"
  }

  // FALLBACK: Theme default
  return defaultStyle;
}

function shouldUseAlternativeStyle(suggestedStyle) {
  // AI suggestion is valid if it's in the allowed set and different from default
  const allowedStyles = [
    "whimsical",
    "gothic",
    "minimalist",
    "modern",
    "elegant",
    "playful",
    "serious",
    "mystical",
    "surreal",
    "retro",
  ];

  return allowedStyles.includes(suggestedStyle);
}
```

| Theme       | Default Image Style    | Flexibility                                        | Example                                       |
| ----------- | ---------------------- | -------------------------------------------------- | --------------------------------------------- |
| `dark`      | gothic, moody          | AI can suggest "mysterious" for a specific chapter | Chapter 2: "mysterious" instead of "gothic"   |
| `light`     | bright, airy, clean    | AI can suggest "whimsical" for a playful chapter   | Chapter 3: "whimsical" instead of "bright"    |
| `corporate` | professional, minimal  | AI can suggest "modern" for a trendy chapter       | Chapter 4: "modern" instead of "professional" |
| `bold`      | vibrant, high-contrast | AI can suggest "energetic" for a dynamic chapter   | Chapter 5: "energetic" instead of "vibrant"   |

---

## Content Validation Strategy

### Design: "Edited Content Pass-Through"

`ebookService` **accepts and passes through all content as-is**:

```javascript
// ebookService treats content as already "edited"
const content = chapterData.content; // ← No validation, no filtering

// Future: User editing will allow refinement before composition
// For now: Direct pass-through to maintain flow
```

**Rationale**:

- ✅ Keeps ebookService focused on structure, not content quality
- ✅ Allows AI full creative freedom
- 📋 User editing interface coming soon
- ✅ Reduces complexity in MVP

**Error Handling**:

- If AI fails to generate → throw error
- If JSON parsing fails → throw error
- If content is empty → throw error
- Otherwise → accept as valid

---

## Density Classification

Based on `pageCount`, classify content density:

```javascript
const density =
  pageCount <= 5
    ? "light"
    : pageCount <= 10
    ? "medium"
    : pageCount <= 15
    ? "dense"
    : "very-dense";
```

**Density affects composition**:

- Content depth per page
- Section/chapter breakdown
- Typography (line height, margins)
- Space allocation

---

## genieService Composition Pipeline

Once ebookService returns structured data, genieService composes the final ebook.

### Phase 1: Resolve Images

For each chapter's image concept:

```javascript
async resolveImage(imageConcept, imageStyle, colorPalette) {
  // IMAGE CACHE STRATEGY: SVG Library 50% of the time + Fallback

  // STEP 1: Query SVG library
  const cached = await svgLibrary.search(
    imageConcept,
    imageStyle,
    { palette_hint: colorPalette }
  );

  // 50% Hit Rate Strategy: Use cached SVG half the time
  const useCache = cached && Math.random() < 0.5;

  if (useCache) {
    await svgLibrary.incrementUsage(cached.id);
    return {
      id: cached.id,
      source: "svg_library",
      cost: "$0"
    };
  }

  // STEP 2: Generate via Gemini (50% or on cache miss)
  const generated = await geminiClient.generateImage({
    prompt: `Create a ${imageStyle} illustration: ${imageConcept}`,
    style: imageStyle,
    palette: colorPalette
  });

  // STEP 3: Cache for future use
  const svgId = await svgLibrary.store(generated.svg, {
    concept: imageConcept,
    style: imageStyle,
    palette_hint: colorPalette,
    sourceProvider: "gemini",
    createdAt: new Date()
  });

  return {
    id: svgId,
    source: "gemini_cached",
    cost: "$0.05"
  };
}
```

**Image Cache Strategy Explained**:

- ✅ Query SVG library first (fast, cost: $0)
- ✅ If hit: Use 50% of the time (for image diversity)
- ✅ If miss OR pass on hit: Request from Gemini + cache (cost: $0.05)
- ✅ All Gemini-generated images cached for future use
- **Result**: Cost optimization + visual variety

### Phase 2: Compose Final Ebook

```javascript
async composeEbook(structuredData, imageMap) {

  // 1. Cover Page (theme-aware)
  const coverHtml = generateCover(
    structuredData.title,
    imageMap.get("cover"),
    structuredData.metadata.theme,
    structuredData.metadata.colorPalette
  );

  // 2. Copyright Page
  const copyrightHtml = generateCopyright(
    structuredData.metadata.generation_date || new Date()
  );

  // 3. Table of Contents (with page numbers)
  const tocHtml = generateTOC(
    structuredData.chapters,
    structuredData.metadata.density
  );

  // 4. Content Pages (with resolved images)
  const contentHtml = structuredData.chapters.map(ch => {
    const imageId = imageMap.get(ch.id);
    return generateContentPage(
      ch.chapter,
      ch.title,
      ch.content,
      imageId,  // SVG library ID
      structuredData.metadata
    );
  }).join("\n<div class='page-break'></div>\n");

  // 5. Epilogue
  const epilogueHtml = generateEpilogue(
    structuredData.metadata.theme
  );

  // 6. Assemble final HTML
  const finalHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      ${generateHeadMatter(structuredData.metadata, structuredData.title)}
    </head>
    <body class="theme-${structuredData.metadata.theme}">
      ${coverHtml}
      ${copyrightHtml}
      ${tocHtml}
      ${contentHtml}
      ${epilogueHtml}
    </body>
    </html>
  `;

  return {
    html: finalHtml,
    metadata: structuredData.metadata,
    imageCount: imageMap.size,
    actions: structuredData.actions
  };
}
```

---

## Theme System

All components respect the **theme parameter**:

### Supported Themes

| Theme       | Background | Text    | Accent  | Use Case               |
| ----------- | ---------- | ------- | ------- | ---------------------- |
| `dark`      | #1a1a1a    | #ffffff | #00d4ff | Modern, professional   |
| `light`     | #ffffff    | #000000 | #0066cc | Classic, readable      |
| `corporate` | #f5f5f5    | #2c3e50 | #34495e | Business documents     |
| `bold`      | #000000    | #ffff00 | #ff6b35 | High contrast, vibrant |

### Font Scaling

`fontSizeScale` (0.8-1.2) adjusts base font size:

- **0.8**: Compact (more content, smaller text)
- **1.0**: Standard (default readability)
- **1.2**: Large (accessibility friendly, fewer words per page)

### Color Palettes

`colorPalette` parameter affects:

- Image generation color scheme
- Accent color selection
- Typography highlights

---

## Error Handling

ebookService throws descriptive errors:

```javascript
// Input validation
if (!payload.prompt || !payload.prompt.trim()) {
  throw new Error("ebookService: prompt is required and must be non-empty");
}

if (payload.metadata.pageCount < 3 || payload.metadata.pageCount > 20) {
  throw new Error("ebookService: pageCount must be between 3 and 20");
}

// AI conversation failures
try {
  const structure = await geminiClient.generateStructure(prompt);
} catch (err) {
  throw new Error(
    `ebookService: AI structure generation failed - ${err.message}`
  );
}

try {
  const chapter = await geminiClient.generateChapter(prompt);
} catch (err) {
  throw new Error(
    `ebookService: AI chapter generation failed - ${err.message}`
  );
}

// Validation of AI responses
if (!structure.outline || !Array.isArray(structure.outline)) {
  throw new Error(
    "ebookService: AI returned invalid structure (missing outline array)"
  );
}
```

genieService.process() catches these and returns proper HTTP 500 errors.

---

## Testing Strategy

### Unit Tests

- ✅ Input validation (prompt, pageCount, theme, etc.)
- ✅ Structure generation parsing
- ✅ Chapter content parsing
- ✅ Image concept extraction
- ✅ Image style determination (theme + AI)
- ✅ Density classification
- ✅ Error handling (invalid AI responses)

### Integration Tests

- ✅ Full sequential conversation flow
- ✅ Structure → content pipeline
- ✅ Output matches contract
- ✅ All chapters have required fields
- ✅ Image concepts are descriptive

### E2E Tests

- ✅ End-to-end generation (prompt → structured data)
- ✅ genieService composition
- ✅ Final HTML rendering in browser
- ✅ Theme switching
- ✅ Override functionality
- ✅ Export to PDF

---

## Example Usage

```javascript
// From genieService.process() when routing to "ebook" mode
const payload = {
  prompt:
    "A children's mystery tale about a blind mouse detective in Mouse-town",
  metadata: {
    theme: "light",
    pageCount: 8,
    colorPalette: "vibrant",
    fontSizeScale: 1.0,
  },
};

const result = await ebookService.handle(payload);

// result contains structured data:
// {
//   title: "A Children's Mystery Tale About a Blind Mouse Detective",
//   chapters: [
//     {
//       id: "ch_1",
//       chapter: 1,
//       title: "Mouse-town Secrets",
//       content: "In the heart of Mouse-town, nestled between...",
//       image: {
//         concept: "A curious blind mouse using her cane...",
//         style: "whimsical",
//         tone: "mysterious",
//         palette_hint: "vibrant",
//         size_hint: "full-width"
//       }
//     },
//     // ... more chapters
//   ],
//   metadata: { ... },
//   actions: { ... }
// }

// genieService then composes this into final ebook HTML
```

---

## Related Files

- **Frontend State**: `/client/src/stores/ebookStore.js`
- **Frontend API**: `/client/src/lib/ebookApi.js`
- **Backend Endpoint**: `/server/index.js` (POST /api/ebook/generate)
- **Orchestrator**: `/server/genieService.js` (routes to ebookService)
- **Composition**: `/server/genieService.compose()` (creates final ebook)
- **SVG Cache**: `/server/utils/svgLibrary.js` (image resolution)

---

## Version History

| Version | Date         | Changes                                                                                                                   |
| ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 2.0     | Nov 23, 2025 | Refined architecture: Sequential AI conversations, theme + AI image styling, content pass-through, 50% cache hit strategy |
| 1.0     | Nov 23, 2025 | Initial design specification                                                                                              |

---

**Last Updated**: November 23, 2025  
**Author**: Design Team  
**Status**: ✅ Design Complete - Ready for Implementation
