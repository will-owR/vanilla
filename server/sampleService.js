// Services MUST be pure: return canonical out_envelope and optional actions.
// This module provides a minimal, testable implementation of the Generation
// contract: async generate(envelopeReq) -> { out_envelope, metadata? }

function buildContent(prompt, opts = {}) {
  const maxWords = opts.titleWords || 6;
  const words = String(prompt || "")
    .split(/\s+/)
    .filter(Boolean);
  const title = `Prompt: ${words.slice(0, maxWords).join(" ")}`;
  const body = String(prompt || "");
  return { title, body };
}

function makeCopies(content, n = 3) {
  return Array.from({ length: n }, () => ({ ...content }));
}

function buildPagesFromCopies(copies) {
  return copies.map((c, idx) => ({
    id: `p${idx + 1}`,
    title: c.title,
    blocks: [
      {
        type: "text",
        content: c.body,
      },
    ],
  }));
}

async function generate(envelopeReq = {}, opts = {}) {
  // Pure: do not perform any I/O or persistence here.
  // Accept only the canonical envelope request: { in_envelope, out_envelope }
  if (
    !envelopeReq ||
    typeof envelopeReq !== "object" ||
    !envelopeReq.in_envelope
  ) {
    const e = new Error(
      "Invalid input: expected { in_envelope, out_envelope }"
    );
    // @ts-ignore
    e.status = 400;
    throw e;
  }

  const inEnv = envelopeReq.in_envelope || {};
  const outEnv = envelopeReq.out_envelope || {};

  const content = buildContent(inEnv.prompt || "", opts);
  const copies = makeCopies(content, opts.copies || 3);
  const pages = buildPagesFromCopies(copies);

  // Populate out_envelope with canonical pages and metadata
  outEnv.pages = pages;
  outEnv.metadata = outEnv.metadata || { model: "sample-v1" };
  // Ensure producers explicitly include an actions key (empty by default)
  outEnv.actions = outEnv.actions || {};

  // Return the canonical shape: { out_envelope: { ... }, metadata? }
  const metadata = { generatedAt: new Date().toISOString() };
  return { out_envelope: outEnv, metadata };
}

// Keep a backward-compatible wrapper name for callers that used the old API.
// Wrapper kept for API compatibility but now requires an envelope request.
async function generateFromPrompt(envelopeReq, opts = {}) {
  return generate(envelopeReq, opts);
}

/**
 * Handle enhanced payload for basic/default mode
 * Creates a multi-page ebook from a single prompt
 *
 * Business Logic:
 * 1. Derive title from prompt (first 6 words)
 * 2. Use entire prompt as body content
 * 3. Create 3 pages (ad-hoc; can be parameterized via options.pages_count)
 * 4. Each page: { id, title, blocks: [{ type: "text", content: body }] }
 * 5. Express persistence intent via actions.persist_prompt
 *
 * @param {Object} payload - { mode, prompt, metadata, options }
 * @returns {Promise<Object>} Canonical service result { pages, metadata, actions }
 */
async function handle(payload) {
  const { prompt, options = {} } = payload;
  // Note: metadata from payload is intentionally not spread into response
  // Services return only service-generated metadata (model, pages_count, source)
  // Take first 6 words, add ellipsis if prompt is longer
  const titleWords = prompt.split(/\s+/).slice(0, 6);
  const title = titleWords.join(" ");
  const isTruncated = prompt.split(/\s+/).length > 6;
  const finalTitle = title + (isTruncated ? "..." : "");

  // 2. Use prompt as body
  const body = prompt;

  // 3. Create pages
  // Default to 3 pages (ad-hoc), can be overridden via options.pages_count
  const numPages = parseInt(options.pages_count || 3, 10);
  const pages = Array.from({ length: numPages }).map((_, idx) => ({
    id: `p${idx + 1}`,
    title: `${finalTitle} — Page ${idx + 1}`,
    blocks: [
      {
        type: "text",
        content: body,
      },
    ],
  }));

  // 4. Return canonical shape with actions for persistence
  return {
    pages,
    metadata: {
      // Service-generated fields ONLY (no request metadata)
      model: "sample-v1",
      pages_count: pages.length,
      source: "prompt",
    },
    actions: {
      // Signal to orchestrator: persist the prompt to file
      persist_prompt: true,
      // Signal to orchestrator: this content is exportable as PDF
      generate_pdf: true,
      can_export: true,
      can_preview: true,
    },
  };
}

module.exports = {
  buildContent,
  makeCopies,
  buildPagesFromCopies,
  generate,
  generateFromPrompt,
  handle,
};
