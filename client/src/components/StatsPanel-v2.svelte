<script>
  import { flowStore } from '../lib/stores/flowStore.js';

  export let result = null;
  export let classification = null;
  export let modelName = 'Claude 3.5 Sonnet';

  $: resultData = result || $flowStore.result || {};
  $: classificationData = classification || $flowStore.classification || {};
  $: latency = resultData.latency || 0;
  $: confidence = classificationData.confidence || 0;
  $: source = classificationData.source || 'Unknown';
  $: costEstimate = resultData.costEstimate || 0;

  // Format latency to seconds
  function formatLatency(ms) {
    if (!ms) return '0.00s';
    return `${(ms / 1000).toFixed(2)}s`;
  }

  // Format confidence percentage
  function formatConfidence(conf) {
    return `${Math.round(conf * 100)}%`;
  }

  // Get source badge
  function getSourceLabel(src) {
    const labels = {
      'rules': '⚙️ Rules-Based',
      'ai': '🤖 AI-Generated',
      'hybrid': '🔀 Hybrid'
    };
    return labels[src.toLowerCase()] || '❓ Unknown';
  }

  // Format cost with currency
  function formatCost(cost) {
    return `$${cost.toFixed(2)}`;
  }
</script>

<div class="stats-panel">
  <div class="stat-item">
    <div class="stat-label">Generation Time</div>
    <div class="stat-value">{formatLatency(latency)}</div>
  </div>

  <div class="stat-item">
    <div class="stat-label">Model</div>
    <div class="stat-value">{modelName}</div>
  </div>

  <div class="stat-item">
    <div class="stat-label">Confidence</div>
    <div class="stat-value">{formatConfidence(confidence)}</div>
  </div>

  <div class="stat-item">
    <div class="stat-label">Source</div>
    <div class="stat-value">{getSourceLabel(source)}</div>
  </div>

  <div class="stat-item">
    <div class="stat-label">Cost Estimate</div>
    <div class="stat-value">{formatCost(costEstimate)}</div>
  </div>
</div>

<style>
  .stats-panel {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: white;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }

  .stat-label {
    font-size: 11px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }

  @media (max-width: 768px) {
    .stats-panel {
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 12px;
      padding: 12px;
    }

    .stat-item {
      padding: 10px;
    }

    .stat-value {
      font-size: 14px;
    }
  }
</style>
