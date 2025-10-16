<script>
  import { previewStore } from "../lib/storeAdapter.js";
  import { onMount } from "svelte";

  // Minimal uiState for showing loading state; in real implementation
  // this will be wired to a proper store.
  export let uiState = { status: "idle", message: "" };

  // Spinner (inline small component)
  let showSkeleton = false;
  let skeletonTimer;
  const SKELETON_MIN_MS = 200; // ensure short visibility to avoid flicker

  $: if (uiState.status === "loading") {
    clearTimeout(skeletonTimer);
    showSkeleton = true;
  } else {
    // keep skeleton visible for a short minimum time to avoid flicker
    clearTimeout(skeletonTimer);
    skeletonTimer = setTimeout(() => {
      showSkeleton = false;
    }, SKELETON_MIN_MS);
  }

  // Mirror test hook behavior: update body attribute when preview present
  $: {
    if (typeof document !== "undefined") {
      if ($previewStore && $previewStore.length > 0) {
        document.body.setAttribute("data-preview-ready", "true");
      } else {
        document.body.removeAttribute("data-preview-ready");
      }
    }
  }

  // Dev debug overlay toggle
  let showDebug = false;

  onMount(() => {
    try {
      const params =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      if (params && params.get("debugPreview") === "1") showDebug = true;
      if (
        typeof window !== "undefined" &&
        window.localStorage &&
        window.localStorage.getItem("__SHOW_PREVIEW_DEBUG__") === "1"
      )
        showDebug = true;
    } catch (e) {}
  });
</script>

<div class="preview-container">
  {#if uiState.status === "loading"}
    <div class="loading-overlay">
      {#if showSkeleton}
        <div class="skeleton">
          <div class="s-line" style="width:70%"></div>
          <div class="s-line" style="width:90%"></div>
          <div class="s-line" style="width:60%"></div>
        </div>
      {:else}
        <p>{uiState.message || "Loading Preview..."}</p>
      {/if}
    </div>
  {:else if $previewStore && $previewStore.body}
    <div
      class="preview-window-content"
      data-testid="preview-content"
      data-preview-ready={$previewStore && $previewStore.body.length > 0}
    >
      {@html $previewStore.body}
    </div>
  {:else}
    <div class="placeholder">Your generated preview will appear here.</div>
  {/if}
</div>

{#if showDebug}
  <div class="preview-debug-overlay" data-testid="preview-debug-overlay">
    <h4>Preview Debug</h4>
    <div>
      <strong>Preview length:</strong>
      {$previewStore ? $previewStore.length : 0}
    </div>
    <div style="margin-top:8px">
      <strong>Preview HTML (truncated):</strong>
      <pre>{String($previewStore || "").substring(0, 2000)}</pre>
    </div>
  </div>
{/if}

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
  .preview-window-content {
    padding: 1.5rem;
    text-align: left;
    width: 100%;
    height: 100%;
  }
  .skeleton {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .s-line {
    height: 12px;
    background: #eee;
    border-radius: 6px;
  }
  .preview-debug-overlay {
    position: fixed;
    right: 12px;
    bottom: 12px;
    width: 320px;
    max-height: 40vh;
    overflow: auto;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    font-family: monospace;
    font-size: 12px;
    padding: 8px;
    border-radius: 6px;
    z-index: 9999;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  }
  /* Print-safe rules: avoid breaking preview content across pages */
  @media print {
    .preview-window-content {
      page-break-inside: avoid;
    }
    .preview-container {
      border: none;
      background: #fff;
    }
  }

  /* Use a readable serif/sans stack similar to canonical client */
  .preview-window-content,
  .preview-container {
    font-family: Georgia, "Times New Roman", Times, serif;
    color: #111;
  }
</style>
