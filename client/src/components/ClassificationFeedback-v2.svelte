<script>
  import { flowStore } from '../lib/stores/flowStore.js';

  export let classification = null;
  export let onAccept = () => {};
  export let onRequestOverride = () => {};

  $: data = classification || $flowStore.classification || {};
  $: confidence = data.confidence || 0;
  $: source = data.source || 'Unknown';

  // Determine confidence color based on percentage
  function getConfidenceColor(conf) {
    if (conf >= 0.85) return 'text-green-700';
    if (conf >= 0.7) return 'text-yellow-600';
    return 'text-orange-600';
  }

  // Format confidence as percentage
  function formatConfidence(conf) {
    return Math.round(conf * 100);
  }

  // Format source badge
  function getSourceBadge(src) {
    const badges = {
      'rules': { icon: '⚙️', label: 'Rules-Based', color: 'bg-blue-100 text-blue-800' },
      'ai': { icon: '🤖', label: 'AI-Generated', color: 'bg-purple-100 text-purple-800' },
      'hybrid': { icon: '🔀', label: 'Hybrid', color: 'bg-indigo-100 text-indigo-800' }
    };
    return badges[src.toLowerCase()] || { icon: '❓', label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  }

  const sourceBadge = getSourceBadge(source);
</script>

<div class="classification-feedback">
  <div class="header">
    <h2>Classification Result</h2>
    <div class="confidence-badge {getConfidenceColor(confidence)}">
      {formatConfidence(confidence)}% Confidence
    </div>
  </div>

  <div class="source-section">
    <span class="source-badge {sourceBadge.color}">
      {sourceBadge.icon} {sourceBadge.label}
    </span>
  </div>

  <div class="details-grid">
    {#if data.medium}
      <div class="detail-item">
        <div class="label">Medium</div>
        <span class="value">{data.medium}</span>
      </div>
    {/if}
    {#if data.style}
      <div class="detail-item">
        <div class="label">Style</div>
        <span class="value">{data.style}</span>
      </div>
    {/if}
    {#if data.audience}
      <div class="detail-item">
        <div class="label">Audience</div>
        <span class="value">{data.audience}</span>
      </div>
    {/if}
    {#if data.genre}
      <div class="detail-item">
        <div class="label">Genre</div>
        <span class="value">{data.genre}</span>
      </div>
    {/if}
    {#if data.tone}
      <div class="detail-item">
        <div class="label">Tone</div>
        <span class="value">{data.tone}</span>
      </div>
    {/if}
    {#if data.themes && Array.isArray(data.themes)}
      <div class="detail-item">
        <div class="label">Themes</div>
        <span class="value">{data.themes.join(', ')}</span>
      </div>
    {/if}
  </div>

  <div class="action-buttons">
    <button class="btn btn-primary" on:click={onAccept}>
      ✓ Accept Classification
    </button>
    <button class="btn btn-secondary" on:click={onRequestOverride}>
      ✎ Override Classification
    </button>
  </div>
</div>

<style>
  .classification-feedback {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 24px;
    margin: 16px 0;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    gap: 12px;
  }

  .header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
  }

  .confidence-badge {
    font-size: 14px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 20px;
    white-space: nowrap;
  }

  .source-section {
    margin-bottom: 20px;
  }

  .source-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
    margin: 20px 0;
    padding: 16px 0;
    border-top: 1px solid #e5e7eb;
    border-bottom: 1px solid #e5e7eb;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-item .label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .detail-item .value {
    font-size: 14px;
    color: #1f2937;
    font-weight: 500;
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }

  .btn {
    flex: 1;
    padding: 12px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #1f2937;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }
</style>
