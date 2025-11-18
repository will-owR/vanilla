# Backend Modularity Architecture

"Here's exactly how to implement each module, the testing strategy, and the implementation sequence"

**Document Version**: 1.0  
**Date**: November 18, 2025  
**Status**: 🟢 **READY FOR IMPLEMENTATION**  
**Audience**: Backend developers, DevOps, integration testers  
**Scope**: Phase A-B module dependencies, data pipelines, orchestrator design, implementation sequence

---

## **Table of Contents**

1. [Executive Summary](#executive-summary)
2. [Module Overview](#module-overview)
3. [Dependency Graph](#dependency-graph)
4. [Data Transformation Pipeline](#data-transformation-pipeline)
5. [Module Specifications](#module-specifications)
6. [Orchestrator Architecture](#orchestrator-architecture)
7. [API Layer Integration](#api-layer-integration)
8. [Service Layer Integration](#service-layer-integration)
9. [Implementation Sequence](#implementation-sequence)
10. [Testing Strategy](#testing-strategy)

---

## **Executive Summary**

This document provides the **missing backend architecture details** that complement FRONTEND_BACKEND_INTEGRATION_SPEC.md.

### **Key Components**

- **6 Phase A-B Utility Modules** in `server/utils/`:
  - `ruleEngine.js` - Keyword tokenization and rule-based classification
  - `llmClassifier.js` - LLM-based classification (Gemini API)
  - `classificationValidator.js` - Merges rule + AI results intelligently
  - `svgLibrary.js` - Cached SVG search and retrieval
  - `overrideSystem.js` - Style overrides without full regeneration
  - `imageGenerator.js` - (existing) Image generation via LLM

- **3 Orchestrator Methods** in `server/genieService.js`:
  - `classifyPrompt(prompt)` - NEW: orchestrates classification pipeline
  - `process(prompt, mode, classification)` - ENHANCED: routes to services with classification
  - `override(generationId, overrides)` - NEW: applies style overrides

- **3 API Endpoints** in `server/index.js`:
  - `POST /api/classify` - NEW: classification only
  - `POST /api/generate` - NEW: generation with classification
  - `POST /api/override` - NEW: override application

### **Critical Dependencies**

```
[HTTP Request] 
  ↓
[Validation Layer] 
  ↓
[Orchestrator] ← classifyPrompt() + process() + override()
  ↓
[Utility Modules] ← ruleEngine → llmClassifier → classificationValidator
                 ← svgLibrary, overrideSystem, imageGenerator
  ↓
[Services] ← demoService, ebookService, sampleService
  ↓
[HTTP Response]
```

---

## **Module Overview**

### **Phase A-B Utility Modules** (Location: `server/utils/`)

| Module | Purpose | Status | LOC | Dependencies |
|---|---|---|---|---|
| `ruleEngine.js` | Keyword-based classification | ✅ Complete | 468 | None |
| `llmClassifier.js` | LLM-based classification | ✅ Complete | ~200 | Gemini API client |
| `classificationValidator.js` | Merge rule + AI results | ✅ Complete | ~150 | ruleEngine, llmClassifier |
| `svgLibrary.js` | Cache SVG search/retrieval | ✅ Complete | 335 | None |
| `overrideSystem.js` | Apply style overrides | ✅ Complete | ~200 | None |
| `imageGenerator.js` | LLM image generation | ✅ Complete | Variable | imageGenerator APIs |

### **Orchestrator** (Location: `server/genieService.js`)

| Method | Purpose | Status | Returns |
|---|---|---|---|
| `classifyPrompt(prompt)` | Classify without generating | ❌ NEW | Classification object |
| `process(prompt, mode, classification?)` | Route to service with classification | ❌ ENHANCE | Service result |
| `override(generationId, overrides)` | Apply overrides + regenerate | ❌ NEW | Updated PDF + cost |

### **API Endpoints** (Location: `server/index.js`)

| Endpoint | Purpose | Status | Calls |
|---|---|---|---|
| `POST /api/classify` | Classification pipeline | ❌ NEW | genieService.classifyPrompt() |
| `POST /api/generate` | Generation with classification | ❌ NEW | genieService.process() |
| `POST /api/override` | Override + regenerate | ❌ NEW | overrideSystem + service |

### **Services** (Location: `server/` - existing)

| Service | Purpose | Status | Integrates With |
|---|---|---|---|
| `demoService.js` | Demo mode generation | ✅ Exists | ruleEngine (for classification) |
| `ebookService.js` | eBook generation | ✅ Exists | ruleEngine, imageGenerator |
| `sampleService.js` | Sample generation | ✅ Exists | ruleEngine, imageGenerator |

---

## **Dependency Graph**

### **Utility Module Dependencies**

```
┌─────────────────────────────────────────────────────────┐
│ HTTP Request (POST /api/classify)                       │
└────────────────────┬────────────────────────────────────┘
                     ↓
         ┌───────────────────────┐
         │ Validation Layer      │
         │ (request schema)       │
         └───────────────┬───────┘
                         ↓
        ┌────────────────────────────────┐
        │ genieService.classifyPrompt()   │ ← Orchestrator
        └────────────┬───────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ RULE ENGINE PHASE              │
        │ (ruleEngine.js)                │
        │ • tokenize(prompt)             │
        │ • scoreRules(tokens)           │
        │ • extractSemanticRules(tokens) │
        └────────────┬───────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ LLM PHASE (Optional)           │
        │ (llmClassifier.js)             │
        │ • classify(prompt, ruleResult) │
        │ • scoreConfidence(aiResult)    │
        └────────────┬───────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ MERGE PHASE                    │
        │ (classificationValidator.js)   │
        │ • merge(ruleResult, aiResult)  │
        │ • validateResult(merged)       │
        │ • return Classification        │
        └────────────┬───────────────────┘
                     ↓
         ┌───────────────────────┐
         │ HTTP Response         │
         │ { classification }    │
         └───────────────────────┘
```

### **Generation with Classification**

```
┌─────────────────────────────────────────────────────────┐
│ HTTP Request (POST /api/generate)                       │
│ { prompt, medium, classification }                      │
└────────────────────┬────────────────────────────────────┘
                     ↓
         ┌───────────────────────┐
         │ Validation Layer      │
         └───────────────┬───────┘
                         ↓
        ┌────────────────────────────────┐
        │ genieService.process()         │ ← Orchestrator
        │ (ENHANCED for classification)  │
        └────────────┬───────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ Service Selection              │
        │ • SELECT service based on      │
        │   classification.medium        │
        │   (demo|ebook|calendar|etc)    │
        └────────────┬───────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ Service Execution              │
        │ • service.handle(              │
        │     prompt,                    │
        │     classification             │
        │   )                            │
        │ Calls:                         │
        │ • imageGenerator (if needed)   │
        │ • svgLibrary (for SVGs)        │
        └────────────┬───────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ Response Normalization         │
        │ • normalizeResponse(result)    │
        │ • ADD classification metadata  │
        │ • ADD latency, model, cost     │
        └────────────┬───────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ Persistence                    │
        │ • Save with UUID               │
        │ • Store in /tmp-exports/       │
        └────────────┬───────────────────┘
                     ↓
         ┌───────────────────────┐
         │ HTTP Response         │
         │ { result }            │
         └───────────────────────┘
```

### **Override with Regeneration**

```
┌─────────────────────────────────────────────────────────┐
│ HTTP Request (POST /api/override)                       │
│ { generationId, classification, overrides }             │
└────────────────────┬────────────────────────────────────┘
                     ↓
         ┌───────────────────────┐
         │ Validation Layer      │
         │ • Check generationId  │
         │ • Validate overrides  │
         └───────────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ Lookup Previous Generation     │
        │ • Find PDF in /tmp-exports/    │
        │ • Restore state from UUID      │
        └────────────┬───────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ Calculate Cost Multiplier      │
        │ (overrideSystem.js)            │
        │ • color change = 0.05 (5%)     │
        │ • style change = 0.40 (40%)    │
        │ • medium change = 1.0 (100%)   │
        └────────────┬───────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ Decide Regeneration Strategy   │
        │ IF medium changed:             │
        │   • Full regeneration (100%)   │
        │   • Call service.handle() new  │
        │ ELSE:                          │
        │   • Partial restyle (5-40%)    │
        │   • Apply overrides to PDF     │
        └────────────┬───────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ Regenerate/Restyle            │
        │ • imageGenerator (if needed)   │
        │ • svgLibrary (if needed)       │
        │ • PDF re-rendering             │
        └────────────┬───────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ Save New Generation            │
        │ • Generate new UUID            │
        │ • Save PDF to /tmp-exports/    │
        └────────────┬───────────────────┘
                     ↓
         ┌───────────────────────┐
         │ HTTP Response         │
         │ { result, cost }      │
         └───────────────────────┘
```

---

## **Data Transformation Pipeline**

### **Pipeline 1: Classification Flow**

```
Input: { prompt: "Summer poetry collection" }
  ↓
RuleEngine.tokenize()
  → tokens: ['summer', 'poetry', 'collection']
  → confidence: 0.65 (rules matched 65% of criteria)
  → detected_medium: 'ebook'
  → detected_style: 'minimalist'
  ↓
LLMClassifier.classify()
  → confidence: 0.92
  → medium: 'ebook' (matches rule)
  → style: 'literary'
  → themes: ['poetry', 'nature', 'contemplative']
  ↓
ClassificationValidator.merge()
  → Merge results intelligently
  → confidence: 0.85 (average of 0.65 and 0.92, weighted by rule_weight/ai_weight)
  → source: 'hybrid' (both rules and AI contributed)
  → final_result: {
      medium: 'ebook',
      style: 'literary',
      themes: ['poetry', 'nature'],
      confidence: 0.85,
      source: 'hybrid'
    }
  ↓
Output: Classification object ready for generation
```

### **Pipeline 2: Generation Flow**

```
Input: { 
  prompt: "Summer poetry...",
  classification: { medium: 'ebook', style: 'literary', ... }
}
  ↓
GenieService.process()
  → Select service: ebookService (classification.medium === 'ebook')
  ↓
EbookService.handle()
  → Parse classification metadata
  → Call imageGenerator.generate() if images needed
    → LLM generates image descriptions
    → External service creates images
  → Call svgLibrary.search() for decorative elements
    → Search by theme keywords
    → Get SVG from cache
  → Build eBook structure
    → chapters, sections, formatted text
    → embedded images, SVG decorations
  → Render to PDF
    → Puppeteer generates PDF from HTML
  ↓
Response normalization
  → Add classification metadata to response
  → Calculate latency (end - start)
  → Add model info (which service, which LLM)
  → Calculate cost estimate
  ↓
Save to /tmp-exports/{uuid}.pdf
  ↓
Output: {
  pdfUrl: '/tmp-exports/abc123.pdf',
  pageCount: 12,
  classification: { ... },
  latency: 8234,
  costEstimate: 0.02
}
```

### **Pipeline 3: Override Flow**

```
Input: {
  generationId: 'abc123',
  classification: { medium: 'ebook', style: 'literary' },
  overrides: { style: 'gothic', color: 'dark' }
}
  ↓
Lookup previous generation
  → Read from /tmp-exports/abc123.pdf
  → Restore metadata from cache
  ↓
OverrideSystem.calculateCost()
  → style changed (literary → gothic) = 0.40 cost multiplier
  → color changed (default → dark) = 0.05 cost multiplier
  → Combined: max(0.40, 0.05) = 0.40 (40% regeneration)
  ↓
Decision: Partial regeneration (40%)
  → Don't regenerate images (reuse from original)
  → Don't regenerate structure (reuse from original)
  → Only re-style: colors, fonts, decorative elements
  ↓
If medium also changed: Full regeneration (100%)
  → Call service.handle() with new medium
  → Generate new images
  → Build new structure
  ↓
OverrideSystem.apply()
  → Update CSS/styling in PDF
  → Apply color scheme changes
  → Update decorative SVG colors
  ↓
Save to /tmp-exports/{new_uuid}.pdf
  ↓
Output: {
  pdfUrl: '/tmp-exports/def456.pdf',
  costMultiplier: 0.40,
  latency: 2150,
  regenerationStrategy: 'partial'
}
```

---

## **Module Specifications**

### **MODULE 1: RuleEngine** (`server/utils/ruleEngine.js`)

**Responsibility**: Keyword-based classification using predefined rules

**Inputs**:
- `prompt` (string): User's creative prompt
- Optional: `keywords` (object): Custom keyword database override

**Outputs**:
- `Classification` object: `{ medium, style, themes, confidence, source: 'rules' }`

**Key Functions**:

```typescript
export function tokenize(prompt: string): string[] {
  // Lowercase, split on whitespace/punctuation, filter stop words
  // Returns: ['summer', 'poetry', 'collection']
}

export function scoreRules(tokens: string[]): RuleScore {
  // Match tokens against keyword database (490+ keywords)
  // Weight by category: mediums (40%), styles (30%), themes (30%)
  // Returns: { medium: 'ebook', confidence: 0.65, matched_rules: [...] }
}

export function extractSemanticRules(tokens: string[]): SemanticRules {
  // Advanced: check for phrases, patterns, negations
  // E.g., "not minimalist" → avoid minimalist style
  // Returns: { tone: 'contemplative', audience: 'adults', ... }
}

export function classify(prompt: string): Classification {
  // Pipeline: tokenize → scoreRules → extractSemanticRules → merge
  // Returns complete classification from rules engine only
}
```

**Dependencies**: None (standalone)

**Test Coverage**:
- 50+ tests for tokenization edge cases
- 100+ tests for rule scoring combinations
- 20+ tests for semantic pattern detection

**Performance Target**: <10ms for typical prompt

---

### **MODULE 2: LLMClassifier** (`server/utils/llmClassifier.js`)

**Responsibility**: LLM-based classification via Gemini API

**Inputs**:
- `prompt` (string): User's creative prompt
- Optional: `ruleResult` (Classification): Seed from rule engine (for context)

**Outputs**:
- `Classification` object: `{ medium, style, themes, confidence, source: 'ai' }`

**Key Functions**:

```typescript
export async function classify(
  prompt: string,
  ruleResult?: Classification
): Promise<Classification> {
  // Build LLM prompt with context
  // Call Gemini API with structured output request
  // Parse response
  // Calculate confidence based on API certainty scores
  // Returns: { medium, style, themes, audience, genre, tone, confidence, source: 'ai' }
}

export async function scoreConfidence(response: any): number {
  // Extract confidence scores from LLM response
  // Weight by dimension importance
  // Returns: 0-1 confidence score
}

export function handleFallback(error: Error): Classification {
  // If LLM fails, return null or partial result
  // Allow classificationValidator to handle gracefully
}
```

**Dependencies**: Gemini API client (existing)

**Test Coverage**:
- 30+ tests for API response parsing
- 15+ tests for error handling and fallback
- 10+ tests for confidence scoring

**Performance Target**: <500ms for typical prompt (including API call)

---

### **MODULE 3: ClassificationValidator** (`server/utils/classificationValidator.js`)

**Responsibility**: Intelligently merge rule + AI classification results

**Inputs**:
- `ruleResult` (Classification): From rule engine
- `aiResult` (Classification): From LLM, can be null/partial
- Config: weights and thresholds

**Outputs**:
- `Classification` object: merged, validated, normalized

**Key Functions**:

```typescript
export function merge(
  ruleResult: Classification,
  aiResult?: Classification
): Classification {
  // If AI unavailable: use rules only, source: 'rules'
  // If both available: weighted average of confidence
  // Prefer AI where confident, rules as fallback
  // Reconcile conflicting medium/style choices
  // Returns: { medium, style, themes, confidence, source: 'hybrid'|'rules'|'ai' }
}

export function validate(result: Classification): boolean {
  // Check all required fields present
  // Check medium in SUPPORTED_MEDIUMS
  // Check confidence in 0-1 range
  // Check themes array not empty
  // Returns: true if valid, throw Error if not
}

export function normalize(result: Classification): Classification {
  // Ensure consistent field types
  // Convert confidence to 0-1 scale
  // Lowercase string fields
  // Sort arrays for consistency
  // Returns: normalized Classification
}
```

**Dependencies**: ruleEngine, llmClassifier

**Test Coverage**:
- 40+ tests for merge logic (all combinations of rule + AI results)
- 20+ tests for validation rules
- 10+ tests for normalization

**Performance Target**: <5ms

---

### **MODULE 4: SVGLibrary** (`server/utils/svgLibrary.js`)

**Responsibility**: Cached SVG search and retrieval for decorative elements

**Inputs**:
- `keywords` (string[]): Search terms from classification
- Optional: `theme` (string): Target theme

**Outputs**:
- `SVG` object: `{ url, content, theme, cached: boolean }`

**Key Functions**:

```typescript
export function search(keywords: string[], theme?: string): SVG[] {
  // Query keyword database for matching SVGs
  // Filter by theme if provided
  // Check cache first (Redis or in-memory)
  // If cache miss: fetch from SVG library
  // Increment usage counter for analytics
  // Returns: array of matching SVGs, sorted by relevance
}

export function getSVG(id: string): SVG {
  // Fetch specific SVG by ID
  // Return from cache if available
  // Handle errors gracefully (return placeholder)
}

export function incrementUsage(svgId: string): void {
  // Track which SVGs are most popular
  // Used for analytics and cache optimization
}
```

**Dependencies**: None (can be external API or embedded library)

**Test Coverage**:
- 30+ tests for keyword search
- 15+ tests for caching behavior
- 10+ tests for error handling

**Performance Target**: <50ms (with caching, <5ms on cache hit)

---

### **MODULE 5: OverrideSystem** (`server/utils/overrideSystem.js`)

**Responsibility**: Calculate cost and apply style overrides

**Inputs**:
- `overrides` (object): `{ style?, color?, medium?, theme?, tone? }`
- `classification` (Classification): Original classification

**Outputs**:
- `OverrideResult` object: `{ appliedOverrides, costMultiplier, strategy }`

**Key Functions**:

```typescript
export function calculateCost(overrides: object, classification: Classification): CostCalculation {
  // Check which dimensions changed
  // Apply cost multipliers:
  //   - color only: 0.05 (5%)
  //   - style only: 0.40 (40%)
  //   - theme only: 0.20 (20%)
  //   - medium: 1.0 (100%)
  //   - combinations: MAX of individual costs
  // Returns: { changedDimensions, costMultiplier, latencyEstimate }
}

export function decide(overrides: object): RegenerationStrategy {
  // If medium changed: return 'full'
  // Else if style changed: return 'partial'
  // Else: return 'restyling'
  // Strategy determines what needs regeneration
}

export function apply(overrides: object, pdfContent: Buffer): Buffer {
  // For restyling: modify PDF colors/fonts without regeneration
  // For partial: regenerate only styling, reuse images
  // For full: regenerate everything (delegated to service)
  // Returns: updated PDF buffer
}

export function validate(overrides: object): string[] {
  // Check each override value is valid
  // Return array of invalid values or empty if all valid
}
```

**Dependencies**: None (pure logic)

**Test Coverage**:
- 30+ tests for cost calculations
- 20+ tests for strategy decisions
- 15+ tests for override validation

**Performance Target**: <10ms

---

### **MODULE 6: ImageGenerator** (`server/imageGenerator.js` - existing)

**Responsibility**: Generate images via LLM (already implemented)

**Integration Point**: Called by services when classification.themes require images

**Updates Needed**: Accept classification metadata for better image generation

```typescript
// ENHANCE: Add classification context to generate()
export async function generate(
  description: string,
  classification?: Classification
): Promise<Image> {
  // Use classification.themes to guide image generation
  // Use classification.style to influence aesthetic
  // Rest of logic unchanged
}
```

---

## **Orchestrator Architecture**

### **GenieService Overview** (`server/genieService.js`)

Current implementation: Lines 544-631 (process method)

**Architecture**:
```
POST /prompt
  ↓
genieService.process(prompt, mode, classification?)
  ├─ Phase 1: INPUT NORMALIZATION
  │  ├─ Validate inputs
  │  ├─ Generate UUID for tracking
  │  └─ Initialize context object
  │
  ├─ Phase 2: CLASSIFICATION (if not provided)
  │  ├─ Call classifyPrompt(prompt) ← NEW METHOD
  │  └─ Get Classification object
  │
  ├─ Phase 3: SERVICE SELECTION
  │  ├─ Extract medium from classification
  │  ├─ Select service (demo|ebook|calendar|etc)
  │  └─ Validate service is available
  │
  ├─ Phase 4: SERVICE EXECUTION
  │  ├─ Call service.handle(prompt, classification)
  │  ├─ Pass classification to service
  │  ├─ Measure latency
  │  └─ Capture result
  │
  ├─ Phase 5: RESPONSE NORMALIZATION
  │  ├─ normalizeResponse(serviceResult, classification)
  │  ├─ Add classification metadata
  │  ├─ Add latency, model, cost
  │  └─ Standardize response envelope
  │
  ├─ Phase 6: PERSISTENCE
  │  ├─ Save PDF to /tmp-exports/{uuid}.pdf
  │  ├─ Cache metadata by UUID
  │  └─ Store in database if enabled
  │
  └─ Phase 7: RESPONSE
     └─ Return normalized response
```

### **NEW: classifyPrompt() Method**

**Location**: `server/genieService.js` (new method, ~50 lines)

**Purpose**: Orchestrate classification pipeline

**Implementation**:

```typescript
export async function classifyPrompt(prompt: string): Promise<Classification> {
  try {
    // Phase 1: Rule-based classification
    const ruleResult = ruleEngine.classify(prompt);
    
    // Phase 2: LLM-based classification (optional, based on confidence)
    let aiResult = null;
    if (ruleResult.confidence < CONFIDENCE_THRESHOLD) {
      try {
        aiResult = await llmClassifier.classify(prompt, ruleResult);
      } catch (error) {
        console.warn('LLM classification failed, using rules only', error);
        // aiResult stays null, validator will handle
      }
    }
    
    // Phase 3: Merge and validate
    const finalClassification = classificationValidator.merge(ruleResult, aiResult);
    classificationValidator.validate(finalClassification);
    
    // Phase 4: Normalize for response
    return classificationValidator.normalize(finalClassification);
  } catch (error) {
    throw new ClassificationError(`Classification failed: ${error.message}`);
  }
}
```

### **ENHANCED: process() Method**

**Location**: `server/genieService.js` (existing, lines 544-631)

**Changes**:

```typescript
// Before: process(prompt, mode)
// After: process(prompt, mode, classification?)

export async function process(
  prompt: string,
  mode: string,
  classification?: Classification // NEW parameter
): Promise<any> {
  const startTime = Date.now();
  const requestId = generateUUID();
  
  try {
    // STEP 1: Get classification if not provided
    if (!classification) {
      classification = await this.classifyPrompt(prompt); // NEW
    }
    
    // STEP 2: Select service based on mode OR classification.medium
    const service = this.selectService(mode || classification.medium); // ENHANCED
    
    // STEP 3: Call service with classification
    const result = await service.handle(prompt, classification); // ENHANCED: pass classification
    
    // STEP 4: Normalize response
    const normalized = this.normalizeResponse(result, classification, startTime); // ENHANCED
    
    // STEP 5: Persist
    this.persistenceLayer(normalized, requestId);
    
    // STEP 6: Return
    return normalized;
    
  } catch (error) {
    this.errorHandler(error, requestId);
    throw error;
  }
}
```

### **NEW: override() Method**

**Location**: `server/genieService.js` (new method, ~80 lines)

**Purpose**: Apply overrides and regenerate/restyle

**Implementation**:

```typescript
export async function override(
  generationId: string,
  classification: Classification,
  overrides: object
): Promise<any> {
  const startTime = Date.now();
  
  try {
    // Phase 1: Lookup previous generation
    const previousResult = this.lookupGeneration(generationId);
    if (!previousResult) {
      throw new Error(`Generation ${generationId} not found`);
    }
    
    // Phase 2: Calculate cost
    const costCalc = overrideSystem.calculateCost(overrides, classification);
    
    // Phase 3: Decide regeneration strategy
    const strategy = overrideSystem.decide(overrides);
    
    // Phase 4: Execute strategy
    let result;
    if (strategy === 'full') {
      // Full regeneration: call service with new medium
      const service = this.selectService(overrides.medium || classification.medium);
      result = await service.handle(prompt, { ...classification, ...overrides });
    } else if (strategy === 'partial') {
      // Partial regeneration: update styling only
      result = overrideSystem.apply(overrides, previousResult.pdfBuffer);
    } else {
      // Pure restyling: CSS changes only
      result = overrideSystem.apply(overrides, previousResult.pdfBuffer);
    }
    
    // Phase 5: Normalize and persist
    const normalized = this.normalizeResponse(result, classification, startTime);
    normalized.costMultiplier = costCalc.costMultiplier;
    normalized.regenerationStrategy = strategy;
    this.persistenceLayer(normalized, generateUUID());
    
    return normalized;
    
  } catch (error) {
    throw new OverrideError(`Override failed: ${error.message}`);
  }
}
```

---

## **API Layer Integration**

### **Endpoint 1: POST /api/classify**

**Location**: `server/index.js` (new, ~30 lines)

**Implementation**:

```typescript
app.post('/api/classify', async (req, res) => {
  try {
    // Validation
    const { prompt, userId, context } = req.body;
    if (!prompt || prompt.length < 10) {
      return res.status(400).json({ error: 'Prompt too short (min 10 chars)' });
    }
    
    // Call orchestrator
    const classification = await genieService.classifyPrompt(prompt);
    
    // Response
    res.status(200).json({
      id: classification.id,
      medium: classification.medium,
      mediumConfidence: classification.mediumConfidence,
      style: classification.style,
      styleConfidence: classification.styleConfidence,
      themes: classification.themes,
      audience: classification.audience,
      genre: classification.genre,
      tone: classification.tone,
      source: classification.source,
      confidence: classification.confidence,
      metadata: classification.metadata
    });
    
  } catch (error) {
    console.error('Classification error:', error);
    res.status(500).json({ error: 'Classification service error' });
  }
});
```

**Flow**:
```
POST /api/classify
  ↓
validatePayload(req.body)
  ↓
genieService.classifyPrompt(prompt)
  ├─ ruleEngine.classify()
  ├─ llmClassifier.classify() [optional]
  ├─ classificationValidator.merge()
  └─ return Classification
  ↓
res.json(classification)
```

### **Endpoint 2: POST /api/generate**

**Location**: `server/index.js` (new, ~40 lines)

**Implementation**:

```typescript
app.post('/api/generate', async (req, res) => {
  try {
    // Validation
    const { prompt, medium, classification } = req.body;
    if (!prompt || !classification) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Call orchestrator
    const result = await genieService.process(prompt, medium, classification);
    
    // Response
    res.status(200).json({
      id: result.id,
      pdfUrl: result.pdfUrl,
      pageCount: result.pageCount,
      medium: result.medium,
      style: result.style,
      classification: {
        id: result.classification.id,
        confidence: result.classification.confidence
      },
      metadata: result.metadata,
      latency: result.latency,
      costEstimate: result.costEstimate
    });
    
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Generation failed' });
  }
});
```

**Flow**:
```
POST /api/generate
  ↓
validatePayload(req.body)
  ↓
genieService.process(prompt, medium, classification)
  ├─ selectService(medium)
  ├─ service.handle(prompt, classification)
  │  ├─ imageGenerator.generate() [if needed]
  │  ├─ svgLibrary.search() [if needed]
  │  └─ pdfGenerator.render()
  ├─ normalizeResponse(result, classification)
  └─ persistenceLayer(normalized)
  ↓
res.json(result)
```

### **Endpoint 3: POST /api/override**

**Location**: `server/index.js` (new, ~40 lines)

**Implementation**:

```typescript
app.post('/api/override', async (req, res) => {
  try {
    // Validation
    const { generationId, classification, overrides } = req.body;
    if (!generationId || !overrides || Object.keys(overrides).length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate override values
    const invalidFields = overrideSystem.validate(overrides);
    if (invalidFields.length > 0) {
      return res.status(422).json({ error: 'Invalid override values', invalid: invalidFields });
    }
    
    // Call orchestrator
    const result = await genieService.override(generationId, classification, overrides);
    
    // Response
    res.status(200).json({
      id: result.id,
      pdfUrl: result.pdfUrl,
      pageCount: result.pageCount,
      overrides: {
        applied: result.appliedOverrides,
        skipped: result.skippedOverrides,
        warning: result.warning
      },
      costMultiplier: result.costMultiplier,
      costBreakdown: result.costBreakdown,
      latency: result.latency,
      metadata: result.metadata,
      costEstimate: result.costEstimate
    });
    
  } catch (error) {
    console.error('Override error:', error);
    res.status(500).json({ error: 'Override failed' });
  }
});
```

**Flow**:
```
POST /api/override
  ↓
validatePayload(req.body)
  ↓
overrideSystem.validate(overrides)
  ↓
genieService.override(generationId, classification, overrides)
  ├─ lookupGeneration(generationId)
  ├─ overrideSystem.calculateCost(overrides, classification)
  ├─ overrideSystem.decide(overrides)
  ├─ Execute strategy:
  │  ├─ Full: service.handle() with new params
  │  ├─ Partial: overrideSystem.apply() with partial regen
  │  └─ Restyling: overrideSystem.apply() CSS only
  ├─ normalizeResponse(result, classification)
  └─ persistenceLayer(normalized)
  ↓
res.json(result)
```

---

## **Service Layer Integration**

### **Service Interface** (How services are called)

**Current**: `service.handle(prompt, mode)`

**Enhanced**: `service.handle(prompt, classification)`

**Updated Interface**:

```typescript
export interface ServiceHandle {
  (
    prompt: string,
    classification: Classification,
    options?: ServiceOptions
  ): Promise<ServiceResult>;
}

export interface ServiceResult {
  content: string;              // HTML or formatted content
  format: 'pdf' | 'html' | 'json';
  pageCount: number;
  images: Image[];
  metadata: {
    generatedAt: string;
    service: string;
    model?: string;
    processingTimeMs: number;
  };
}
```

### **Service: DemoService** (`server/demoService.js`)

**Changes**:

```typescript
// Before: handle(prompt, mode)
// After: handle(prompt, classification)

export async function handle(
  prompt: string,
  classification: Classification
): Promise<ServiceResult> {
  // Use classification.medium to select output format
  // Use classification.style to adjust styling
  // Use classification.themes to select theme colors
  
  // Build demo output based on classification
  const output = buildDemoOutput(prompt, classification);
  
  // Render to PDF
  const pdf = await renderPDF(output);
  
  return {
    content: output,
    format: 'pdf',
    pageCount: 1,
    images: [],
    metadata: { generatedAt: new Date(), service: 'demo' }
  };
}
```

### **Service: EbookService** (`server/ebookService.js`)

**Changes**:

```typescript
export async function handle(
  prompt: string,
  classification: Classification
): Promise<ServiceResult> {
  // Use classification for smarter eBook generation
  
  // Phase 1: Generate images if themes suggest visual content
  const images = [];
  if (classification.themes.includes('illustrated')) {
    for (const theme of classification.themes) {
      const img = await imageGenerator.generate(
        `${theme} illustration for ebook`,
        classification
      );
      images.push(img);
    }
  }
  
  // Phase 2: Find decorative SVGs matching themes
  const svgs = svgLibrary.search(classification.themes, classification.style);
  
  // Phase 3: Build eBook structure
  const chapters = buildChapters(prompt, classification);
  
  // Phase 4: Render to PDF with images and SVGs
  const html = buildEbookHTML(chapters, images, svgs, classification);
  const pdf = await renderPDF(html);
  
  return {
    content: html,
    format: 'pdf',
    pageCount: chapters.length * 2, // approximate
    images: images,
    metadata: { generatedAt: new Date(), service: 'ebook' }
  };
}
```

### **Service: SampleService** (`server/sampleService.js`)

**Changes**: Similar to EbookService

---

## **Implementation Sequence**

### **Phase 1: Foundation** (2-3 hours - BLOCKING)

**Must complete before anything else:**

1. **Add classifyPrompt() to genieService.js** (40 minutes)
   - Import: ruleEngine, llmClassifier, classificationValidator
   - Implement orchestration logic
   - Add error handling
   - Unit test

2. **Create POST /api/classify endpoint** (20 minutes)
   - Validation layer
   - Call genieService.classifyPrompt()
   - Response normalization
   - Error responses (400, 408, 500)

3. **Verify ruleEngine integration** (30 minutes)
   - Test ruleEngine.classify() returns correct structure
   - Test confidence scoring
   - Test with various prompt types

**Blocking factors**: None  
**Testing**: Unit tests only (no backend integration yet)

---

### **Phase 2: Generation Enhancement** (1-2 hours - MEDIUM PRIORITY)

**Can start after Phase 1 verification:**

1. **Enhance genieService.process()** (1 hour)
   - Add classification parameter
   - Update service selection logic
   - Pass classification to service.handle()
   - Add to response envelope

2. **Create POST /api/generate endpoint** (40 minutes)
   - Call genieService.process() with classification
   - Normalize response
   - Error handling

3. **Update service interfaces** (30 minutes)
   - Modify demoService.handle()
   - Modify ebookService.handle()
   - Modify sampleService.handle()
   - Add classification parameter usage

**Blocking factors**: Phase 1 complete  
**Testing**: Integration tests with services

---

### **Phase 3: Override System** (1.5-2 hours - HIGH PRIORITY)

**Can start after Phase 1-2 foundation:**

1. **Implement override() in genieService.js** (1 hour)
   - Lookup previous generation
   - Cost calculation
   - Strategy decision
   - Partial regeneration

2. **Create POST /api/override endpoint** (40 minutes)
   - Validation of override values
   - Call genieService.override()
   - Response with cost multiplier

3. **Enhance OverrideSystem** (30 minutes)
   - Implement apply() method for CSS changes
   - Implement logic for full vs partial regeneration

**Blocking factors**: Phase 1-2 complete  
**Testing**: Override flow tests

---

### **Phase 4: Error Handling & Resilience** (1-2 hours - ONGOING)

**Parallel with Phases 1-3:**

1. **Add retry logic** (30 minutes)
   - Exponential backoff for timeouts
   - Fallback to rules engine if LLM fails
   - Graceful degradation

2. **Add monitoring/logging** (30 minutes)
   - Log each phase of classification/generation
   - Track latency by phase
   - Alert on errors

3. **Add error recovery tests** (1 hour)
   - Test timeout recovery
   - Test LLM unavailable scenario
   - Test partial failures

**Blocking factors**: None (can be done in parallel)

---

### **Phase 5: Integration & QA** (2-3 hours)

**After Phases 1-3 complete:**

1. **End-to-end flow testing** (1 hour)
   - Full flow: classify → generate → override → export
   - All error scenarios
   - All state transitions

2. **Performance testing** (30 minutes)
   - Latency: classify < 2s (or < 5s with LLM)
   - Latency: generate 8-20s
   - Latency: override < 2s

3. **Load testing** (30 minutes)
   - Concurrent requests
   - Cache effectiveness
   - Database query performance

4. **Frontend integration testing** (1 hour)
   - Coordinate with frontend team
   - Test all 3 endpoints with frontend
   - Verify response schemas match expectations

**Blocking factors**: Phases 1-3 complete

---

### **Dependency Tree**

```
[Foundation]
├─ Phase 1: classifyPrompt() + /api/classify
│  ├─ Depends: ruleEngine, llmClassifier, classificationValidator
│  ├─ Blocking: Everything
│  └─ Effort: 1.5h
│
├─ Phase 2: process() enhancement + /api/generate
│ ├─ Depends: Phase 1 ✓
│  ├─ Effort: 2h
│  └─ Unblocks: Phase 3
│
├─ Phase 3: override() + /api/override
│  ├─ Depends: Phase 1-2 ✓
│  ├─ Effort: 2h
│  └─ Unblocks: QA
│
├─ Phase 4: Error handling (Parallel)
│  ├─ Depends: Phases 1-3 ✓
│  ├─ Effort: 1.5h
│  └─ Unblocks: Production
│
└─ Phase 5: Integration & QA
   ├─ Depends: Phases 1-4 ✓
   ├─ Effort: 2.5h
   └─ Deliverable: Production-ready
```

**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 5  
**Total Effort**: 10-12 hours  
**Parallel Work**: Phase 4 (error handling, 1.5 hours)

---

## **Testing Strategy**

### **Unit Tests by Module** (30 tests per module, ~180 total)

#### **RuleEngine Tests** (45 tests)

```typescript
describe('RuleEngine', () => {
  describe('tokenize()', () => {
    test('splits on whitespace', () => {
      const tokens = ruleEngine.tokenize('summer poetry collection');
      expect(tokens).toEqual(['summer', 'poetry', 'collection']);
    });
    
    test('removes stop words', () => {
      const tokens = ruleEngine.tokenize('a summer of poetry');
      expect(tokens).not.toContain('a');
      expect(tokens).not.toContain('of');
    });
    
    test('lowercases all tokens', () => {
      const tokens = ruleEngine.tokenize('SUMMER Poetry Collection');
      expect(tokens.every(t => t === t.toLowerCase())).toBe(true);
    });
    
    // ... 40+ more tests
  });
  
  describe('scoreRules()', () => {
    test('identifies medium: ebook from keywords', () => {
      const score = ruleEngine.scoreRules(['summer', 'poetry', 'book']);
      expect(score.medium).toBe('ebook');
      expect(score.confidence).toBeGreaterThan(0.5);
    });
    
    // ... 30+ more tests
  });
  
  describe('classify()', () => {
    test('returns complete Classification object', () => {
      const result = ruleEngine.classify('summer poetry');
      expect(result).toHaveProperty('medium');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('source', 'rules');
    });
    
    // ... 15+ more tests
  });
});
```

#### **LLMClassifier Tests** (35 tests)

```typescript
describe('LLMClassifier', () => {
  describe('classify()', () => {
    test('calls Gemini API with correct payload', async () => {
      const spy = jest.spyOn(geminiClient, 'generateContent');
      await llmClassifier.classify('summer poetry');
      expect(spy).toHaveBeenCalled();
    });
    
    test('returns Classification with AI source', async () => {
      const result = await llmClassifier.classify('summer poetry');
      expect(result.source).toBe('ai');
      expect(result.confidence).toBeGreaterThan(0);
    });
    
    test('handles LLM timeout gracefully', async () => {
      geminiClient.generateContent.mockRejectedValueOnce(
        new Error('Request timeout')
      );
      const result = await llmClassifier.classify('summer poetry');
      expect(result).toBeNull();
    });
    
    // ... 30+ more tests
  });
});
```

### **Integration Tests** (40+ tests)

#### **Classification Flow**

```typescript
describe('Classification Flow (ruleEngine → llmClassifier → validator)', () => {
  test('low-confidence rule result triggers LLM', async () => {
    const prompt = 'ambiguous prompt';
    const classification = await genieService.classifyPrompt(prompt);
    
    expect(classification.source).toBe('hybrid');
    expect(classification.confidence).toBeGreaterThan(0.5);
  });
  
  test('high-confidence rule result skips LLM', async () => {
    const prompt = 'definitely an ebook';
    const classification = await genieService.classifyPrompt(prompt);
    
    // LLM should not have been called
    expect(llmClassifier.classify).not.toHaveBeenCalled();
    expect(classification.source).toBe('rules');
  });
});
```

#### **Generation Flow**

```typescript
describe('Generation Flow', () => {
  test('end-to-end: classify → generate → result', async () => {
    const classification = await genieService.classifyPrompt('summer poetry');
    
    const result = await genieService.process(
      'summer poetry',
      'ebook',
      classification
    );
    
    expect(result).toHaveProperty('pdfUrl');
    expect(result).toHaveProperty('pageCount');
    expect(result).toHaveProperty('latency');
    expect(result.classification.id).toBe(classification.id);
  });
});
```

#### **Override Flow**

```typescript
describe('Override Flow', () => {
  test('apply style override with partial regeneration (40% cost)', async () => {
    // Setup: generate initial PDF
    const classification = { medium: 'ebook', style: 'minimalist' };
    const result1 = await genieService.process('prompt', 'ebook', classification);
    
    // Override: change style to gothic
    const result2 = await genieService.override(
      result1.id,
      classification,
      { style: 'gothic' }
    );
    
    expect(result2.costMultiplier).toBe(0.40);
    expect(result2.regenerationStrategy).toBe('partial');
    expect(result2.pdfUrl).not.toBe(result1.pdfUrl); // Different file
  });
  
  test('apply medium override with full regeneration (100% cost)', async () => {
    const classification = { medium: 'ebook' };
    const result1 = await genieService.process('prompt', 'ebook', classification);
    
    const result2 = await genieService.override(
      result1.id,
      classification,
      { medium: 'poster' }
    );
    
    expect(result2.costMultiplier).toBe(1.0);
    expect(result2.regenerationStrategy).toBe('full');
  });
});
```

### **E2E Tests** (via API)

```typescript
describe('API E2E', () => {
  test('POST /api/classify → POST /api/generate → POST /api/override', async () => {
    // Step 1: Classify
    const classRes = await fetch('http://localhost:3000/api/classify', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'summer poetry' })
    });
    const classification = await classRes.json();
    expect(classification.confidence).toBeGreaterThan(0);
    
    // Step 2: Generate
    const genRes = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'summer poetry',
        medium: classification.medium,
        classification
      })
    });
    const result = await genRes.json();
    expect(result.pdfUrl).toBeTruthy();
    
    // Step 3: Override
    const ovRes = await fetch('http://localhost:3000/api/override', {
      method: 'POST',
      body: JSON.stringify({
        generationId: result.id,
        classification,
        overrides: { style: 'gothic' }
      })
    });
    const override = await ovRes.json();
    expect(override.costMultiplier).toBe(0.40);
  });
});
```

---

## **Success Criteria**

✅ **Functional**
- [ ] `/api/classify` returns valid Classification with confidence
- [ ] `/api/generate` returns PDF with all metadata
- [ ] `/api/override` returns updated PDF with cost multiplier
- [ ] All Phase A-B utilities integrate correctly
- [ ] Services receive classification and use it
- [ ] All 180+ unit tests pass
- [ ] All 40+ integration tests pass
- [ ] All E2E tests pass

✅ **Performance**
- [ ] Classify: < 2s (rules) or < 5s (with LLM)
- [ ] Generate: 8-20s
- [ ] Override: < 2s
- [ ] No memory leaks
- [ ] Cache hit rate > 80% for SVG searches

✅ **Reliability**
- [ ] Error recovery: automatic retries on timeout
- [ ] Fallback to rules if LLM unavailable
- [ ] All error codes properly handled
- [ ] Request tracing with UUIDs
- [ ] Comprehensive logging

✅ **Integration**
- [ ] Frontend can call all 3 endpoints
- [ ] Response schemas match spec
- [ ] All data flows correctly to frontend components
- [ ] No breaking changes to existing /prompt endpoint

---

## **Document Control**

| Version | Date       | Status   | Notes                                               |
| ------- | ---------- | -------- | --------------------------------------------------- |
| 1.0     | 2025-11-18 | 🟢 READY | Complete backend modularity and implementation plan |

---

**Status**: 🟢 **READY FOR IMPLEMENTATION** — All modules scoped, dependencies clear, sequencing defined, testing strategy locked.

**Next Steps**:
1. Backend team begins Phase 1 (classifyPrompt + /api/classify)
2. Parallel: Frontend team begins progressive disclosure implementation
3. After Phase 1: Coordinate testing between frontend and backend
4. After Phase 3: Full E2E integration testing

**Related Documents**:
- `FRONTEND_BACKEND_INTEGRATION_SPEC.md` - Frontend-backend contract
- `ORCHESTRATOR_ARCHITECTURE.md` - Current orchestrator design
- `PHASE_A-B_INTEGRATION_CHECKLIST.md` - High-level integration plan
- `FRONTEND_PROGRESSIVE_DISCLOSURE_ARCHITECTURE.md` - Frontend state machine

---

**END OF BACKEND_MODULARITY_ARCHITECTURE**
