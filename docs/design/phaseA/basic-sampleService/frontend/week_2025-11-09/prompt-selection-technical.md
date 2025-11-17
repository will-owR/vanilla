# Prompt Selection Technical Analysis

date: 2025-11-08
status: draft
description: |
Technical analysis of current prompt selection implementation and planned
extensions to support multiple prompt types (Basic, Demo, eBook).

## Current Implementation

### Component Structure

1. **App.svelte**

   - Root component
   - Manages global state
   - Houses main UI layout
   - Contains health check and user status

2. **PromptInput.svelte**

   - Main prompt interface component
   - Contains:
     - Textarea (`data-testid="prompt-textarea"`)
     - Generate button (`data-testid="generate-button"`)
   - Handles user input and validation

3. **Flow Management**

   - Location: `client/src/lib/flows.js`
   - Key function: `generateAndPreview(prompt)`
     - Calls `genieServiceFE.generate(prompt)`
     - Fallback to `submitPrompt(prompt)`
     - Handles timeouts (10s default)
     - Manages UI loading state
     - Sets content store
     - Triggers preview generation

4. **State Management**
   - Uses Svelte stores
   - Key stores:
     - `contentStore` - Manages prompt/response content
     - `previewStore` - Handles preview state
     - `uiStateStore` - Manages UI status messages

### Current Flow

1. User enters prompt in textarea
2. Validates non-empty input
3. Clicks Generate → `handleGenerateNow()`
4. Triggers `generateAndPreview(prompt)`
5. Shows loading state
6. Processes response
7. Updates UI with result

## Planned Extensions

### New Component Structure

1. **Selection Bar Component**

   ```
   [Basic Prompt → Book] [Demo Prompt → Book] [eBook Prompt → Book]
   ```

   - Horizontal layout
   - Equal spacing
   - Consistent styling
   - Clear active state

2. **State Management Extensions**

   ```typescript
   interface PromptMode {
     id: "basic" | "demo" | "ebook";
     label: string;
     active: boolean;
   }

   // Store
   const promptModeStore = writable<PromptMode>({
     id: "basic",
     label: "Basic Prompt → Book",
     active: true,
   });
   ```

3. **View Management**
   - Container component to switch views
   - Preserve current implementation for basic mode
   - Add new view components for demo and ebook

### Technical Integration

1. **Component Updates**

   ```svelte
   <!-- PromptSelector.svelte -->
   <script>
     import { promptModeStore } from '../stores/promptStore';

     const modes = [
       { id: 'basic', label: 'Basic Prompt → Book' },
       { id: 'demo', label: 'Demo Prompt → Book' },
       { id: 'ebook', label: 'eBook Prompt → Book' }
     ];
   </script>

   <div class="mode-selector">
     {#each modes as mode}
       <button
         class:active={$promptModeStore.id === mode.id}
         on:click={() => promptModeStore.set({...mode, active: true})}>
         {mode.label}
       </button>
     {/each}
   </div>
   ```

2. **View Container**

   ```svelte
   <!-- PromptViewContainer.svelte -->
   <script>
     import { promptModeStore } from '../stores/promptStore';
     import BasicPrompt from './BasicPrompt.svelte';
     import DemoPrompt from './DemoPrompt.svelte';
     import EbookPrompt from './EbookPrompt.svelte';
   </script>

   <div class="prompt-container">
     {#if $promptModeStore.id === 'basic'}
       <BasicPrompt />
     {:else if $promptModeStore.id === 'demo'}
       <DemoPrompt />
     {:else if $promptModeStore.id === 'ebook'}
       <EbookPrompt />
     {/if}
   </div>
   ```

### Implementation Strategy

1. **Phase 1: Selection UI**

   - Add selection component
   - Implement state management
   - Keep only basic view active

2. **Phase 2: View Management**

   - Create view container
   - Add placeholder views
   - Implement view switching

3. **Phase 3: New Views**
   - Implement demo view
   - Implement ebook view
   - Add view-specific logic

### Integration Points

1. **App.svelte**

   - Add PromptSelector above existing prompt interface
   - Wrap current PromptInput in view container
   - Handle mode-specific state

2. **State Management**

   - Extend stores for mode management
   - Add mode-specific state handling
   - Preserve existing store functionality

3. **Flow Integration**
   - Update `generateAndPreview` to handle mode-specific logic
   - Maintain backward compatibility
   - Add mode-specific API endpoints as needed

## Testing Considerations

1. **Component Tests**

   - Add tests for selection UI
   - Verify mode switching
   - Test view rendering

2. **Integration Tests**

   - Verify mode state management
   - Test flow modifications
   - Validate API integration

3. **E2E Tests**
   - Add mode selection to E2E flows
   - Test complete user journeys
   - Verify mode persistence

## Next Steps

1. Create selection component structure
2. Implement basic mode switching
3. Add placeholder views
4. Integrate with existing prompt handling
5. Add mode-specific functionality

---

This document serves as the technical foundation for implementing the prompt selection enhancement while maintaining the simplicity of the current system.
