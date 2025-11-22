<script>
  /**
   * OverrideForm Component - Phase B
   * Allows users to apply style overrides to existing eBooks
   * (theme, color palette, etc.) without regenerating content
   */

  export let onApply = async (overrides) => {};
  export let isLoading = false;

  let overrideTheme = "dark";
  let overrideColorPalette = "standard";
  let fontSizeScale = 1;

  const themes = ["dark", "light", "corporate", "bold"];
  const colorPalettes = [
    { id: "standard", label: "Standard", desc: "Default colors" },
    { id: "vibrant", label: "Vibrant", desc: "Bold, energetic" },
    { id: "muted", label: "Muted", desc: "Soft, calm" },
    { id: "grayscale", label: "Grayscale", desc: "Monochrome" },
  ];

  const handleApply = async () => {
    const overrides = {
      theme: overrideTheme,
      colorPalette: overrideColorPalette,
      fontSizeScale: fontSizeScale,
    };

    isLoading = true;
    try {
      await onApply(overrides);
    } finally {
      isLoading = false;
    }
  };

  const handleReset = () => {
    overrideTheme = "dark";
    overrideColorPalette = "standard";
    fontSizeScale = 1;
  };
</script>

<div class="override-form">
  <div class="form-header">
    <h3>Override Styles</h3>
    <p class="form-description">
      Apply style changes without regenerating content (fast path)
    </p>
  </div>

  <div class="form-group">
    <label for="override-theme">Theme</label>
    <select
      id="override-theme"
      bind:value={overrideTheme}
      disabled={isLoading}
      class="form-control"
    >
      {#each themes as theme}
        <option value={theme}>{theme.charAt(0).toUpperCase() + theme.slice(1)}</option>
      {/each}
    </select>
    <p class="field-help">Change the overall visual style</p>
  </div>

  <div class="form-group">
    <label for="override-palette">Color Palette</label>
    <select
      id="override-palette"
      bind:value={overrideColorPalette}
      disabled={isLoading}
      class="form-control"
    >
      {#each colorPalettes as palette}
        <option value={palette.id}>{palette.label} - {palette.desc}</option>
      {/each}
    </select>
    <p class="field-help">Adjust color scheme (vibrant, muted, etc.)</p>
  </div>

  <div class="form-group">
    <label for="font-size">Font Size Scale</label>
    <div class="slider-wrapper">
      <span class="scale-label">A</span>
      <input
        id="font-size"
        type="range"
        min="0.8"
        max="1.2"
        step="0.05"
        bind:value={fontSizeScale}
        disabled={isLoading}
        class="form-slider"
      />
      <span class="scale-label large">A</span>
      <span class="scale-value">{(fontSizeScale * 100).toFixed(0)}%</span>
    </div>
    <p class="field-help">Adjust text size (80% – 120%)</p>
  </div>

  <div class="form-info">
    <div class="info-icon">ℹ️</div>
    <div class="info-text">
      <strong>Fast Path Applied</strong>
      <p>Changes are applied without regenerating content. PDF will be re-rendered in ~2 seconds.</p>
    </div>
  </div>

  <div class="form-actions">
    <button
      class="btn btn-primary"
      on:click={handleApply}
      disabled={isLoading}
      aria-busy={isLoading}
    >
      {#if isLoading}
        <span class="spinner"></span>
        Applying...
      {:else}
        ✓ Apply Overrides
      {/if}
    </button>
    <button
      class="btn btn-secondary"
      on:click={handleReset}
      disabled={isLoading}
    >
      ↻ Reset
    </button>
  </div>

  <div class="override-preview">
    <div class="preview-header">Preview (coming soon)</div>
    <div class="preview-content">
      <div class="preview-text" style="font-size: {fontSizeScale}em">
        <p style="color: var(--color-text, #333)">
          This is how your text will appear with the selected overrides.
        </p>
      </div>
    </div>
  </div>
</div>

<style>
  .override-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    background: var(--color-bg, #f9f9f9);
    border-radius: 8px;
    border: 1px solid var(--color-border, #e0e0e0);
  }

  .form-header h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: var(--color-headings, #333);
  }

  .form-description {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-subtle, #666);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 500;
    color: var(--color-text, #333);
    font-size: 0.95rem;
  }

  .form-control {
    padding: 0.75rem;
    border: 1px solid var(--color-border, #ddd);
    border-radius: 6px;
    font-size: 0.95rem;
    background: white;
    color: var(--color-text, #333);
    cursor: pointer;
    transition: all 0.2s;
  }

  .form-control:hover:not(:disabled) {
    border-color: var(--color-accent, #0066cc);
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
  }

  .form-control:focus {
    outline: none;
    border-color: var(--color-accent, #0066cc);
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
  }

  .form-control:disabled {
    background: #f5f5f5;
    color: #999;
    cursor: not-allowed;
  }

  .slider-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .scale-label {
    font-size: 0.85rem;
    color: var(--color-subtle, #666);
  }

  .scale-label.large {
    font-size: 1.2rem;
  }

  .form-slider {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--color-border, #e0e0e0);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .form-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-accent, #0066cc);
    cursor: pointer;
  }

  .form-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-accent, #0066cc);
    cursor: pointer;
    border: none;
  }

  .scale-value {
    min-width: 45px;
    font-weight: 500;
    color: var(--color-accent, #0066cc);
  }

  .field-help {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-subtle, #999);
  }

  .form-info {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(0, 102, 204, 0.05);
    border-left: 3px solid var(--color-accent, #0066cc);
    border-radius: 4px;
  }

  .info-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .info-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }

  .info-text strong {
    color: var(--color-accent, #0066cc);
  }

  .info-text p {
    margin: 0;
    color: var(--color-text, #333);
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-start;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background: var(--color-accent, #0066cc);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0052a3;
    box-shadow: 0 2px 8px rgba(0, 102, 204, 0.3);
  }

  .btn-secondary {
    background: white;
    color: var(--color-accent, #0066cc);
    border: 1px solid var(--color-accent, #0066cc);
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(0, 102, 204, 0.05);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .override-preview {
    padding: 1rem;
    background: white;
    border: 1px solid var(--color-border, #e0e0e0);
    border-radius: 6px;
  }

  .preview-header {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-subtle, #999);
    margin-bottom: 0.75rem;
  }

  .preview-content {
    padding: 1rem;
    background: var(--color-bg, #f9f9f9);
    border-radius: 4px;
  }

  .preview-text {
    transition: font-size 0.2s;
  }

  .preview-text p {
    margin: 0;
    line-height: 1.6;
  }

  @media (max-width: 600px) {
    .form-actions {
      flex-direction: column;
    }

    .btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
