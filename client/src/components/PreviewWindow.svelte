<script>
  import { contentStore, previewStore, uiStateStore } from '../stores';
  import { previewAbortStore } from '../stores';
  import { loadPreview, abortableFetch } from '../lib/api';
  import Spinner from './Spinner.svelte';
  import PreviewSkeleton from './PreviewSkeleton.svelte';
  import { onMount } from 'svelte';

  import { debounce } from '../lib/utils';

  let content;
  // Default uiState to avoid undefined access during initial render in tests
  let uiState = { status: 'idle', message: '' };

  // expose debug hook for automated verification: latest preview HTML
  let latestPreviewHtml = '';
  $: if ($previewStore) {
    latestPreviewHtml = $previewStore;
    try { console.debug('[DEV] PreviewWindow: $previewStore length=', String($previewStore).length); } catch (e) {}
    try {
      // @ts-ignore
      window.__preview_updated_ts = Date.now();
      // @ts-ignore
      window.__preview_html_snippet = String($previewStore).slice(0, 1200);
      // Dev helper: expose function to read the full preview HTML easily
      try { /** @type {any} */ (window).__getPreviewHtml = () => String($previewStore || ''); } catch (e) {}
      try { /** @type {any} */ (window).__getUiState = () => uiState || null; } catch (e) {}
    } catch (e) {}
  }


  // Subscribe to stores during component lifecycle to ensure Svelte's
  // lifecycle helpers (onDestroy) have a valid component context. Subscriptions
  // are cleaned up when the component is unmounted.
  onMount(() => {
    const unsubContent = contentStore.subscribe(value => {
      content = value;
  // If content is a locally-created quick preview (from PromptInput),
  // skip the network-backed autoPreview so the local preview isn't
  // immediately overwritten.
  const isLocalQuick = content && content.__localPreview;
  if (content && autoPreview && !isLocalQuick) {
        // Debounced auto update to avoid rapid requests
        debouncedUpdate(content);
      }
    });

    const unsubUi = uiStateStore.subscribe(value => {
      uiState = value;
    });

    // If initial content exists, trigger a preview
    if (content) updatePreview(content);

    return () => {
      try { unsubContent(); } catch (e) {}
      try { unsubUi(); } catch (e) {}
      // cleanup dev helpers exposed on window
      try { /** @type {any} */ (window).__getPreviewHtml = null; } catch (e) {}
      try { /** @type {any} */ (window).__getUiState = null; } catch (e) {}
      try { /** @type {any} */ (window).__previewAbort = null; } catch (e) {}
      try { /** @type {any} */ (window).__preview_html_snippet = null; } catch (e) {}
      try { /** @type {any} */ (window).__preview_updated_ts = null; } catch (e) {}
      previewAbortStore.set(null);
    };
  });

  // Dev-only DOM marker to help automated verification detect updates
  $: if (import.meta.env.DEV && $previewStore) {
    try {
      const el = document.querySelector('.preview-container');
      if (el) el.setAttribute('data-preview-updated', String(Date.now()));
    } catch (e) {}
  }

  // Background preview URL derived from content.background (filename or absolute URL)
  $: bgUrl = null;
  $: if (content && content.background) {
    if (typeof content.background === 'string' && content.background.startsWith('http')) {
      bgUrl = content.background;
    } else {
      bgUrl = `/samples/images/${encodeURIComponent(content.background)}`;
    }
  }

  // Preview controls
  let autoPreview = true;
  let flash = false;
  // update token to prevent race conditions
  let latestUpdateId = 0;
  let isPreviewing = false;

  // Abort controller for the current preview request so user can cancel
  let currentPreviewAbort = null;

  const updatePreview = async (newContent) => {
    if (!newContent) {
      previewStore.set('');
      return;
    }
    const updateId = ++latestUpdateId;
    isPreviewing = true;
    // show loading state
    uiStateStore.set({ status: 'loading', message: 'Loading preview...' });
    // enforce minimal skeleton visibility to avoid flash
    const skeletonShownAt = Date.now();
    try {
      // Use abortable fetch for the active preview so we can cancel long requests.
      if (currentPreviewAbort) {
        try { currentPreviewAbort(); } catch (e) {}
        currentPreviewAbort = null;
      }
      const { promise, abort } = abortableFetch(`/preview?content=${encodeURIComponent(JSON.stringify(newContent))}`, {
        // Prefer fail-fast for UI-driven previews
        retryConfig: { maxRetries: 1, initialBackoffMs: 200, maxBackoffMs: 2000 },
      });
      currentPreviewAbort = abort;
      // expose abort to other components
      previewAbortStore.set(() => {
        try { currentPreviewAbort(); } catch (e) {}
      });
      // Test helper: expose global abort for e2e tests
  try { /** @type {any} */ (window).__previewAbort = () => { try { currentPreviewAbort(); } catch (e) {} }; } catch (e) {}
      const resp = await promise;
      if (!resp.ok) throw new Error(`Preview request failed: ${resp.status}`);
      const html = await resp.text();
  currentPreviewAbort = null;
  previewAbortStore.set(null);
  try { /** @type {any} */ (window).__previewAbort = null; } catch (e) {}
      // only apply if this update matches latest
      if (updateId === latestUpdateId) {
        const elapsed = Date.now() - skeletonShownAt;
        const minVisible = 300;
        if (elapsed < minVisible) await new Promise(r => setTimeout(r, minVisible - elapsed));
        previewStore.set(html);
        flash = true;
        setTimeout(() => (flash = false), 600);
        uiStateStore.set({ status: 'success', message: 'Preview loaded' });
      }
    } catch (error) {
      if (updateId === latestUpdateId) {
  // Distinguish between abort and other errors
  const msg = error && error.name === 'AbortError' ? 'Preview canceled' : `Failed to load preview: ${error.message}`;
  uiStateStore.set({ status: error && error.name === 'AbortError' ? 'idle' : 'error', message: msg });
        previewStore.set('');
      }
    } finally {
  if (updateId === latestUpdateId) isPreviewing = false;
  previewAbortStore.set(null);
  try { /** @type {any} */ (window).__previewAbort = null; } catch (e) {}
    }
  };

  // Debounced auto update to avoid rapid requests (200ms for snappier feel)
  const debouncedUpdate = debounce(updatePreview, 200);

  onMount(() => {
    if (content) {
      updatePreview(content);
    }
  });

  function cancelPreview() {
    if (currentPreviewAbort) {
      try { currentPreviewAbort(); } catch (e) {}
      currentPreviewAbort = null;
      uiStateStore.set({ status: 'idle', message: 'Preview canceled' });
      isPreviewing = false;
    }
  }
</script>

  <div class="preview-container">
  <div class="preview-controls">
    <label><input type="checkbox" data-testid="auto-preview-checkbox" bind:checked={autoPreview} /> Auto-preview</label>
    <button data-testid="preview-now-button" on:click={() => updatePreview(content)} disabled={!content || uiState.status === 'loading'}>
      {#if uiState.status === 'loading'}
        Previewing...
      {:else}
        Preview Now
      {/if}
    </button>
    {#if isPreviewing}
      <button data-testid="cancel-preview-button" on:click={cancelPreview}>Cancel</button>
    {/if}
  </div>

  {#if $previewStore}
    <div class="preview-stage {flash ? 'flash' : ''}">
      {#if bgUrl}
        <div class="bg-preview"><img src={bgUrl} alt="background preview" /></div>
      {/if}
      <div id="preview-content" class="preview-content" data-testid="preview-content">
        {@html $previewStore}
      </div>
    </div>
  {:else if isPreviewing || uiState.status === 'loading'}
    <div class="loading-overlay">
      <PreviewSkeleton />
      <div class="center-spinner"><Spinner /></div>
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
    min-height: 240px; /* ensure preview area isn't collapsed to zero height */
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

  .preview-stage { position: relative; min-height: 300px }
  .bg-preview { position: absolute; inset: 0; opacity: 0.45; pointer-events: none }
  .bg-preview img { width: 100%; height: 100%; object-fit: cover }
  .preview-stage .preview-content { position: relative; z-index: 2 }

  /* flash highlight when preview updates */
  .preview-stage.flash {
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15) inset, 0 0 0 2px rgba(66,153,225,0.08);
    transition: box-shadow 0.45s ease-out;
  }
</style>
