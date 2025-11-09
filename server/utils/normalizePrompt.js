// Normalize prompt text: trim, collapse whitespace/newlines, preserve case
function normalizePrompt(input) {
  if (input === null || input === undefined) return "";
  const s = String(input);
  // Trim and replace any sequence of whitespace (including newlines/tabs)
  // with a single space.
  return s.trim().replace(/\s+/g, " ");
}

module.exports = normalizePrompt;
