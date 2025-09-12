<script>
  import { promptStore, contentStore, uiStateStore, setUiLoading, setUiSuccess, setUiError } from '../stores';
  import { submitPrompt, exportToPdf } from '../lib/api';
  import { tick } from 'svelte';

  let currentPrompt = '';

  // Keep the local textarea binding in sync with promptStore for programmatic updates
  // (e.g. when the demo button calls promptStore.set(...)). The guard avoids
  // reassigning when the values already match which would otherwise cause
  // unnecessary reactive churn.
  $: if (typeof $promptStore !== 'undefined' && currentPrompt !== $promptStore) {
    currentPrompt = $promptStore;
  }

  let uiState;
  uiStateStore.subscribe(value => {
    uiState = value;
  });

  // Quick-insert suggestions for the 'summer' theme
  const insertSummerSuggestion = async () => {
    const suggestion = `A short, sunlit summer poem about cicadas and long shadows.`;
    console.log('insertSummerSuggestion: setting suggestion=', suggestion);
    promptStore.set(suggestion);
    // Keep the local binding in sync so the textarea reflects the change immediately
    currentPrompt = suggestion;
    // Wait a tick for the DOM to update, then focus the textarea
    await tick();
    const el = document.getElementById('prompt-textarea');
    if (el) {
      // Defensive: set the DOM value directly so test runners observe the change
  try { if (el instanceof HTMLTextAreaElement) el.value = suggestion; } catch (e) { /* ignore */ }
      el.focus();
      console.log('insertSummerSuggestion: focused textarea');
    } else {
      console.log('insertSummerSuggestion: textarea element not found');
    }
  };

  let isGenerating = false;
  let isPreviewing = false;
  let touched = false;

  $: isPromptEmpty = !currentPrompt || !currentPrompt.trim();

  import { generateAndPreview, previewFromContent, generateOnly } from '../lib/flows';

  // Respect an explicit EMERGENCY_MODE flag (docs describe how to enable).
  const EMERGENCY_MODE = Boolean(import.meta.env?.VITE_EMERGENCY_MODE || false);

  const handleSubmit = async () => {
    console.log('handleSubmit -> generate: called, currentPrompt=', currentPrompt, 'EMERGENCY_MODE=', EMERGENCY_MODE);
    touched = true;
    if (!currentPrompt || !currentPrompt.trim()) {
      setUiError('Prompt cannot be empty.');
      return;
    }
    isGenerating = true;
    try {
      if (EMERGENCY_MODE) {
        // Minimal path: generate only, skip preview to reduce dependencies
        await generateOnly(currentPrompt);
      } else {
        await generateAndPreview(currentPrompt);
      }
    } catch (err) {
      console.log('generate error', err);
    } finally {
      isGenerating = false;
    }
  };

  import { get } from 'svelte/store';

  const handlePreviewNow = async () => {
    const current = get(contentStore);
    if (!current) {
  setUiError('No content to preview. Generate content first.');
      return;
    }
    isPreviewing = true;
    try {
      await previewFromContent(current);
    } catch (err) {
      console.log('previewFromContent error', err);
    } finally {
      isPreviewing = false;
    }
  };

  // In-UI smoke test: runs preview -> export and saves PDF on success or diagnostic JSON on failure
  const runSmokeTest = async () => {
    const current = get(contentStore);
    if (!current) {
  setUiError('No content to run smoke test. Load or generate content first.');
      return;
    }

  setUiLoading('Running smoke test (preview → export)...');
    try {
      // Ensure preview renders
      await handlePreviewNow();

      // Trigger export which downloads a PDF if successful
      await exportToPdf(current);

  setUiSuccess('Smoke test succeeded — PDF downloaded.');
    } catch (err) {
      // Create a diagnostic JSON blob and trigger download
      const diag = {
        error: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : null,
        timestamp: new Date().toISOString(),
        contentSnapshot: current,
      };
      const blob = new Blob([JSON.stringify(diag, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagnostic-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

  setUiError('Smoke test failed — diagnostic saved.');
    }
  };
</script>

  <div class="prompt-container">
  <label for="prompt-textarea">Prompt</label>
  <textarea
    id="prompt-textarea"
    data-testid="prompt-textarea"
    bind:value={currentPrompt}
    on:input={() => { promptStore.set(currentPrompt); touched = true }}
    on:blur={() => (touched = true)}
    rows="6"
    placeholder="e.g., A noir detective story set in a city of robots."
    disabled={isGenerating || isPreviewing}
  ></textarea>
    {#if touched && isPromptEmpty}
      <p class="validation">Please enter a prompt before generating.</p>
    {/if}
  <div class="controls-row">
    <button
      class="suggestion"
      on:click={insertSummerSuggestion}
      title="Insert summer prompt suggestion"
      aria-label="Insert a summer prompt suggestion"
      data-testid="summer-suggestion"
      disabled={isGenerating || isPreviewing}
    >
      Summer suggestion
    </button>
    <button
      class="demo"
      on:click={() => {
        // Populate the content store directly with a V0.1 demo payload
        const demo = {
          title: 'Summer Poems — Demo',
          body: '<div style="page-break-after:always;padding:48px;background-image:url(/samples/images/summer1.svg);background-size:cover;background-position:center;"><h1>Summer Poem 1</h1><p>By Unknown</p><pre>Roses are red\nViolets are blue\nSummer breeze carries you</pre></div><div style="page-break-after:always;padding:48px;background-image:url(/samples/images/summer2.svg);background-size:cover;background-position:center;"><h1>Summer Poem 2</h1><p>By Unknown</p><pre>Sun on the sand\nWaves lap the shore\nA page on each</pre></div>'
        };
  // Instrumentation: log demo flow for reproducibility tests
  console.log('loadDemo: setting promptStore and contentStore with demo payload');
  promptStore.set('Load demo: two short summer poems, one per page');
  contentStore.set(demo);
  console.log('loadDemo: contentStore set, triggering preview flow');
  // Trigger a preview update and show an immediate status so the user
  // sees activity on the page (not only in the terminal).
  uiStateStore.set({ status: 'loading', message: 'Loading demo preview...' });
  setUiLoading('Loading demo preview...');
  // Use the existing preview flow to populate the preview pane.
  handlePreviewNow().then(() => console.log('loadDemo: handlePreviewNow resolved')).catch(err => console.log('loadDemo: handlePreviewNow error', err));
      }}
      title="Load full V0.1 demo content"
      data-testid="load-demo"
      disabled={isGenerating || isPreviewing}
    >
      Load V0.1 demo
    </button>
    <button
      data-testid="generate-button"
      on:click={handleSubmit}
      disabled={isPromptEmpty || isGenerating || isPreviewing}
      aria-busy={isGenerating}
      aria-disabled={isPromptEmpty || isGenerating || isPreviewing}
      aria-live="polite"
      title={isPromptEmpty ? 'Enter a prompt to enable generate' : isGenerating ? 'Generating... please wait' : 'Generate content from prompt'}
    >
      {#if isGenerating}
        <span class="spinner" aria-hidden="true"></span>
        <span class="visually-hidden">Generating…</span>
      {:else}
        Generate
      {/if}
    </button>
    <button data-testid="preview-button" on:click={handlePreviewNow} disabled={uiState.status === 'loading' || isGenerating || isPreviewing}>
      {#if isPreviewing}
        Previewing...
      {:else}
        Preview
      {/if}
    </button>
    <button data-testid="smoke-button" title="Run preview→export smoke test" on:click={runSmokeTest} disabled={uiState.status === 'loading' || isGenerating || isPreviewing}>
      Run smoke test
    </button>
  </div>
  
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
  .controls-row { display:flex; gap:0.5rem; align-items:center }
  .suggestion { background: #f6e58d; color: #2d3436; padding: 0.5rem; border-radius:4px; border:none }
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
  .spinner {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255,255,255,0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 0.5rem;
    vertical-align: middle;
  }
  .visually-hidden { position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden; }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .error-message {
    color: #e74c3c;
    margin-top: 0.5rem;
  }
</style>
