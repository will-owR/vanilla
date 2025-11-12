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
 * Accepts flattened payload structure and generates content
 * @param {Object} payload - { mode, prompt, metadata, options }
 * @returns {Promise<Object>} Handler result { pages, metadata, actions }
 */
async function handle(payload) {
  const { prompt, metadata = {}, options = {} } = payload;

  // Use existing generation logic
  const content = buildContent(prompt, options);
  const copies = makeCopies(content, options.copies || 3);
  const pages = buildPagesFromCopies(copies);

  return {
    pages,
    metadata: {
      // NOTE: Response metadata MUST only contain service-generated fields.
      // Request metadata is for validation input only and must NOT be reflected in response.
      // This preserves the semantic contract: request metadata != response metadata
      model: "sample-v1",
      pages_count: pages.length,
    },
    actions: {
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
