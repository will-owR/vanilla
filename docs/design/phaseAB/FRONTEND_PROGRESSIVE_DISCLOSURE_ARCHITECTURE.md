````markdown
# Frontend Progressive Disclosure Architecture (Option C)

**Strategic UI/UX Design for Phase A-B User Validation**

**Date**: November 17, 2025  
**Status**: 🟢 **DRAFT**  
**Branch**: `aetherV0/anew-default-demo`  
**Scope**: Permanent redesign of App.svelte to showcase Phase A-B functionality through progressive revelation of UI components

---

## **1. Executive Summary**

### **Problem**

Phase A-B architecture is complete (10 modules, 457 tests passing), but **users cannot interact with it**. The frontend doesn't expose:

- Medium selection (classify → route decision)
- Classification feedback (confidence, source, metadata)
- Override system (cost model, style customization)
- E2E validation (classify → generate → override → export)

### **Solution: Progressive Disclosure**

Replace existing demo mode with a **state-based workflow** that reveals UI elements as the user progresses through the system:

```
INITIAL
  ↓ (reveal: MediaSelector)
  User chooses medium (ebook, calendar, poster, etc.)
  ↓ (reveal: PromptInput)
  User enters prompt and clicks Generate
  ↓ (show: Loading spinner)
  Backend: classify → route → generate
  ↓ (reveal: ClassificationFeedback)
  User sees: medium, confidence, source, metadata
  User action: Accept or Override
  ↓ (reveal: ResultsDisplay with PDF preview)
  User sees: generated PDF
  ↓ (reveal: OverrideControls, collapsed)
  User can click "Customize" to apply style/color/medium overrides
  ↓ (final: Export button)
  User downloads PDF or starts new prompt
```

### **Why This Approach**

- ✅ **Non-overwhelming**: Single focus at each step
- ✅ **Educational**: Teaches system architecture (classify → route → render → customize)
- ✅ **Verifiable**: User sees each Phase A-B component working
- ✅ **Mobile-friendly**: Works on all screen sizes
- ✅ **Permanent**: No legacy code, clean forward-looking design
- ✅ **Scalable**: Extensible to Phase B services (calendar, poster, etc.)

---

## **2. Architecture Overview**

### **2.1 Component Hierarchy**

```
App.svelte (root)
├─ Header.svelte
│  └─ Health status, mode switcher
├─ GenerateFlow.svelte (state machine)
│  ├─ State: INITIAL, MEDIUM_SELECTED, PROMPT_ENTERED, GENERATING,
│  │         CLASSIFICATION_READY, RESULT_READY, OVERRIDE_ACTIVE, COMPLETE
│  │
│  ├─ Conditional Rendering (based on state):
│  │
│  ├─ [State: INITIAL]
│  │  └─ MediaSelector.svelte
│  │     └─ user clicks medium → transition to MEDIUM_SELECTED
│  │
│  ├─ [State: MEDIUM_SELECTED]
│  │  ├─ PromptInput.svelte
│  │  │  └─ user clicks Generate → transition to GENERATING
│  │  └─ MediaIndicator.svelte (show selected medium)
│  │
│  ├─ [State: GENERATING]
│  │  └─ LoadingSpinner.svelte
│  │
│  ├─ [State: CLASSIFICATION_READY]
│  │  ├─ ClassificationFeedback.svelte
│  │  │  ├─ show classification metadata
│  │  │  ├─ [Accept] → transition to RESULT_READY
│  │  │  └─ [Override] → transition to OVERRIDE_ACTIVE
│  │  └─ MediaIndicator.svelte
│  │
│  ├─ [State: RESULT_READY]
│  │  ├─ ResultsDisplay.svelte
│  │  │  ├─ PDF preview (iframe or PDF.js)
│  │  │  ├─ [Customize] button → transition to OVERRIDE_ACTIVE
│  │  │  └─ [Export] button
│  │  ├─ StatsPanel.svelte
│  │  │  └─ latency, cost, model info
│  │  └─ ActionButtons.svelte
│  │     ├─ [Export PDF]
│  │     ├─ [Share]
│  │     └─ [New Prompt] → reset to INITIAL
│  │
│  ├─ [State: OVERRIDE_ACTIVE]
│  │  ├─ ResultsDisplay.svelte
│  │  ├─ OverrideControls.svelte (expanded)
│  │  │  ├─ Change Medium (100% cost)
│  │  │  ├─ Change Style (40% cost)
│  │  │  ├─ Change Color (5% cost)
│  │  │  └─ [Apply Override] → transition to GENERATING → RESULT_READY
│  │  └─ CostVisualization.svelte
│  │
│  └─ [State: COMPLETE]
│     └─ SuccessPanel.svelte with [Export] / [New] options
│
└─ Footer.svelte
   └─ Links, status, debug info (DEV only)
```

### **2.2 State Machine Definition**

```typescript
type FlowState =
  | "INITIAL" // Start: show MediaSelector
  | "MEDIUM_SELECTED" // User chose medium: show PromptInput
  | "PROMPT_ENTERED" // User typed prompt: ready to generate
  | "GENERATING" // API call in progress: show spinner
  | "CLASSIFICATION_READY" // Got classification: show feedback
  | "RESULT_READY" // Got PDF: show preview + override option
  | "OVERRIDE_ACTIVE" // User wants to customize: show controls
  | "COMPLETE"; // Ready to export/share

interface FlowContext {
  state: FlowState;
  selectedMedium: string | null;
  prompt: string;
  classification: Classification | null;
  result: GenerationResult | null;
  error: string | null;
  isLoading: boolean;

  // Metadata for display
  latency: number;
  costMultiplier: number;
  attemptCount: number;
}

// State transitions
interface Transition {
  from: FlowState;
  to: FlowState;
  trigger: (context: FlowContext) => void;
  condition?: (context: FlowContext) => boolean;
}

const transitions: Transition[] = [
  { from: "INITIAL", to: "MEDIUM_SELECTED", trigger: (ctx) => {} },
  { from: "MEDIUM_SELECTED", to: "PROMPT_ENTERED", trigger: (ctx) => {} },
  {
    from: "PROMPT_ENTERED",
    to: "GENERATING",
    trigger: (ctx) => generateContent(ctx),
  },
  { from: "GENERATING", to: "CLASSIFICATION_READY", trigger: (ctx) => {} },
  { from: "CLASSIFICATION_READY", to: "RESULT_READY", trigger: (ctx) => {} },
  { from: "CLASSIFICATION_READY", to: "OVERRIDE_ACTIVE", trigger: (ctx) => {} },
  { from: "RESULT_READY", to: "OVERRIDE_ACTIVE", trigger: (ctx) => {} },
  {
    from: "OVERRIDE_ACTIVE",
    to: "GENERATING",
    trigger: (ctx) => applyOverride(ctx),
  },
  { from: "RESULT_READY", to: "COMPLETE", trigger: (ctx) => {} },
  { from: "COMPLETE", to: "INITIAL", trigger: (ctx) => reset(ctx) },
];
```

---

## **3. Visual Flow Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                         App Header                          │
│                  (Health, Title, Settings)                  │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                      GenerateFlow                           │
│  (State Machine Container)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  {#if state === 'INITIAL'}                                 │
│  ┌────────────────────────────────────────────────┐        │
│  │                                                │        │
│  │  📖 What would you like to create?            │        │
│  │                                                │        │
│  │  [📖 eBook] [📅 Calendar] [🖼️ Poster]         │        │
│  │  [✨ Stickers] [💌 Card] [📔 Journal]         │        │
│  │                                                │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  {#else if state === 'MEDIUM_SELECTED'}                    │
│  ┌────────────────────────────────────────────────┐        │
│  │  You selected: 📖 eBook                        │        │
│  │                                                │        │
│  │  Enter your creative prompt:                  │        │
│  │  [textarea]                                    │        │
│  │                                                │        │
│  │  [Generate →]                                 │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  {#else if state === 'GENERATING'}                         │
│  ┌────────────────────────────────────────────────┐        │
│  │  ⏳ Generating your eBook...                   │        │
│  │  [████████░░] 60%                             │        │
│  │  (Classifying → Routing → Rendering)         │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  {#else if state === 'CLASSIFICATION_READY'}              │
│  ┌────────────────────────────────────────────────┐        │
│  │  ✓ Classification Complete                    │        │
│  │  Medium: eBook                                │        │
│  │  Confidence: 92%                              │        │
│  │  Source: rule-based                           │        │
│  │  Style: minimalist                            │        │
│  │  Themes: [magical-realism, minimalist-zen]   │        │
│  │                                                │        │
│  │  [Accept] [Override]                         │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  {#else if state === 'RESULT_READY'}                       │
│  ┌─────────────────────┬──────────────────────────┐        │
│  │ PDF Preview        │ Stats:                   │        │
│  │ [Page 1]           │ • Latency: 8.2s          │        │
│  │ [Page 2]           │ • Model: demo-1          │        │
│  │ [Page 3]           │ • Confidence: 92%        │        │
│  │ [Page 4]           │ • Cost: $0.00            │        │
│  │ [Page 5]           │                          │        │
│  │                    │ [Customize Style]        │        │
│  │ {pagination}       │ [Export PDF] [Share]     │        │
│  │                    │ [Start Over]             │        │
│  └─────────────────────┴──────────────────────────┘        │
│                                                             │
│  {#else if state === 'OVERRIDE_ACTIVE'}                    │
│  ┌─────────────────────┬──────────────────────────┐        │
│  │ PDF Preview        │ Override Controls:       │        │
│  │ (re-rendering)     │ Change Style:            │        │
│  │                    │ [minimalist ▼]           │        │
│  │                    │ Change Color:            │        │
│  │                    │ [dark ▼]                 │        │
│  │                    │ Change Medium:           │        │
│  │                    │ [ebook ▼]                │        │
│  │                    │                          │        │
│  │                    │ Cost Impact: 40%         │        │
│  │                    │ [████░░░░░░]             │        │
│  │                    │                          │        │
│  │                    │ [✓ Apply] [↻ Reset]     │        │
│  │                    │ [Export] [Cancel]        │        │
│  └─────────────────────┴──────────────────────────┘        │
│                                                             │
│  {#else if state === 'COMPLETE'}                           │
│  ┌────────────────────────────────────────────────┐        │
│  │  ✓ Your eBook is ready!                       │        │
│  │                                                │        │
│  │  [Download PDF] [Share Link] [View History]  │        │
│  │  [Start New Prompt]                           │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  {/if}                                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                      App Footer                             │
│              (Status, Debug Info, Links)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## **4. Key Design Principles**

### **4.1 Progressive Disclosure**

- **Only show what's relevant for the current step**
- Hidden elements don't clutter the interface
- User focuses on one decision at a time

### **4.2 Visual Feedback**

- Each state transition includes visual confirmation
- Progress indicators (spinners, progress bars)
- Error messages show clearly (red panel)
- Success states use checkmarks and color coding

### **4.3 Accessibility**

- Clear labels and descriptions
- ARIA roles for screen readers
- Keyboard navigation (Tab, Enter, Escape)
- High contrast for readability

### **4.4 Mobile-First Responsive Design**

- Mobile: Vertical stacking, full-width elements
- Tablet: Two-column layout for preview + controls
- Desktop: Three-column layout (input, preview, metadata)

### **4.5 Transparency (Show the Architecture)**

- User sees classification metadata (medium, style, confidence, source)
- User understands cost model (5%, 40%, 100%)
- Latency metrics displayed (how fast was generation?)
- Model info visible (which service rendered this?)

---

## **5. Component Specifications**

### **5.1 GenerateFlow.svelte (Container, ~400 lines)**

**Responsibilities**:

- State machine logic (state transitions, validation)
- API orchestration (classify, generate, override)
- Error handling and recovery
- Event delegation to child components

**Key Props**:

```typescript
export let initialState = "INITIAL";
export let onComplete = (result) => {};
export let onError = (error) => {};
```

**Key Events**:

```typescript
// Event bus for state transitions
dispatch("state-change", { from, to, context });
dispatch("api-call", { endpoint, method, duration });
dispatch("error", { code, message });
```

---

### **5.2 MediaSelector.svelte (Reused from Module 6)**

**State**: INITIAL → MEDIUM_SELECTED  
**Emits**: `on:mediaSelected` → GenerateFlow updates selectedMedium

---

### **5.3 PromptInput.svelte (New, ~150 lines)**

**State**: MEDIUM_SELECTED → PROMPT_ENTERED → GENERATING

**Props**:

```typescript
export let selectedMedium = "ebook";
export let isLoading = false;
export let placeholder = "Enter your creative prompt...";
```

**Features**:

- Textarea with character counter
- "Generate" button (disabled until prompt > 10 chars)
- Quick-start prompt suggestions
- Disabled state during generation

---

### **5.4 LoadingSpinner.svelte (New, ~80 lines)**

**State**: GENERATING (show progress)

**Props**:

```typescript
export let progress = 0; // 0-100
export let message = "Generating your content...";
export let steps = [
  "Classifying prompt",
  "Routing to service",
  "Generating content",
  "Rendering PDF",
];
```

**Features**:

- Animated spinner
- Progress bar
- Step indicators
- Estimated time remaining

---

### **5.5 ClassificationFeedback.svelte (Reused from Module 10)**

**State**: CLASSIFICATION_READY (show & await feedback)

**Enhanced for this flow**:

- Auto-expands to full screen (not collapsed)
- More prominent confidence indicator
- Clear "Accept" vs "Override" buttons
- Shows all metadata (medium, style, theme, audience, genre, tone)

---

### **5.6 ResultsDisplay.svelte (New, ~300 lines)**

**State**: RESULT_READY (show PDF + metadata)

**Props**:

```typescript
export let pdfUrl = "";
export let classification = null;
export let latency = 0;
export let costMultiplier = 1.0;
export let pageCount = 5;
```

**Features**:

- PDF preview (iframe or PDF.js)
- Page pagination
- Stats panel (latency, model, confidence, cost)
- Fullscreen preview option
- [Customize] button (transition to OVERRIDE_ACTIVE)
- [Export] button
- [New Prompt] button

---

### **5.7 OverrideControls.svelte (Reused from Module 10)**

**State**: OVERRIDE_ACTIVE (show expanded controls)

**Enhanced for this flow**:

- Auto-expanded (not collapsed)
- Live preview updates (real-time re-rendering)
- Cost visualization (bar chart showing 5/40/100%)
- [Apply Override] button with progress indicator
- [Cancel] button returns to RESULT_READY

---

### **5.8 CostVisualization.svelte (New, ~120 lines)**

**State**: OVERRIDE_ACTIVE (show cost impact)

**Props**:

```typescript
export let costMultiplier = 1.0;
export let changedDimensions = []; // ['color', 'style', 'medium']
```

**Features**:

- Horizontal bar chart (0% → 100%)
- Color coding (green 5%, yellow 40%, red 100%)
- Breakdown by dimension
- Explanation text ("5% color change, 40% style change...")

---

### **5.9 StatsPanel.svelte (New, ~100 lines)**

**State**: RESULT_READY & OVERRIDE_ACTIVE (show metadata)

**Props**:

```typescript
export let latency = 0; // ms
export let model = "demo-1";
export let medium = "ebook";
export let confidence = 0.92;
export let source = "rules"; // or 'ai', 'hybrid'
export let pageCount = 5;
export let costEstimate = 0.0;
```

**Features**:

- Clean metric display
- Icons for each metric
- Tooltips on hover
- Copy-to-clipboard for technical details

---

### **5.10 ActionButtons.svelte (New, ~80 lines)**

**State**: RESULT_READY & COMPLETE

**Props**:

```typescript
export let canExport = true;
export let canShare = false;
export let canCustomize = true;
export let isExporting = false;
```

**Features**:

- [Export PDF] button (download or open in new tab)
- [Share] button (copy link, future feature)
- [Customize] button (transition to OVERRIDE_ACTIVE)
- [New Prompt] button (reset to INITIAL)
- [View History] button (future: show past results)

---

## **6. Error Handling & Recovery**

### **6.1 Recoverable Errors**

**Classification failed** (LLM timeout):

- Fallback to rule engine result
- Show warning badge on ClassificationFeedback
- Allow user to continue or retry

**Image generation failed**:

- Use placeholder images
- Show warning in ResultsDisplay
- [Retry] button to regenerate images only

**PDF rendering failed**:

- Show error message
- [Retry] button
- [Download as HTML] fallback option

### **6.2 Fatal Errors**

**Network failure**:

- Show error panel: "Network error. Retrying..."
- Exponential backoff (1s, 2s, 4s, 8s)
- [Retry Now] button
- After 3 failed attempts: [Start Over] (reset to INITIAL)

**Server error (500/503)**:

- Show error panel: "Server temporarily unavailable"
- [Retry] button with cooldown
- Link to status page

**Invalid input**:

- Validation on PromptInput (>10 chars required)
- Show inline error message
- Disable [Generate] button until fixed

---

## **7. Responsive Design Breakpoints**

### **Mobile (< 768px)**

```
┌──────────────────────┐
│ Header               │
├──────────────────────┤
│ Main Content         │
│ (full width,        │
│  single column)      │
├──────────────────────┤
│ Footer               │
└──────────────────────┘
```

### **Tablet (768px - 1024px)**

```
┌────────────────────────────────┐
│ Header                         │
├──────────────────┬─────────────┤
│ Input Section    │ Preview     │
│ (40% width)      │ (60% width) │
│                  │             │
│ MediaSelector    │ PDF         │
│ PromptInput      │ Page 1/5    │
│ StatsPanel       │             │
├──────────────────┴─────────────┤
│ Footer                         │
└────────────────────────────────┘
```

### **Desktop (> 1024px)**

```
┌─────────────────────────────────────────────────┐
│ Header                                          │
├─────────────────┬──────────────┬────────────────┤
│ Input Section   │ PDF Preview  │ Stats & Actions│
│ (30% width)     │ (40% width)  │ (30% width)    │
│                 │              │                │
│ MediaSelector   │ Pages 1/5    │ Latency: 8.2s  │
│ PromptInput     │ [Prev/Next]  │ Confidence 92% │
│ [Generate]      │ Fullscreen   │ [Customize]    │
│                 │              │ [Export]       │
├─────────────────┴──────────────┴────────────────┤
│ Footer                                          │
└─────────────────────────────────────────────────┘
```

---

## **8. Accessibility Checklist**

- [ ] ARIA labels on all interactive elements
- [ ] Keyboard navigation (Tab, Shift+Tab, Enter, Escape)
- [ ] Focus indicators visible (blue outline)
- [ ] Color not the only indicator (use icons + text)
- [ ] Minimum touch target size 44x44px
- [ ] Text contrast >4.5:1 for WCAG AA
- [ ] Alt text on all images
- [ ] Screen reader announcements for state changes
- [ ] Form labels associated with inputs (`<label for="">`)
- [ ] Disabled buttons clearly indicated

---

## **9. Performance Considerations**

### **9.1 Lazy Loading**

- Load OverrideControls only when needed (on-demand)
- Defer heavy components (PDF preview) until result ready

### **9.2 Caching**

- Cache classification results by prompt hash
- Cache PDF renders to avoid re-generation on style override (if possible)
- Local storage: save user's medium preference

### **9.3 Debouncing**

- Debounce character input on PromptInput (500ms)
- Debounce window resize (for responsive layout adjustments)

### **9.4 Animation Performance**

- Use CSS transforms (not position changes)
- GPU-accelerated transitions (translate, opacity)
- Disable animations on `prefers-reduced-motion`

---

## **10. Testing Strategy**

### **Unit Tests** (per component)

- MediaSelector: user can select and emit event
- PromptInput: character counter, validation, disabled state
- ClassificationFeedback: displays metadata, handles Accept/Override
- ResultsDisplay: renders PDF, pagination, button actions
- OverrideControls: calculates cost multiplier, applies overrides
- StatsPanel: displays metrics correctly
- CostVisualization: shows correct cost breakdown

### **Integration Tests** (state machine)

- INITIAL → MEDIUM_SELECTED → PROMPT_ENTERED → GENERATING → CLASSIFICATION_READY → RESULT_READY
- RESULT_READY → OVERRIDE_ACTIVE → GENERATING → RESULT_READY
- Error recovery: GENERATING (error) → CLASSIFICATION_READY (with error badge)
- Reset: RESULT_READY → INITIAL

### **E2E Tests** (full user flow)

- User selects medium "ebook"
- User enters prompt "summer poems"
- System classifies and generates eBook
- User sees classification feedback (confidence, source)
- User accepts classification
- System shows PDF preview + stats
- User clicks "Customize"
- User changes style to "gothic"
- System shows cost multiplier (40%)
- User clicks "Apply Override"
- System re-renders PDF with new style
- User clicks "Export PDF"
- PDF downloads successfully

---

## **11. Success Metrics**

### **User Validation**

- [ ] User can select medium (all 6 options)
- [ ] User can see classification results (medium, confidence, source)
- [ ] User understands cost model (can explain 5/40/100%)
- [ ] User can apply overrides without errors
- [ ] User can export PDF

### **System Performance**

- [ ] Classify: <10ms (rule engine) or ~500ms (with LLM fallback)
- [ ] Generate: 8-20s (including image generation)
- [ ] Override: <2s (re-styling only, no regeneration)
- [ ] Overall latency: <30s (95th percentile)

### **Code Quality**

- [ ] All 457 existing tests still pass (zero regressions)
- [ ] New components have 80%+ test coverage
- [ ] No console errors or warnings
- [ ] Accessibility audit: 100% WCAG AA

---

## **Document Control**

| Version | Date       | Status   | Notes                                       |
| ------- | ---------- | -------- | ------------------------------------------- |
| 1.0     | 2025-11-17 | 🟢 READY | Progressive Disclosure architecture defined |

---

**Status**: 🟢 **READY FOR MODULARITY BREAKDOWN** — Architecture locked, ready for component specifications and implementation plan.

**Next Document**: `FRONTEND_PROGRESSIVE_DISCLOSURE_MODULARITY.md` (module breakdown, dependencies, timeline)

---

**END OF FRONTEND PROGRESSIVE DISCLOSURE ARCHITECTURE**
````
