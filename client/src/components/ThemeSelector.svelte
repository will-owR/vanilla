<script>
  /**
   * ThemeSelector Component - Phase B
   * Displays 4 theme options (dark, light, corporate, bold)
   * with live preview and accessibility annotations
   */

  import { onMount } from "svelte";

  export let selectedTheme = "dark";
  export let onChange = (theme) => {};

  const themes = [
    {
      id: "dark",
      label: "Dark",
      description: "Minimalist, elegant dark theme",
      icon: "🌙",
    },
    {
      id: "light",
      label: "Light",
      description: "Clean, professional light theme",
      icon: "☀️",
    },
    {
      id: "corporate",
      label: "Corporate",
      description: "Business-ready corporate theme",
      icon: "💼",
    },
    {
      id: "bold",
      label: "Bold",
      description: "Eye-catching, vibrant bold theme",
      icon: "⚡",
    },
  ];

  const themeColors = {
    dark: { bg: "#1a1a1a", text: "#e0e0e0", accent: "#00d4ff" },
    light: { bg: "#ffffff", text: "#333333", accent: "#0066cc" },
    corporate: { bg: "#f5f5f5", text: "#1f1f1f", accent: "#003d82" },
    bold: { bg: "#ffffff", text: "#1a1a1a", accent: "#ff6600" },
  };

  const handleThemeChange = (themeId) => {
    selectedTheme = themeId;
    onChange(themeId);
  };
</script>

<div class="theme-selector">
  <div class="selector-header">
    <h3>Select Theme</h3>
    <p class="current-theme">Current: <strong>{selectedTheme}</strong></p>
  </div>

  <div class="theme-grid">
    {#each themes as theme (theme.id)}
      <button
        class="theme-button"
        class:active={selectedTheme === theme.id}
        on:click={() => handleThemeChange(theme.id)}
        aria-pressed={selectedTheme === theme.id}
        aria-label={`Select ${theme.label} theme: ${theme.description}`}
      >
        <div class="theme-preview">
          <div
            class="color-sample"
            style="background-color: {themeColors[theme.id].bg}; border: 2px solid {themeColors[theme.id].accent};"
          ></div>
        </div>
        <div class="theme-info">
          <span class="icon">{theme.icon}</span>
          <span class="theme-name">{theme.label}</span>
          <span class="accessibility-badge" title="WCAG AA Compliant"
            >♿ AA</span
          >
        </div>
        <p class="theme-description">{theme.description}</p>
      </button>
    {/each}
  </div>
</div>

<style>
  .theme-selector {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    background: var(--color-bg, #f9f9f9);
    border-radius: 8px;
    border: 1px solid var(--color-border, #e0e0e0);
  }

  .selector-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .selector-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-headings, #333);
  }

  .current-theme {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-subtle, #999);
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
  }

  .theme-button {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border: 2px solid transparent;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  .theme-button:hover {
    border-color: var(--color-accent, #0066cc);
    box-shadow: 0 2px 8px rgba(0, 102, 204, 0.15);
  }

  .theme-button.active {
    border-color: var(--color-accent, #0066cc);
    background: var(--color-accent, #0066cc);
    color: white;
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.25);
  }

  .theme-button.active .theme-info {
    color: white;
  }

  .theme-preview {
    display: flex;
    justify-content: center;
  }

  .color-sample {
    width: 60px;
    height: 60px;
    border-radius: 4px;
  }

  .theme-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-weight: 500;
    color: #333;
    transition: color 0.2s;
  }

  .icon {
    font-size: 1.25rem;
  }

  .theme-name {
    font-size: 0.95rem;
  }

  .accessibility-badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
    background: rgba(100, 200, 100, 0.2);
    border-radius: 3px;
    color: #2d5f2d;
  }

  .theme-button.active .accessibility-badge {
    background: rgba(255, 255, 255, 0.3);
    color: white;
  }

  .theme-description {
    margin: 0;
    font-size: 0.75rem;
    color: #666;
    line-height: 1.3;
  }

  .theme-button.active .theme-description {
    color: rgba(255, 255, 255, 0.9);
  }

  @media (max-width: 600px) {
    .theme-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .selector-header {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
