<script>
  /**
   * PageCountSlider Component - Phase B
   * Interactive slider for selecting page count (3-20 pages)
   * with visual feedback and accessibility support
   */

  export let pageCount = 8;
  export let minPages = 3;
  export let maxPages = 20;
  export let onChange = (count) => {};

  const handleChange = (e) => {
    pageCount = parseInt(e.target.value);
    onChange(pageCount);
  };

  // Helper to classify density based on page count
  const getDensityLabel = (count) => {
    if (count <= 5) return "Sparse";
    if (count <= 10) return "Standard";
    if (count <= 15) return "Dense";
    return "Very Dense";
  };

  // Helper to get density percentage
  const getDensityPercent = (count) => {
    return Math.round(((count - minPages) / (maxPages - minPages)) * 100);
  };
</script>

<div class="page-count-slider">
  <div class="slider-header">
    <label for="page-slider">
      <span class="label-text">Pages:</span>
      <span class="current-value">{pageCount}</span>
    </label>
    <span class="density-label" title="Content density classification">
      {getDensityLabel(pageCount)}
    </span>
  </div>

  <div class="slider-container">
    <input
      id="page-slider"
      type="range"
      min={minPages}
      max={maxPages}
      bind:value={pageCount}
      on:change={handleChange}
      class="slider-input"
      aria-label="Select page count ({pageCount} of {maxPages})"
    />

    <div class="slider-track" style="--percentage: {getDensityPercent(pageCount)}%">
      <div class="slider-fill" />
    </div>

    <div class="slider-labels">
      <span class="label-min">{minPages}p</span>
      <span class="label-max">{maxPages}p</span>
    </div>
  </div>

  <div class="slider-details">
    <div class="detail-item">
      <span class="detail-label">Content Density:</span>
      <span class="detail-value">{getDensityLabel(pageCount)}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">Est. Images:</span>
      <span class="detail-value">
        {#if pageCount <= 5}
          ~{pageCount}
        {:else if pageCount <= 10}
          ~{Math.round(pageCount * 1.2)}
        {:else if pageCount <= 15}
          ~{Math.round(pageCount * 1.3)}
        {:else}
          ~{Math.round(pageCount * 1.1)}
        {/if}
      </span>
    </div>
    <div class="detail-item">
      <span class="detail-label">Est. Time:</span>
      <span class="detail-value"
        >{#if pageCount <= 5}
          ~30s
        {:else if pageCount <= 10}
          ~5s
        {:else if pageCount <= 15}
          ~7s
        {:else}
          ~9s
        {/if}</span
      >
    </div>
  </div>

  <div class="slider-help">
    <p>
      <strong>Sparse (3-5):</strong> Minimal content, maximized images
    </p>
    <p>
      <strong>Standard (6-10):</strong> Balanced content and images
    </p>
    <p>
      <strong>Dense (11-15):</strong> More content, optimized layout
    </p>
    <p>
      <strong>Very Dense (16-20):</strong> Comprehensive coverage, tight spacing
    </p>
  </div>
</div>

<style>
  .page-count-slider {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--color-bg, #f9f9f9);
    border-radius: 8px;
    border: 1px solid var(--color-border, #e0e0e0);
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-weight: 500;
    color: var(--color-text, #333);
  }

  .label-text {
    font-size: 0.95rem;
  }

  .current-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--color-accent, #0066cc);
    min-width: 50px;
  }

  .density-label {
    font-size: 0.85rem;
    padding: 0.4rem 0.8rem;
    background: rgba(102, 153, 255, 0.1);
    border-radius: 4px;
    color: var(--color-accent, #0066cc);
    font-weight: 500;
  }

  .slider-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .slider-input {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--color-border, #e0e0e0);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }

  .slider-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-accent, #0066cc);
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 102, 204, 0.3);
    transition: all 0.2s;
  }

  .slider-input::-webkit-slider-thumb:hover {
    width: 28px;
    height: 28px;
    box-shadow: 0 4px 10px rgba(0, 102, 204, 0.4);
  }

  .slider-input::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-accent, #0066cc);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 6px rgba(0, 102, 204, 0.3);
    transition: all 0.2s;
  }

  .slider-input::-moz-range-thumb:hover {
    width: 28px;
    height: 28px;
    box-shadow: 0 4px 10px rgba(0, 102, 204, 0.4);
  }

  .slider-track {
    position: relative;
    height: 4px;
    background: linear-gradient(
      to right,
      var(--color-accent, #0066cc) 0%,
      var(--color-accent, #0066cc) var(--percentage),
      var(--color-border, #e0e0e0) var(--percentage),
      var(--color-border, #e0e0e0) 100%
    );
    border-radius: 2px;
    margin-top: -5px;
    pointer-events: none;
  }

  .slider-labels {
    display: flex;
    justify-content: space-between;
    padding: 0 8px;
    font-size: 0.8rem;
    color: var(--color-subtle, #999);
    margin-top: 0.25rem;
  }

  .slider-details {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    padding: 1rem;
    background: white;
    border-radius: 6px;
    border: 1px solid var(--color-border, #e0e0e0);
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-subtle, #999);
  }

  .detail-value {
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text, #333);
  }

  .slider-help {
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border, #e0e0e0);
  }

  .slider-help p {
    margin: 0.5rem 0;
    font-size: 0.85rem;
    color: var(--color-subtle, #666);
    line-height: 1.4;
  }

  .slider-help strong {
    color: var(--color-text, #333);
  }

  @media (max-width: 600px) {
    .slider-details {
      grid-template-columns: 1fr;
    }

    .slider-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }
</style>
