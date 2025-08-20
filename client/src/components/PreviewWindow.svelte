<script>
  import { contentStore, previewStore, uiStateStore } from '../stores';
  import { loadPreview } from '../lib/api';
  import { onMount } from 'svelte';

  import { debounce } from '../lib/utils';

  let content;
  contentStore.subscribe(value => {
    content = value;
    if (content && autoPreview) {
      // Debounced auto update to avoid rapid requests
      debouncedUpdate(content);
    }
  });

  let uiState;
  uiStateStore.subscribe(value => {
    uiState = value;
  });

  // Preview controls
  let autoPreview = true;

  const updatePreview = async (newContent) => {
    if (!newContent) {
      previewStore.set('');
      return;
    }
    try {
      uiStateStore.set({ status: 'loading', message: 'Loading preview...' });
      const html = await loadPreview(newContent);
      previewStore.set(html);
      uiStateStore.set({ status: 'success', message: 'Preview loaded' });
    } catch (error) {
      uiStateStore.set({ status: 'error', message: `Failed to load preview: ${error.message}` });
      previewStore.set('');
    }
  };

  // Debounced auto update to avoid rapid requests
  const debouncedUpdate = debounce(updatePreview, 350);

  onMount(() => {
    if (content) {
      updatePreview(content);
    }
  });
</script>

<div class="preview-container">
  <div class="preview-controls">
    <label><input type="checkbox" bind:checked={autoPreview} /> Auto-preview</label>
    <button on:click={() => updatePreview(content)} disabled={!content || uiState.status === 'loading'}>Preview Now</button>
  </div>

  {#if uiState.status === 'loading'}
    <div class="loading-overlay">
      <p>Loading Preview...</p>
    </div>
  {:else if $previewStore}
    <div class="preview-content">
      {@html $previewStore}
    </div>
  {:else}
    <div class="placeholder">
      <p>Your generated preview will appear here.</p>
    </div>
  {/if}
</div>

<style>
  .preview-container {
    position: relative;
    height: 100%;
    width: 100%;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background-color: #f9f9f9;
    overflow-y: auto;
  }
  .loading-overlay, .placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: #888;
  }
  .preview-content {
    padding: 1.5rem;
    text-align: left;
  }
</style>
