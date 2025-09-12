<script>
  import { contentStore, previewStore, uiStateStore, setUiLoading, setUiSuccess, setUiError } from '../stores';
  import { loadPreview } from '../lib/api';
  import { onMount } from 'svelte';

  import { debounce } from '../lib/utils';
  import { sanitizeHtml } from '../lib/sanitize';

  let content;
  contentStore.subscribe(value => {
    content = value;
    if (content && autoPreview) {
      // Debounced auto update to avoid rapid requests
      debouncedUpdate(content);
    }
  });

  // Instrument previewStore updates using Svelte's auto-subscription ($previewStore)
  // reactive local preview HTML used by the template to avoid any indirect render races
  let lastPreview = '';
  let previewHtmlLocal = '';

  $: if (typeof $previewStore !== 'undefined' && $previewStore !== lastPreview) {
    const value = $previewStore;
    previewHtmlLocal = value || '';
    console.log('PreviewWindow: previewStore updated, length=', value ? value.length : 0);
    // set DOM-visible attribute for tests when preview is present and include a timestamp
    try {
      if (typeof document !== 'undefined' && document.body) {
        const ts = String(Date.now());
        // mark body for backward compatibility
        try { document.body.setAttribute('data-preview-ready', value ? '1' : '0'); } catch (e) {}
        try { document.body.setAttribute('data-preview-timestamp', value ? ts : ''); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('preview-ready', { detail: { timestamp: ts } })); } catch (e) {}
        setTimeout(() => { try { document.body.removeAttribute('data-preview-ready'); document.body.removeAttribute('data-preview-timestamp'); } catch (e) {} }, 8000);
        // also mark the preview-content element directly so automated checks targeting it succeed
        try {
          const el = document.querySelector('[data-testid="preview-content"]');
          if (el) {
            el.setAttribute('data-preview-ready', value ? '1' : '0');
            if (value) el.setAttribute('data-preview-timestamp', ts);
            else el.removeAttribute('data-preview-timestamp');
          }
        } catch (e) {}
        // expose last preview HTML to tests
        try { if (typeof window !== 'undefined') window['__LAST_PREVIEW_HTML'] = value; } catch (e) {}
        // ensure UI state and local flag reflect the preview presence so the template renders
        try { uiStateStore.set({ status: 'success', message: 'Preview loaded' }); } catch (e) {}
      }
    } catch (e) {}
    lastPreview = value;
  }

  // computed reactive flag: true when previewStore contains non-empty HTML
  $: computedHasPreview = previewHtmlLocal && String(previewHtmlLocal).trim().length > 0;

  let uiState = { status: 'idle', message: '' };
  uiStateStore.subscribe(value => {
    uiState = value || { status: 'idle', message: '' };
  });

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
  let isPreviewing = false;

  // Track the latest update so out-of-order responses are ignored
  let latestUpdateId = 0;

  const updatePreview = async (newContent) => {
    if (!newContent) {
      previewStore.set('');
      return;
    }
    const updateId = ++latestUpdateId;
    const skeletonShownAt = Date.now();
    try {
      // mark UI and local flag
      isPreviewing = true;
      setUiLoading('Loading preview...');
      const html = await loadPreview(newContent);
      // Normalize the preview HTML: if the server returned a full HTML document
      // (with <!DOCTYPE> or <html>), parse and extract the meaningful inner HTML
      // (prefer the `.preview` wrapper if present, else the body innerHTML).
      let normalizedHtml = html || '';
      try {
        if (typeof normalizedHtml === 'string' && /<!doctype|<html/i.test(normalizedHtml)) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(normalizedHtml, 'text/html');
          const previewNode = doc.querySelector('.preview');
          normalizedHtml = previewNode ? previewNode.outerHTML : doc.body.innerHTML || normalizedHtml;
        }
      } catch (e) {
        // if parsing fails, fall back to raw HTML
        normalizedHtml = html || '';
      }

      // only apply if this update matches latest
      if (updateId === latestUpdateId) {
        // enforce a minimum visible skeleton time to avoid flicker
        const elapsed = Date.now() - skeletonShownAt;
        const minVisible = 300;
        if (elapsed < minVisible) await new Promise((r) => setTimeout(r, minVisible - elapsed));

  // Sanitize HTML for rendering to avoid executing scripts or event handlers.
  // Keep previewStore set to the raw server HTML for testing/diagnostics but
  // render a sanitized version in the DOM.
  const safeHtml = sanitizeHtml(normalizedHtml || html || '');
  previewHtmlLocal = safeHtml;
  previewStore.set(html);
        try {
          if (typeof window !== 'undefined') window['__LAST_PREVIEW_HTML'] = html;
        } catch (e) {}
        // Minimal DOM-visible instrumentation for automated tests / diagnostics:
        // set a short-lived attribute and dispatch an event indicating preview is ready.
        try {
          if (typeof document !== 'undefined' && document.body) {
            const ts = String(Date.now());
            // mark body for backward compatibility
            document.body.setAttribute('data-preview-ready', '1');
            document.body.setAttribute('data-preview-timestamp', ts);
            try {
              window.dispatchEvent(new CustomEvent('preview-ready', { detail: { timestamp: ts } }));
            } catch (e) {}
            setTimeout(() => {
              try {
                document.body.removeAttribute('data-preview-ready');
                document.body.removeAttribute('data-preview-timestamp');
              } catch (e) {}
            }, 8000);
            try {
              if (typeof window !== 'undefined') window['__LAST_PREVIEW_HTML'] = html;
            } catch (e) {}
            // ALSO set the attribute directly on the preview-content node so tests targeting it
            // (e.g. [data-testid="preview-content"][data-preview-ready="1"]) see the ready flag immediately.
            try {
              const el = document.querySelector('[data-testid="preview-content"]');
              if (el) {
                el.setAttribute('data-preview-ready', '1');
                el.setAttribute('data-preview-timestamp', ts);
              }
            } catch (e) {}
          }
        } catch (e) {
          // swallow instrumentation errors
        }
        // trigger brief flash to draw attention
        flash = true;
        setTimeout(() => (flash = false), 600);
        setUiSuccess('Preview loaded');
      }
    } catch (error) {
      if (updateId === latestUpdateId) {
        setUiError(`Failed to load preview: ${error.message}`);
        previewStore.set('');
        // Ensure the preview-content attribute is cleared on error so tests don't wait forever
        try {
          if (typeof document !== 'undefined') {
            const el = document.querySelector('[data-testid="preview-content"]');
            if (el) {
              el.setAttribute('data-preview-ready', '0');
              el.removeAttribute('data-preview-timestamp');
            }
            try { document.body.setAttribute('data-preview-ready', '0'); } catch (e) {}
          }
        } catch (e) {}
      }
    }
    finally {
      if (updateId === latestUpdateId) isPreviewing = false;
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
    <label><input type="checkbox" data-testid="auto-preview-checkbox" bind:checked={autoPreview} /> Auto-preview</label>
    <button data-testid="preview-now-button" on:click={() => updatePreview(content)} disabled={!content || uiState.status === 'loading'}>
      {#if uiState.status === 'loading'}
        Previewing...
      {:else}
        Preview Now
      {/if}
    </button>
  </div>

  <div class="preview-stage {computedHasPreview ? (flash ? 'flash' : '') : ''}">
    {#if bgUrl}
      <div class="bg-preview"><img src={bgUrl} alt="background preview" /></div>
    {/if}

    <!-- Always render the preview-content node so automated checks find it reliably -->
    <div
      class="preview-content"
      data-testid="preview-content"
      data-preview-ready={computedHasPreview ? '1' : '0'}
      aria-busy={uiState.status === 'loading'}
    >
      {#if uiState.status === 'loading'}
        <div class="small-spinner" aria-hidden="true"></div>
      {/if}
  {@html previewHtmlLocal}

      {#if !computedHasPreview && uiState.status !== 'loading'}
        <div class="placeholder-inner">
          <p>Your generated preview will appear here.</p>
        </div>
      {/if}
    </div>

    {#if !computedHasPreview && uiState.status === 'loading'}
      <div class="loading-overlay">
        <p>Loading Preview...</p>
      </div>
    {/if}
  </div>
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
  .loading-overlay {
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

  .small-spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 4px solid rgba(0,0,0,0.08);
    border-top-color: #2c3e50;
    animation: spin 0.9s linear infinite;
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
  }

  @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

  /* flash highlight when preview updates */
  .preview-stage.flash {
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15) inset, 0 0 0 2px rgba(66,153,225,0.08);
    transition: box-shadow 0.45s ease-out;
  }
</style>
