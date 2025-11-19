<script>
  import { flowStore } from '../lib/stores/flowStore.js';

  export let result = null;
  export let onCustomizeStyle = () => {};
  export let onDownloadPDF = () => {};
  export let onNewPrompt = () => {};

  $: data = result || $flowStore.result || {};
  $: pdfUrl = data.pdfUrl || '';
  $: pageCount = data.pageCount || 0;
  $: classification = $flowStore.classification || {};

  // Format file size (placeholder)
  function formatFileSize(bytes) {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  // Extract filename from URL
  function getFileName(url) {
    if (!url) return 'output.pdf';
    const parts = url.split('/');
    return parts[parts.length - 1] || 'output.pdf';
  }

  // Handle PDF download
  function handleDownload() {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = getFileName(pdfUrl);
      link.click();
    }
    onDownloadPDF();
  }
</script>

<div class="results-display">
  <div class="preview-container">
    <div class="preview-header">
      <h2>Generated PDF Preview</h2>
      <span class="file-info">
        {pageCount} page{pageCount !== 1 ? 's' : ''}
      </span>
    </div>

    {#if pdfUrl}
      <div class="pdf-preview">
        <iframe
          src={pdfUrl}
          title="PDF Preview"
          sandbox="allow-scripts"
          loading="lazy"
        ></iframe>
      </div>
    {:else}
      <div class="preview-placeholder">
        <span class="icon">📄</span>
        <p>PDF preview unavailable</p>
      </div>
    {/if}
  </div>

  <div class="metadata-panel">
    <h3>File Details</h3>

    <div class="metadata-list">
      {#if classification.medium}
        <div class="metadata-item">
          <span class="label">Medium</span>
          <span class="value">{classification.medium}</span>
        </div>
      {/if}

      {#if classification.style}
        <div class="metadata-item">
          <span class="label">Style</span>
          <span class="value">{classification.style}</span>
        </div>
      {/if}

      {#if pageCount}
        <div class="metadata-item">
          <span class="label">Pages</span>
          <span class="value">{pageCount}</span>
        </div>
      {/if}

      {#if data.latency}
        <div class="metadata-item">
          <span class="label">Generation Time</span>
          <span class="value">{(data.latency / 1000).toFixed(2)}s</span>
        </div>
      {/if}

      {#if data.costEstimate}
        <div class="metadata-item">
          <span class="label">Cost Estimate</span>
          <span class="value">${data.costEstimate.toFixed(2)}</span>
        </div>
      {/if}
    </div>
  </div>

  <div class="action-buttons">
    <button class="btn btn-primary" on:click={onCustomizeStyle}>
      🎨 Customize Style
    </button>
    <button class="btn btn-secondary" on:click={handleDownload}>
      ⬇️ Download PDF
    </button>
    <button class="btn btn-tertiary" on:click={onNewPrompt}>
      ➕ Create Another
    </button>
  </div>
</div>

<style>
  .results-display {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 24px;
    margin: 16px 0;
  }

  .preview-container {
    margin-bottom: 24px;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .preview-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
  }

  .file-info {
    font-size: 13px;
    color: #6b7280;
    background: #f3f4f6;
    padding: 4px 12px;
    border-radius: 12px;
  }

  .pdf-preview {
    position: relative;
    width: 100%;
    height: 400px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
  }

  .pdf-preview iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  .preview-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    background: #f9fafb;
    border: 2px dashed #d1d5db;
    border-radius: 6px;
    color: #6b7280;
    gap: 12px;
  }

  .preview-placeholder .icon {
    font-size: 48px;
  }

  .metadata-panel {
    margin-bottom: 24px;
    padding: 16px;
    background: #f9fafb;
    border-radius: 6px;
  }

  .metadata-panel h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .metadata-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
  }

  .metadata-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .metadata-item .label {
    font-size: 11px;
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .metadata-item .value {
    font-size: 14px;
    color: #1f2937;
    font-weight: 500;
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .btn {
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    flex: 1;
    min-width: 120px;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: #10b981;
    color: white;
  }

  .btn-secondary:hover {
    background: #059669;
  }

  .btn-tertiary {
    background: #f3f4f6;
    color: #1f2937;
    border: 1px solid #d1d5db;
  }

  .btn-tertiary:hover {
    background: #e5e7eb;
  }
</style>
