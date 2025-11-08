# Default GUI Implementation

date: 2025-11-08
status: active
description: |
Technical design document for the default GUI implementation,
including current state and planned mode selection enhancements.

## Current Implementation

### Component Structure

```typescript
// App.svelte
export default {
  components: {
    PromptInput,
    Preview,
    StatusBar
  }
}

// Layout hierarchy
App
├── StatusBar
│   ├── AppTitle
│   ├── HealthStatus
│   └── UserStatus
├── MainContent
│   ├── Title
│   ├── PromptInput
│   └── GenerateButton
└── Preview
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

```typescript
interface ModeOption {
  id: 'basic' | 'demo' | 'ebook';
  label: string;
  description: string;
  icon?: string;
}

// ModeSelector.svelte
export default {
  props: {
    modes: ModeOption[],
    active: string
  },
  events: {
    'mode:change': (mode: string) => void
  }
}
```

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

```typescript
interface PromptState {
  mode: "basic" | "demo" | "ebook";
  prompt: string;
  metadata?: {
    author?: string;
    title?: string;
    pages?: number;
  };
  generating: boolean;
  error?: string;
}

// promptStore.ts
export const promptStore = writable<PromptState>({
  mode: "basic",
  prompt: "",
  generating: false,
});
```

### Mode Switching Logic

```typescript
async function switchMode(newMode: string) {
  // 1. Save current state
  const currentState = get(promptStore);

  // 2. Update mode
  promptStore.update((s) => ({
    ...s,
    mode: newMode,
    metadata: newMode === "basic" ? undefined : {},
  }));

  // 3. Load mode-specific components
  await loadModeComponents(newMode);
}
```

### CSS Structure

```scss
.mode-selector {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-light);
  border-bottom: 1px solid var(--border);

  .mode-option {
    flex: 1;
    padding: 0.75rem;
    border-radius: 4px;
    text-align: center;
    cursor: pointer;

    &.active {
      background: var(--primary-light);
      color: var(--primary);
    }
  }
}
```

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
