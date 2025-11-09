# Default GUI Implementation

date: 2025-11-08
status: active

**description:** |
Technical design document for the default GUI implementation,
including current state and planned mode selection enhancements.

## Current Implementation

### Component Structure

```text
// Root component: client/src/App.svelte
// Key components used or available in the client:
// - client/src/components/ModeSwitcher.svelte
// - client/src/components/MetadataSection.svelte
// - client/src/components/ExportButton.svelte
// - client/src/components/Preview.svelte (and PreviewWindow/PreviewSkeleton)
// - client/src/components/StatusDisplay.svelte (exists; App currently renders header inline)

// Current layout (implementation in App.svelte)
App
├── header-info (inline in App.svelte)
│   ├── Title / Motto
│   ├── Current user
│   └── Backend health
├── MainContent
│   ├── ModeSwitcher (client/src/components/ModeSwitcher.svelte)
│   ├── MetadataSection (shown when mode === 'demo')
│   ├── Prompt textarea (inline in App.svelte)
│   └── Generate button (inline in App.svelte form)
└── Preview (component)
```

### Current Layout

```
┌──────────────────────────────────────┐
│        AetherPress (V0.1)            │ <- Status Bar
│ From Imagination to Publication...   │
│ Current user: None                   │
│ Backend health: ok                   │
├──────────────────────────────────────┤
│     AI-Powered eBook Creation        │ <- Main Title
│                                      │
│ Enter your creative prompt:          │
│ ┌────────────────────────────────┐   │
│ │                                │   │ <- Prompt Area
│ │     [Prompt textarea here]     │   │
│ │                                │   │
│ └────────────────────────────────┘   │
│                                      │
│         [Generate button]            │ <- Action Button
└──────────────────────────────────────┘
```

### Interaction States

1. **Initial State**
   - Empty prompt
   - Generate button disabled
   - No preview visible

2. **Input State**
   - Prompt being typed
   - Generate enabled when valid
   - Previous preview (if any) visible

3. **Generation State**
   - Input locked
   - Loading indicator active
   - Preview updating

4. **Result State**
   - Input unlocked
   - Preview visible
   - Generate available

## Planned Enhancement

Note:
[Basic] -> [Demo] -> [eBook]
Development Path ----------------->

### Mode Selection Addition

```
┌───────────────────────────────────────────────┐
│             AetherPress (V0.1)                │
│      From Imagination to Publication...       │
├───────────────────────────────────────────────┤
│          AI-Powered eBook Creation            │
├───────────────────────────────────────────────┤
│ ┌─────────────┐┌─────────────┐┌─────────────┐ |
│ │Basic Prompt ││Demo Prompt  ││eBook Prompt │ | <- Mode Selection
│ │   → Book    ││   → Book    ││   → Book    │ |
│ └─────────────┘└─────────────┘└─────────────┘ |
│                                               │
│   Enter your creative prompt:                 │
│ ┌─────────────────────────────────────────┐   │
│ │         [Prompt textarea here]          │   │
│ └─────────────────────────────────────────┘   │
│                                               │
│              [Generate button]                │
│                                               │
├───────────────────────────────────────────────┤
│  Current user: None   |  Backend health: OK   │
└───────────────────────────────────────────────┘
```

### Mode Selection Components

The project implements a `ModeSwitcher.svelte` component (not `ModeSelector`). It exposes a simple switch API and updates the `modeStore` and `promptStore`.

```text
// Example modes (from client/src/components/ModeSwitcher.svelte)
const modes = [
  { id: 'demo', label: 'Demo Prompt → Book' },
  { id: 'basic', label: 'Basic Prompt → Book' },
  { id: 'ebook', label: 'eBook Prompt → Book' }
];

// Note: the 'ebook' mode button is present in the UI but currently disabled (WIP).
```

Mode switching updates both `modeStore` (which keeps params and timestamps) and `promptStore` (which holds the active prompt and metadata).

### Mode-Specific Features

1. **Basic Mode**
   - Current functionality
   - Single prompt input
   - Direct generation
   - Standard preview

2. **Demo Mode**
   - Extended metadata
   - Author field
   - Title field
   - Page count field

3. **eBook Mode**
   - Full book settings
   - Chapter structure
   - Front matter options
   - Publishing metadata

## Technical Implementation

### State Management

The implementation uses Svelte writable stores (JavaScript). The actual `promptStore` lives at `client/src/stores/promptStore.js` and is initialized with `mode: 'demo'` and a small metadata shape. Example (JS):

```javascript
import { writable } from "svelte/store";

const initialState = {
  mode: "demo",
  prompt: "",
  metadata: {
    title: "",
    author: "",
    pages: undefined,
  },
  generating: false,
  error: null,
};

export const promptStore = writable(initialState);

export function setGenerating(gen) {
  promptStore.update((s) => ({ ...s, generating: gen, error: null }));
}

export function setError(err) {
  promptStore.update((s) => ({ ...s, error: err, generating: false }));
}
```

### Mode Switching Logic

Mode switching is implemented via `modeStore.setMode(...)` and by updating `promptStore` so UI components can react. Example (JS-style):

```javascript
import { get } from "svelte/store";
import { promptStore } from "../stores/promptStore.js";
import { modeStore } from "../stores/modeStore.js";

function switchMode(newMode) {
  // 1. Persist or snapshot current prompt if needed (optional)
  const current = get(promptStore);

  // 2. Update mode store with params (modeStore holds params/timestamps)
  modeStore.setMode(newMode, {
    promptType: newMode,
    outputType: "book",
    validation: newMode === "demo" ? "enhanced" : "standard",
  });

  // 3. Update promptStore mode and reset metadata when switching to basic
  promptStore.update((s) => ({
    ...s,
    mode: newMode,
    metadata: newMode === "basic" ? undefined : s.metadata,
  }));
}
```

### CSS Structure

Component styles are plain CSS in Svelte single-file components. Example (from `ModeSwitcher.svelte`):

```css
.mode-selector {
  display: flex;
  gap: 1rem;
  margin: 1.5rem 0;
  padding: 0.5rem;
  background: var(--bg-light, #f5f5f5);
  border-radius: 8px;
}

.mode-button {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border, #e0e0e0);
  border-radius: 4px;
  background: white;
  color: var(--text-primary, #333);
}

.mode-button.active {
  background: var(--primary, #ff3e00);
  color: white;
}
```

> Note: The project does not currently use **an SCSS build step for the client**; component styles are regular CSS inside Svelte components.

---

### Status / Testing notes

The client includes `vitest` and `playwright` in devDependencies, but Playwright e2e and CI integration are currently work-in-progress—see `client/README.md` and `scripts/` for existing smoke/e2e helpers.

## Implementation Plan

1. **Phase 1: Mode Selection UI**
   - Add mode selector component
   - Implement basic switching
   - Preserve current functionality
   - Add visual feedback

2. **Phase 2: Mode-Specific Views**
   - Create view components
   - Add metadata fields
   - Implement validation
   - Update preview handling

3. **Phase 3: State Integration**
   - Enhance state management
   - Add persistence
   - Implement error handling
   - Add loading states

## Testing Strategy

### Unit Tests

```typescript
describe("ModeSelector", () => {
  it("shows all available modes", () => {
    // Test mode option rendering
  });

  it("indicates active mode", () => {
    // Test active state
  });

  it("handles mode switching", () => {
    // Test mode change events
  });
});
```

### Integration Tests
- Mode switching flow
- State preservation
- Preview updates
- Error handling

### E2E Tests
- Complete user journeys
- Cross-mode operations
- Error scenarios
- Performance metrics

---

This document is actively maintained.
Last Updated: 2025-11-08
