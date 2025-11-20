<script>
  import { flowStore } from '../lib/stores/flowStore.js';

  export let classification = null;
  export let onApplyOverride = () => {};

  $: data = classification || $flowStore.classification || {};

  const STYLES = ['minimalist', 'gothic', 'abstract', 'retro', 'modern'];
  const TONES = ['professional', 'casual', 'uplifting', 'dramatic', 'mysterious'];

  let selectedStyle = data.style || STYLES[0];
  let selectedTone = data.tone || TONES[0];
  let selectedThemes = data.themes ? [...data.themes] : [];

  // Common themes for the content
  const AVAILABLE_THEMES = [
    'tech', 'nature', 'business', 'creative', 'minimalist',
    'bold', 'elegant', 'playful', 'serious', 'modern'
  ];

  function toggleTheme(theme) {
    const index = selectedThemes.indexOf(theme);
    if (index > -1) {
      selectedThemes = selectedThemes.filter((_, i) => i !== index);
    } else {
      selectedThemes = [...selectedThemes, theme];
    }
  }

  function handleApply() {
    const overrides = {
      style: selectedStyle,
      tone: selectedTone,
      themes: selectedThemes
    };
    onApplyOverride(overrides);
  }

  function handleReset() {
    selectedStyle = data.style || STYLES[0];
    selectedTone = data.tone || TONES[0];
    selectedThemes = data.themes ? [...data.themes] : [];
  }

  $: isModified = selectedStyle !== data.style || selectedTone !== data.tone ||
    JSON.stringify(selectedThemes) !== JSON.stringify(data.themes);
</script>

<div class="override-controls">
  <h3>Customize Generation</h3>

  <div class="control-section">
    <label for="style-select" class="section-label">Style</label>
    <select
      id="style-select"
      bind:value={selectedStyle}
      class="dropdown"
    >
      {#each STYLES as style}
        <option value={style}>{style}</option>
      {/each}
    </select>
  </div>

  <div class="control-section">
    <label for="tone-select" class="section-label">Tone</label>
    <select
      id="tone-select"
      bind:value={selectedTone}
      class="dropdown"
    >
      {#each TONES as tone}
        <option value={tone}>{tone}</option>
      {/each}
    </select>
  </div>

  <div class="control-section">
    <div class="section-label">Themes</div>
    <div class="themes-grid">
      {#each AVAILABLE_THEMES as theme}
        <label class="theme-checkbox">
          <input
            type="checkbox"
            checked={selectedThemes.includes(theme)}
            on:change={() => toggleTheme(theme)}
          />
          <span>{theme}</span>
        </label>
      {/each}
    </div>
  </div>

  <div class="action-buttons">
    <button
      class="btn btn-primary"
      on:click={handleApply}
      disabled={!isModified}
    >
      ✓ Apply Override
    </button>
    <button
      class="btn btn-secondary"
      on:click={handleReset}
      disabled={!isModified}
    >
      ↻ Reset
    </button>
  </div>
</div>

<style>
  .override-controls {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 24px;
    margin: 16px 0;
  }

  .override-controls h3 {
    margin: 0 0 20px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }

  .control-section {
    margin-bottom: 20px;
  }

  .section-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .dropdown {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    background: white;
    color: #1f2937;
    cursor: pointer;
    transition: border-color 0.2s ease;
  }

  .dropdown:hover {
    border-color: #9ca3af;
  }

  .dropdown:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .themes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  .theme-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }

  .theme-checkbox:hover {
    background: #f9fafb;
    border-color: #d1d5db;
  }

  .theme-checkbox input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .theme-checkbox input:checked + span {
    color: #3b82f6;
    font-weight: 600;
  }

  .theme-checkbox span {
    font-size: 13px;
    color: #4b5563;
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .btn {
    flex: 1;
    padding: 12px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #1f2937;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }
</style>
