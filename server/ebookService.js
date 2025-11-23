/**
 * ebookService - ebook generation service
 *
 * Provides enhanced ebook generation with support for structured metadata
 * Implements the same handler contract as demoService for consistency
 *
 * Routes through Phase B pipeline:
 * prompt → sampleService.generate() → contentChunker → themeEngine →
 * pageLayout → tocGenerator → HTML generation
 */

function buildContent(prompt) {
  const title = `Ebook: ${String(prompt || "")
    .split(/\s+/)
    .slice(0, 6)
    .join(" ")}`;
  const body = `Ebook generated content for prompt: ${prompt}`;
  return { title, body, layout: "ebook-structured" };
}

function makePages(content, n = 3) {
  return Array.from({ length: n }).map((_, i) => ({
    title: `${content.title} — Chapter ${i + 1}`,
    body: `${content.body}\n\nChapter ${i + 1} content...`,
    layout: content.layout,
  }));
}

async function generateFromPrompt(prompt) {
  const content = buildContent(prompt);
  const copies = makePages(content, 3);
  const metadata = { model: "ebook-v1", pages: copies.length };
  return { content, copies, metadata };
}

/**
 * Handle enhanced payload for ebook mode
 * Generates ebook content without orchestrating utility services
 * (Those are handled by genieService orchestrator if needed)
 * @param {Object} payload - { prompt, metadata: { theme, pageCount, colorPalette, fontSizeScale } }
 * @param {Object} classification - Optional classification data from genieService
 * @returns {Promise<Object>} Handler result { pages, metadata, html, actions }
 */
async function handle(payload, classification) {
  const { prompt } = payload;
  const {
    theme = "dark",
    pageCount = 8,
    colorPalette = "standard",
    fontSizeScale = 1.0,
  } = payload.metadata || {};

  try {
    // Generate base content
    const content = buildContent(prompt);
    const pages = makePages(content, pageCount);

    // Compute density classification
    const density =
      pageCount <= 5 ? "light" : pageCount <= 10 ? "medium" : "dense";

    // Generate HTML with theme colors and font scaling
    const html = generateHTML(pages, {
      theme,
      title: `Ebook: ${String(prompt || "")
        .split(/\s+/)
        .slice(0, 6)
        .join(" ")}`,
      author: "Aether AI",
      fontSizeScale,
      colorPalette,
    });

    // Return standardized handler response
    return {
      pages,
      content: prompt,
      html,
      metadata: {
        model: "ebook-v1",
        pages_count: pageCount,
        source: "ebook",
        theme,
        colorPalette,
        fontSizeScale,
        density,
        classification,
      },
      actions: {
        persist_prompt: true,
        generate_pdf: true,
        can_export: true,
        can_preview: true,
        can_override: true,
      },
    };
  } catch (error) {
    console.error("Error in ebookService.handle():", error);
    throw error;
  }
}

/**
 * Generate HTML from themed chunks, layout, and TOC
 * @param {Array} chunks - Themed content chunks
 * @param {Object} layout - Generated page layout
 * @param {Object} toc - Table of contents
 * @param {Object} options - { theme, title, author, fontSizeScale }
 * @returns {string} HTML string
 */
function generateHTML(chunks, layout, toc, options = {}) {
  const {
    theme = "dark",
    title = "E-book",
    author = "Aether AI",
    fontSizeScale = 1,
  } = options;

  // Define theme colors
  const themeColors = {
    dark: {
      bg: "#1a1a1a",
      text: "#ffffff",
      accent: "#00d4ff",
      heading: "#ffffff",
    },
    light: {
      bg: "#ffffff",
      text: "#000000",
      accent: "#0066cc",
      heading: "#000000",
    },
    corporate: {
      bg: "#f5f5f5",
      text: "#2c3e50",
      accent: "#34495e",
      heading: "#2c3e50",
    },
    bold: {
      bg: "#000000",
      text: "#ffff00",
      accent: "#ff6b35",
      heading: "#ff6b35",
    },
  };

  const colors = themeColors[theme] || themeColors.dark;
  const fontSize = Math.round(16 * fontSizeScale);

  // Build HTML structure
  const pageStyle = `
    background-color: ${colors.bg};
    color: ${colors.text};
    font-size: ${fontSize}px;
    font-family: Georgia, serif;
    line-height: 1.6;
    padding: 40px;
    margin: 0;
  `;

  const contentHtml = (chunks || [])
    .map(
      (chunk, idx) => `
    <div style="margin-bottom: 20px; page-break-inside: avoid;">
      <h2 style="color: ${colors.heading}; border-bottom: 2px solid ${
        colors.accent
      }; padding-bottom: 10px;">
        ${chunk.title || `Section ${idx + 1}`}
      </h2>
      <p>${chunk.content || ""}</p>
    </div>
  `
    )
    .join("");

  const tocHtml = toc
    ? `
    <div style="page-break-after: always; margin-bottom: 40px;">
      <h1 style="color: ${colors.heading};">Table of Contents</h1>
      <ul>
        ${(toc.entries || [])
          .map((entry) => `<li><a href="#${entry.id}">${entry.title}</a></li>`)
          .join("")}
      </ul>
    </div>
  `
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      ${pageStyle}
    }
    a { color: ${colors.accent}; }
    h1, h2, h3 { color: ${colors.heading}; }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 40px;">
    <h1>${title}</h1>
    <p>by ${author}</p>
  </div>
  
  ${tocHtml}
  
  <div style="page-break-after: always;"></div>
  
  ${contentHtml}
  
  <footer style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid ${colors.accent};">
    <p>Generated with Aether AI</p>
  </footer>
</body>
</html>`;
}

module.exports = {
  generateFromPrompt,
  buildContent,
  makePages,
  handle,
  generateHTML,
};
