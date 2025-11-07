/**
 * defaultModule - encapsulates the current DEFAULT pipeline used by genieService
 *
 * Responsibilities moved here:
 * - normalize svcOut and ensure content/layout defaults
 * - build aiResponse via buildMockAiResponse and merge base content/copies
 * - assemble the canonical `out` envelope
 * - perform best-effort persistence (with Prisma -> crud fallbacks) and
 *   expose a persistence promise that callers/tests can await
 */

const normalizePrompt = require("./utils/normalizePrompt");
const { buildMockAiResponse } = require("./utils/aiMockResponse");

// Helper: attempt to resolve a dbUtils implementation similar to genieService
async function resolveDbUtils(injectedDbUtils) {
  if (typeof injectedDbUtils !== "undefined") return injectedDbUtils;
  try {
    return require("./utils/dbUtils");
  } catch (e) {
    // Fallback to legacy crud when Prisma-backed dbUtils unavailable
    try {
      return require("./crud");
    } catch (err2) {
      throw e;
    }
  }
}

/**
 * Run the default generation+assembly+persistence pipeline.
 * @param {{prompt: string, svcOut: any, result: any, injectedDbUtils?: any, ENABLE_PERSISTENCE: boolean, AWAIT_PERSISTENCE: boolean}} opts
 * @returns {Promise<{out: any, persistencePromise?: Promise<void>}>}
 */
async function runDefault({
  prompt,
  svcOut,
  result,
  injectedDbUtils,
  ENABLE_PERSISTENCE,
  AWAIT_PERSISTENCE,
}) {
  // Ensure returned content/layout and metadata defaults
  const content = (svcOut && svcOut.content) || {};
  if (!content.layout) content.layout = "poem-single-column";
  const metadata = svcOut.metadata || {
    model: "mock-1",
    tokens: Math.max(10, Math.min(200, String(prompt || "").length)),
  };

  // Normalize returned pages/copies/content into a compat shape used below
  const normalized = {};
  if (Array.isArray(svcOut.pages)) {
    normalized.pages = svcOut.pages;
    normalized.copies = svcOut.pages.map((p) => ({
      title: p.title || (p.blocks && p.blocks[0] && p.blocks[0].content) || "",
      body: (p.blocks && p.blocks[0] && p.blocks[0].content) || "",
      layout: p.layout || content.layout,
    }));
    normalized.pagesCount = svcOut.pages.length;
  }
  if (Array.isArray(svcOut.copies)) {
    normalized.copies = svcOut.copies;
    normalized.pagesCount = svcOut.copies.length;
  }
  if (svcOut.content) normalized.content = svcOut.content;
  if (svcOut.metadata) normalized.metadata = svcOut.metadata;

  // Build a backward-compatible output envelope and include a richer
  // aiResponse envelope that can be multi-page. Use copies from the
  // generator when present, otherwise generate pages via helper.
  const pagesCount =
    (result && typeof result.pages === "number" && result.pages) ||
    (result && Array.isArray(result.copies) && result.copies.length) ||
    undefined;

  const baseContent = result && result.content ? result.content : null;
  const mock = buildMockAiResponse(prompt, {
    pages: pagesCount,
    model: metadata.model,
  });

  if (baseContent) {
    mock.content = {
      title: baseContent.title || mock.content.title,
      body: baseContent.body || mock.content.body,
      layout: baseContent.layout || mock.content.layout,
    };
  }

  if (result && Array.isArray(result.copies) && result.copies.length > 0) {
    mock.aiResponse.pages = result.copies.map((c) => ({
      title: c.title || mock.content.title,
      body: c.body || mock.content.body,
      layout: c.layout || mock.content.layout,
    }));
    mock.aiResponse.pageCount = mock.aiResponse.pages.length;
  }

  const out = {
    success: true,
    data: {
      content: mock.content,
      aiResponse: mock.aiResponse,
      copies: result.copies || [],
      metadata: mock.metadata,
    },
  };

  // Persistence: mirror genieService behavior (best-effort)
  let persistenceResolver;
  let persistenceRejecter;
  const persistencePromise = new Promise((res, rej) => {
    persistenceResolver = res;
    persistenceRejecter = rej;
  });

  const runPersistence = async () => {
    try {
      let dbUtils;
      try {
        dbUtils = await resolveDbUtils(injectedDbUtils);
      } catch (e) {
        // If dbUtils resolution failed entirely, rethrow so callers can
        // decide whether to fail or continue.
        throw e;
      }

      // Create prompt record with dedupe-on-create handling.
      try {
        let p;
        try {
          p = await dbUtils.createPrompt(String(prompt));
        } catch (createErr) {
          // Attempt recovery by searching for existing prompt
          try {
            const norm = normalizePrompt(prompt);
            let recent = [];
            try {
              recent = await dbUtils.getPrompts();
            } catch (dbErr) {
              recent = [];
            }
            const found = (recent || []).find((r) => {
              try {
                return (
                  typeof r.prompt === "string" &&
                  normalizePrompt(r.prompt) === norm
                );
              } catch (e) {
                return false;
              }
            });
            if (found && found.id) p = { id: found.id };
            else throw createErr;
          } catch (recoverErr) {
            throw createErr;
          }
        }

        if (p && p.id) out.data.promptId = p.id;

        // Create AI result record linked to the prompt
        try {
          let aiRes = null;
          if (dbUtils && typeof dbUtils.createAIResult === "function") {
            const toPersist = out.data.aiResponse || {
              content: out.data.content,
              copies: out.data.copies,
            };
            aiRes = await dbUtils.createAIResult(out.data.promptId, toPersist);
          }
          if (aiRes && aiRes.id) out.data.resultId = aiRes.id;
        } catch (e) {
          // non-fatal: log and continue
          // eslint-disable-next-line no-console
          console.warn(
            "defaultModule: failed to create AI result",
            e && e.message
          );
        }
      } catch (e) {
        // non-fatal: log and continue
        // eslint-disable-next-line no-console
        console.warn("defaultModule: failed to create prompt", e && e.message);
      }

      persistenceResolver();
    } catch (e) {
      // Non-fatal: log and reject promise
      // eslint-disable-next-line no-console
      console.warn("defaultModule: persistence step failed", e && e.message);
      persistenceRejecter(e);
    }
  };

  if (ENABLE_PERSISTENCE) {
    if (AWAIT_PERSISTENCE) {
      try {
        await runPersistence();
      } catch (e) {
        // already logged inside runPersistence
      }
    } else {
      // Fire-and-forget
      (async () => {
        try {
          await runPersistence();
        } catch (e) {
          // already logged
        }
      })();
    }
  } else {
    // If persistence disabled, resolve immediately
    persistenceResolver();
  }

  return { out, persistencePromise };
}

module.exports = {
  runDefault,
};
