// sanitizer.js
// Server-side sanitizer using jsdom + DOMPurify via isomorphic-dompurify.
// This replaces the previous very-small escape-only sanitizer to provide a
// more robust defense against XSS while allowing safe markup like basic
// formatting and images (if desired). DOMPurify's config can be tightened
// as needed for stricter policies.

const { JSDOM } = require("jsdom");
const createDOMPurify = require("isomorphic-dompurify");

// Create a shared JSDOM window used by DOMPurify. Reusing the same window
// avoids re-allocating a DOM per request and is sufficient for server-side
// sanitization tasks that operate on strings.
const window = new JSDOM("", {
  // Optional: url can influence behavior of some sanitizers when resolving
  // relative URLs inside attributes. Keep it generic.
  url: "http://localhost/",
}).window;

const DOMPurify = createDOMPurify(window);

/**
 * sanitizeHtml(input)
 * - input: string of HTML/content to sanitize
 * Returns sanitized HTML string safe to embed in server-rendered templates.
 */
function sanitizeHtml(input = "") {
  if (!input) return "";
  // Use DOMPurify with default configuration; the application can supply
  // additional hooks/config if a different policy is desired (e.g., allow
  // only a strict subset of tags or attributes).
  try {
    return DOMPurify.sanitize(String(input));
  } catch (e) {
    // Fail-safe: if DOMPurify fails for any reason, fall back to conservative escaper.
    return String(input)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

module.exports = { sanitizeHtml };
