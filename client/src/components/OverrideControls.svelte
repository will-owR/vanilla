<script lang="ts">
  import { contentStore, uiStateStore } from '../stores';
  import { saveOverride, applyOverride, getServiceCapabilities } from '../lib/api';
  import { onDestroy } from 'svelte';

  let originalContent: object | null;
  let classification: any = null;
  let newClassification: any = null;
  let localContent = { title: '', body: '' };
  let debounceTimer: number;
  let costMultiplier = 1.0;
  let capabilities: any = {};
  let loading = false;

  // Available options for overrides
  const mediums = ['ebook', 'calendar', 'poster', 'stickers', 'greeting-card', 'journal', 'app-ui', 'wall-art'];
  let availableStyles: string[] = [];
  let availableThemes: string[] = [];

  // Local override selections
  let selectedStyle: string = '';
  let selectedColor: string = '';
  let selectedMedium: string = '';

  const contentUnsubscribe = contentStore.subscribe(value => {
    originalContent = value;
    if (value) {
      localContent = { ...value };
      // Extract classification from content if available
      if (value.classification) {
        classification = { ...value.classification };
        newClassification = { ...value.classification };
        selectedStyle = value.classification.style || '';
        selectedMedium = value.classification.medium || '';
      }
    }
  });

  // Load capabilities for a medium
  async function loadCapabilities(medium: string) {
    if (!medium) return;
    try {
      const caps = await getServiceCapabilities(medium);
      capabilities[medium] = caps;
      availableStyles = caps.styles || [];
      availableThemes = caps.themes || [];
    } catch (error) {
      console.error('Failed to load capabilities:', error);
    }
  }

  // Calculate cost multiplier
  function calculateCostMultiplier() {
    if (!classification || !newClassification) return;
    
    let multiplier = 1.0;
    
    // Color change: 5%
    if (selectedColor && selectedColor !== (classification.colorPalette || '')) {
      multiplier = 0.05;
    }
    
    // Style change: 40% (or 5% if only color changed)
    if (selectedStyle && selectedStyle !== (classification.style || '')) {
      multiplier = Math.max(multiplier, 0.4);
    }
    
    // Medium change: 100% (full regeneration)
    if (selectedMedium && selectedMedium !== (classification.medium || '')) {
      multiplier = 1.0;
    }
    
    costMultiplier = multiplier;
  }

  // Handle override application
  async function applyClassificationOverride() {
    if (!originalContent || !classification) return;
    
    loading = true;
    uiStateStore.set({ status: 'loading', message: 'Applying override...' });
    
    try {
      newClassification = {
        ...classification,
        style: selectedStyle || classification.style,
        colorPalette: selectedColor || classification.colorPalette,
        medium: selectedMedium || classification.medium,
      };
      
      calculateCostMultiplier();
      
      const result = await applyOverride(originalContent, classification, newClassification);
      
      if (result) {
        contentStore.set({ ...originalContent, ...result });
        uiStateStore.set({ 
          status: 'success', 
          message: `Override applied. Cost multiplier: ${(costMultiplier * 100).toFixed(0)}%` 
        });
      }
    } catch (error) {
      const err = error as Error;
      uiStateStore.set({ status: 'error', message: `Failed to apply override: ${err.message}` });
    } finally {
      loading = false;
    }
  }

  // Reset overrides
  function resetOverrides() {
    if (classification) {
      selectedStyle = classification.style || '';
      selectedColor = classification.colorPalette || '';
      selectedMedium = classification.medium || '';
      costMultiplier = 1.0;
    }
  }

  // Watch for medium changes
  $: if (selectedMedium && selectedMedium !== (classification?.medium || '')) {
    loadCapabilities(selectedMedium);
    calculateCostMultiplier();
  }
  
  $: if (selectedStyle || selectedColor) {
    calculateCostMultiplier();
  }

  const handleDebouncedInput = (field: 'title' | 'body', value: string) => {
    localContent[field] = value;
    
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const changes = { [field]: value };
      updateContent(changes);
    }, 500); // 500ms debounce
  };

  const handleTitleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    handleDebouncedInput('title', target.value);
  }

  const handleBodyInput = (event: Event) => {
    const target = event.currentTarget as HTMLTextAreaElement;
    handleDebouncedInput('body', target.value);
  }

  const updateContent = async (changes: object) => {
    if (!originalContent) return;

    uiStateStore.set({ status: 'loading', message: 'Saving changes...' });
    try {
      const response = await saveOverride(originalContent, changes);
      if (response && response.data) {
        try {
          const { safePersistContent } = await import('../lib/persistHelper');
          const result = await safePersistContent(response.data.content);
          if (!result) {
            contentStore.set(response.data.content);
          }
        } catch (e) {
          // Fallback to local set if persist helper isn't available or fails
          contentStore.set(response.data.content);
          console.warn('OverrideControls: safePersistContent failed, falling back to local set', e && e.message);
        }
        uiStateStore.set({ status: 'success', message: 'Changes saved.' });
      } else {
        throw new Error('Invalid response from server.');
      }
    } catch (error) {
      const err = error as Error;
      uiStateStore.set({ status: 'error', message: `Failed to save: ${err.message}` });
    }
  };

  onDestroy(() => {
    contentUnsubscribe();
    window.clearTimeout(debounceTimer);
  });
</script>

{#if originalContent && classification}
<div class="override-container">
  <h3>Override Classification & Settings</h3>
  
  <!-- Current Classification Display -->
  <div class="current-classification">
    <h4>Current Classification</h4>
    <div class="classification-grid">
      <div class="classification-item">
        <span class="label">Medium:</span>
        <span class="value">{classification.medium || 'Not set'}</span>
      </div>
      <div class="classification-item">
        <span class="label">Style:</span>
        <span class="value">{classification.style || 'Not set'}</span>
      </div>
      <div class="classification-item">
        <span class="label">Confidence:</span>
        <span class="value">{classification.confidence ? `${(classification.confidence * 100).toFixed(0)}%` : 'N/A'}</span>
      </div>
    </div>
  </div>
  
  <!-- Override Selectors -->
  <div class="override-section">
    <h4>Apply Overrides</h4>
    
    <div class="form-group">
      <label for="override-medium">Change Medium</label>
      <select id="override-medium" bind:value={selectedMedium} disabled={loading}>
        <option value="">No change</option>
        {#each mediums as medium}
          <option value={medium}>{medium}</option>
        {/each}
      </select>
      <p class="hint">⚠️ Changing medium requires full regeneration (100% cost)</p>
    </div>
    
    <div class="form-group">
      <label for="override-style">Change Style</label>
      <select id="override-style" bind:value={selectedStyle} disabled={loading}>
        <option value="">No change</option>
        {#if availableStyles.length > 0}
          {#each availableStyles as style}
            <option value={style}>{style}</option>
          {/each}
        {:else}
          <option disabled>Load a medium first</option>
        {/if}
      </select>
      <p class="hint">Changing style has 40% cost impact</p>
    </div>
    
    <div class="form-group">
      <label for="override-color">Change Color Palette</label>
      <select id="override-color" bind:value={selectedColor} disabled={loading}>
        <option value="">No change</option>
        <option value="vibrant">Vibrant</option>
        <option value="pastel">Pastel</option>
        <option value="dark">Dark</option>
        <option value="grayscale">Grayscale</option>
        <option value="warm">Warm</option>
        <option value="cool">Cool</option>
      </select>
      <p class="hint">Changing color has minimal cost impact (5%)</p>
    </div>
  </div>
  
  <!-- Cost Multiplier Display -->
  <div class="cost-display">
    <h4>Estimated Cost Impact</h4>
    <div class="cost-bar">
      <div class="cost-indicator" style="width: {costMultiplier * 100}%">
        <span class="cost-label">{(costMultiplier * 100).toFixed(0)}%</span>
      </div>
    </div>
    <p class="cost-explanation">
      {#if costMultiplier === 1.0}
        Full regeneration required (changing medium)
      {:else if costMultiplier >= 0.4}
        Style change detected (40% of full cost)
      {:else if costMultiplier > 0}
        Color change only (5% of full cost)
      {:else}
        No changes selected
      {/if}
    </p>
  </div>
  
  <!-- Action Buttons -->
  <div class="actions">
    <button 
      on:click={applyClassificationOverride}
      disabled={loading || (!selectedStyle && !selectedColor && !selectedMedium)}
      class="btn btn-primary"
    >
      {#if loading}
        ⏳ Applying...
      {:else}
        ✓ Apply Override
      {/if}
    </button>
    <button 
      on:click={resetOverrides}
      disabled={loading}
      class="btn btn-secondary"
    >
      ↻ Reset
    </button>
  </div>
  
  <!-- Original Content Editing (collapsed by default) -->
  <details class="content-editor">
    <summary>Edit Content (Advanced)</summary>
    <div class="form-group">
      <label for="override-title">Title</label>
      <input
        id="override-title"
        type="text"
        bind:value={localContent.title}
        on:input={handleTitleInput}
        disabled={loading}
      />
    </div>
    <div class="form-group">
      <label for="override-body">Body</label>
      <textarea
        id="override-body"
        rows="8"
        bind:value={localContent.body}
        on:input={handleBodyInput}
        disabled={loading}
      ></textarea>
    </div>
  </details>
</div>
{/if}

<style>
  .override-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    text-align: left;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  }

  h3, h4 {
    margin: 0;
    color: #333;
  }

  h3 {
    font-size: 1.25rem;
    border-bottom: 2px solid #007bff;
    padding-bottom: 0.5rem;
  }

  h4 {
    font-size: 1rem;
    margin-top: 0.5rem;
    margin-bottom: 1rem;
  }

  .current-classification {
    background: #f0f7ff;
    border-left: 4px solid #0066cc;
    padding: 1rem;
    border-radius: 4px;
  }

  .classification-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .classification-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .classification-item .label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
  }

  .classification-item .value {
    font-size: 1rem;
    font-weight: 500;
    color: #333;
    font-family: monospace;
  }

  .override-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 600;
    color: #333;
    font-size: 0.9rem;
  }

  input, select, textarea {
    width: 100%;
    padding: 0.75rem;
    border-radius: 4px;
    border: 1px solid #ccc;
    font-family: inherit;
    font-size: 1rem;
    background: white;
    transition: border-color 0.2s;
  }

  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }

  input:disabled, select:disabled, textarea:disabled {
    background-color: #f5f5f5;
    color: #999;
    cursor: not-allowed;
  }

  .hint {
    font-size: 0.75rem;
    color: #999;
    margin: 0;
    font-style: italic;
  }

  .cost-display {
    background: #fff8dc;
    border: 1px solid #ffd700;
    padding: 1rem;
    border-radius: 4px;
  }

  .cost-bar {
    width: 100%;
    height: 24px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
    margin: 0.75rem 0;
  }

  .cost-indicator {
    height: 100%;
    background: linear-gradient(90deg, #ff6b6b, #ffd700, #51cf66);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 8px;
    transition: width 0.3s ease;
  }

  .cost-label {
    color: white;
    font-weight: bold;
    font-size: 0.875rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .cost-explanation {
    font-size: 0.875rem;
    color: #666;
    margin: 0;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.75rem 1.25rem;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 600;
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
    box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
  }

  .btn-primary:disabled {
    background: #ccc;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .btn-secondary {
    background: #6c757d;
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #545b62;
    transform: translateY(-2px);
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .content-editor {
    border-top: 1px solid #e0e0e0;
    padding-top: 1rem;
  }

  .content-editor summary {
    cursor: pointer;
    font-weight: 600;
    color: #666;
    user-select: none;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .content-editor summary:hover {
    background: #f5f5f5;
  }

  .content-editor[open] summary {
    color: #333;
    margin-bottom: 1rem;
  }
</style>
