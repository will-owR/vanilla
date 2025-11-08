<script>
  // Basic App component for AetherPress Svelte frontend
  import { appState } from './stores/appState.js';
  import { modeStore } from './stores/modeStore.js';
  import { promptStore, setGenerating, setError } from './stores/promptStore.js';
  import ModeSwitcher from './components/ModeSwitcher.svelte';
  import MetadataSection from './components/MetadataSection.svelte';
  import { contentStore } from './stores/index.js';
  import { submitPrompt as apiSubmitPrompt } from './lib/api.js';
  import ExportButton from './components/ExportButton.svelte';

  // Fetch backend health status on mount
  let health = null;
  let apiError = null;
  let aiResult = '';
  
  // Subscribe to promptStore
  $: prompt = $promptStore.prompt;
  $: loadingAI = $promptStore.generating;

  async function checkHealth() {
    appState.update(state => ({ ...state, loading: true, error: null }));
    try {
      const res = await fetch('/health'); // Use relative path for Vite proxy
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      health = data.status;
      appState.update(state => ({ ...state, loading: false }));
    } catch (err) {
      apiError = err.message;
      appState.update(state => ({ ...state, loading: false, error: err.message }));
    }
  }

  async function submitPrompt() {
    aiResult = '';
    apiError = null;
    setGenerating(true);
    try {
  // Use shared API helper which normalizes the response shape
  const result = await apiSubmitPrompt(prompt);
      // result is normalized to { content, copies, metadata, promptId, resultId }
      aiResult = JSON.stringify(result, null, 2);
      // Populate the shared content store so UI components (ExportButton)
      // can reactively enable export and other actions.
      // `result` is an envelope: { content, copies, metadata, promptId, resultId }
      // Export expects a content object with top-level { title, body }.
      // Unwrap common envelope shapes to ensure the store contains the
      // expected payload shape (defensive but minimal change).
      const contentToStore =
        (result && (result.content || (result.data && result.data.content))) ||
        result ||
        null;
      contentStore.set(contentToStore);
    } catch (err) {
      setError(err.message);
      apiError = err.message;
    } finally {
      setGenerating(false);
    }
  }

  checkHealth();
</script>

<main>
  <div class="header-info">
    <p class="title">AetherPress (V0.1)</p>
    <p class="motto">From Imagination to Publication (It's a snap!)</p>
    <p>Current user: {$appState.user ? $appState.user : 'None'}</p>
    <p>Backend health: {health ? health : 'Checking...'}</p>
  </div>

  <section class="main-content">
    <h2>AI-Powered eBook Creation</h2>
    <ModeSwitcher />
    
    {#if $modeStore.current === 'demo'}
      <MetadataSection />
    {/if}
    
    <form on:submit|preventDefault={submitPrompt}>
      <label for="prompt">Enter your creative prompt:</label>
      <textarea id="prompt" bind:value={prompt} rows="4" class="prompt-input"></textarea>
      <button type="submit" disabled={loadingAI || !prompt.trim()} class="generate-button">Generate</button>
    </form>
    {#if loadingAI}
      <p>Generating with AI...</p>
    {/if}
    {#if aiResult}
      <div style="margin-top:1.5rem; padding:1rem; border:1px solid #ccc; border-radius:8px; background:#fafafa;">
        <h3>AI Result</h3>
        <pre style="white-space:pre-wrap;">{aiResult}</pre>

        <!-- Action UI: Export wired to ExportButton; Edit still stubbed -->
        <div class="action-buttons" style="margin-top:0.75rem; display:flex; gap:0.5rem;">
          <ExportButton />

          <button
            class="stub-button"
            aria-disabled="true"
            disabled
            title="Edit — coming soon"
            data-testid="edit-button-stub"
          >
            Edit
          </button>
        </div>
      </div>
    {/if}
    {#if apiError}
      <p style="color: red">API Error: {apiError}</p>
    {/if}
  </section>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 4rem;
    font-family: system-ui, sans-serif;
  }
  .header-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .header-info p {
    margin: 0;
    font-size: 1rem;
  }
  .title {
    color: #ff3e00;
    font-weight: 500;
  }
  .motto {
    color: #444;
    font-style: italic;
  }
  p {
    color: #444;
  }
  .main-content {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    padding: 2rem;
    width: 100%;
    max-width: 800px;
  }

  form {
    margin-top: 1.5rem;
  }

  .prompt-input {
    width: 100%;
    margin-top: 0.5rem;
    font-size: 1rem;
    font-family: inherit;
    border-radius: 6px;
    border: 1px solid #ccc;
    padding: 0.75rem;
    resize: vertical;
    min-height: 120px;
  }

  .generate-button {
    margin-top: 1rem;
  }
  button {
    background: #ff3e00;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.5rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
</style>
