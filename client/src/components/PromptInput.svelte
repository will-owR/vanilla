<script>
  import { promptStore, contentStore, uiStateStore } from '../stores';
  import { submitPrompt } from '../lib/api';

  let currentPrompt;
  promptStore.subscribe(value => {
    currentPrompt = value;
  });

  let uiState;
  uiStateStore.subscribe(value => {
    uiState = value;
  });

  const handleSubmit = async () => {
    if (!currentPrompt || !currentPrompt.trim()) {
      uiStateStore.set({ status: 'error', message: 'Prompt cannot be empty.' });
      return;
    }

    uiStateStore.set({ status: 'loading', message: 'Generating content...' });
    try {
      const response = await submitPrompt(currentPrompt);
      if (response && response.data) {
        contentStore.set(response.data.content);
        uiStateStore.set({ status: 'success', message: 'Content generated successfully.' });
      } else {
        throw new Error('Invalid response structure from server.');
      }
    } catch (error) {
      uiStateStore.set({ status: 'error', message: error.message || 'An unknown error occurred.' });
    }
  };

  import { get } from 'svelte/store';

  const handlePreviewNow = async () => {
    const current = get(contentStore);
    if (!current) {
      uiStateStore.set({ status: 'error', message: 'No content to preview. Generate content first.' });
      return;
    }
    try {
      uiStateStore.set({ status: 'loading', message: 'Loading preview...' });
      const html = await import('../lib/api').then((m) => m.loadPreview(current));
      const { previewStore } = await import('../stores');
      previewStore.set(html);
      uiStateStore.set({ status: 'success', message: 'Preview updated' });
    } catch (err) {
      uiStateStore.set({ status: 'error', message: err.message || 'Preview failed' });
    }
  };
</script>

<div class="prompt-container">
  <label for="prompt-textarea">Prompt</label>
  <textarea
    id="prompt-textarea"
    bind:value={$promptStore}
    rows="6"
    placeholder="e.g., A noir detective story set in a city of robots."
    disabled={uiState.status === 'loading'}
  ></textarea>
  <button on:click={handleSubmit} disabled={uiState.status === 'loading'}>
    {#if uiState.status === 'loading'}
      Generating...
    {:else}
      Generate
    {/if}
  </button>
  <button on:click={handlePreviewNow} disabled={uiState.status === 'loading'}>
    Preview
  </button>
  
  {#if uiState.status === 'error'}
    <p class="error-message">{uiState.message}</p>
  {/if}
</div>

<style>
  .prompt-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    text-align: left;
  }
  label {
    font-weight: bold;
  }
  textarea {
    width: 100%;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #ccc;
    font-family: inherit;
    font-size: 1rem;
  }
  button {
    padding: 0.75rem;
    border-radius: 4px;
    border: none;
    background-color: #2c3e50;
    color: white;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.2s;
  }
  button:hover {
    background-color: #3a506b;
  }
  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  .error-message {
    color: #e74c3c;
    margin-top: 0.5rem;
  }
</style>
