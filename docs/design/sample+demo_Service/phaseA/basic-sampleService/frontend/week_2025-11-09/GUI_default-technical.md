# GUI Default Mode - Technical Specification

date: 2025-11-09
status: active

description: |
Technical specification for the GUI implementation, including
mode selection system and view management.

**Note: API Payload Structure**
The API calls should be structured to handle any data configuration, current or future.
Instead of hardcoding `{ prompt }`, we use a comprehensive payload structure:

```javascript
{
  mode: "basic" | "demo" | "ebook",  // Identifies the context
  prompt: string,                    // The core prompt
  metadata: {                        // Optional structured metadata
    title?: string,
    author?: string,
    pages?: number,
    // ... any future fields
  },
  options?: {                        // Optional configuration
    // ... future settings/flags
  }
}
```

This structure ensures:
- Backward compatibility with basic mode
- Support for current demo mode metadata
- Extensibility for future enhancements
- Progressive server-side feature adoption

## Component Architecture

### Mode Management Structure

The project defines three user-facing modes: `basic`, `demo`, and `ebook`. In the repository the UI uses a simple mode descriptor array (JS) and the actual switcher component is `client/src/components/ModeSwitcher.svelte`.

```javascript
// Example mode descriptors (JS)
const modes = [
  {
    id: "basic",
    label: "Basic Prompt → Book",
    description: "Simple prompt to book generation",
  },
  {
    id: "demo",
    label: "Demo Prompt → Book",
    description: "Extended demo with metadata",
    // metadata expectations are handled by the UI and promptStore
  },
  {
    id: "ebook",
    label: "eBook Prompt → Book",
    description: "Full eBook generation flow (WIP)",
  },
];
```

Note: the `ebook` mode is present in the UI but currently disabled (work-in-progress). The server and client are designed to accept a flexible payload (see API Payload Structure above) so modes can add metadata fields without changing endpoints.

### Component Structure

The repository structure is JS/Svelte-based and the client uses a flat `components/` directory rather than a `components/modes/` subtree. Key files to reference:

```
client/src/
├── components/
│   ├── ModeSwitcher.svelte       # Mode selection UI (active)
│   ├── ModeIndicator.svelte      # Small mode indicator
│   ├── MetadataSection.svelte    # Demo-mode metadata inputs
│   ├── PromptInput.svelte        # Prompt textarea and helpers
│   ├── Preview.svelte            # Preview wrapper
│   ├── PreviewWindow.svelte      # Preview render window
│   ├── PreviewSkeleton.svelte    # Skeleton while preview loads
│   ├── ExportButton.svelte       # Export action UI
│   └── StatusDisplay.svelte      # Status/health UI (component exists; App may render header inline)
└── lib/
  ├── api.js                    # Client API helpers (fetchWithRetry and endpoints)
  ├── flows.js                  # High-level UI flows
  └── previewHelper.js          # Preview helper utilities
```

## State Management

### Mode Store

The implementation uses a JS writable store at `client/src/stores/modeStore.js`. It stores a simple `current` identifier, a timestamp, and `params` describing the mode. It exposes `setMode(mode, params)` and `revertToDefault()` helpers.

```javascript
// client/src/stores/modeStore.js (summary)
{
  current: 'demo',
  timestamp: 169...,
  params: { promptType: 'demo', outputType: 'book', validation: 'enhanced' }
}

// API
modeStore.setMode(modeId, params);
modeStore.revertToDefault();
```

This is intentionally lightweight: the store records the active mode and any associated params; it does not maintain a long history by default (history could be added as an enhancement).

### Prompt Store

The real `promptStore` lives at `client/src/stores/promptStore.js`. It initializes with `mode: 'demo'` (not 'basic') and provides helper functions used by the UI. Example summary:

```javascript
// client/src/stores/promptStore.js (summary)
{
  mode: 'demo',
  prompt: '',
  metadata: { title: '', author: '', pages: undefined },
  generating: false,
  error: null,
}

// helpers present in the file:
resetMetadata();
setMode(mode);
setGenerating(boolean);
setError(err);
```

The UI performs validation against the active mode (for example, demo mode requires author/title/pages). Validation helper logic is implemented in the UI flows and tests rather than as a monolithic TypeScript function in the store.

## View Management

### Mode Switcher Implementation

The repo implements `ModeSwitcher.svelte` (see `client/src/components/ModeSwitcher.svelte`). It is a small JS/Svelte component which updates `modeStore` and the `promptStore`. The `ebook` button is currently disabled in the implementation.

```svelte
<script>
  import { modeStore } from '../stores/modeStore.js';
  import { promptStore } from '../stores/promptStore.js';

  const modes = [
    { id: 'demo', label: 'Demo Prompt → Book' },
    { id: 'basic', label: 'Basic Prompt → Book' },
    { id: 'ebook', label: 'eBook Prompt → Book' }
  ];

  function switchMode(modeId) {
    modeStore.setMode(modeId, { promptType: modeId, outputType: 'book' });
    promptStore.update(s => ({ ...s, mode: modeId }));
  }
</script>

<div class="mode-selector">
  {#each modes as mode}
    <button
      class="mode-button {$modeStore.current === mode.id ? 'active' : ''}"
      on:click={() => switchMode(mode.id)}
      disabled={mode.id === 'ebook'}>
      {mode.label}
    </button>
  {/each}
</div>

<style>
  /* component styles (plain CSS) */
</style>
```

## API Integration

### Prompt Service

The client uses `client/src/lib/api.js` helpers. In the implementation the prompt submission endpoint is `POST /prompt` (not `/api/prompt`) and the client has retry and normalization logic.

```javascript
// client/src/lib/api.js -> submitPrompt
export async function submitPrompt(prompt) {
  // POST /prompt with { prompt }
}
```

Persistence of prompts is handled via the CRUD endpoint `POST /api/prompts` (see `savePromptContent` in `api.js`).

### Preview Service

The client implements an adaptive preview flow in `client/src/lib/api.js` that:

- Prefers GET `/preview?content=` for small payloads (quick inline HTML response)
- Uses POST `/api/preview` for large payloads (returns JSON { preview })
- Resolves `resultId` or `promptId` via `/preview?resultId=` or `/preview?promptId=` before falling back to `/content/*` helper endpoints
- Cancels in-flight requests via AbortController to avoid race conditions

See `client/src/lib/api.js` for the exact `loadPreview` and `fetchWithRetry` logic (the client handles aborts, retryable statuses, and payload-size-based routing).

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
Last Updated: 2025-11-09
