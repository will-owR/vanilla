<script>
  import { flowStore } from '../lib/stores/flowStore.js';

  export let result = null;
  export let costMultiplier = 1.0;
  export let overrides = null;

  $: resultData = result || $flowStore.result || {};
  $: baseCost = resultData.costEstimate || 0;
  $: finalCost = baseCost * costMultiplier;

  // Calculate cost breakdown from overrides
  function calculateBreakdown() {
    const breakdown = {
      base: baseCost,
      style: 0,
      tone: 0,
      themes: 0,
      total: baseCost
    };

    if (overrides) {
      if (overrides.style) breakdown.style = baseCost * 0.4;
      if (overrides.tone) breakdown.tone = baseCost * 0.3;
      if (overrides.themes && overrides.themes.length > 0) {
        breakdown.themes = baseCost * 0.2;
      }
      breakdown.total = baseCost + breakdown.style + breakdown.tone + breakdown.themes;
    }

    return breakdown;
  }

  $: breakdown = calculateBreakdown();
  $: multiplierPercent = Math.round((costMultiplier - 1) * 100);

  function formatCost(cost) {
    return `$${cost.toFixed(2)}`;
  }
</script>

<div class="cost-visualization">
  <h3>Cost Estimate</h3>

  <div class="cost-display">
    <div class="base-cost">
      <span class="label">Base Cost</span>
      <span class="value">{formatCost(baseCost)}</span>
    </div>

    {#if overrides && (overrides.style || overrides.tone || overrides.themes?.length > 0)}
      <div class="breakdown">
        {#if overrides.style}
          <div class="breakdown-item">
            <span class="breakdown-label">Style Override</span>
            <span class="breakdown-cost">+{formatCost(breakdown.style)}</span>
          </div>
        {/if}

        {#if overrides.tone}
          <div class="breakdown-item">
            <span class="breakdown-label">Tone Override</span>
            <span class="breakdown-cost">+{formatCost(breakdown.tone)}</span>
          </div>
        {/if}

        {#if overrides.themes && overrides.themes.length > 0}
          <div class="breakdown-item">
            <span class="breakdown-label">Theme Override ({overrides.themes.length})</span>
            <span class="breakdown-cost">+{formatCost(breakdown.themes)}</span>
          </div>
        {/if}
      </div>

      <div class="total-cost">
        <span class="label">Estimated Total</span>
        <span class="value final">{formatCost(breakdown.total)}</span>
      </div>

      {#if multiplierPercent !== 0}
        <div class="multiplier-info">
          <span class="multiplier-label">Cost Multiplier</span>
          <span class="multiplier-value">
            {costMultiplier.toFixed(2)}x ({multiplierPercent > 0 ? '+' : ''}{multiplierPercent}%)
          </span>
        </div>
      {/if}
    {:else}
      <div class="total-cost">
        <span class="label">Estimated Total</span>
        <span class="value">{formatCost(baseCost)}</span>
      </div>
    {/if}
  </div>

  <div class="info-box">
    <span class="info-icon">ℹ️</span>
    <span class="info-text">Additional overrides may increase the generation cost based on complexity.</span>
  </div>
</div>

<style>
  .cost-visualization {
    background: linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 100%);
    border: 1px solid #c7d2fe;
    border-radius: 8px;
    padding: 20px;
    margin: 16px 0;
  }

  .cost-visualization h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }

  .cost-display {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 12px;
  }

  .base-cost {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  .label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .value {
    font-size: 18px;
    font-weight: 700;
    color: #1f2937;
  }

  .breakdown {
    padding: 12px 0;
    border-bottom: 1px solid #e5e7eb;
  }

  .breakdown-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 13px;
  }

  .breakdown-label {
    color: #4b5563;
  }

  .breakdown-cost {
    font-weight: 600;
    color: #10b981;
  }

  .total-cost {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
  }

  .value.final {
    font-size: 20px;
    color: #3b82f6;
  }

  .multiplier-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 8px;
    font-size: 12px;
  }

  .multiplier-label {
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .multiplier-value {
    font-weight: 600;
    color: #1f2937;
  }

  .info-box {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 12px;
  }

  .info-icon {
    flex-shrink: 0;
    font-size: 14px;
  }

  .info-text {
    color: #1e40af;
    line-height: 1.4;
  }
</style>
