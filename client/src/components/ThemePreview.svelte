<script>
  /**
   * ThemePreview Component - Phase B
   * Displays a live preview of how the selected theme will look
   * Shows theme colors, typography, and sample content
   */

  export let theme = "dark";
  export let pageCount = 8;

  const themeConfigs = {
    dark: {
      background: "#1a1a1a",
      text: "#e0e0e0",
      accent: "#00d4ff",
      headings: "#ffffff",
      subtle: "#a0a0a0",
      fonts: {
        body: "'Georgia', serif",
        headings: "'Roboto', sans-serif",
      },
    },
    light: {
      background: "#ffffff",
      text: "#333333",
      accent: "#0066cc",
      headings: "#000000",
      subtle: "#666666",
      fonts: {
        body: "'Calibri', sans-serif",
        headings: "'Arial', sans-serif",
      },
    },
    corporate: {
      background: "#f5f5f5",
      text: "#1f1f1f",
      accent: "#003d82",
      headings: "#003d82",
      subtle: "#555555",
      fonts: {
        body: "'Segoe UI', sans-serif",
        headings: "'Segoe UI', sans-serif",
      },
    },
    bold: {
      background: "#ffffff",
      text: "#1a1a1a",
      accent: "#d84000",
      headings: "#ff3300",
      subtle: "#333333",
      fonts: {
        body: "'Impact', sans-serif",
        headings: "'Impact', sans-serif",
      },
    },
  };

  const getDensityInfo = (count) => {
    if (count <= 5) return { type: "Sparse", images: Math.ceil(count * 0.8) };
    if (count <= 10) return { type: "Standard", images: Math.round(count * 1.2) };
    if (count <= 15) return { type: "Dense", images: Math.round(count * 1.3) };
    return { type: "Very Dense", images: Math.round(count * 1.1) };
  };

  $: config = themeConfigs[theme];
  $: densityInfo = getDensityInfo(pageCount);
</script>

<div class="theme-preview" style="--bg: {config.background}; --text: {config.text};">
  <div class="preview-header">
    <h3>Theme Preview</h3>
    <span class="theme-badge">{theme.toUpperCase()}</span>
  </div>

  <div class="preview-container">
    <!-- Cover Page Preview -->
    <div class="page-preview cover-page">
      <div
        class="page-background"
        style="background-color: {config.background};"
      >
        <div
          class="page-content"
          style="color: {config.text}; font-family: {config.fonts.body};"
        >
          <h1 style="color: {config.headings}; font-family: {config.fonts.headings};">
            Sample eBook
          </h1>
          <p style="color: {config.subtle};">
            Generated eBook with {pageCount} pages
          </p>
          <div
            class="accent-line"
            style="background-color: {config.accent};"
          ></div>
        </div>
      </div>
      <p class="page-label">Cover</p>
    </div>

    <!-- Content Page Preview -->
    <div class="page-preview content-page">
      <div
        class="page-background"
        style="background-color: {config.background};"
      >
        <div
          class="page-content"
          style="color: {config.text}; font-family: {config.fonts.body};"
        >
          <h2 style="color: {config.headings}; font-family: {config.fonts.headings};">
            Chapter 1: Introduction
          </h2>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </p>
          <p style="color: {config.subtle}; font-size: 0.9em;">
            Figure 1: Sample illustration
          </p>
        </div>
      </div>
      <p class="page-label">Content</p>
    </div>
  </div>

  <div class="preview-details">
    <div class="detail-grid">
      <div class="detail-box">
        <span class="detail-label">Colors</span>
        <div class="color-palette">
          <div class="color-swatch" style="background: {config.background}; border: 1px solid #ccc;" title="Background"></div>
          <div class="color-swatch" style="background: {config.text};" title="Text"></div>
          <div class="color-swatch" style="background: {config.accent};" title="Accent"></div>
          <div class="color-swatch" style="background: {config.headings};" title="Headings"></div>
        </div>
      </div>

      <div class="detail-box">
        <span class="detail-label">Typography</span>
        <p class="font-sample" style="font-family: {config.fonts.body};">
          Body: Georgia
        </p>
        <p class="font-sample" style="font-family: {config.fonts.headings};">
          Headings: Roboto
        </p>
      </div>

      <div class="detail-box">
        <span class="detail-label">Page Info</span>
        <p class="info-text">
          Pages: <strong>{pageCount}</strong>
        </p>
        <p class="info-text">
          Density: <strong>{densityInfo.type}</strong>
        </p>
        <p class="info-text">
          Images: <strong>~{densityInfo.images}</strong>
        </p>
      </div>
    </div>
  </div>
</div>

<style>
  .theme-preview {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    background: var(--color-bg, #f9f9f9);
    border-radius: 8px;
    border: 1px solid var(--color-border, #e0e0e0);
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .preview-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-headings, #333);
  }

  .theme-badge {
    font-size: 0.75rem;
    padding: 0.4rem 0.8rem;
    background: var(--bg, #333);
    color: var(--text, #fff);
    border-radius: 4px;
    font-weight: 600;
    letter-spacing: 1px;
  }

  .preview-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .page-preview {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .page-background {
    aspect-ratio: 3 / 4;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 250px;
  }

  .page-content {
    text-align: center;
  }

  .cover-page .page-content h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    line-height: 1.2;
  }

  .cover-page .page-content p {
    margin: 0 0 1rem 0;
    font-size: 0.95rem;
  }

  .content-page .page-content {
    text-align: left;
  }

  .content-page .page-content h2 {
    margin: 0 0 0.75rem 0;
    font-size: 1.25rem;
  }

  .content-page .page-content p {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .accent-line {
    width: 60px;
    height: 3px;
    margin: 0 auto;
  }

  .page-label {
    margin: 0;
    font-size: 0.85rem;
    text-align: center;
    color: var(--color-subtle, #999);
    font-weight: 500;
  }

  .preview-details {
    padding: 1rem;
    background: white;
    border-radius: 6px;
    border: 1px solid var(--color-border, #e0e0e0);
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
  }

  .detail-box {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-subtle, #999);
  }

  .color-palette {
    display: flex;
    gap: 0.4rem;
  }

  .color-swatch {
    width: 30px;
    height: 30px;
    border-radius: 4px;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .color-swatch:hover {
    transform: scale(1.1);
  }

  .font-sample {
    margin: 0.25rem 0;
    font-size: 0.85rem;
    color: var(--color-text, #333);
  }

  .info-text {
    margin: 0.25rem 0;
    font-size: 0.85rem;
    color: var(--color-text, #333);
  }

  @media (max-width: 600px) {
    .preview-container {
      grid-template-columns: 1fr;
    }

    .detail-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
