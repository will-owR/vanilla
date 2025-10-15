// previewRenderer.js
// Small renderer that produces a full HTML document from content and
// sanitizes inputs. Uses the sanitizer module for defensive sanitization.

const { sanitizeHtml } = require("./sanitizer");

function renderPreview(content = {}, opts = {}) {
  const title = sanitizeHtml(String(content.title || ""));
  const body = sanitizeHtml(String(content.body || ""));

  // Minimal HTML wrapper; Puppeteer/export pipeline can use this.
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; }
      h1 { font-size: 1.4rem; }
    </style>
  </head>
  <body>
    <article>
      <h1>${title}</h1>
      <section>${body}</section>
    </article>
  </body>
</html>`;

  return html;
}

module.exports = { renderPreview };
