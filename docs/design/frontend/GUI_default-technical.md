# GUI Default Mode - Technical Specification

date: 2025-11-08
status: active
description: |
Technical specification for the GUI implementation, including
mode selection system and view management.

## Component Architecture

### Mode Management Structure

```typescript
// Types and interfaces
interface Mode {
  id: "basic" | "demo" | "ebook";
  label: string;
  description: string;
  metadata?: MetadataConfig;
}

interface MetadataConfig {
  fields: {
    name: string;
    type: "text" | "number";
    required: boolean;
    label: string;
  }[];
}

// Mode definitions
const modes: Mode[] = [
  {
    id: "basic",
    label: "Basic Prompt → Book",
    description: "Simple prompt to book generation",
  },
  {
    id: "demo",
    label: "Demo Prompt → Book",
    description: "Extended demo with metadata",
    metadata: {
      fields: [
        {
          name: "author",
          type: "text",
          required: true,
          label: "Author Name",
        },
        {
          name: "title",
          type: "text",
          required: true,
          label: "Book Title",
        },
        {
          name: "pages",
          type: "number",
          required: true,
          label: "Page Count",
        },
      ],
    },
  },
  {
    id: "ebook",
    label: "eBook Prompt → Book",
    description: "Full eBook generation flow",
  },
];
```

### Component Structure

```
src/
├── components/
│   ├── modes/                    # Mode-specific components
│   │   ├── ModeSelector.svelte   # Mode selection UI
│   │   ├── BasicMode.svelte      # Basic mode view
│   │   ├── DemoMode.svelte       # Demo mode view
│   │   └── EbookMode.svelte      # eBook mode view
│   ├── prompt/                   # Prompt components
│   │   ├── PromptInput.svelte    # Main prompt input
│   │   └── MetadataInput.svelte  # Metadata fields
│   └── preview/                  # Preview components
│       ├── Preview.svelte        # Preview container
│       └── PreviewContent.svelte # Content display
└── lib/
    ├── stores/                  # State management
    │   ├── modeStore.ts         # Mode selection state
    │   ├── promptStore.ts       # Prompt content state
    │   └── previewStore.ts      # Preview state
    ├── services/                # API services
    │   ├── promptService.ts     # Prompt handling
    │   └── previewService.ts    # Preview generation
    └── utils/                   # Utilities
        ├── validation.ts        # Input validation
        └── persistence.ts       # State persistence
```

## State Management

### Mode Store

```typescript
// stores/modeStore.ts
interface ModeState {
  current: Mode;
  history: Mode[];
  metadata: Record<string, any>;
}

export const modeStore = writable<ModeState>({
  current: modes[0], // Basic mode default
  history: [],
  metadata: {},
});

// Mode switching with history
export function switchMode(modeId: string) {
  return modeStore.update((state) => {
    const newMode = modes.find((m) => m.id === modeId);
    if (!newMode) return state;

    return {
      ...state,
      history: [...state.history, state.current],
      current: newMode,
      metadata: {}, // Clear metadata on mode switch
    };
  });
}
```

### Prompt Store

```typescript
// stores/promptStore.ts
interface PromptState {
  content: string;
  metadata: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

export const promptStore = writable<PromptState>({
  content: "",
  metadata: {},
  isValid: false,
  errors: [],
});

// Validation handler
export function validatePrompt(state: PromptState): boolean {
  const errors = [];
  const mode = get(modeStore).current;

  // Basic content validation
  if (!state.content.trim()) {
    errors.push("Prompt is required");
  }

  // Metadata validation for Demo mode
  if (mode.id === "demo") {
    if (!state.metadata.author) errors.push("Author is required");
    if (!state.metadata.title) errors.push("Title is required");
    if (!state.metadata.pages) errors.push("Page count is required");
  }

  promptStore.update((s) => ({
    ...s,
    isValid: errors.length === 0,
    errors,
  }));

  return errors.length === 0;
}
```

## View Management

### Mode Selector Implementation

```svelte
<!-- ModeSelector.svelte -->
<script lang="ts">
  import { modeStore, switchMode } from '../stores/modeStore';
  import { modes } from '../config/modes';

  $: activeMode = $modeStore.current;
</script>

<div class="mode-selector">
  {#each modes as mode}
    <button
      class="mode-option"
      class:active={activeMode.id === mode.id}
      on:click={() => switchMode(mode.id)}>
      <span class="mode-label">{mode.label}</span>
      <span class="mode-description">{mode.description}</span>
    </button>
  {/each}
</div>

<style>
  .mode-selector {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: var(--surface-light);
  }

  .mode-option {
    flex: 1;
    padding: 0.75rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    cursor: pointer;
  }

  .mode-option.active {
    background: var(--primary-light);
    border-color: var(--primary);
  }
</style>
```

## API Integration

### Prompt Service

```typescript
// services/promptService.ts
interface PromptRequest {
  mode: string;
  content: string;
  metadata?: Record<string, any>;
}

export async function submitPrompt(request: PromptRequest) {
  const response = await fetch("/api/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Prompt submission failed");
  }

  return response.json();
}
```

### Preview Service

```typescript
// services/previewService.ts
export async function generatePreview(content: string, mode: string) {
  // Cancel any pending preview requests
  if (currentPreviewController) {
    currentPreviewController.abort();
  }

  const controller = new AbortController();
  currentPreviewController = controller;

  try {
    const response = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, mode }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error("Preview generation failed");

    const html = await response.text();
    previewStore.set({ html, loading: false });
  } catch (error) {
    if (error.name === "AbortError") return;
    previewStore.update((s) => ({ ...s, error: error.message }));
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// tests/modes.test.ts
describe("Mode Management", () => {
  test("validates demo mode metadata", () => {
    const state = {
      content: "Test prompt",
      metadata: {
        author: "Test Author",
        title: "Test Book",
        pages: 100,
      },
    };
    expect(validatePrompt(state)).toBe(true);
  });

  test("handles mode switching", () => {
    switchMode("demo");
    const state = get(modeStore);
    expect(state.current.id).toBe("demo");
    expect(state.history).toHaveLength(1);
  });
});
```

### Integration Tests

```typescript
// tests/prompt-flow.test.ts
describe("Prompt Flow", () => {
  test("complete demo mode flow", async () => {
    // 1. Switch to demo mode
    switchMode("demo");

    // 2. Set prompt and metadata
    await updatePrompt({
      content: "Test prompt",
      metadata: {
        author: "Test Author",
        title: "Test Book",
        pages: 100,
      },
    });

    // 3. Submit and verify
    const result = await submitPrompt(get(promptStore));
    expect(result.success).toBe(true);
  });
});
```

## Implementation Plan

### Phase 1: Mode Selection

1. Implement mode store
2. Add mode selector component
3. Basic mode switching
4. Mode persistence

### Phase 2: Mode-Specific Views

1. Create view components
2. Implement metadata handling
3. Add validation
4. Update preview generation

### Phase 3: Integration

1. Update API services
2. Add error handling
3. Implement caching
4. Add loading states

### Phase 4: Testing

1. Unit test coverage
2. Integration tests
3. E2E test flows
4. Performance testing

---

This document is actively maintained.
Last Updated: 2025-11-08
