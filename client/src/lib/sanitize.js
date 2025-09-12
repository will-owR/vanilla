// Minimal sanitization wrapper used by the client preview.
// Prefer DOMPurify if available in the environment; otherwise fall back
// to a conservative sanitizer that removes <script> tags and on* attributes.
export function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return "";

  // If DOMPurify is available globally (e.g., added via a script tag or bundler), use it.
  if (
    typeof window !== "undefined" &&
    window.DOMPurify &&
    typeof window.DOMPurify.sanitize === "function"
  ) {
    try {
      return window.DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
    } catch (e) {
      // fallback to minimal sanitizer below
    }
  }

  // Minimal sanitizer: remove <script> tags and strip attributes that start with 'on' (e.g., onclick)
  // NOTE: This is intentionally conservative and not a replacement for a full sanitizer like DOMPurify.
  try {
    // Remove script tags and their contents
    let out = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    // Remove event handler attributes (onxyz=)
    out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    // Remove javascript: URIs in href/src
    out = out.replace(
      /(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi,
      '$1="#"'
    );
    return out;
  } catch (e) {
    return "";
  }
}
