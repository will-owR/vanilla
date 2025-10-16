// Helper utilities for extracting and normalizing preview HTML from server responses
export function extractPreviewHtml(result) {
  if (!result) return null;

  // Prefer top-level preview
  if (typeof result.preview === "string" && result.preview.trim())
    return result.preview;

  // data.preview
  if (result.data && typeof result.data.preview === "string")
    return result.data.preview;

  // data.content.html or data.content.body
  if (
    result.data &&
    result.data.content &&
    (typeof result.data.content.html === "string" ||
      typeof result.data.content.body === "string")
  ) {
    return result.data.content.html || result.data.content.body;
  }

  // legacy content / content.html / content.body
  if (
    result.content &&
    (typeof result.content.html === "string" ||
      typeof result.content.body === "string")
  )
    return result.content.html || result.content.body;

  // last resort: string html at top-level
  if (typeof result.html === "string") return result.html;

  return null;
}

export function normalizePreviewValue(html) {
  return { body: typeof html === "string" ? html : "" };
}

export default { extractPreviewHtml, normalizePreviewValue };
