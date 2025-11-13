/**
 * PDF Structure Builder - Phase A (Demo Mode)
 * Integrates all modules into 10-page polished PDF
 * Structure: Cover → Copyright → TOC → 5 Content Pages → Epilogue
 * Page numbering: Roman (i-iii) front, Arabic (5-10) content/epilogue
 */

const pdfGenerator = require("../pdfGenerator");
const { getTheme } = require("./themeEngine");
const fs = require("fs");
const path = require("path");

/**
 * Generate complete 10-page PDF from all Phase A modules
 * @param {Object} envelope - { pages: [], metadata: {}, epilogue: {} }
 * @param {Object} theme - Theme object from getTheme()
 * @param {Object} [options] - { validate?: boolean, browser?: any }
 * @returns {Promise<Buffer|{buffer: Buffer, validation: Object}>} PDF buffer or result object
 */
async function generatePDF(envelope, theme = "dark", options = {}) {
  if (!envelope || !envelope.pages) {
    throw new Error("Invalid envelope: missing pages");
  }

  // If theme is a string, get the theme object
  const themeConfig = typeof theme === "string" ? getTheme(theme) : theme;
  const pages = envelope.pages || [];
  const metadata = envelope.metadata || {};
  const epilogue = envelope.epilogue || {};

  // Build HTML structure for all 10 pages
  const html = buildPDFHTML({
    pages,
    metadata,
    epilogue,
    theme: themeConfig,
  });

  // Generate PDF using existing pdfGenerator (Puppeteer-based)
  const pdfBuffer = await pdfGenerator.generatePdfBuffer({
    title: metadata.title || "Demo Presentation",
    body: html,
    validate: options.validate || false,
    browser: options.browser,
    envelope: { pages, metadata, epilogue },
  });

  return pdfBuffer;
}

/**
 * Build complete HTML structure for 10-page PDF
 * @param {Object} config - { pages, metadata, epilogue, theme }
 * @returns {string} HTML string for PDF rendering
 */
function buildPDFHTML({ pages, metadata, epilogue, theme }) {
  const author = metadata.author || "CELS";
  const title = metadata.title || "Demo Presentation";

  let html = buildHTMLHeader(theme);

  // Page 1 (i): Cover Page
  html += buildCoverPage(title, author, theme);

  // Page 2 (ii): Copyright Page
  html += buildCopyrightPage(theme);

  // Page 3 (iii): Table of Contents
  html += buildTableOfContents(pages, theme);

  // Pages 4-8 (5-9): Content Pages
  pages.forEach((page, idx) => {
    const pageNumber = idx + 5; // Arabic numbering starts at 5
    html += buildContentPage(page, pageNumber, theme);
  });

  // Page 9 (10): Epilogue
  html += buildEpiloguePage(epilogue, theme);

  html += buildHTMLFooter();

  return html;
}

/**
 * Build HTML header with meta, styles, page setup
 */
function buildHTMLHeader(theme) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: "${theme.fonts.body}", serif;
      background-color: ${theme.colors.background};
      color: ${theme.colors.text};
      line-height: ${theme.spacing.lineHeight};
    }

    .page {
      width: 8.5in;
      height: 11in;
      margin: 0 auto;
      padding: ${theme.spacing.pageMargin};
      background-color: ${theme.colors.background};
      color: ${theme.colors.text};
      page-break-after: always;
      position: relative;
    }

    .page-number {
      position: absolute;
      bottom: 0.5in;
      right: 0.75in;
      font-size: 10pt;
      color: ${theme.colors.secondaryText};
    }

    /* Cover Page */
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: linear-gradient(135deg, ${theme.colors.background} 0%, #252525 100%);
    }

    .cover-title {
      font-family: "${theme.fonts.header}", sans-serif;
      font-size: 48pt;
      font-weight: bold;
      color: ${theme.colors.text};
      margin-bottom: 1in;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    }

    .cover-author {
      font-size: 24pt;
      color: ${theme.colors.accent};
      margin-bottom: 2in;
    }

    .cover-date {
      font-size: 14pt;
      color: ${theme.colors.secondaryText};
    }

    /* Copyright Page */
    .copyright-page {
      display: flex;
      flex-direction: column;
      justify-content: center;
      font-size: 12pt;
      color: ${theme.colors.secondaryText};
      border-top: 1px solid ${theme.colors.border};
      padding-top: 1in;
    }

    .copyright-section {
      margin-bottom: 0.5in;
    }

    .copyright-section p {
      margin-bottom: 0.25in;
    }

    /* Table of Contents */
    .toc-page {
      padding-top: 1in;
    }

    .toc-title {
      font-family: "${theme.fonts.header}", sans-serif;
      font-size: 28pt;
      color: ${theme.colors.accent};
      margin-bottom: 0.5in;
      font-weight: bold;
    }

    .toc-entry {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.3in;
      font-size: 12pt;
    }

    .toc-entry-title {
      color: ${theme.colors.text};
    }

    .toc-entry-page {
      color: ${theme.colors.secondaryText};
    }

    /* Content Page */
    .content-page {
      padding-top: 0.5in;
    }

    .content-title {
      font-family: "${theme.fonts.header}", sans-serif;
      font-size: 28pt;
      color: ${theme.colors.accent};
      margin-bottom: 0.5in;
      font-weight: bold;
    }

    .content-block {
      margin-bottom: ${theme.spacing.sectionGap};
    }

    .text-block {
      font-size: 12pt;
      line-height: ${theme.spacing.lineHeight};
      margin-bottom: 0.25in;
    }

    .image-block {
      text-align: center;
      margin: 0.5in 0;
      padding: 0.3in;
      background-color: #252525;
      border: 1px solid ${theme.colors.border};
      border-radius: 4px;
    }

    .image-caption {
      font-size: 10pt;
      color: ${theme.colors.secondaryText};
      margin-top: 0.1in;
      font-style: italic;
    }

    .callout-block {
      background-color: #252525;
      border-left: 3px solid ${theme.colors.accent};
      padding: 0.25in 0.5in;
      margin: 0.3in 0;
      color: ${theme.colors.text};
      font-size: 11pt;
      font-weight: bold;
    }

    /* Epilogue Page */
    .epilogue-page {
      padding-top: 0.5in;
    }

    .epilogue-title {
      font-family: "${theme.fonts.header}", sans-serif;
      font-size: 28pt;
      color: ${theme.colors.accent};
      margin-bottom: 0.5in;
      font-weight: bold;
    }

    .epilogue-section {
      margin-bottom: 0.75in;
    }

    .epilogue-section-title {
      font-size: 14pt;
      color: ${theme.colors.accent};
      font-weight: bold;
      margin-bottom: 0.25in;
      border-bottom: 1px solid ${theme.colors.border};
      padding-bottom: 0.1in;
    }

    .epilogue-section-content {
      font-size: 11pt;
      line-height: ${theme.spacing.lineHeight};
      color: ${theme.colors.secondaryText};
    }

    .epilogue-section-content p {
      margin-bottom: 0.15in;
    }

    .resource-item {
      margin-bottom: 0.1in;
      padding-left: 0.3in;
    }

    .resource-link {
      color: ${theme.colors.accent};
      text-decoration: underline;
    }

    @media print {
      body { margin: 0; padding: 0; }
      .page { margin: 0; padding: 0; }
    }
  </style>
</head>
<body>
`;
}

/**
 * Build cover page HTML
 */
function buildCoverPage(title, author, theme) {
  return `
  <div class="page cover-page">
    <div class="page-number">i</div>
    <div class="cover-title">${escapeHtml(title)}</div>
    <div class="cover-author">by ${escapeHtml(author)}</div>
    <div class="cover-date">2025</div>
  </div>
`;
}

/**
 * Build copyright page HTML
 */
function buildCopyrightPage(theme) {
  return `
  <div class="page copyright-page">
    <div class="page-number">ii</div>
    <div class="copyright-section">
      <p><strong>First Edition, 2025</strong></p>
      <p>Published by CELS</p>
      <p>All rights reserved.</p>
    </div>
    <div class="copyright-section">
      <p>This work is provided for informational and educational purposes. 
         The author and publisher make no warranty, express or implied, 
         with respect to the material contained herein.</p>
    </div>
    <div class="copyright-section">
      <p><small>ISBN: 978-0-00000-000-0 (placeholder)<br>
         Copyright © 2025 CELS. All rights reserved.</small></p>
    </div>
  </div>
`;
}

/**
 * Build table of contents HTML
 */
function buildTableOfContents(pages, theme) {
  let toc = `
  <div class="page toc-page">
    <div class="page-number">iii</div>
    <div class="toc-title">Table of Contents</div>
`;

  pages.forEach((page, idx) => {
    const pageNum = idx + 5; // Content pages start at 5
    toc += `
    <div class="toc-entry">
      <span class="toc-entry-title">${escapeHtml(page.title)}</span>
      <span class="toc-entry-page">${pageNum}</span>
    </div>
`;
  });

  toc += `
    <div class="toc-entry" style="margin-top: 0.5in; border-top: 1px solid ${theme.colors.border}; padding-top: 0.3in;">
      <span class="toc-entry-title">Epilogue</span>
      <span class="toc-entry-page">10</span>
    </div>
  </div>
`;

  return toc;
}

/**
 * Build content page HTML
 */
function buildContentPage(page, pageNumber, theme) {
  let html = `
  <div class="page content-page">
    <div class="page-number">${pageNumber}</div>
    <div class="content-title">${escapeHtml(page.title)}</div>
`;

  // Render blocks
  page.blocks?.forEach((block) => {
    switch (block.type) {
      case "text":
        html += `
    <div class="content-block text-block">
      ${escapeHtml(block.content)}
    </div>
`;
        break;

      case "image":
        html += `
    <div class="content-block image-block">
      <div style="width: 100%; height: 2in; background-color: #333; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: ${
        theme.colors.secondaryText
      };">
        [Image: ${escapeHtml(block.caption)}]
      </div>
      <div class="image-caption">${escapeHtml(block.caption)}</div>
    </div>
`;
        break;

      case "callout":
        html += `
    <div class="content-block callout-block">
      ${escapeHtml(block.content)}
    </div>
`;
        break;
    }
  });

  html += `
  </div>
`;

  return html;
}

/**
 * Build epilogue page HTML
 */
function buildEpiloguePage(epilogue, theme) {
  let html = `
  <div class="page epilogue-page">
    <div class="page-number">10</div>
    <div class="epilogue-title">Epilogue</div>
`;

  // Closing section
  if (epilogue.sections?.closing) {
    const closing = epilogue.sections.closing;
    html += `
    <div class="epilogue-section">
      <div class="epilogue-section-title">${escapeHtml(closing.title)}</div>
      <div class="epilogue-section-content">
        <p>${escapeHtml(closing.content)}</p>
      </div>
    </div>
`;
  }

  // Bio section
  if (epilogue.sections?.bio) {
    const bio = epilogue.sections.bio;
    html += `
    <div class="epilogue-section">
      <div class="epilogue-section-title">${escapeHtml(bio.title)}</div>
      <div class="epilogue-section-content">
        <p>${escapeHtml(bio.content)}</p>
        <p><strong>Email:</strong> <span class="resource-link">${escapeHtml(
          bio.email
        )}</span></p>
      </div>
    </div>
`;
  }

  // Resources section
  if (epilogue.sections?.resources) {
    const resources = epilogue.sections.resources;
    html += `
    <div class="epilogue-section">
      <div class="epilogue-section-title">${escapeHtml(resources.title)}</div>
      <div class="epilogue-section-content">
`;
    resources.items?.forEach((item) => {
      html += `
        <div class="resource-item">
          • <strong>${escapeHtml(item.title)}</strong>: 
          <span class="resource-link">${escapeHtml(item.url)}</span>
        </div>
`;
    });
    html += `
      </div>
    </div>
`;
  }

  html += `
  </div>
`;

  return html;
}

/**
 * Build HTML footer
 */
function buildHTMLFooter() {
  return `
</body>
</html>
`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = {
  generatePDF,
  buildPDFHTML,
};
