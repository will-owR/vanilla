````markdown
# Frontend Progressive Disclosure Modularity Breakdown

**Implementation Plan for Option C Frontend Redesign**

**Date**: November 17, 2025  
**Status**: 🟢 **DRAFT**  
**Branch**: `aetherV0/anew-default-demo`  
**Reference**: `FRONTEND_PROGRESSIVE_DISCLOSURE_ARCHITECTURE.md`

---

## **1. Overview: Module Breakdown**

The frontend redesign consists of **12 independent/dependent modules** organized by priority and dependency:

| #   | Module                         | Type      | Status   | Depends On | Time   |
| --- | ------------------------------ | --------- | -------- | ---------- | ------ |
| 1   | StateManager (Store)           | Core      | 🔄 Ready | None       | 1-2h   |
| 2   | GenerateFlow Container         | Core      | 🔄 Ready | 1          | 2-3h   |
| 3   | MediaSelector (existing)       | Reuse     | ✅ Done  | None       | 0h     |
| 4   | PromptInput Component          | New       | 🔄 Ready | None       | 1-2h   |
| 5   | LoadingSpinner Component       | New       | 🔄 Ready | None       | 0.5h   |
| 6   | ClassificationFeedback (exist) | Enhance   | 🔄 Ready | 3          | 0.5h   |
| 7   | ResultsDisplay Component       | New       | 🔄 Ready | 3, 6       | 2-3h   |
| 8   | OverrideControls (existing)    | Enhance   | 🔄 Ready | 6, 7       | 0.5h   |
| 9   | CostVisualization Component    | New       | 🔄 Ready | 8          | 1-1.5h |
| 10  | StatsPanel Component           | New       | 🔄 Ready | 6, 7       | 1h     |
| 11  | ActionButtons Component        | New       | 🔄 Ready | 7, 8       | 0.5h   |
| 12  | App.svelte Root Refactor       | Integrate | 🔄 Ready | All        | 1-2h   |

**Total Implementation Time**: 13-20 hours (1-2 weeks for 1 developer)

---

## **2. Dependency Graph**

```
┌──────────────────────────────────────────────────────┐
│         CORE LAYER (Independent)                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  StateManager (1)           [Core state logic]      │
│       ↓                                              │
│  GenerateFlow (2)           [Container component]   │
│       ↓                                              │
│  ┌────────────────────────────────────────┐         │
│  │  PRESENTATIONAL LAYER (Independent)    │         │
│  ├────────────────────────────────────────┤         │
│  │                                        │         │
│  │  MediaSelector (3) ✅ exists          │         │
│  │  PromptInput (4)                       │         │
│  │  LoadingSpinner (5)                    │         │
│  │                                        │         │
│  └────────────────────────────────────────┘         │
│       ↓                                              │
│  ┌────────────────────────────────────────┐         │
│  │  FEEDBACK LAYER (Soft dependencies)    │         │
│  ├────────────────────────────────────────┤         │
│  │                                        │         │
│  │  ClassificationFeedback (6)            │         │
│  │       ↓                                │         │
│  │  ResultsDisplay (7)                    │         │
│  │       ↓                                │         │
│  │  StatsPanel (10)                       │         │
│  │                                        │         │
│  └────────────────────────────────────────┘         │
│       ↓                                              │
│  ┌────────────────────────────────────────┐         │
│  │  OVERRIDE LAYER (Dependent)            │         │
│  ├────────────────────────────────────────┤         │
│  │                                        │         │
│  │  OverrideControls (8)                  │         │
│  │  CostVisualization (9)                 │         │
│  │  ActionButtons (11)                    │         │
│  │                                        │         │
│  └────────────────────────────────────────┘         │
│       ↓                                              │
│  ┌────────────────────────────────────────┐         │
│  │  ROOT INTEGRATION                      │         │
│  ├────────────────────────────────────────┤         │
│  │                                        │         │
│  │  App.svelte (12)                       │         │
│  │  [Orchestrates all modules]            │         │
│  │                                        │         │
│  └────────────────────────────────────────┘         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## **3. Module Specifications**

### **MODULE 1: StateManager Store**

**File**: `client/src/stores/flowStore.ts`  
**Type**: Svelte Store (logic layer)  
**Time**: 1-2 hours

#### **Responsibility**

Centralized state machine for the progressive disclosure flow

#### **Interface**

```typescript
interface FlowState {
  state:
    | "INITIAL"
    | "MEDIUM_SELECTED"
    | "PROMPT_ENTERED"
    | "GENERATING"
    | "CLASSIFICATION_READY"
    | "RESULT_READY"
    | "OVERRIDE_ACTIVE"
    | "COMPLETE";

  // Data
  selectedMedium: string | null;
  prompt: string;
  classification: Classification | null;
  result: GenerationResult | null;
  error: Error | null;

  // Metadata
  isLoading: boolean;
  latency: number;
  costMultiplier: number;
  attemptCount: number;
  startTime: number;
}

export const flowStore = writable<FlowState>({
  state: "INITIAL",
  selectedMedium: null,
  prompt: "",
  classification: null,
  result: null,
  error: null,
  isLoading: false,
  latency: 0,
  costMultiplier: 1.0,
  attemptCount: 0,
  startTime: 0,
});

// Actions
export function selectMedium(medium: string): void;
export function enterPrompt(prompt: string): void;
export function startGenerating(): void;
export function setClassification(classification: Classification): void;
export function setResult(result: GenerationResult): void;
export function setError(error: Error | null): void;
export function setOverrideCost(multiplier: number): void;
export function reset(): void;
export function transition(toState: FlowState.state): void;
```

#### **Key Methods**

```typescript
// State transitions with validation
private canTransition(from: string, to: string): boolean {
  const validTransitions = {
    INITIAL: ['MEDIUM_SELECTED'],
    MEDIUM_SELECTED: ['PROMPT_ENTERED', 'INITIAL'],
    PROMPT_ENTERED: ['GENERATING', 'MEDIUM_SELECTED'],
    GENERATING: ['CLASSIFICATION_READY', 'ERROR'],
    CLASSIFICATION_READY: ['RESULT_READY', 'OVERRIDE_ACTIVE', 'INITIAL'],
    RESULT_READY: ['OVERRIDE_ACTIVE', 'COMPLETE', 'INITIAL'],
    OVERRIDE_ACTIVE: ['GENERATING', 'RESULT_READY', 'INITIAL'],
    COMPLETE: ['INITIAL'],
  };
  return validTransitions[from]?.includes(to) || false;
}

// Calculate latency
public getLatency(): number {
  const current = get(flowStore);
  if (!current.startTime) return 0;
  return Date.now() - current.startTime;
}

// Validation
private isValidPrompt(prompt: string): boolean {
  return prompt.trim().length > 10;
}

private isValidMedium(medium: string): boolean {
  return ['ebook', 'calendar', 'poster', 'stickers', 'card', 'journal'].includes(medium);
}
```

#### **Unit Tests** (15 tests)

- [ ] `transition()` rejects invalid state changes
- [ ] `selectMedium()` validates medium
- [ ] `enterPrompt()` validates prompt length
- [ ] `reset()` clears all data
- [ ] `getLatency()` calculates correctly
- [ ] Error state can be set/cleared
- [ ] Cost multiplier updates correctly

#### **Dependencies**: None

---

### **MODULE 2: GenerateFlow Container**

**File**: `client/src/components/GenerateFlow.svelte`  
**Type**: Container Component (orchestration)  
**Time**: 2-3 hours

#### **Responsibility**

State machine container that renders conditional UI and orchestrates API calls

#### **Structure**

```svelte
<script>
  import { flowStore, ... } from '../stores/flowStore';
  import { classify, generate, applyOverride } from '../lib/api';

  // Subscribe to store
  $: state = $flowStore.state;
  $: selectedMedium = $flowStore.selectedMedium;
  $: prompt = $flowStore.prompt;
  $: classification = $flowStore.classification;
  $: result = $flowStore.result;
  $: isLoading = $flowStore.isLoading;

  async function handleGenerateClick() {
    startGenerating();
    try {
      // STEP 1: Classify
      const classResult = await classify(prompt);
      setClassification(classResult);
      transition('CLASSIFICATION_READY');

      // Auto-accept if high confidence (>0.85)
      if (classResult.confidence > 0.85) {
        await handleAcceptClassification();
      }
    } catch (error) {
      setError(error);
      // Retry logic
    }
  }

  async function handleAcceptClassification() {
    transition('GENERATING');
    try {
      // STEP 2: Generate
      const genResult = await generate(prompt, selectedMedium);
      setResult(genResult);
      transition('RESULT_READY');
    } catch (error) {
      setError(error);
      transition('CLASSIFICATION_READY');  // Allow retry
    }
  }

  async function handleApplyOverride(overrides) {
    transition('GENERATING');
    try {
      // STEP 3: Override
      const overrideResult = await applyOverride(result, classification, overrides);
      setResult(overrideResult);
      setOverrideCost(overrideResult.costMultiplier);
      transition('RESULT_READY');
    } catch (error) {
      setError(error);
      transition('OVERRIDE_ACTIVE');  // Allow retry
    }
  }
</script>

<!-- Conditional rendering based on state -->
{#if state === 'INITIAL'}
  <MediaSelector on:mediaSelected={handleMediaSelect} />
{:else if state === 'MEDIUM_SELECTED'}
  <PromptInput bind:prompt on:generate={handleGenerateClick} />
{:else if state === 'GENERATING'}
  <LoadingSpinner message="Generating..." />
{:else if state === 'CLASSIFICATION_READY'}
  <ClassificationFeedback
    {classification}
    on:accept={handleAcceptClassification}
    on:override={() => transition('OVERRIDE_ACTIVE')}
  />
{:else if state === 'RESULT_READY'}
  <ResultsDisplay
    {result}
    {classification}
    on:customize={() => transition('OVERRIDE_ACTIVE')}
    on:export={handleExport}
    on:newPrompt={() => reset()}
  />
{:else if state === 'OVERRIDE_ACTIVE'}
  <div class="override-wrapper">
    <ResultsDisplay {result} {classification} />
    <OverrideControls
      on:apply={handleApplyOverride}
      on:cancel={() => transition('RESULT_READY')}
    />
  </div>
{:else if state === 'COMPLETE'}
  <SuccessPanel on:export={handleExport} on:newPrompt={() => reset()} />
{/if}

<!-- Global error panel -->
{#if $flowStore.error}
  <ErrorPanel error={$flowStore.error} on:retry={handleRetry} on:dismiss={clearError} />
{/if}
```

#### **Key Functions**

```typescript
async function handleMediaSelect(event) {
  selectMedium(event.detail);
  transition("MEDIUM_SELECTED");
}

async function handleGenerateClick() {
  // Full E2E flow: classify → generate → classify result
  startGenerating();
  try {
    const classResult = await classify(prompt);
    setClassification(classResult);

    if (classResult.confidence > 0.85) {
      // Auto-accept high-confidence classifications
      transition("GENERATING");
      const genResult = await generate(prompt, selectedMedium);
      setResult(genResult);
      transition("RESULT_READY");
    } else {
      // Let user review classification
      transition("CLASSIFICATION_READY");
    }
  } catch (error) {
    setError(error);
    transition("CLASSIFICATION_READY"); // Allow retry
  }
}

async function handleRetry() {
  // Retry from current state
  if (state === "CLASSIFICATION_READY") {
    await handleGenerateClick();
  } else if (state === "OVERRIDE_ACTIVE") {
    // Retry override
  }
  clearError();
}
```

#### **Unit Tests** (10 tests)

- [ ] Renders correct component per state
- [ ] State transitions work as expected
- [ ] API calls made in correct order (classify → generate)
- [ ] Auto-accept high-confidence classifications
- [ ] Error recovery allows retry
- [ ] Export button works
- [ ] Reset clears all data

#### **Dependencies**: Module 1 (StateManager)

---

### **MODULE 3: MediaSelector (Existing)**

**File**: `client/src/components/MediaSelector.svelte`  
**Status**: ✅ Already implemented  
**Time**: 0h (reuse)

#### **No Changes Required**

- Component already exists and works
- Just integrate into GenerateFlow state machine

---

### **MODULE 4: PromptInput Component**

**File**: `client/src/components/PromptInput.svelte`  
**Type**: Input Component  
**Time**: 1-2 hours

#### **Responsibility**

Textarea for prompt input with validation and quick-start suggestions

#### **Props**

```typescript
export let selectedMedium = "ebook";
export let prompt = "";
export let isLoading = false;
export let minChars = 10;
export let maxChars = 2000;
export let placeholder = "What would you like to create? Be specific...";
```

#### **Features**

```svelte
<script>
  let charCount = 0;
  let isValid = false;

  $: charCount = prompt.length;
  $: isValid = charCount >= minChars && charCount <= maxChars;

  const quickStarts = {
    ebook: [
      'Summer poetry collection with nature themes',
      'Self-help guide on productivity and focus',
      'Science fiction short stories',
    ],
    calendar: [
      'Family planner for 2026 with vacation dates',
      '2026 fitness challenge calendar',
      'Monthly gardening calendar',
    ],
    poster: [
      'Minimalist tech startup poster',
      'Retro vintage travel poster',
      'Bold motivational poster',
    ],
  };

  function insertQuickStart(text) {
    prompt = text;
    $emit('quickstart-selected', { medium: selectedMedium, text });
  }
</script>

<div class="prompt-input">
  <h3>Enter your creative prompt</h3>

  <textarea
    bind:value={prompt}
    {placeholder}
    disabled={isLoading}
    rows="5"
    aria-label="Creative prompt"
  />

  <div class="meta">
    <span class="char-count" class:warning={charCount > maxChars * 0.8}>
      {charCount} / {maxChars}
    </span>
    <span class="status">
      {#if !isValid}
        ❌ {minChars - charCount} more characters needed
      {:else}
        ✓ Ready to generate
      {/if}
    </span>
  </div>

  <div class="quick-starts">
    <p>Quick starts for {selectedMedium}:</p>
    {#each quickStarts[selectedMedium] || [] as suggestion}
      <button
        class="quick-start-btn"
        on:click={() => insertQuickStart(suggestion)}
        disabled={isLoading}
      >
        💡 {suggestion}
      </button>
    {/each}
  </div>

  <div class="actions">
    <button
      class="generate-btn"
      on:click={() => $emit('generate')}
      disabled={!isValid || isLoading}
    >
      {#if isLoading}
        ⏳ Generating...
      {:else}
        Generate →
      {/if}
    </button>
  </div>
</div>

<style>
  .prompt-input {
    padding: 1.5rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: monospace;
    font-size: 1rem;
    resize: vertical;
  }

  textarea:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }

  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: #666;
    margin-top: 0.5rem;
  }

  .char-count.warning {
    color: #ff6b6b;
    font-weight: bold;
  }

  .quick-starts {
    margin-top: 1rem;
  }

  .quick-start-btn {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.5rem;
    margin: 0.25rem 0;
    border: 1px solid #e0e0e0;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .quick-start-btn:hover {
    background: #f5f5f5;
    border-color: #007bff;
  }

  .generate-btn {
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    background: #0056b3;
    transform: translateY(-2px);
  }

  .generate-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
```

#### **Unit Tests** (8 tests)

- [ ] Character counter updates
- [ ] Validation: <10 chars shows error
- [ ] Validation: >2000 chars shows warning
- [ ] Quick-start buttons insert text
- [ ] Generate button disabled until valid
- [ ] Generates emits event with prompt
- [ ] Disabled state during loading
- [ ] Accessibility: ARIA labels present

#### **Dependencies**: None (independent component)

---

### **MODULE 5: LoadingSpinner Component**

**File**: `client/src/components/LoadingSpinner.svelte`  
**Type**: Feedback Component  
**Time**: 0.5 hour

#### **Responsibility**

Visual feedback during generation

#### **Props**

```typescript
export let progress = 0; // 0-100
export let message = "Generating...";
export let steps = [
  "Classifying prompt",
  "Routing to service",
  "Generating content",
  "Rendering PDF",
];
export let currentStep = 0;
export let estimatedSeconds = 15;
```

#### **Features**

- Animated spinner (CSS keyframes)
- Progress bar with percentage
- Step indicators
- Estimated time remaining
- Animated dots in message ("Generating...")

#### **Unit Tests** (4 tests)

- [ ] Spinner animates
- [ ] Progress bar updates
- [ ] Steps display in order
- [ ] Estimated time decreases

#### **Dependencies**: None

---

### **MODULE 6: ClassificationFeedback (Enhance)**

**File**: `client/src/components/ClassificationFeedback.svelte`  
**Status**: ✅ Already exists  
**Time**: 0.5 hour (enhancement)

#### **Changes**

- Auto-expand (not collapsed by default)
- Larger confidence indicator
- Show full metadata (theme, audience, genre, tone)
- Clear button labels: "Accept" and "Let Me Choose"

#### **No breaking changes**

- Existing props remain
- Just adjust UI for full-screen prominence

---

### **MODULE 7: ResultsDisplay Component**

**File**: `client/src/components/ResultsDisplay.svelte`  
**Type**: Results Component  
**Time**: 2-3 hours

#### **Responsibility**

Display generated PDF with preview, stats, and action buttons

#### **Props**

```typescript
export let result: GenerationResult;
export let classification: Classification;
export let pdfUrl: string = "";
export let pageCount: number = 5;
export let currentPage: number = 1;
```

#### **Features**

```svelte
<div class="results-display">
  <!-- PDF Preview Section (60% on desktop) -->
  <div class="preview-section">
    <h3>Your Generated {result.medium}</h3>

    <div class="pdf-viewer">
      <iframe
        src={pdfUrl}
        title="Generated PDF preview"
      />
    </div>

    <div class="pagination">
      <button on:click={previousPage} disabled={currentPage === 1}>
        ← Previous
      </button>
      <span>{currentPage} / {pageCount}</span>
      <button on:click={nextPage} disabled={currentPage === pageCount}>
        Next →
      </button>
      <button on:click={toggleFullscreen} title="View fullscreen">
        ⛶ Fullscreen
      </button>
    </div>
  </div>

  <!-- Stats & Actions Section (40% on desktop) -->
  <div class="metadata-section">
    <StatsPanel {result} {classification} />

    <ActionButtons
      on:customize={() => $emit('customize')}
      on:export={() => $emit('export')}
      on:share={() => $emit('share')}
      on:newPrompt={() => $emit('newPrompt')}
    />
  </div>
</div>

<style>
  .results-display {
    display: grid;
    grid-template-columns: 60% 40%;
    gap: 2rem;
    padding: 1.5rem;
    background: white;
    border-radius: 8px;
  }

  .pdf-viewer {
    width: 100%;
    height: 600px;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
  }

  .pdf-viewer iframe {
    width: 100%;
    height: 100%;
  }

  @media (max-width: 1024px) {
    .results-display {
      grid-template-columns: 1fr;
    }
  }
</style>
```

#### **Key Methods**

```typescript
function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    scrollPreviewToTop();
  }
}

function nextPage() {
  if (currentPage < pageCount) {
    currentPage++;
    scrollPreviewToTop();
  }
}

function toggleFullscreen() {
  // Use fullscreen API
  const viewer = document.querySelector(".pdf-viewer");
  if (viewer) viewer.requestFullscreen();
}

function scrollPreviewToTop() {
  const viewer = document.querySelector(".pdf-viewer");
  if (viewer) viewer.scrollTop = 0;
}
```

#### **Unit Tests** (8 tests)

- [ ] Renders PDF iframe
- [ ] Pagination works (Previous/Next buttons)
- [ ] Page counter updates
- [ ] Fullscreen button works
- [ ] Action buttons emit events
- [ ] Stats panel displays
- [ ] Responsive layout (desktop vs. mobile)
- [ ] Accessible (ARIA labels)

#### **Dependencies**: Modules 10, 11 (StatsPanel, ActionButtons)

---

### **MODULE 8: OverrideControls (Enhance)**

**File**: `client/src/components/OverrideControls.svelte`  
**Status**: ✅ Already exists  
**Time**: 0.5 hour (enhancement)

#### **Changes**

- Auto-expand controls (not collapsed)
- Show live preview updates as user changes style/color
- Clear "Apply Override" button (no additional form)
- Add [Cancel] button to exit override mode
- Better integration with CostVisualization

---

### **MODULE 9: CostVisualization Component**

**File**: `client/src/components/CostVisualization.svelte`  
**Type**: Data Visualization  
**Time**: 1-1.5 hours

#### **Responsibility**

Show cost impact of overrides (5%, 40%, 100%)

#### **Props**

```typescript
export let costMultiplier = 1.0; // 0.05-1.0
export let changedDimensions: string[] = []; // ['color', 'style', 'medium']
export let baselineLatency = 8; // seconds
```

#### **Features**

```svelte
<div class="cost-visualization">
  <h4>Cost & Performance Impact</h4>

  <!-- Cost Bar -->
  <div class="cost-bar">
    <div class="cost-indicator" style="width: {costMultiplier * 100}%">
      <span class="label">{Math.round(costMultiplier * 100)}% regeneration</span>
    </div>
  </div>

  <!-- Breakdown -->
  <div class="breakdown">
    {#if changedDimensions.includes('color')}
      <div class="item">
        <span class="badge" style="background: #90EE90">5%</span>
        <span>Color change (minimal cost)</span>
      </div>
    {/if}
    {#if changedDimensions.includes('style')}
      <div class="item">
        <span class="badge" style="background: #FFD700">40%</span>
        <span>Style change (moderate cost)</span>
      </div>
    {/if}
    {#if changedDimensions.includes('medium')}
      <div class="item">
        <span class="badge" style="background: #FF6B6B">100%</span>
        <span>Medium change (full regeneration)</span>
      </div>
    {/if}
  </div>

  <!-- Estimated Latency -->
  <div class="latency-estimate">
    <p>Estimated time: {Math.round(baselineLatency * costMultiplier)}s</p>
  </div>
</div>

<style>
  .cost-bar {
    width: 100%;
    height: 30px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
    margin: 1rem 0;
  }

  .cost-indicator {
    height: 100%;
    background: linear-gradient(90deg, #51cf66, #ffd700, #ff6b6b);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 8px;
    transition: width 0.3s ease;
  }

  .label {
    color: white;
    font-weight: bold;
    font-size: 0.875rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .breakdown {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .badge {
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-weight: bold;
    font-size: 0.75rem;
    color: white;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
  }
</style>
```

#### **Unit Tests** (5 tests)

- [ ] Cost bar width matches multiplier (5% → 50px width)
- [ ] Breakdown shows correct dimensions
- [ ] Latency calculation correct
- [ ] Color-coded correctly (green/yellow/red)
- [ ] Responsive layout

#### **Dependencies**: Module 8 (OverrideControls)

---

### **MODULE 10: StatsPanel Component**

**File**: `client/src/components/StatsPanel.svelte`  
**Type**: Information Panel  
**Time**: 1 hour

#### **Responsibility**

Display generation metrics (latency, model, confidence, cost)

#### **Props**

```typescript
export let latency = 0; // ms
export let model = "demo-1";
export let medium = "ebook";
export let confidence = 0.92; // 0-1
export let source = "rules"; // 'rules' | 'ai' | 'hybrid'
export let pageCount = 5;
export let costEstimate = 0.0; // USD
```

#### **Features**

```svelte
<div class="stats-panel">
  <h4>Generation Stats</h4>

  <div class="stat-item">
    <span class="icon">⚡</span>
    <span class="label">Latency</span>
    <span class="value">{(latency / 1000).toFixed(1)}s</span>
  </div>

  <div class="stat-item">
    <span class="icon">🤖</span>
    <span class="label">Model</span>
    <span class="value">{model}</span>
  </div>

  <div class="stat-item">
    <span class="icon">📊</span>
    <span class="label">Medium</span>
    <span class="value">{medium}</span>
  </div>

  <div class="stat-item">
    <span class="icon">💯</span>
    <span class="label">Confidence</span>
    <span class="value">
      {Math.round(confidence * 100)}%
      <span class="source-badge">{source}</span>
    </span>
  </div>

  <div class="stat-item">
    <span class="icon">📄</span>
    <span class="label">Pages</span>
    <span class="value">{pageCount}</span>
  </div>

  {#if costEstimate > 0}
    <div class="stat-item">
      <span class="icon">💰</span>
      <span class="label">Est. Cost</span>
      <span class="value">${costEstimate.toFixed(4)}</span>
    </div>
  {/if}
</div>

<style>
  .stats-panel {
    padding: 1rem;
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    font-size: 0.9rem;
  }

  .icon {
    font-size: 1.25rem;
    margin-right: 0.5rem;
  }

  .value {
    font-weight: bold;
    font-family: monospace;
  }

  .source-badge {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.2rem 0.4rem;
    background: #ddd;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: normal;
  }
</style>
```

#### **Unit Tests** (5 tests)

- [ ] All stats display
- [ ] Latency formatted correctly (ms → seconds)
- [ ] Confidence shows as percentage
- [ ] Cost shows when > 0
- [ ] Responsive layout

#### **Dependencies**: Modules 6, 7 (data flow from parent)

---

### **MODULE 11: ActionButtons Component**

**File**: `client/src/components/ActionButtons.svelte`  
**Type**: Button Group  
**Time**: 0.5 hour

#### **Responsibility**

Primary call-to-action buttons (Export, Share, Customize, New Prompt)

#### **Props**

```typescript
export let canExport = true;
export let canShare = false;
export let canCustomize = true;
export let isExporting = false;
```

#### **Features**

```svelte
<div class="action-buttons">
  <button
    class="btn btn-primary"
    on:click={() => $emit('export')}
    disabled={!canExport || isExporting}
  >
    {#if isExporting}
      ⏳ Exporting...
    {:else}
      📥 Download PDF
    {/if}
  </button>

  {#if canShare}
    <button class="btn btn-secondary" on:click={() => $emit('share')}>
      🔗 Share
    </button>
  {/if}

  {#if canCustomize}
    <button class="btn btn-secondary" on:click={() => $emit('customize')}>
      🎨 Customize
    </button>
  {/if}

  <button class="btn btn-tertiary" on:click={() => $emit('newPrompt')}>
    ✨ New Prompt
  </button>
</div>

<style>
  .action-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.75rem 1.25rem;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
    flex: 1;
    min-width: 150px;
  }

  .btn-primary {
    background: #007bff;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0056b3;
    transform: translateY(-2px);
  }

  .btn-secondary {
    background: #6c757d;
    color: white;
  }

  .btn-tertiary {
    background: white;
    border: 1px solid #ddd;
    color: #333;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

#### **Unit Tests** (4 tests)

- [ ] Buttons emit correct events
- [ ] Disabled states work
- [ ] Loading state shows spinner
- [ ] Responsive layout

#### **Dependencies**: None (pure presentation)

---

### **MODULE 12: App.svelte Root Refactor**

**File**: `client/src/App.svelte`  
**Type**: Root Component Refactor  
**Time**: 1-2 hours

#### **Changes**

Replace current demo form with GenerateFlow container

#### **Before**

```svelte
<!-- OLD: Direct form, no state machine -->
<form on:submit|preventDefault={submitPrompt}>
  <textarea bind:value={prompt} />
  <button>Generate</button>
</form>
```

#### **After**

```svelte
<!-- NEW: Progressive disclosure flow -->
<script>
  import GenerateFlow from './components/GenerateFlow.svelte';
  import Header from './components/Header.svelte';
  import Footer from './components/Footer.svelte';
</script>

<main class="app">
  <Header />
  <GenerateFlow />
  <Footer />
</main>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
</style>
```

#### **Deletions**

- Remove: Demo mode form
- Remove: demoService import
- Remove: Mode switcher (consolidate)

#### **Additions**

- Import: GenerateFlow
- Import: ErrorBoundary (error handling)
- Add: DevTools for debugging (DEV only)

#### **Unit Tests** (3 tests)

- [ ] App mounts without errors
- [ ] GenerateFlow renders in initial state
- [ ] No console errors or warnings
- [ ] Responsive on mobile/tablet/desktop

#### **Dependencies**: Modules 1-11 (all)

---

## **4. Implementation Timeline**

### **Phase 1: Core Infrastructure (Days 1-2, 4 hours)**

- [ ] Module 1: StateManager
- [ ] Module 2: GenerateFlow
- **Deliverable**: State machine working, tests passing

### **Phase 2: Input Components (Days 2-3, 3-4 hours)**

- [ ] Module 4: PromptInput
- [ ] Module 5: LoadingSpinner
- **Deliverable**: User can input prompt, see loading state

### **Phase 3: Feedback Components (Days 3-4, 3 hours)**

- [ ] Module 6: ClassificationFeedback (enhance)
- [ ] Module 7: ResultsDisplay
- [ ] Module 10: StatsPanel
- **Deliverable**: User sees classification + results + stats

### **Phase 4: Override & Customization (Days 4-5, 3-4 hours)**

- [ ] Module 8: OverrideControls (enhance)
- [ ] Module 9: CostVisualization
- [ ] Module 11: ActionButtons
- **Deliverable**: User can customize styles, see cost impact

### **Phase 5: Integration & Polish (Days 5-6, 2-3 hours)**

- [ ] Module 12: App.svelte refactor
- [ ] E2E testing (full flow)
- [ ] Mobile responsiveness
- [ ] Accessibility audit
- **Deliverable**: Production-ready frontend

---

## **5. Testing Strategy**

### **Unit Tests** (1 test per component)

- ~60 tests total (5-10 per major module)
- Target: 80%+ code coverage
- Mock API calls

### **Integration Tests** (state machine)

- Full flow: INITIAL → COMPLETE
- Error recovery paths
- State validation

### **E2E Tests** (user scenarios)

- Select medium → generate → review → customize → export
- Error scenarios (network failure, API timeout)
- Mobile responsiveness

### **Accessibility Tests**

- WCAG AA compliance
- Screen reader testing
- Keyboard navigation

---

## **6. Success Criteria**

- [ ] User can select medium (6 options visible)
- [ ] User can enter prompt and generate
- [ ] User sees classification metadata (confidence, source, style)
- [ ] User can customize style/color with cost visualization
- [ ] User can export PDF without errors
- [ ] All 457 existing tests still pass (zero regressions)
- [ ] Mobile layout works (tested on device)
- [ ] No console errors or warnings
- [ ] Accessibility audit passes (WCAG AA)
- [ ] Performance: <30s end-to-end (classify → generate → override → export)

---

## **7. Rollback Plan**

If major issues discovered:

1. Branch: `revert/frontend-refactor`
2. Keep old App.svelte in Git history
3. Revert commit if necessary
4. All new components remain (valuable for Phase B)

---

## **Document Control**

| Version | Date       | Status   | Notes                                    |
| ------- | ---------- | -------- | ---------------------------------------- |
| 1.0     | 2025-11-17 | 🟢 READY | Modularity breakdown + timeline complete |

---

**Status**: 🟢 **READY FOR IMPLEMENTATION** — All 12 modules scoped, dependencies clear, timeline defined, success criteria locked.

**Next Step**: Begin implementation with Module 1 (StateManager) and Module 2 (GenerateFlow).

---

**END OF FRONTEND PROGRESSIVE DISCLOSURE MODULARITY BREAKDOWN**
````
