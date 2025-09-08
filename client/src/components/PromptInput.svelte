<script>
  import { promptStore, contentStore, uiStateStore, previewStore } from '../stores';
  import { submitPrompt, exportToPdf, loadPreview } from '../lib/api';
    import { get } from 'svelte/store';

  let currentPrompt;
  promptStore.subscribe(value => {
    currentPrompt = value;
  });

  let uiState;
  uiStateStore.subscribe(value => {
    uiState = value;
  });

  // Quick-insert suggestions for the 'summer' theme
  const insertSummerSuggestion = () => {
    const suggestion = `A short, sunlit summer poem about cicadas and long shadows.`;
    promptStore.set(suggestion);
    // Focus textarea after inserting so keyboard users can immediately edit
    const el = document.getElementById('prompt-textarea');
    if (el) el.focus();
  };

  let isGenerating = false;
  let isPreviewing = false;
  import { previewAbortStore } from '../stores';

  let previewAbortFn = null;
  previewAbortStore.subscribe((fn) => (previewAbortFn = fn));
  // Step 1A: typed-prompt dialog state (do NOT call model in this stage)
  let showTypedPromptDialog = false;
  let typedPrompt = '';
  // Short-term visual feedback: flash the Generate button when clicked
  let generateFlash = false;
  // Preserve original body background for temporary flash
  let originalBodyBg = '';

  const handleSubmit = async () => {
    // Full generation flow (kept for later steps). Not used for Step 1A.
    if (!currentPrompt || !currentPrompt.trim()) {
      try { console.debug('[DEV] PromptInput: setting uiState error: Prompt cannot be empty.'); } catch(e){}
      uiStateStore.set({ status: 'error', message: 'Prompt cannot be empty.' });
      return;
    }
    isGenerating = true;
    try { console.debug('[DEV] PromptInput: setting uiState loading: Generating content...'); } catch(e){}
    uiStateStore.set({ status: 'loading', message: 'Generating content...' });
    try {
      const response = await submitPrompt(currentPrompt);
      // Defensive handling: server may return multiple shapes. Accept the common variants:
      // { data: { content: {...} } } or { content: {...} } or { data: {...} }
      try { console.debug('[DEV] PromptInput: submitPrompt response', response); } catch (e) {}
      let newContent = null;
      if (response) {
        if (response.data && response.data.content) newContent = response.data.content;
        else if (response.content) newContent = response.content;
        else if (response.data && response.data.title && response.data.body) newContent = response.data;
        else if (response.title && response.body) newContent = response;
      }

      if (newContent) {
        contentStore.set(newContent);
        try { console.debug('[DEV] PromptInput: setting uiState success: Content generated successfully.'); } catch(e){}
        uiStateStore.set({ status: 'success', message: 'Content generated successfully.' });
        // Auto-trigger preview after generation completes
        await handlePreviewNow();
      } else {
        // Surface the unexpected response shape for debugging
        console.error('[DEV] PromptInput: unexpected submitPrompt response shape', response);
        throw new Error('Invalid response structure from server.');
      }
    } catch (error) {
      try { console.debug('[DEV] PromptInput: setting uiState error:', error && error.message); } catch(e){}
      uiStateStore.set({ status: 'error', message: error.message || 'An unknown error occurred.' });
    }
    finally {
      isGenerating = false;
    }
  };

  // Step 1A: intercept Generate button to show typed-prompt dialog only (no model call)
  const handleGenerateClick = () => {
    const p = get(promptStore);
    if (!p || !p.trim()) {
      try { console.debug('[DEV] PromptInput: setting uiState error: Prompt cannot be empty.'); } catch(e){}
      uiStateStore.set({ status: 'error', message: 'Prompt cannot be empty.' });
      return;
    }
    // Short-term UX: flash the Generate button (no modal, no model call)
    typedPrompt = p;
    generateFlash = true;
    // ensure flash is visible briefly
    setTimeout(() => { generateFlash = false; }, 700);
    // flash the preview container background to show visible activity local to the preview area
    try {
      const pc = /** @type {HTMLElement|null} */ (document.querySelector('.preview-container'));
      if (pc) {
        const prevBg = pc.style.backgroundColor || getComputedStyle(pc).backgroundColor || '';
        pc.style.backgroundColor = '#ffdddd';
        pc.setAttribute('data-preview-flash', '1');
        setTimeout(() => {
          try { pc.style.backgroundColor = prevBg || ''; pc.removeAttribute('data-preview-flash'); } catch (e){}
        }, 700);
      }
    } catch (e) {}
  // (diagnostic overlay removed) — rely on contentStore/previewStore updates only
    // Option B: local preview shortcut — create a mock content object and render locally
    try {
  const localContent = { title: (typedPrompt || '').split('\n')[0].slice(0, 80) || 'Untitled', body: typedPrompt };
  // Mark this as a local-only preview to avoid triggering the network-backed
  // preview in PreviewWindow which would overwrite the local preview if it
  // is aborted. PreviewWindow will ignore content objects with
  // __localPreview === true for auto-preview.
  contentStore.set({ ...localContent, __localPreview: true });
      // Build local preview HTML and set previewStore directly (avoids network)
  const html = buildLocalPreviewHtml(localContent);
      try { console.debug('[DEV] PromptInput: about to previewStore.set (local) length=', String(html).length); } catch (e) {}
      previewStore.set(html);
      try { console.debug('[DEV] PromptInput: previewStore.set (local) done'); } catch (e) {}
      // Mark DOM with source so we can detect overwrites/hiding in the browser
      try {
        const pc = document.querySelector('.preview-container');
        if (pc) {
          pc.setAttribute('data-preview-source', `local:${Date.now()}`);
        }
      } catch (e) {}
      // mark UI state and DOM marker similar to real flow
      uiStateStore.set({ status: 'success', message: 'Preview (local) updated' });
      try { const pc = document.querySelector('.preview-container'); if (pc) pc.setAttribute('data-preview-local', String(Date.now())); } catch (e) {}
    } catch (e) {
      uiStateStore.set({ status: 'error', message: 'Local preview failed' });
    }
    // intentionally do not call submitPrompt in Step 1A
    showTypedPromptDialog = false;
  };

  // Diagnostic overlay removed — preview is updated only via contentStore/previewStore

  // Build a tiny client-side preview HTML (safe-escaped) to emulate server preview
  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const buildLocalPreviewHtml = (content) => {
    const title = escapeHtml(content.title || 'Preview');
    const body = escapeHtml(content.body || '');
    // Minimal styling to make it visible and similar to server output
    return `
      <article class="local-preview-quick" style="padding:1.25rem">
        <h2 style=\"margin-top:0;\">${title}</h2>
        <div>${body.replace(/\n/g, '<br/>')}</div>
      </article>
    `;
  };

  // Temporary debug helper: force the current prompt into previewStore
  const forceRenderPromptPreview = () => {
    const current = get(promptStore) || '';
    const localContent = { title: (current || '').split('\n')[0].slice(0, 80) || 'Untitled', body: current };
    const html = buildLocalPreviewHtml(localContent);
    try { console.debug('[DEV] forceRenderPromptPreview: setting previewStore (force) length=', String(html).length); } catch (e) {}
    previewStore.set(html);
    uiStateStore.set({ status: 'success', message: 'Preview updated (forced)' });
  };

  const closeTypedPromptDialog = () => {
    showTypedPromptDialog = false;
    // Return focus to the textarea for keyboard users
    const el = document.getElementById('prompt-textarea');
    if (el) el.focus();
  };

  

  const handlePreviewNow = async () => {
    const current = get(contentStore);
    if (!current) {
      try { console.debug('[DEV] handlePreviewNow: setting uiState error: No content to preview.'); } catch(e){}
      uiStateStore.set({ status: 'error', message: 'No content to preview. Generate content first.' });
      return;
    }
  // Delegate preview loading to PreviewWindow: update contentStore which will
  // trigger the PreviewWindow subscription and its abortable fetch logic.
  try { console.debug('[DEV] handlePreviewNow: delegating preview to PreviewWindow (contentStore.set)'); } catch (e) {}
  // Re-set the content so subscribers will react (forces update even if same object).
  // If the content was previously marked as a local quick-preview, remove
  // that marker so PreviewWindow will perform the server-backed preview.
  const sanitized = { ...current };
  if (sanitized.__localPreview) delete sanitized.__localPreview;
  contentStore.set(sanitized);
  };

  // In-UI smoke test: runs preview -> export and saves PDF on success or diagnostic JSON on failure
  const runSmokeTest = async () => {
    const current = get(contentStore);
    if (!current) {
      try { console.debug('[DEV] runSmokeTest: setting uiState error: No content to run smoke test.'); } catch(e){}
      uiStateStore.set({ status: 'error', message: 'No content to run smoke test. Load or generate content first.' });
      return;
    }

    try { console.debug('[DEV] runSmokeTest: setting uiState loading: Running smoke test (preview → export)...'); } catch(e){}
    uiStateStore.set({ status: 'loading', message: 'Running smoke test (preview → export)...' });
    try {
      // Ensure preview renders
      await handlePreviewNow();

      // Trigger export which downloads a PDF if successful
      await exportToPdf(current);

      try { console.debug('[DEV] runSmokeTest: setting uiState success: Smoke test succeeded — PDF downloaded.'); } catch(e){}
      uiStateStore.set({ status: 'success', message: 'Smoke test succeeded — PDF downloaded.' });
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

      try { console.debug('[DEV] runSmokeTest: setting uiState error: Smoke test failed — diagnostic saved.'); } catch(e){}
      uiStateStore.set({ status: 'error', message: 'Smoke test failed — diagnostic saved.' });
    }
  };
</script>

  <div class="prompt-container">
  <label for="prompt-textarea">Prompt</label>
  <textarea
    id="prompt-textarea"
    data-testid="prompt-textarea"
    bind:value={$promptStore}
    rows="6"
    placeholder="e.g., A noir detective story set in a city of robots."
  disabled={(uiState && uiState.status === 'loading')}
  ></textarea>
  <div class="controls-row">
    <button
      class="suggestion"
      on:click={insertSummerSuggestion}
      title="Insert summer prompt suggestion"
      aria-label="Insert a summer prompt suggestion"
      data-testid="summer-suggestion"
      disabled={uiState.status === 'loading'}
    >
      Summer suggestion
    </button>
    <button
      class="demo"
      style="display:none"
      aria-hidden="true"
      title="Load full V0.1 demo content (developer helper - hidden)"
      data-testid="load-demo"
      disabled={uiState.status === 'loading'}
    >
      Load V0.1 demo
    </button>
  <button data-testid="generate-button" class:flash={generateFlash} on:click={handleGenerateClick} disabled={(uiState && uiState.status === 'loading') || isGenerating || isPreviewing}>
        {#if isGenerating}
          <span class="btn-spinner" aria-hidden="true"></span> Generating...
        {:else}
          Generate
        {/if}
      </button>
  <button data-testid="preview-button" on:click={handlePreviewNow} disabled={(uiState && uiState.status === 'loading') || isGenerating || isPreviewing}>
      {#if isPreviewing}
        Previewing...
      {:else}
        Preview
      {/if}
    </button>
    <!-- Temporary test button: force the prompt text into the preview area immediately -->
    <button data-testid="force-preview-button" class="test" on:click={forceRenderPromptPreview} title="Force prompt into preview" disabled={(uiState && uiState.status === 'loading') || isGenerating || isPreviewing}>
      Force Preview
    </button>
    {#if previewAbortFn}
      <button data-testid="prompt-cancel-preview" on:click={() => { try { previewAbortFn(); } catch(e){} }}>
        Cancel Preview
      </button>
    {/if}
    <button data-testid="smoke-button" style="display:none" aria-hidden="true" title="Run preview→export smoke test (developer helper - hidden)" on:click={runSmokeTest} disabled={uiState.status === 'loading' || isGenerating || isPreviewing}>
      Run smoke test
    </button>
  </div>
  
  {#if uiState.status === 'error'}
    <p class="error-message">{uiState.message}</p>
  {/if}
</div>

  {#if showTypedPromptDialog}
    <div class="typed-prompt-backdrop" role="dialog" aria-modal="true">
      <div class="typed-prompt-modal" role="document">
    <h3 id="typed-prompt-title">Hi</h3>
  <p class="typed-prompt-text">Hi</p>
        <div class="typed-prompt-actions">
          <button on:click={closeTypedPromptDialog} data-testid="typed-prompt-ok">OK</button>
        </div>
      </div>
    </div>
  {/if}

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
  .error-message {
    color: #e74c3c;
    margin-top: 0.5rem;
  }
  /* Typed prompt modal styles (Step 1A) */
  .typed-prompt-backdrop {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .typed-prompt-modal {
    background: white;
    padding: 1rem 1.25rem;
    border-radius: 8px;
    max-width: 640px;
    width: 90%;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  }
  .typed-prompt-text { margin-top: 0.5rem; white-space: pre-wrap }
  .typed-prompt-actions { margin-top: 1rem; text-align: right }
  button.flash {
    background-color: #c0392b !important;
    box-shadow: 0 0 0 4px rgba(192,57,43,0.12);
    transform: scale(1.03);
  }
</style>
