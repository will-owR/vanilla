# aiService Enrichment for demoService: Hybrid Approach

**Draft: Phase A-B Enhancement**

**Date**: November 15, 2025  
**Status**: 🔄 **DRAFT — BRAINSTORM CAPTURE**  
**Branch**: `aetherV0/anew-default-demo`  
**Scope**: Enrich demoService with prompt classification (medium, style, theme) using hybrid rule engine + LLM fallback

---

## **Problem Statement**

Currently, Phase A demoService is **medium-agnostic**: any prompt becomes a 5-page dark-themed document. We lack understanding of:

1. **Medium**: What the user is actually building (children's book, calendar, poster, etc.)
2. **Artistic Style**: How they want it to look (whimsical, minimalist, gothic, retro, etc.)
3. **Theme**: The mood/atmosphere/visual traits (playful colors, dark tones, magical, etc.)

**Goal**: Extract these three dimensions from prompts to inform PDF styling, layout hints, and image generation.

---

## **Recommended Approach: Hybrid (Option 3)**

### **Concept**

Two-tier system: **fast path** (rule engine) for most prompts + **smart fallback** (LLM) for uncertain cases.

```
Prompt Input
    ↓
[FAST PATH] Rule Engine Extraction (0-10ms)
    ├─ Keyword matching against predefined database
    ├─ Calculate confidence score (0-1)
    │
    ├─ If confidence > 0.8 → Return immediately ✅
    │
    └─ If confidence ≤ 0.8 → [SLOW PATH]
        ↓
        Call aiService.enrichPrompt() (~500ms)
        ├─ LLM extracts fine-grained details
        ├─ Validate against rule results
        └─ Return merged classification ✅
```

### **Why Hybrid?**

| Criteria        | Rule Engine          | LLM              | Hybrid                             |
| --------------- | -------------------- | ---------------- | ---------------------------------- |
| Speed           | ✅ Instant           | ❌ 500ms+        | ✅ Fast by default, smart fallback |
| Accuracy        | ⚠️ Pattern-based     | ✅ Context-aware | ✅ Best of both                    |
| Cost            | ✅ Free              | ❌ $$ per call   | ✅ Minimizes LLM calls             |
| Observability   | ✅ Transparent       | ⚠️ Black box     | ✅ Observable (tracks which path)  |
| Maintainability | ⚠️ Keyword DB needed | ✅ No setup      | ✅ Keyword DB grows over time      |

---

## **Component 1: Rule Engine (Fast Path)**

### **1.1 Keyword Database**

Organize keywords by category (medium, style, theme):

```javascript
const keywords = {
  mediums: {
    book: [
      "book",
      "novel",
      "storybook",
      "children's book",
      "illustrated book",
      "picture book",
    ],
    calendar: ["calendar", "monthly", "yearly", "date", "planner", "agenda"],
    poster: ["poster", "wall art", "print", "framed", "wall poster", "artwork"],
    "digital-planner": [
      "digital planner",
      "planner",
      "schedule",
      "organizer",
      "app",
      "e-planner",
    ],
    "illustrated-story": [
      "illustrated story",
      "story",
      "narrative",
      "tale",
      "fable",
    ],
    "wall-art": ["wall art", "canvas", "gallery", "art piece", "mural"],
    craft: ["craft", "DIY", "project", "activity", "template"],
    "art-concept": ["concept art", "concept", "artistic", "visual concept"],
    poetry: ["poetry", "poem", "verse", "poetic"],
    "greeting-card": [
      "greeting card",
      "card",
      "invitation",
      "thank you",
      "birthday card",
    ],
    journal: ["journal", "diary", "notebook", "log"],
    app: ["app", "application", "mobile", "software"],
    sticker: ["sticker", "stickers", "decal"],
    "ui-element": ["UI", "button", "icon", "interface", "component"],
  },

  styles: {
    whimsical: [
      "whimsical",
      "playful",
      "fun",
      "lighthearted",
      "quirky",
      "charming",
      "whimsy",
      "playfulness",
    ],
    minimalist: [
      "minimal",
      "simple",
      "clean",
      "sparse",
      "minimal design",
      "minimalism",
      "uncluttered",
    ],
    gothic: [
      "gothic",
      "dark",
      "mysterious",
      "eerie",
      "Victorian",
      "ornate",
      "gothic style",
    ],
    "folk-art": [
      "folk",
      "traditional",
      "cultural",
      "handmade",
      "earthy",
      "rustic",
      "folk art",
    ],
    surrealist: [
      "surreal",
      "surrealism",
      "dreamlike",
      "surrealist",
      "dreamscape",
      "fantastical",
    ],
    "retro-vintage": [
      "retro",
      "vintage",
      "nostalgic",
      "classic",
      "old-school",
      "70s",
      "80s",
      "90s",
      "nostalgia",
    ],
    "modern-flat": [
      "modern",
      "flat design",
      "flat",
      "contemporary",
      "bold",
      "geometric",
    ],
  },

  themes: {
    "exaggerated-characters": [
      "cartoon",
      "exaggerated",
      "oversize",
      "silly",
      "caricature",
      "animated",
    ],
    "playful-colors": [
      "bright",
      "colorful",
      "vibrant",
      "bold colors",
      "rainbow",
      "saturated",
    ],
    "magical-realism": [
      "magical",
      "fantasy",
      "dreamlike",
      "surreal",
      "enchanted",
      "mythical",
    ],
    "sparse-compositions": [
      "sparse",
      "minimal composition",
      "empty space",
      "breathing room",
      "negative space",
    ],
    "muted-palettes": [
      "muted",
      "subdued",
      "neutral",
      "earthy tones",
      "desaturated",
      "soft colors",
    ],
    "symbolic-storytelling": [
      "symbolic",
      "metaphor",
      "allegory",
      "meaning",
      "layers",
    ],
    "dark-tones": ["dark", "moody", "shadowy", "low-key", "dramatic lighting"],
    "ornate-details": [
      "ornate",
      "intricate",
      "detailed",
      "decorative",
      "embellished",
    ],
    "eerie-atmosphere": [
      "eerie",
      "spooky",
      "creepy",
      "unsettling",
      "mysterious",
      "ominous",
    ],
    "earthy-textures": [
      "earthy",
      "textured",
      "raw",
      "rustic",
      "organic",
      "natural materials",
    ],
    "cultural-motifs": [
      "cultural",
      "traditional motifs",
      "ethnic",
      "indigenous",
      "heritage",
    ],
    "handcrafted-feel": [
      "handcrafted",
      "handmade",
      "artisanal",
      "craft",
      "DIY feel",
    ],
    "dreamlike-juxtaposition": [
      "dreamlike",
      "surreal juxtaposition",
      "absurd",
      "unexpected combinations",
    ],
    "nostalgic-palettes": [
      "nostalgic",
      "retro colors",
      "vintage palette",
      "80s",
      "90s colors",
    ],
    "clean-lines": [
      "clean lines",
      "sharp",
      "geometric",
      "precise",
      "structured",
    ],
    "bold-colors": ["bold", "saturated", "vivid", "high contrast"],
    iconography: ["icon", "iconic", "symbol", "emblematic"],
  },
};
```

### **1.2 Extraction Function**

```javascript
function extractClassification(prompt) {
  const lower = prompt.toLowerCase();
  const tokens = lower.split(/\W+/).filter((t) => t.length > 2);

  const scores = {
    medium: {},
    style: {},
    theme: {},
  };

  // Score each keyword occurrence
  tokens.forEach((token) => {
    Object.entries(keywords.mediums).forEach(([category, keywordList]) => {
      keywordList.forEach((keyword) => {
        if (keyword.includes(token) || token.includes(keyword.split(" ")[0])) {
          scores.medium[category] = (scores.medium[category] || 0) + 1;
        }
      });
    });

    Object.entries(keywords.styles).forEach(([category, keywordList]) => {
      keywordList.forEach((keyword) => {
        if (keyword.includes(token) || token.includes(keyword.split(" ")[0])) {
          scores.style[category] = (scores.style[category] || 0) + 1;
        }
      });
    });

    Object.entries(keywords.themes).forEach(([category, keywordList]) => {
      keywordList.forEach((keyword) => {
        if (keyword.includes(token) || token.includes(keyword.split(" ")[0])) {
          scores.theme[category] = (scores.theme[category] || 0) + 1;
        }
      });
    });
  });

  // Extract top matches
  const topMedium = Object.entries(scores.medium).sort(
    ([, a], [, b]) => b - a
  )[0];
  const topStyle = Object.entries(scores.style).sort(
    ([, a], [, b]) => b - a
  )[0];
  const topThemes = Object.entries(scores.theme)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat);

  return {
    medium: topMedium?.[0] || null,
    style: topStyle?.[0] || null,
    themes: topThemes || [],
    confidence: calculateConfidence(scores),
    source: "rules",
  };
}

function calculateConfidence(scores) {
  const allScores = [
    ...Object.values(scores.medium),
    ...Object.values(scores.style),
    ...Object.values(scores.theme),
  ];

  if (allScores.length === 0) return 0.0;

  const maxScore = Math.max(...allScores);
  const avgScore = allScores.reduce((a, b) => a + b) / allScores.length;

  // Confidence: 0-1 based on signal strength
  return Math.min(1.0, (maxScore * avgScore) / 100);
}
```

### **1.3 Rule Engine (Decision Rules)**

Apply semantic rules to refine classification:

```javascript
const rules = [
  {
    condition: (tokens) =>
      (tokens.includes("children") || tokens.includes("kids")) &&
      tokens.some((t) =>
        ["playful", "fun", "bright"].some((x) => x.includes(t))
      ),
    result: { style: "whimsical", colorPalette: "vibrant", mood: "playful" },
  },
  {
    condition: (tokens) =>
      tokens.includes("gothic") ||
      (tokens.includes("dark") && tokens.includes("mysterious")),
    result: { style: "gothic", colorPalette: "dark", mood: "eerie" },
  },
  {
    condition: (tokens) =>
      tokens.includes("minimal") ||
      (tokens.includes("clean") && tokens.includes("simple")),
    result: { style: "minimalist", colorPalette: "muted", mood: "serene" },
  },
  {
    condition: (tokens) =>
      tokens.some((t) =>
        ["retro", "vintage", "nostalgic", "80s", "90s"].includes(t)
      ),
    result: {
      style: "retro-vintage",
      colorPalette: "nostalgic",
      mood: "nostalgic",
    },
  },
  {
    condition: (tokens) =>
      tokens.includes("folk") ||
      (tokens.includes("traditional") && tokens.includes("cultural")),
    result: { style: "folk-art", colorPalette: "earthy", mood: "warm" },
  },
  {
    condition: (tokens) =>
      tokens.includes("surreal") || tokens.includes("dreamlike"),
    result: { style: "surrealist", colorPalette: "vibrant", mood: "dreamlike" },
  },
  {
    condition: (tokens) =>
      (tokens.includes("modern") || tokens.includes("flat")) &&
      (tokens.includes("bold") || tokens.includes("geometric")),
    result: {
      style: "modern-flat",
      colorPalette: "vibrant",
      mood: "energetic",
    },
  },
];

function applyRules(extracted, tokens) {
  let result = { ...extracted };

  for (const rule of rules) {
    if (rule.condition(tokens)) {
      result = { ...result, ...rule.result };
      break; // First matching rule wins (or combine all matches)
    }
  }

  return result;
}
```

---

## **Component 2: Color Palette Mapping**

Based on theme classification, inject specific color palettes:

```javascript
const colorPalettes = {
  vibrant: {
    background: "#1a1a1a",
    text: "#FFFFFF",
    accent: "#FF6B9D",
    secondary: "#00D9FF",
    colors: ["#FF6B9D", "#00D9FF", "#FBBF24", "#06B6D4"],
  },
  muted: {
    background: "#2B2520",
    text: "#E0D7CE",
    accent: "#A78D78",
    secondary: "#8B7D71",
    colors: ["#A78D78", "#8B7D71", "#D4C5B5", "#6B5D52"],
  },
  dark: {
    background: "#0F0F0F",
    text: "#FFFFFF",
    accent: "#8B0000",
    secondary: "#666666",
    colors: ["#8B0000", "#333333", "#CCCCCC", "#1A1A1A"],
  },
  earthy: {
    background: "#1F1810",
    text: "#FFFEF0",
    accent: "#D4A574",
    secondary: "#8B7355",
    colors: ["#D4A574", "#8B7355", "#6B4423", "#C9A876"],
  },
  nostalgic: {
    background: "#2A2A2A",
    text: "#F5E6D3",
    accent: "#E8B4A8",
    secondary: "#C9A876",
    colors: ["#E8B4A8", "#C9A876", "#F5E6D3", "#A67C6D"],
  },
};

function injectColorPalette(baseTheme, classification) {
  const paletteKey = classification.theme?.colorPalette || "vibrant";
  const palette = colorPalettes[paletteKey] || colorPalettes.vibrant;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      ...palette,
    },
  };
}
```

---

## **Component 3: LLM Fallback (Slow Path)**

When rule engine confidence ≤ 0.8, call aiService:

```javascript
async function enrichPromptWithLLM(prompt) {
  const llmPrompt = `
You are an artistic director analyzing creative briefs.

Given this prompt:
"${prompt}"

Extract and classify (respond ONLY with valid JSON, no other text):

{
  "medium": {
    "category": "book|calendar|poster|digital-planner|illustrated-story|wall-art|craft|art-concept|poetry|greeting-card|journal|app|sticker|ui-element|other",
    "description": "one sentence"
  },
  "style": {
    "category": "whimsical|minimalist|gothic|folk-art|surrealist|retro-vintage|modern-flat|other",
    "description": "one sentence"
  },
  "theme": {
    "categories": ["list", "of", "2-3", "traits"],
    "colorPalette": "vibrant|muted|dark|earthy|pastel|nostalgic",
    "mood": "one word describing feeling"
  },
  "confidence": 0.0-1.0
}
  `;

  try {
    const result = await aiService.classify(llmPrompt);
    return JSON.parse(result);
  } catch (error) {
    console.warn("LLM enrichment failed, falling back to rules:", error);
    return null;
  }
}
```

---

## **Component 4: Integration with demoService**

### **4.1 Enhanced demoService.handle()**

```javascript
async handle(prompt, userMetadata = {}) {

  // STEP 1: Extract classification (fast path)
  let classification = this.extractClassification(prompt);

  // STEP 2: Apply rules refinement
  const tokens = prompt.toLowerCase().split(/\W+/);
  classification = applyRules(classification, tokens);

  // STEP 3: Confidence check → LLM fallback if needed
  if (classification.confidence < 0.8) {
    const llmResult = await enrichPromptWithLLM(prompt);
    if (llmResult) {
      classification = {
        ...classification,
        ...llmResult,
        sources: {
          rules: { confidence: classification.confidence },
          ai: llmResult,
          merged: true
        }
      };
    }
  }

  // STEP 4: Generate 5-page structure (existing logic)
  const pages = this.generatePages(prompt);

  // STEP 5: Apply style hints to blocks
  pages.forEach((page) => {
    page.blocks.forEach(block => {
      if (block.type === "callout") {
        block.style = this.selectCalloutStyle(
          classification.style,
          classification.theme
        );
      }
      if (block.type === "image") {
        block.caption = this.enhanceCaption(
          block.caption,
          classification.medium
        );
      }
    });
  });

  // STEP 6: Merge with user metadata
  const enrichedMetadata = {
    ...this.defaultMetadata(),
    ...userMetadata,
    classification,
    source: classification.sources?.merged ? "hybrid" : "rules"
  };

  // STEP 7: Persist with enriched metadata
  return {
    pages,
    metadata: enrichedMetadata,
    actions: this.defaultActions()
  };
}
```

### **4.2 Response Structure**

```typescript
interface EnrichedOutEnvelope {
  pages: DemoPage[];
  metadata: {
    model: "demo-1";
    pages_count: 5;
    theme: "dark";
    classification: {
      medium: string;
      style: string;
      themes: string[];
      colorPalette: string;
      mood: string;
      confidence: number;
      source: "rules" | "ai" | "hybrid";
      sources?: {
        rules: { confidence: number };
        ai: any;
        merged: true;
      };
    };
    generatedAt: string;
  };
  actions: DemoActions;
}
```

---

## **Component 5: Styling Variations by Classification**

### **5.1 Callout Styles**

```javascript
const calloutStylesByStyle = {
  whimsical: {
    backgroundColor: "#FFE5F0",
    borderLeft: "4px solid #FF6B9D",
    icon: "✨",
    padding: "1.25em",
  },
  minimalist: {
    backgroundColor: "#F5F5F5",
    borderLeft: "2px solid #CCCCCC",
    icon: "→",
    padding: "1em",
  },
  gothic: {
    backgroundColor: "#2A0A0A",
    borderLeft: "4px solid #8B0000",
    icon: "⚰️",
    padding: "1.25em",
  },
  "folk-art": {
    backgroundColor: "#F5E6D3",
    borderLeft: "4px solid #D4A574",
    icon: "🌾",
    padding: "1.25em",
  },
  surrealist: {
    backgroundColor: "#3D2645",
    borderLeft: "4px solid #D58CFF",
    icon: "✨",
    padding: "1.25em",
  },
  "retro-vintage": {
    backgroundColor: "#2A2A2A",
    borderLeft: "4px solid #E8B4A8",
    icon: "🎞️",
    padding: "1em",
  },
  "modern-flat": {
    backgroundColor: "#E8F4F8",
    borderLeft: "0px solid transparent",
    borderTop: "3px solid #00D9FF",
    icon: "→",
    padding: "1em",
  },
};

function selectCalloutStyle(style, themes) {
  return calloutStylesByStyle[style] || calloutStylesByStyle.minimalist;
}
```

### **5.2 Image Caption Enhancements**

```javascript
const captionTemplates = {
  book: "Illustration: {concept}",
  calendar: "Featured {season/month}: {concept}",
  poster: "{concept}",
  "greeting-card": "{concept}",
  "illustrated-story": "Scene: {concept}",
  "wall-art": "{concept}",
  craft: "Activity: {concept}",
  "digital-planner": "Inspiration: {concept}",
  poetry: "Image for: {concept}",
  journal: "Prompt: {concept}",
  app: "Feature: {concept}",
  sticker: "Design: {concept}",
  "ui-element": "Component: {concept}",
  default: "Figure: {concept}",
};

function enhanceCaption(baseCaption, medium) {
  const template = captionTemplates[medium] || captionTemplates.default;
  return template.replace("{concept}", baseCaption);
}
```

---

## **Performance Characteristics**

| Path                | Time        | Calls   | Cost                | Coverage        |
| ------------------- | ----------- | ------- | ------------------- | --------------- |
| Rule Engine (fast)  | 0-10ms      | 0       | $0                  | ~80% of prompts |
| LLM Fallback (slow) | ~500ms      | 1       | ~$0.001             | Edge cases      |
| **Total (hybrid)**  | **0-510ms** | **0-1** | **~$0.0001/prompt** | **~100%**       |

---

## **Implementation Phases**

### **Phase A-1 (Week 1): Rule Engine Foundation**

- [ ] Build keyword database (100-200 core terms)
- [ ] Implement extraction function + scoring
- [ ] Create 15-20 decision rules
- [ ] Test with sample prompts (10 different variations)
- [ ] Measure accuracy vs. manual classification
- [ ] Deploy as fast-path-only (no LLM)

### **Phase A-2 (Week 2): LLM Integration**

- [ ] Integrate aiService.enrichPrompt() call
- [ ] Add confidence-based routing (>0.8 threshold)
- [ ] Test hybrid behavior on 20 sample prompts
- [ ] Monitor LLM fallback rate (target: <20%)
- [ ] Validate merged classification accuracy
- [ ] Deploy to production

### **Phase B (Future): Advanced Styling**

- [ ] Implement color palette injection
- [ ] Theme variant system (select styling by style/medium)
- [ ] Dynamic layout hints (adapt layout to medium)
- [ ] Image prompt engineering (style-aware image generation)
- [ ] User feedback loop (collect feedback, refine rules)

---

## **Risks & Mitigations**

| Risk                                              | Mitigation                                             |
| ------------------------------------------------- | ------------------------------------------------------ |
| Rule engine misclassifies common prompts          | Comprehensive keyword DB + A/B testing                 |
| LLM calls too expensive                           | Set confidence threshold high (>0.8) to minimize calls |
| LLM hallucinates (returns invalid JSON)           | Add try-catch + fallback to rule result                |
| Keyword database becomes stale                    | Quarterly review + user feedback loop                  |
| Classification affects user experience negatively | Classifications purely enhance styling, not content    |

---

## **Success Criteria**

- [ ] Rule engine achieves >80% accuracy on 50-sample test set
- [ ] LLM fallback triggered <20% of time
- [ ] Hybrid system <100ms 95th percentile latency
- [ ] Visual styling noticeably varies by medium/style/theme
- [ ] User can override auto-classification manually (Phase B feature)
- [ ] 0 regressions in existing Phase A tests

---

## **Next Steps**

1. **Validate Concept**: Review with stakeholders; confirm medium/style/theme taxonomy
2. **Build Keyword DB**: Crowdsource keywords from design team
3. **Create Sample Prompts**: 30-50 diverse test cases for accuracy measurement
4. **Implement Phase A-1**: Deploy rule engine, measure baseline accuracy
5. **Iterate**: Refine rules based on early results before LLM integration

---

**Document Version**: 0.1 (Draft)  
**Last Updated**: November 15, 2025  
**Status**: 🔄 **AWAITING FEEDBACK & VALIDATION**
