<script>
  import { onMount } from 'svelte';
  import { previewStore, uiStateStore } from '$lib/stores';
  import Spinner from './Spinner.svelte';

  const _win = typeof window !== 'undefined' ? window : {};

  // Dev-only assertion: if previewStore is not the canonical instance,
  // log a detailed error to help diagnose rogue imports caused by HMR/module
  // resolution divergence. This will not run in production.
  try {
    if (typeof window !== 'undefined' && window.IS_DEV) {
      try {
        const importedId = (previewStore && previewStore.__chronos_id) || null;
        const isCanonical = !!(previewStore && previewStore.__is_canonical);
        const globalId = (_win.__CHRONOS_STORES__ && _win.__CHRONOS_STORES__.__STORE_IDS__ && _win.__CHRONOS_STORES__.__STORE_IDS__.previewStore) || null;
        if (!isCanonical) {
          console.error('[DIAG][PreviewWindow] Imported previewStore is NOT canonical', {
            importedId,
            importedModuleUrl: (previewStore && previewStore.__module_url) || null,
            globalId,
            windowHasCanonical: !!(_win.__CHRONOS_STORES__ && _win.__CHRONOS_STORES__.previewStore),
          });
        }
      } catch (e) {}
    }
  } catch (e) {}

  onMount(() => {
    try {
      const verbose = _win.IS_DEV || false;
      if (verbose) {
        try {
          console.debug('[DIAG] PreviewWindow mounted. global store ids:', (_win.__CHRONOS_STORES__ && _win.__CHRONOS_STORES__.__STORE_IDS__) || null);
          console.debug('[DIAG] PreviewWindow mounted. imported previewStore id:', (previewStore && previewStore.__chronos_id) || null);
        } catch (e) {}

        // Dev-only instrumentation: subscribe to the previewStore and write what
        // the mounted PreviewWindow actually observes to a global for probes.
        try {
          const unsub = previewStore.subscribe(value => {
            try {
              const observedId = (previewStore && previewStore.__chronos_id) || null;
              const valStr = typeof value === 'string' ? value : String(value || '');
              const snippet = valStr.substring(0, 200);
              const len = valStr.length;
              _win.__PREVIEW_WINDOW_LAST__ = {
                observedStoreId: observedId,
                observedValueLength: len,
                observedSnippet: snippet,
                ts: Date.now(),
                source: 'PreviewWindow'
              };
            } catch (e) {}
          });

          // Return cleanup so Svelte can unsubscribe when component is destroyed.
          return () => {
            try { unsub(); } catch (e) {}
          };
        } catch (e) {}
      }
    } catch (e) {}
  });

  let uiState = { status: 'idle', message: '' };
  uiStateStore.subscribe(value => {
    uiState = value || { status: 'idle', message: '' };
  });

  // Test hook: Set an attribute on the body when the preview is rendered
  // so that integration tests can reliably wait for the update.
  $: {
    if (typeof document !== 'undefined') {
      if ($previewStore && $previewStore.length > 0) {
        document.body.setAttribute('data-preview-ready', '1');
        try {
          // Expose store identity info on the DOM for runtime inspection
          const globalId = (_win.__CHRONOS_STORES__ && _win.__CHRONOS_STORES__.__STORE_IDS__ && _win.__CHRONOS_STORES__.__STORE_IDS__.previewStore) || null;
          document.body.setAttribute('data-global-preview-store-id', String(globalId || ''));
        } catch (e) {}
        if (_win.IS_DEV) {
          try {
            console.debug('[DEV] PreviewWindow reactive update:', {
              previewLength: $previewStore.length,
              previewSnippet: String($previewStore).substring(0, 100) + '...',
              importedPreviewStoreId: (previewStore && previewStore.__chronos_id) || null,
              globalPreviewStoreId:
                (_win.__CHRONOS_STORES__ && _win.__CHRONOS_STORES__.__STORE_IDS__ && _win.__CHRONOS_STORES__.__STORE_IDS__.previewStore) || null,
              globalPreviewStorePresent: !!(_win.__CHRONOS_STORES__ && _win.__CHRONOS_STORES__.previewStore),
            });
          } catch (e) {}
        }
      } else {
        document.body.removeAttribute('data-preview-ready');
        if (_win.IS_DEV) {
          try {
            console.debug('[DEV] PreviewWindow reactive update: No preview content', {
              importedPreviewStoreId: (previewStore && previewStore.__chronos_id) || null,
              globalPreviewStoreId:
                (_win.__CHRONOS_STORES__ && _win.__CHRONOS_STORES__.__STORE_IDS__ && _win.__CHRONOS_STORES__.__STORE_IDS__.previewStore) || null,
            });
          } catch (e) {}
        }
      }
    }
  }
</script>

<div class="preview-container">
  {#if uiState.status === 'loading'}
    <div class="loading-overlay">
      <Spinner />
      <p>{uiState.message || 'Loading Preview...'}</p>
    </div>
    {:else if $previewStore}
    <div class="preview-content" data-testid="preview-content" data-chronos-preview-store-id={(previewStore && previewStore.__chronos_id) || ''}>
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
    min-height: 240px;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .loading-overlay {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: #888;
  }
  .preview-content {
    padding: 1.5rem;
    text-align: left;
    width: 100%;
    height: 100%;
  }
  .placeholder {
    color: #888;
  }
  .preview-debug-overlay {
    position: fixed;
    right: 12px;
    bottom: 12px;
    width: 320px;
    max-height: 40vh;
    overflow: auto;
    background: rgba(0,0,0,0.8);
    color: #fff;
    font-family: monospace;
    font-size: 12px;
    padding: 8px;
    border-radius: 6px;
    z-index: 9999;
    box-shadow: 0 6px 18px rgba(0,0,0,0.3);
  }
  .preview-debug-overlay h4 { margin: 0 0 6px 0; font-size: 13px }
  .preview-debug-overlay pre { white-space: pre-wrap; word-break: break-word; }
</style>

<!-- HMR touch -->

{#if (typeof window !== 'undefined') && (new URLSearchParams(window.location.search).get('debugPreview') === '1' || (window.localStorage && window.localStorage.getItem('__SHOW_PREVIEW_DEBUG__') === '1'))}
    <div class="preview-debug-overlay" data-testid="preview-debug-overlay">
    <h4>Preview Debug</h4>
    <div><strong>Imported previewStore id:</strong> {(previewStore && previewStore.__chronos_id) || 'n/a'}</div>
    <div><strong>Global previewStore id:</strong> {(_win.__CHRONOS_STORES__ && _win.__CHRONOS_STORES__.__STORE_IDS__ && _win.__CHRONOS_STORES__.__STORE_IDS__.previewStore) || 'n/a'}</div>
    <div style="margin-top:8px"><strong>Preview HTML (truncated):</strong>
      <pre>{String($previewStore || '').substring(0, 2000)}</pre>
    </div>
  </div>
{/if}

