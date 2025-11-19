# Frontend Implementation Schedule: Phase 1 + Phase 2

**Date**: November 19, 2025  
**Version**: 1.0  
**Status**: 🟢 Ready to Execute  
**Total Duration**: ~11 hours of development + 2.5 hours breaks = ~13.5 hours total  
**Audience**: Frontend lead, frontend engineers, project manager

---

## **Overview**

Frontend Phase 1 (Infrastructure) + Phase 2 (UI Components) combined into a continuous 2-hour interval schedule with strategic breaks for code review and testing.

**Total Tasks**: 9 major components  
**Total Bundles**: 6 × 2-hour intervals  
**Break Strategy**: 15-min break between bundles, 30-min lunch break after Bundle 3

---

## **Timeline Summary**

```
Bundle 1 (2h):   StateManager store + API client wrapper foundation
  ↓ [15-min break]
Bundle 2 (2h):   API client wrapper completion + GenerateFlow orchestrator setup
  ↓ [15-min break]
Bundle 3 (2h):   GenerateFlow orchestrator completion + mock API
  ↓ [30-min lunch break]
Bundle 4 (2h):   MediaSelector + PromptInput components
  ↓ [15-min break]
Bundle 5 (2h):   ClassificationFeedback + ResultsDisplay components
  ↓ [15-min break]
Bundle 6 (2h):   StatsPanel + Component wiring + Zero regression check

TOTAL: 11 hours development + 2.5 hours breaks = 13.5 hours
```

---

## **BUNDLE 1: Infrastructure Foundation** (2 hours)

**Time**: 09:00 - 11:00  
**Owner**: Frontend Lead + 1 Senior FE Engineer  
**Focus**: State management + API client setup

### **Task 1.1: Create StateManager Store** (1 hour)

**Objective**: Implement Svelte store with 8-state flow machine

**Deliverable**: `client/src/lib/stores/flowStore.js`

**Implementation Steps**:

1. Create store file with writable stores for each state:

   - `state` (INITIAL, MEDIUM_SELECTED, GENERATING, CLASSIFICATION_READY, RESULT_READY, OVERRIDE_ACTIVE, COMPLETE, ERROR)
   - `selectedMedium` (string)
   - `prompt` (string)
   - `classification` (object)
   - `result` (object)
   - `latency` (number)
   - `overrideCost` (number)
   - `error` (object)

2. Implement setter methods:

   - `setState(newState)` — validates state transition
   - `setClassification(classObj)` — store classification response
   - `setResult(resultObj)` — store generation/override result
   - `setLatency(ms)` — store latency
   - `setError(errorObj)` — store error
   - `reset()` — clear all state

3. Add state machine validation (prevent invalid transitions)

4. Export as singleton store

**Code Length**: ~100 lines  
**Success Criteria**:

- ✅ All 8 states defined
- ✅ All setter methods work
- ✅ Invalid transitions rejected
- ✅ Store is reactive (Svelte $)

**Testing** (while implementing):

- Unit test file: `client/src/lib/stores/flowStore.test.js`
- Test cases: state transitions, setters, reset, invalid transitions
- Target: 8+ tests passing

---

### **Task 1.2: Create API Client Wrapper (Phase 1)** (1 hour)

**Objective**: Implement 3 API functions with validation + error handling

**Deliverable**: `client/src/lib/api.js` (Phase 1 — partial)

**Implementation Steps**:

1. **Setup**:

   - Import config (timeouts, API_BASE_URL)
   - Create helper function for fetch with timeout
   - Create error normalizer function

2. **classify() function**:

   ```typescript
   export async function classify(prompt: string, selectedMedium: string) {
     // Validate: prompt >= 10 chars, selectedMedium valid
     // POST /api/classify with timeout
     // Return: { id, medium, confidence, style, themes, ... } OR throw error
   }
   ```

3. **generate() function (stub)**:

   ```typescript
   export async function generate(prompt, medium, classification) {
     // Will complete in Bundle 2
   }
   ```

4. **applyOverride() function (stub)**:

   ```typescript
   export async function applyOverride(
     generationId,
     classification,
     overrides
   ) {
     // Will complete in Bundle 2
   }
   ```

5. **Error handling**:

   - Normalize error responses: `{ status, message, retryable }`
   - Handle 400, 408, 422, 500 errors specifically
   - Add retry-ability flag

6. **Timeout handling**:
   - Use AbortController for cancellation
   - Read timeouts from CONFIG
   - Throw TimeoutError if exceeded

**Code Length**: ~80 lines (Phase 1)  
**Success Criteria**:

- ✅ classify() validates + calls backend
- ✅ Timeout handling works
- ✅ Errors normalized
- ✅ Response schema matches spec

**Testing** (while implementing):

- Unit test file: `client/src/lib/api.test.js`
- Test: classify() success, validation error, timeout
- Target: 3+ tests passing

---

### **Bundle 1 Review Checklist** (10 mins before break)

- [ ] StateManager store compiles without errors
- [ ] All setter methods work
- [ ] Store imports successfully in component
- [ ] API client wrapper validates input
- [ ] classify() function calls backend (test with curl first)
- [ ] Error handling normalizes responses correctly
- [ ] Unit tests for both: 8+ passing

**If not complete**: Mark as in-progress, continue in Bundle 2 start

---

### **Break 1: 15 minutes** (11:00 - 11:15)

- Quick code review of Bundle 1
- Fix any compilation errors
- Update test results
- Prepare Bundle 2 requirements

---

## **BUNDLE 2: API Completion + Orchestrator Setup** (2 hours)

**Time**: 11:15 - 13:15  
**Owner**: Frontend Lead + 1 Senior FE Engineer  
**Focus**: Complete API wrapper + start GenerateFlow

### **Task 2.1: Complete API Client Wrapper** (0.75 hours)

**Objective**: Finish generate() + applyOverride() functions

**Building on Bundle 1**: `client/src/lib/api.js`

**Implementation Steps**:

1. **generate() function**:

   ```typescript
   export async function generate(prompt, medium, classification) {
     // Validate: prompt, medium, classification.id present
     // POST /api/generate with { prompt, medium, classification }
     // Return: { id, pdfUrl, pageCount, latency, costEstimate, ... }
   }
   ```

2. **applyOverride() function**:

   ```typescript
   export async function applyOverride(
     generationId,
     classification,
     overrides
   ) {
     // Validate: generationId, classification, overrides not empty
     // POST /api/override with { generationId, classification, overrides }
     // Return: { id, pdfUrl, costMultiplier, costBreakdown, ... }
   }
   ```

3. **Add retry logic** (optional, can be in GenerateFlow):
   - Exponential backoff: 1s, 2s, 4s, 8s
   - Track retry attempts
   - Give up after 4 attempts

**Code Addition**: ~50 lines  
**Success Criteria**:

- ✅ All 3 functions complete
- ✅ Validation works for each
- ✅ Timeout/error handling consistent
- ✅ Response schemas match spec

**Testing**:

- Add tests for generate() + applyOverride()
- Test error scenarios (400, 408, 422, 500)
- Target: 10+ total tests passing

---

### **Task 2.2: Create GenerateFlow Orchestrator (Phase 1)** (1.25 hours)

**Objective**: Main component handling state transitions + API calls

**Deliverable**: `client/src/components/GenerateFlow.svelte` (Phase 1 — foundation)

**Implementation Steps**:

1. **Setup**:

   - Import flowStore
   - Import API functions (classify, generate, applyOverride)
   - Import child components (will add later)
   - Setup error handling

2. **Define handler methods**:

   ```typescript
   async function handleGenerateClick() {
     // 1. Transition to GENERATING
     // 2. Call classify(prompt, selectedMedium)
     // 3. If error: setError(), stay in MEDIUM_SELECTED
     // 4. If confidence > 0.85: auto-call handleAcceptClassification()
     // 5. Else: transition to CLASSIFICATION_READY
   }

   async function handleAcceptClassification() {
     // 1. Transition to GENERATING
     // 2. Call generate(prompt, medium, classification)
     // 3. If error: setError(), go back to CLASSIFICATION_READY
     // 4. If success: setResult(), transition to RESULT_READY
   }

   async function handleApplyOverride(overrides) {
     // Will complete in Bundle 3
   }

   function transition(newState) {
     // Validate state transition in flowStore
   }

   function reset() {
     // Call flowStore.reset()
   }
   ```

3. **Template skeleton** (no child components yet):

   ```svelte
   <div class="generate-flow">
     {#if $flowStore.state === 'INITIAL'}
       <p>Select a medium to start</p>
     {:else if $flowStore.state === 'MEDIUM_SELECTED'}
       <!-- PromptInput component (add in Bundle 4) -->
     {:else if $flowStore.state === 'GENERATING'}
       <!-- LoadingSpinner component -->
     {:else if $flowStore.state === 'CLASSIFICATION_READY'}
       <!-- ClassificationFeedback component (add in Bundle 5) -->
     {:else if $flowStore.state === 'RESULT_READY'}
       <!-- ResultsDisplay component (add in Bundle 5) -->
     {:else if $flowStore.state === 'ERROR'}
       <!-- Error display -->
     {/if}
   </div>
   ```

4. **Error display**:
   - Show $flowStore.error.message if present
   - Add "Retry" button when retryable
   - Handle different error codes differently

**Code Length**: ~150 lines (Phase 1)  
**Success Criteria**:

- ✅ All handlers defined
- ✅ State transitions work
- ✅ API calls triggered correctly
- ✅ Error handling in place
- ✅ Component compiles without child components

**Testing**:

- Unit test file: `client/src/components/GenerateFlow.test.js`
- Test: state transitions, API calls, error handling
- Target: 6+ tests passing (more in Bundle 3)

---

### **Bundle 2 Review Checklist** (10 mins before break)

- [ ] All 3 API functions complete + tested
- [ ] API client tests: 10+ passing
- [ ] GenerateFlow compiles without children
- [ ] handleGenerateClick() logic correct
- [ ] handleAcceptClassification() logic correct
- [ ] State transitions validated
- [ ] Error display working
- [ ] GenerateFlow tests: 6+ passing

---

### **Break 2: 15 minutes** (13:15 - 13:30)

- Quick code review
- Test all API functions against real /api/classify
- Fix any issues before lunch

---

## **LUNCH BREAK: 30 minutes** (13:30 - 14:00)

---

## **BUNDLE 3: GenerateFlow Completion + Mock API** (2 hours)

**Time**: 14:00 - 16:00  
**Owner**: Frontend Lead + 1 Senior FE Engineer  
**Focus**: Finish orchestrator + create mocks for testing

### **Task 3.1: Complete GenerateFlow Orchestrator** (0.75 hours)

**Objective**: Finish handleApplyOverride() + add missing methods

**Building on Bundle 2**: `client/src/components/GenerateFlow.svelte`

**Implementation Steps**:

1. **handleApplyOverride() method**:

   ```typescript
   async function handleApplyOverride(overrides) {
     // 1. Transition to GENERATING
     // 2. Call applyOverride(generationId, classification, overrides)
     // 3. If error (422): setError(), stay in OVERRIDE_ACTIVE
     // 4. If error (other): setError(), go back to RESULT_READY
     // 5. If success: setResult(), transition to RESULT_READY
   }
   ```

2. **Add reset() functionality**:

   - Button: "New Prompt"
   - Clears all state via flowStore.reset()
   - Transitions back to INITIAL

3. **Add export functionality** (UI only, no API):

   - Trigger browser download of $flowStore.result.pdfUrl
   - Add "Download PDF" button in RESULT_READY state

4. **Complete template**:
   - Add state checking for OVERRIDE_ACTIVE
   - Placeholder for OverrideControls (add in Bundle 5)

**Code Addition**: ~40 lines  
**Success Criteria**:

- ✅ handleApplyOverride() works end-to-end
- ✅ Reset clears all state
- ✅ PDF download triggered
- ✅ All 8 states handled in template

**Testing**:

- Add tests for handleApplyOverride()
- Test error scenarios (422, 500)
- Test reset() clears state
- Target: 10+ total GenerateFlow tests passing

---

### **Task 3.2: Create Mock API Responses** (1.25 hours)

**Objective**: Mock all 3 endpoints for frontend development/testing

**Deliverable**: `client/src/lib/mockApi.js`

**Implementation Steps**:

1. **Setup**:

   - Create toggle: `ENABLE_MOCK_API = true/false`
   - Create response delay (configurable, default 500ms)
   - Create error injection capability

2. **mockClassify() function**:

   ```typescript
   export async function mockClassify(prompt, selectedMedium) {
     // Simulate delay
     // Return valid classification object
     // Vary confidence (sometimes > 0.85, sometimes < 0.85)
     // Optional: Inject 400, 408, 500 errors based on prompt content
   }
   ```

3. **mockGenerate() function**:

   ```typescript
   export async function mockGenerate(prompt, medium, classification) {
     // Simulate delay (longer than classify)
     // Return valid generation object with fake pdfUrl
     // Generate unique UUID for each call
     // Optional: Inject errors
   }
   ```

4. **mockApplyOverride() function**:

   ```typescript
   export async function mockApplyOverride(
     generationId,
     classification,
     overrides
   ) {
     // Simulate delay (shorter than generate)
     // Return valid override response
     // Calculate cost multiplier based on overrides
     // Optional: Inject errors
   }
   ```

5. **Error injection helpers**:

   - Based on prompt keywords or config
   - Support: 400, 408, 422, 500
   - With realistic error messages

6. **Response data generators**:
   - Generate realistic IDs (UUID v4)
   - Generate fake pdfUrl (`/tmp-exports/{uuid}.pdf`)
   - Vary pageCount (10-50)
   - Vary latency (1000-15000ms)

**Code Length**: ~200 lines  
**Success Criteria**:

- ✅ All 3 mock functions work
- ✅ Responses match API spec exactly
- ✅ Error injection works
- ✅ Can toggle between real + mock API
- ✅ Realistic timing (simulates actual network)

**Usage Example**:

```typescript
// In GenerateFlow.svelte or api.js
import { mockClassify } from "$lib/mockApi.js";

if (ENABLE_MOCK_API) {
  const result = await mockClassify(prompt, selectedMedium);
} else {
  const result = await classify(prompt, selectedMedium);
}
```

**Testing**:

- Create mock API test file: `client/src/lib/mockApi.test.js`
- Test: all success paths, error injection
- Target: 8+ tests passing

---

### **Task 3.3: Zero Regression Check (Partial)** (0 hours — will complete in Bundle 6)

**Objective**: Begin running existing frontend tests

**Steps**:

```bash
npm --prefix client run test -- --listTests
```

- Identify all existing test files
- Count total: target is 457+ tests

---

### **Bundle 3 Review Checklist** (10 mins before break)

- [ ] handleApplyOverride() complete + tested
- [ ] Reset functionality works
- [ ] PDF download triggers
- [ ] All 8 states in template
- [ ] GenerateFlow tests: 10+ passing
- [ ] mockApi.js compiles
- [ ] All 3 mock functions return correct schema
- [ ] Error injection works
- [ ] Mock API tests: 8+ passing
- [ ] Can toggle real/mock API

---

### **Break 3: 15 minutes** (16:00 - 16:15)

- Code review
- Test all mock functions
- Verify GenerateFlow works with both real + mock APIs
- Prepare Bundle 4 components

---

## **BUNDLE 4: UI Components Phase 1** (2 hours)

**Time**: 16:15 - 18:15  
**Owner**: Frontend Lead + 1 Senior FE Engineer (different engineer if possible)  
**Focus**: Two input components

### **Task 4.1: Create MediaSelector Component** (0.75 hours)

**Objective**: Component for selecting medium (ebook, calendar, etc.)

**Deliverable**: `client/src/components/MediaSelector.svelte`

**Implementation Steps**:

1. **Component structure**:

   ```svelte
   <script>
     import { flowStore } from '$lib/stores/flowStore.js';

     export let selectedMedium = '';
     export let isLoading = false;

     function handleMediaSelect(medium) {
       flowStore.setState('MEDIUM_SELECTED');
       // Emit event or set store
     }
   </script>

   <div class="media-selector">
     <!-- 6 buttons: ebook, calendar, poster, stickers, card, demo -->
   </div>
   ```

2. **UI Elements**:

   - 6 medium buttons (emoji + label):
     - 📖 eBook
     - 📅 Calendar
     - 📰 Poster
     - 🎫 Stickers
     - 💳 Card
     - 🎮 Demo
   - Visual feedback: selected button highlighted
   - Disabled while isLoading=true

3. **Logic**:

   - Track selected medium in store
   - Emit selection event (if parent needs it)
   - Disable all buttons while generating

4. **Styling**:
   - Grid layout (2-3 columns)
   - Accessible: keyboard navigation, ARIA labels
   - Responsive: stack on mobile

**Code Length**: ~80 lines  
**Success Criteria**:

- ✅ All 6 medium buttons present
- ✅ Selection updates store
- ✅ Visual feedback on selection
- ✅ Disabled while loading
- ✅ Accessible (keyboard + screen reader)

**Testing**:

- Unit test: `client/src/components/MediaSelector.test.js`
- Test: button clicks, selection updates, disabled state
- Target: 4+ tests passing

---

### **Task 4.2: Create PromptInput Component** (1.25 hours)

**Objective**: Component for user to enter prompt + trigger generation

**Deliverable**: `client/src/components/PromptInput.svelte`

**Implementation Steps**:

1. **Component structure**:

   ```svelte
   <script>
     import { flowStore } from '$lib/stores/flowStore.js';
     export let selectedMedium = '';
     export let isLoading = false;

     let prompt = '';

     function handleGenerate() {
       if (prompt.length < 10) {
         // Show validation error
         return;
       }
       // Store prompt
       // Emit generate event or call GenerateFlow method
     }
   </script>

   <div class="prompt-input">
     <!-- Textarea + Generate button -->
   </div>
   ```

2. **UI Elements**:

   - Textarea: placeholder "Enter your creative prompt (min 10 characters)"
   - Validation message: show when prompt < 10 chars
   - Character counter: show current count / 10 min
   - "Generate →" button (disabled if < 10 chars or isLoading)
   - Loading spinner in button while generating

3. **Validation**:

   - Min 10 characters (enforced by business logic)
   - Show error message if < 10 chars
   - Enable button only if >= 10 chars

4. **Events**:

   - On "Generate" click:
     - Store prompt in flowStore
     - Validate selectedMedium present
     - Emit 'generate' event or call handler
     - Update button to show loading state

5. **Styling**:
   - Full-width textarea
   - Focus states (border, shadow)
   - Error message styling (red text)
   - Button styling (accent color, disabled state)

**Code Length**: ~120 lines  
**Success Criteria**:

- ✅ Textarea accepts input
- ✅ Character counter works
- ✅ Validation enforced (>= 10 chars)
- ✅ Generate button disabled when < 10 chars
- ✅ isLoading disables button + shows spinner
- ✅ Events emitted correctly
- ✅ Accessible (labels, ARIA)

**Testing**:

- Unit test: `client/src/components/PromptInput.test.js`
- Test: input validation, button states, events, loading
- Target: 4+ tests passing

---

### **Bundle 4 Review Checklist** (10 mins before break)

- [ ] MediaSelector compiles + renders
- [ ] MediaSelector: all 6 buttons present
- [ ] MediaSelector: selection updates store
- [ ] MediaSelector: disabled while loading
- [ ] MediaSelector tests: 4+ passing
- [ ] PromptInput compiles + renders
- [ ] PromptInput: validation works
- [ ] PromptInput: character counter updates
- [ ] PromptInput: button disabled when < 10 chars
- [ ] PromptInput: generate event emitted
- [ ] PromptInput tests: 4+ passing

---

### **Break 4: 15 minutes** (18:15 - 18:30)

- Code review
- Test components in isolation
- Verify store integration works
- Prepare Bundle 5

---

## **BUNDLE 5: UI Components Phase 2** (2 hours)

**Time**: 18:30 - 20:30  
**Owner**: Frontend Lead + 1 Senior FE Engineer  
**Focus**: Feedback + Results display components

### **Task 5.1: Create ClassificationFeedback Component** (1 hour)

**Objective**: Display classification result + accept/override buttons

**Deliverable**: `client/src/components/ClassificationFeedback.svelte`

**Implementation Steps**:

1. **Component structure**:

   ```svelte
   <script>
     export let classification = {};

     const confidence_percent = Math.round(classification.confidence * 100);
     const source_label = {
       'rules': '📏 Rules',
       'ai': '🤖 AI',
       'hybrid': '⚖️ Hybrid'
     }[classification.source];
   </script>

   <div class="classification-feedback">
     <!-- Display data + buttons -->
   </div>
   ```

2. **Display sections**:

   - **Header**: "Classification Result"
   - **Confidence badge**: Show as % (e.g., "92% Confident")
   - **Source badge**: "Rules" / "AI" / "Hybrid"
   - **Details grid**:
     - Medium: {classification.medium}
     - Style: {classification.style}
     - Themes: {classification.themes.join(', ')}
     - Audience: {classification.audience}
     - Genre: {classification.genre}
     - Tone: {classification.tone}

3. **Buttons**:

   - "✓ Accept & Generate" (primary)
   - "✏️ Change Selections" (secondary)

4. **Logic**:

   - Emit 'accept' event on Accept button
   - Emit 'override' event on Override button
   - Display high-confidence indicator (if > 0.85)

5. **Styling**:
   - Card-based layout
   - Color-coded badges (confidence: green > 85%, yellow < 85%)
   - Grid for details
   - Button group at bottom

**Code Length**: ~100 lines  
**Success Criteria**:

- ✅ All classification data displayed
- ✅ Confidence shown as percentage
- ✅ Source badge displayed
- ✅ Details grid formatted well
- ✅ Accept/Override buttons functional
- ✅ Events emitted correctly
- ✅ Responsive layout

**Testing**:

- Unit test: `client/src/components/ClassificationFeedback.test.js`
- Test: data display, button events, edge cases (high/low confidence)
- Target: 4+ tests passing

---

### **Task 5.2: Create ResultsDisplay + StatsPanel** (1 hour)

**Objective**: Display generated PDF + statistics

**Deliverable**:

- `client/src/components/ResultsDisplay.svelte`
- `client/src/components/StatsPanel.svelte`

#### **ResultsDisplay.svelte**:

**Implementation Steps**:

1. **Component structure**:

   - PDF preview area (iframe or image)
   - File info (page count, medium, style)
   - Action buttons

2. **Display**:

   - PDF iframe: `<iframe src={result.pdfUrl}></iframe>`
   - Page count: "📄 {result.pageCount} pages"
   - Medium: "📖 {result.medium}"
   - Style: "🎨 {result.style}"

3. **Buttons**:

   - "✏️ Customize Style" (secondary)
   - "📋 New Prompt" (secondary)
   - "⬇️ Download PDF" (primary)

4. **Logic**:
   - Emit 'customize', 'newPrompt', 'export' events
   - Download PDF on export button click

**Code Length**: ~80 lines

#### **StatsPanel.svelte**:

**Implementation Steps**:

1. **Component structure**:

   - Stats displayed as key-value pairs or grid

2. **Stats to display**:

   - Latency: {Math.round(latency / 1000)}s
   - Model: {result.metadata.model}
   - Confidence: {Math.round(classification.confidence \* 100)}%
   - Source: {classification.source}
   - Images: {result.metadata.imageCount}
   - Cost: ${result.costEstimate.toFixed(2)}

3. **Styling**:
   - Horizontal or vertical layout
   - Right-aligned numbers
   - Muted text color

**Code Length**: ~60 lines

**Testing**:

- Unit test: `client/src/components/ResultsDisplay.test.js`
- Unit test: `client/src/components/StatsPanel.test.js`
- Test: data formatting, button events, PDF display
- Target: 4+ tests each

---

### **Bundle 5 Review Checklist** (10 mins before break)

- [ ] ClassificationFeedback compiles + renders
- [ ] ClassificationFeedback: all data displayed
- [ ] ClassificationFeedback: confidence as %
- [ ] ClassificationFeedback: source badge shown
- [ ] ClassificationFeedback: buttons emit events
- [ ] ClassificationFeedback tests: 4+ passing
- [ ] ResultsDisplay compiles + renders
- [ ] ResultsDisplay: PDF displayed
- [ ] ResultsDisplay: buttons emit events
- [ ] ResultsDisplay: PDF download works
- [ ] ResultsDisplay tests: 4+ passing
- [ ] StatsPanel displays all stats correctly
- [ ] StatsPanel: latency formatted (ms → seconds)
- [ ] StatsPanel: cost formatted ($)
- [ ] StatsPanel tests: 4+ passing

---

### **Break 5: 15 minutes** (20:30 - 20:45)

- Code review
- Test all UI components in isolation
- Test with mock data
- Prepare Bundle 6

---

## **BUNDLE 6: Component Wiring + Final Testing** (2 hours)

**Time**: 20:45 - 22:45  
**Owner**: Frontend Lead + 1 Senior FE Engineer  
**Focus**: Wire all components + comprehensive testing

### **Task 6.1: Wire All Components to GenerateFlow** (0.5 hours)

**Objective**: Connect all UI components + orchestrate data flow

**Building on**: `client/src/components/GenerateFlow.svelte`

**Implementation Steps**:

1. **Complete template** with all child components:

   ```svelte
   <div class="generate-flow">
     {#if $flowStore.state === 'INITIAL'}
       <!-- Welcome screen -->
     {:else if $flowStore.state === 'MEDIUM_SELECTED'}
       <MediaSelector />
       <PromptInput on:generate={handleGenerateClick} />
     {:else if $flowStore.state === 'GENERATING'}
       <LoadingSpinner />
     {:else if $flowStore.state === 'CLASSIFICATION_READY'}
       <ClassificationFeedback
         classification={$flowStore.classification}
         on:accept={handleAcceptClassification}
         on:override={() => transition('OVERRIDE_ACTIVE')}
       />
     {:else if $flowStore.state === 'RESULT_READY'}
       <ResultsDisplay
         result={$flowStore.result}
         on:customize={() => transition('OVERRIDE_ACTIVE')}
         on:newPrompt={reset}
         on:export={handleExport}
       />
       <StatsPanel latency={$flowStore.latency} result={$flowStore.result} />
     {:else if $flowStore.state === 'OVERRIDE_ACTIVE'}
       <OverrideControls
         classification={$flowStore.classification}
         result={$flowStore.result}
         on:apply={handleApplyOverride}
       />
       <CostVisualization costMultiplier={$flowStore.overrideCost} />
     {:else if $flowStore.state === 'ERROR'}
       <ErrorPanel error={$flowStore.error} on:retry={() => handleGenerateClick()} />
     {/if}
   </div>
   ```

2. **Props passing**:

   - Pass store values to child components
   - Wire emit events to handler methods
   - Ensure two-way binding for store updates

3. **Complete handlers**:
   - Add handleExport() for PDF download
   - Add handleMediaSelect() to set selectedMedium in store

**Code Addition**: ~40 lines

---

### **Task 6.2: Create OverrideControls + CostVisualization** (0.75 hours)

**Objective**: Override UI components (brief implementation since Phase 3)

**Deliverable**:

- `client/src/components/OverrideControls.svelte`
- `client/src/components/CostVisualization.svelte`

#### **OverrideControls.svelte** (simplified for now):

**Implementation Steps**:

1. Dropdowns for: style, tone, theme
2. Show current values from classification
3. "Apply Override" button
4. Emit 'apply' event with selected values

**Code Length**: ~100 lines

#### **CostVisualization.svelte**:

**Implementation Steps**:

1. Display cost multiplier as % (0.05 → 5%)
2. Show breakdown: which dimensions triggered cost
3. Show latency estimate

**Code Length**: ~60 lines

**Testing**:

- Basic unit tests: 4+ each

---

### **Task 6.3: Comprehensive Frontend Testing** (0.75 hours)

**Objective**: Run all tests + verify zero regressions

**Implementation Steps**:

1. **Run full test suite**:

   ```bash
   npm --prefix client run test:run
   ```

2. **Capture results**:

   - Existing tests: 457+/457+ passing
   - New Phase 1 tests: ~30 passing
   - New Phase 2 tests: ~40 passing
   - Total: ~527 tests

3. **Check for regressions**:

   - Compare with baseline (457)
   - Ensure zero regressions
   - All new tests passing

4. **End-to-end flow test** (with mock API):

   ```
   ✅ Start in INITIAL
   ✅ Click medium → MEDIUM_SELECTED
   ✅ Enter prompt + click Generate → GENERATING
   ✅ Wait for /api/classify → CLASSIFICATION_READY or auto-advance
   ✅ Click Accept → GENERATING → RESULT_READY
   ✅ Verify PDF displayed + stats shown
   ✅ Click Customize → OVERRIDE_ACTIVE
   ✅ Click Apply Override → GENERATING → RESULT_READY
   ✅ Click Download → PDF download triggered
   ✅ Click New Prompt → INITIAL
   ```

5. **Test against real backend**:
   - Switch ENABLE_MOCK_API to false
   - Run E2E flow with actual /api/classify + /api/generate
   - Verify all endpoints working

---

### **Task 6.4: Code Cleanup + Documentation** (0.25 hours)

**Objective**: Polish code + add comments

**Implementation Steps**:

1. **Add JSDoc comments** to all functions
2. **Remove debug console.log statements**
3. **Fix any linting issues**:

   ```bash
   npm --prefix client run lint -- --fix
   ```

4. **Create README** for Phase 1 + 2 components:
   - List all components
   - Document component props + events
   - Document store interface
   - Document API client functions

---

### **Bundle 6 Final Checklist** (10 mins before wrap)

- [ ] All components wired to GenerateFlow
- [ ] Props passing correctly
- [ ] Events emitted correctly
- [ ] OverrideControls + CostVisualization complete
- [ ] Full test suite runs: 527+ tests passing
- [ ] Zero regressions detected
- [ ] All new tests passing (70+ tests)
- [ ] E2E flow works with mock API
- [ ] E2E flow works with real backend
- [ ] Code linting passes
- [ ] JSDoc comments added
- [ ] README created

---

## **Summary: What's Complete After Bundle 6**

### **Frontend Phase 1 (Infrastructure)** ✅

1. ✅ StateManager store (8 states, all transitions)
2. ✅ API client wrapper (all 3 endpoints)
3. ✅ GenerateFlow orchestrator (all handlers)
4. ✅ Mock API (all 3 endpoints, error injection)

### **Frontend Phase 2 (UI Components)** ✅

1. ✅ MediaSelector (6 medium buttons)
2. ✅ PromptInput (validation, counter)
3. ✅ ClassificationFeedback (display + buttons)
4. ✅ ResultsDisplay (PDF preview + stats)
5. ✅ StatsPanel (latency, model, cost)
6. ✅ OverrideControls (dropdowns)
7. ✅ CostVisualization (breakdown)

### **Test Results** ✅

- ✅ Existing frontend tests: 457/457 passing (zero regressions)
- ✅ New Phase 1 tests: 30+ passing
- ✅ New Phase 2 tests: 40+ passing
- ✅ Total: 527+ tests passing
- ✅ E2E flow works end-to-end

### **Ready for Checkpoint 2** ✅

- ✅ All frontend components complete
- ✅ All API integrations working
- ✅ Zero regressions
- ✅ Ready for integration testing (QA)

---

## **Timeline at a Glance**

```
09:00 - 11:00  | Bundle 1: StateManager + API wrapper foundation
               | Break (15 min)
11:15 - 13:15  | Bundle 2: Complete API + GenerateFlow setup
               | Break (15 min)
13:30 - 14:00  | LUNCH BREAK (30 min)
14:00 - 16:00  | Bundle 3: Complete GenerateFlow + Mock API
               | Break (15 min)
16:15 - 18:15  | Bundle 4: MediaSelector + PromptInput
               | Break (15 min)
18:30 - 20:30  | Bundle 5: ClassificationFeedback + Results display
               | Break (15 min)
20:45 - 22:45  | Bundle 6: Wiring + Final testing

TOTAL: 11 hours development + 2.5 hours breaks = 13.5 hours
```

---

## **Risk Mitigation**

**If Backend APIs Not Available**:

- Use mock API (toggle in config)
- Switch to real API once backend ready
- No code changes needed

**If Tests Fail**:

- Debug immediately in same bundle
- Use mock API to isolate frontend issues
- Document issues for Checkpoint 1 review

**If Behind Schedule**:

- Skip Phase 2 components temporarily
- Prioritize: StateManager → API → GenerateFlow
- Phase 2 components can be added after Checkpoint 2

---

**Status**: 🟢 **READY TO EXECUTE**

**Next Step**: Start Bundle 1 at 09:00

---

**END OF FRONTEND IMPLEMENTATION SCHEDULE**
