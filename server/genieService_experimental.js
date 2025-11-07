/**
 * genieService - generation and persistence coordination
 *
 * Migration / persisted-read behavior note
 * --------------------------------------
 * This module supports two persistence access patterns used during the
 * migration from legacy sqlite-based `crud` helpers to a Prisma-backed
 * `utils/dbUtils` shim. The helper `getPersistedContent({ promptId, resultId })`
 * implements a read-first strategy to locate canonical persisted AI
 * results for preview/export endpoints.
 *
 * Priority and fallback rules
 * 1. If a Prisma-backed `dbUtils` is available and returns rows, those are
 *    treated as the canonical source of truth (prefer Prisma results).
 * 2. If Prisma is present but returns no rows (or the Prisma query fails),
 * *    the function will attempt to require and query the legacy `./crud`
 *    implementation so persisted rows written by older code paths remain
 *    discoverable. This makes the system tolerant during migration and in
 *    test environments where some code still writes to sqlite.
 * 3. If an injected test `dbUtils` is provided (via `_setDbUtils`) it will
 *    be used to keep unit tests deterministic.
 *
 * Test/runtime flags
 * - USE_PRISMA_IN_TEST=true  : forces using Prisma in test mode (otherwise
 *                              legacy `crud` is preferred in tests)
 * - GENIE_PERSISTENCE_AWAIT   : when truthy, tests will await persistence
 *                              synchronously (default in NODE_ENV=test)
 * - GENIE_PERSISTENCE_ENABLED : global on/off switch for persistence
 *
 * Rationale
 * The conservative fallback ensures that during a rolling migration (or
 * mixed test environments) persisted data is always discoverable whether
 * it's been written by the new Prisma client or the legacy sqlite helpers.
 * This reduces surprising 400 validation failures in preview/export when
 * callers reference `promptId`/`resultId` written by older code paths.
 *
 * Recommended follow-ups
 * - Add a small unit test asserting the fallback path (Prisma present but
 *   returns no rows -> legacy `crud` queried). See actionables for follow-up
 *   TODOs to add that test and a dedupe/runbook workflow.
 */

/**
 * @typedef {Object} Content
 * @property {string} title
 * @property {string} body
 * @property {string} [layout]
 */
/**
 * @typedef {Object} GenEnvelope
 * @property {boolean} success
 * @property {{content: Content, aiResponse?: any, copies?: any[], metadata?: any, promptId?: number, resultId?: number}} data
 * @property {Content} [content]
 */

let sampleService = require("./sampleService");
const { saveContentToFile } = require("./utils/fileUtils");
const normalizePrompt = require("./utils/normalizePrompt");
const { buildMockAiResponse } = require("./utils/aiMockResponse");
// dbUtils is a Prisma-backed shim present in the repo. Lazy-require inside
// functions that use it to avoid instantiating DB connections when not needed.

const ENABLE_PERSISTENCE = (() => {
  // Backwards-compat: if the flag is not set, keep persistence enabled to
  // preserve existing behavior (controller previously persisted). When the
  // flag is explicitly set to "0"/"false" persistence can be disabled.
  if (typeof process.env.GENIE_PERSISTENCE_ENABLED === "undefined") return true;
  return (
    process.env.GENIE_PERSISTENCE_ENABLED === "1" ||
    process.env.GENIE_PERSISTENCE_ENABLED === "true"
  );
})();

const AWAIT_PERSISTENCE = (() => {
  if (process.env.NODE_ENV === "test") return true;
  return (
    process.env.GENIE_PERSISTENCE_AWAIT === "1" ||
    process.env.GENIE_PERSISTENCE_AWAIT === "true"
  );
})();

const genieService = {
  // For the demo, generate delegates to sampleService. In future this can
  // orchestrate real AI/image jobs via aetherService.
  /**
   * Generate content for a prompt.
   * @param {string} prompt
   * @returns {Promise<GenEnvelope>}
   */
  async generate(prompt) {
    if (!prompt || !String(prompt).trim()) {
      const e = new Error("Prompt is required");
      // @ts-ignore
      e.status = 400;
      throw e;
    }

    // Non-fatal: persist a copy of the raw prompt to disk for auditing/debug.
    // Use the async file util `saveContentToFile` and do not block normal
    // generation. In test mode (AWAIT_PERSISTENCE) we await to keep tests
    // deterministic. Any IO error is handled by the save promise's catch
    // so we don't need an outer try/catch here.
    const p = String(prompt);
    const savePromise = saveContentToFile(p).catch((err) => {
      // Log but do not fail generation
      // eslint-disable-next-line no-console
      console.warn(
        "genieService: saveContentToFile failed",
        err && err.message
      );
    });
    if (AWAIT_PERSISTENCE) await savePromise;

    // If persistence/lookup is enabled, attempt a read-only DB lookup first.
    if (ENABLE_PERSISTENCE) {
      try {
        let dbUtils;
        // Debug: record which persistence implementation we'll use
        // eslint-disable-next-line no-console
        console.debug("genieService: selecting persistence implementation", {
          injected: typeof _injectedDbUtils !== "undefined",
          nodeEnv: process.env.NODE_ENV,
        });
        try {
          dbUtils =
            typeof _injectedDbUtils !== "undefined"
              ? _injectedDbUtils
              : require("./utils/dbUtils");
        } catch (e) {
          // If Prisma-backed dbUtils is not available (dev/test without
          // prisma generate), fall back to legacy sqlite `crud` to keep
          // runtime/tests stable. This preserves non-fatal persistence
          // semantics while migrations/Prisma rollout completes.
          // eslint-disable-next-line no-console
          console.warn(
            "genieService: dbUtils unavailable, falling back to legacy crud",
            e && e.message
          );
          try {
            dbUtils = require("./crud");
          } catch (err2) {
            // Re-throw original error if fallback also unavailable
            throw e;
          }
        }
        const norm = normalizePrompt(prompt);
        // Try to find a prompt with matching normalized text. dbUtils.getPrompts
        // returns recent prompts; keep this read-only and non-fatal.
        const prompts = await dbUtils.getPrompts();
        const match = (prompts || []).find((p) => {
          try {
            return (
              typeof p.prompt === "string" && normalizePrompt(p.prompt) === norm
            );
          } catch (e) {
            return false;
          }
        });

        if (match && match.id) {
          // Load latest AI result for this prompt id.
          try {
            // Prefer direct AI result lookup when available
            const aiRow = await dbUtils
              .getAIResultById(match.id)
              .catch(() => null);
            if (aiRow && aiRow.result) {
              const resultObj =
                typeof aiRow.result === "string"
                  ? JSON.parse(aiRow.result)
                  : aiRow.result;
              // Ensure cached results follow the same envelope shape as
              // freshly-generated results: always include content.layout
              // and a metadata object so callers/tests can rely on the
              // contract.
              const content = resultObj.content || resultObj || {};
              if (!content.layout) content.layout = "poem-single-column";
              const metadata = resultObj.metadata || {
                model: "cached-1",
                tokens: Math.max(
                  10,
                  Math.min(200, String(match.prompt || "").length)
                ),
              };

              return {
                success: true,
                data: {
                  content,
                  copies: resultObj.copies || [],
                  metadata,
                  promptId: match.id,
                  resultId: aiRow.id,
                },
              };
            }
          } catch (e) {
            // non-fatal; fall through to generation
          }
        }
      } catch (e) {
        // Non-fatal: log and fall back to generation
        // eslint-disable-next-line no-console
        console.warn("genieService: read-only lookup failed", e && e.message);
      }
    }

    // Synchronous demo service - wrap in Promise to keep async contract
    try {
      const svc =
        typeof _injectedSampleService !== "undefined"
          ? _injectedSampleService
          : sampleService;

      // Build canonical in_envelope and call the worker with an envelope
      const in_envelope = { prompt: String(prompt) };
      const envelopeReq = { in_envelope, out_envelope: {} };
      const result = await svc.generateFromPrompt(envelopeReq);

      // Normalize returned result: prefer envelope.out_envelope when present
      let returned = result || {};
      // Some services may return { envelope, metadata } or { envelope: {...} }
      if (returned.envelope) returned = returned.envelope;

      const svcOut = returned.out_envelope || returned;

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
          title:
            p.title || (p.blocks && p.blocks[0] && p.blocks[0].content) || "",
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

      // Preserve canonical content when provided by the sampleService.
      // Build aiResponse pages around that canonical content.
      const baseContent = result && result.content ? result.content : null;
      const mock = buildMockAiResponse(prompt, {
        pages: pagesCount,
        model: metadata.model,
      });

      if (baseContent) {
        // Use provided content as canonical content
        mock.content = {
          title: baseContent.title || mock.content.title,
          body: baseContent.body || mock.content.body,
          layout: baseContent.layout || mock.content.layout,
        };
      }

      // Prefer explicit pages from sampleService (copies) when provided
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

      // If persistence is enabled, attempt to persist the prompt and AI result.
      // This is best-effort and must not block or fail the generation response.
      if (ENABLE_PERSISTENCE) {
        // Provide a Promise hook that tests can await to know when the
        // persistence attempt completes. This hook is optional and only used
        // by tests that set GENIE_PERSISTENCE_AWAIT=1.
        let persistenceResolver;
        let persistenceRejecter;
        const persistencePromise = new Promise((res, rej) => {
          persistenceResolver = res;
          persistenceRejecter = rej;
        });
        // Expose test hook
        genieService._lastPersistencePromise = persistencePromise;

        const runPersistence = async () => {
          try {
            let dbUtils;
            // If a test injected mock is present, prefer it. This keeps
            // unit tests deterministic by using the mock implementations.
            if (typeof _injectedDbUtils !== "undefined") {
              dbUtils = _injectedDbUtils;
            } else {
              // By default, prefer the legacy `crud` while running under
              // test mode to keep API endpoints consistent (many existing
              // tests expect CRUD-backed storage). Allow overriding this
              // behavior when an explicit environment flag requests that
              // we exercise the Prisma-backed implementation in tests.
              const usePrismaInTest =
                process.env.USE_PRISMA_IN_TEST === "1" ||
                process.env.USE_PRISMA_IN_TEST === "true";

              if (process.env.NODE_ENV === "test" && !usePrismaInTest) {
                dbUtils = require("./crud");
              } else {
                try {
                  dbUtils = require("./utils/dbUtils");
                } catch (e) {
                  // Fallback to legacy crud if Prisma-backed dbUtils unavailable
                  // eslint-disable-next-line no-console
                  console.warn(
                    "genieService: dbUtils unavailable in persistence step, falling back to legacy crud",
                    e && e.message
                  );
                  dbUtils = require("./crud");
                }
              }
            }
            // Create prompt record with dedupe-on-create handling.
            try {
              let p;
              try {
                // Debug: log presence of createPrompt
                // eslint-disable-next-line no-console
                console.debug(
                  "genieService: dbUtils.createPrompt available?",
                  typeof dbUtils.createPrompt
                );
                p = await dbUtils.createPrompt(String(prompt));
                // eslint-disable-next-line no-console
                console.debug("genieService: createPrompt returned", p);
              } catch (createErr) {
                // If create failed due to a uniqueness/constraint error,
                // attempt to recover by searching for an existing prompt
                // that matches the normalized text. This avoids throwing
                // when concurrent requests race to create the same prompt.
                // Normalize and search recent prompts for a match.
                try {
                  const norm = normalizePrompt(prompt);
                  let recent = [];
                  try {
                    recent = await dbUtils.getPrompts();
                  } catch (dbErr) {
                    // Best-effort recovery: if DB not ready or query fails,
                    // log and continue with empty recent list so we don't
                    // surface an unhandled rejection from persistence.
                    // eslint-disable-next-line no-console
                    console.warn(
                      "genieService: recovery getPrompts failed",
                      dbErr && dbErr.message
                    );
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
                  if (found && found.id) {
                    p = { id: found.id };
                  } else {
                    // Re-throw original create error if we couldn't recover
                    throw createErr;
                  }
                } catch (recoverErr) {
                  // Log recovery failure and rethrow original create error
                  // eslint-disable-next-line no-console
                  console.warn(
                    "genieService: createPrompt failed and recovery failed",
                    createErr && createErr.message,
                    recoverErr && recoverErr.message
                  );
                  throw createErr;
                }
              }

              if (p && p.id) out.data.promptId = p.id;

              // Debug: log created prompt and verify it can be read back
              try {
                // If crud-like API available, attempt to read back the prompt
                if (dbUtils && typeof dbUtils.getPromptById === "function") {
                  const verify = await dbUtils
                    .getPromptById(p.id)
                    .catch(() => null);
                  // eslint-disable-next-line no-console
                  console.debug(
                    "genieService: persistence created prompt result:",
                    p,
                    "verify:",
                    verify
                  );
                } else {
                  // eslint-disable-next-line no-console
                  console.debug(
                    "genieService: persistence created prompt (no getPromptById):",
                    p
                  );
                }
              } catch (e) {
                // eslint-disable-next-line no-console
                console.warn(
                  "genieService: persistence verify failed",
                  e && e.message
                );
              }

              // Create AI result record linked to the prompt
              try {
                let aiRes = null;
                if (dbUtils && typeof dbUtils.createAIResult === "function") {
                  // Persist the full aiResponse envelope when available so the
                  // DB retains pages and metadata for future reads.
                  const toPersist = out.data.aiResponse || {
                    content: out.data.content,
                    copies: out.data.copies,
                  };
                  aiRes = await dbUtils.createAIResult(
                    out.data.promptId,
                    toPersist
                  );
                }
                if (aiRes && aiRes.id) out.data.resultId = aiRes.id;
              } catch (e) {
                // non-fatal: log and continue
                // eslint-disable-next-line no-console
                console.warn(
                  "genieService: failed to create AI result",
                  e && e.message
                );
              }
            } catch (e) {
              // non-fatal: log and continue
              // eslint-disable-next-line no-console
              console.warn(
                "genieService: failed to create prompt",
                e && e.message
              );
            }
            persistenceResolver();
          } catch (e) {
            // Non-fatal: log and ignore persistence failures
            // eslint-disable-next-line no-console
            console.warn(
              "genieService: persistence step failed",
              e && e.message
            );
            persistenceRejecter(e);
          } finally {
            // Clear the last persistence promise after it's settled
            setImmediate(() => {
              genieService._lastPersistencePromise = undefined;
            });
          }
        };

        if (AWAIT_PERSISTENCE) {
          // Await persistence synchronously (test-only mode)
          await runPersistence();
        } else {
          // Fire-and-forget for normal operation. Attach a catch to avoid
          // unhandled rejections escaping if persistence fails asynchronously.
          (async () => {
            try {
              await runPersistence();
            } catch (e) {
              // Non-fatal: log background persistence failure
              // eslint-disable-next-line no-console
              console.warn(
                "genieService: background persistence failed",
                e && e.message
              );
            }
          })();
        }
      }

      return out;
    } catch (err) {
      const e = new Error("Generation failed: " + (err && err.message));
      // @ts-ignore
      e.status = 500;
      throw e;
    }
  },

  readLatest() {
    try {
      const { readLatest } = require("./utils/fileUtils");
      return readLatest();
    } catch (e) {
      return null;
    }
  },

  /**
   * Read persisted content by promptId or resultId.
   * Returns an object: { content, metadata, promptId, resultId } or null.
   * @param {{promptId?: number|string, resultId?: number|string}} [opts]
   */
  async getPersistedContent({ promptId, resultId } = {}) {
    try {
      let dbUtils;
      if (typeof _injectedDbUtils !== "undefined") dbUtils = _injectedDbUtils;
      else {
        try {
          dbUtils = require("./utils/dbUtils");
        } catch (e) {
          // Fallback to legacy crud
          dbUtils = require("./crud");
        }
      }

      // If resultId provided, prefer direct lookup
      if (resultId) {
        try {
          // dbUtils.getAIResultById exists on both Prisma shim and crud
          const row = await dbUtils.getAIResultById(parseInt(resultId, 10));
          if (row && row.result) {
            const resultObj =
              typeof row.result === "string"
                ? JSON.parse(row.result)
                : row.result;
            const content =
              resultObj && resultObj.content ? resultObj.content : resultObj;
            return {
              content,
              metadata: resultObj.metadata || null,
              promptId: row.promptId || null,
              resultId: row.id,
            };
          }
        } catch (e) {
          // non-fatal; continue to promptId path
        }
      }

      if (promptId) {
        const pid = parseInt(promptId, 10);
        if (isNaN(pid)) return null;

        // Prefer Prisma-backed direct query when available. If Prisma is
        // present but returns no rows (e.g. tests wrote to legacy sqlite via
        // `crud`) attempt a fallback to the legacy `crud` so persisted rows
        // created by older code paths are still discoverable.
        try {
          if (dbUtils && typeof dbUtils._getPrisma === "function") {
            const prisma = dbUtils._getPrisma();
            let rows = [];
            try {
              rows = await prisma.aIResult.findMany({
                where: { promptId: pid },
                orderBy: { id: "asc" },
              });
            } catch (prismaErr) {
              // If Prisma query fails (no connection, migrations, etc), we'll
              // fall through to the legacy crud fallback below.
              rows = [];
            }

            const latest = rows && rows.length ? rows[rows.length - 1] : null;
            if (latest) {
              const resultObj =
                typeof latest.result === "string"
                  ? JSON.parse(latest.result)
                  : latest.result;
              const content =
                resultObj && resultObj.content ? resultObj.content : resultObj;
              return {
                content,
                metadata: resultObj.metadata || null,
                promptId: pid,
                resultId: latest.id,
              };
            }

            // No Prisma rows found: attempt legacy crud fallback below by
            // continuing execution (do not return). This handles mixed
            // environments during migration where tests or runtime may still
            // write to sqlite via `crud`.
          }
        } catch (e) {
          // fall back to legacy crud path
        }

        // Legacy crud fallback: try to require the legacy `crud` module and
        // query its getAIResults implementation. This covers test and legacy
        // environments where persisted rows were written by `crud` into the
        // sqlite DB while a Prisma client may be present but not used.
        try {
          let legacyDb = null;
          try {
            legacyDb = require("./crud");
          } catch (requireErr) {
            legacyDb = null;
          }

          const candidate = legacyDb || dbUtils;
          if (candidate && typeof candidate.getAIResults === "function") {
            const results = await candidate.getAIResults();
            const filtered = (results || []).filter(
              (r) =>
                r.prompt_id === pid ||
                r.promptId === pid ||
                r.promptId === String(pid)
            );
            // results are ordered by created_at desc in crud.getAIResults, ensure latest
            const latest = filtered.length ? filtered[0] : null;
            if (latest) {
              const resultObj =
                typeof latest.result === "string"
                  ? JSON.parse(latest.result)
                  : latest.result;
              const content =
                resultObj && resultObj.content ? resultObj.content : resultObj;
              return {
                content,
                metadata: resultObj.metadata || null,
                promptId: pid,
                resultId: latest.id,
              };
            }
          }
        } catch (e) {
          // non-fatal
        }
      }

      return null;
    } catch (e) {
      // Non-fatal; return null so callers can fallback
      // eslint-disable-next-line no-console
      console.warn("genieService.getPersistedContent failed", e && e.message);
      return null;
    }
  },

  // Backwards-compatible wrapper that delegates to utils/fileUtils
  /**
   * Export content or a generated prompt to a PDF buffer.
   * @param {{prompt?: string|Content, promptId?: number|string, resultId?: number|string, envelope?: any, validate?: boolean}} [opts]
   */
  async export({
    prompt,
    promptId,
    resultId,
    envelope,
    validate = false,
  } = {}) {
    // Centralized export orchestration: prefer persisted content, fall back
    // to generation, then render PDF using the pdfGenerator utility.
    let contentObj = null;
    // Lazily require pdfGenerator once for this invocation to avoid
    // duplicate identifier complaints from static analysis when using
    // destructured requires in multiple branches.
    const pdfGenerator = /** @type {any} */ (require("./pdfGenerator"));

    // If caller provided a canonical envelope directly, use it immediately
    if (envelope && envelope.pages && Array.isArray(envelope.pages)) {
      // Accept canonical envelope directly; downstream plumbing will render
      // the envelope into a PDF. Bypass legacy title/body normalization.
      // Note: we still allow validate flag to be passed through.
      const generated = await pdfGenerator.generatePdfBuffer({
        envelope,
        validate,
      });
      if (validate) {
        if (generated && generated.buffer)
          return {
            buffer: generated.buffer,
            validation: generated.validation,
          };
        if (generated && generated.validation) return generated;
      }
      return {
        buffer: Buffer.isBuffer(generated) ? generated : generated.buffer,
      };
    }

    // Prefer persisted canonical content when IDs provided
    if (promptId || resultId) {
      const persisted = await genieService.getPersistedContent({
        promptId,
        resultId,
      });
      if (persisted && persisted.content) {
        contentObj =
          persisted.content && persisted.content.content
            ? persisted.content.content
            : persisted.content;
      }
    }

    // If caller provided a content object directly via `prompt`, accept it
    if (!contentObj && prompt && typeof prompt === "object") {
      // shape: { title, body }
      contentObj = prompt;
    }

    // Otherwise, generate content from prompt text
    if (!contentObj && prompt && typeof prompt === "string") {
      const genResult = await genieService.generate(prompt);
      // genieService.generate returns envelope { success, data }
      if (genResult && genResult.data && genResult.data.content)
        contentObj = genResult.data.content;
      else if (genResult && genResult.content) contentObj = genResult.content;
    }

    if (!contentObj || !contentObj.title || !contentObj.body) {
      const e = new Error(
        "Export requires content (title & body) or a valid prompt/persisted id"
      );
      // @ts-ignore
      e.status = 400;
      throw e;
    }

    const title = contentObj.title || "Export";
    const body = contentObj.body || "";

    const generated = await pdfGenerator.generatePdfBuffer({
      title,
      body,
      validate,
    });
    if (validate) {
      if (generated && generated.buffer)
        return { buffer: generated.buffer, validation: generated.validation };
      // Some implementations return { buffer, validation } already
      if (generated && generated.validation) return generated;
    }

    return {
      buffer: Buffer.isBuffer(generated) ? generated : generated.buffer,
    };
  },

  saveContentToFile(content) {
    return saveContentToFile(content);
  },
};

module.exports = genieService;

// Test helpers: allow injecting a mock dbUtils or sample service for unit tests
let _injectedDbUtils;
let _injectedSampleService;
module.exports._setDbUtils = (m) => {
  _injectedDbUtils = m;
};
module.exports._resetDbUtils = () => {
  _injectedDbUtils = undefined;
};
module.exports._setSampleService = (m) => {
  _injectedSampleService = m;
};
module.exports._resetSampleService = () => {
  _injectedSampleService = undefined;
};
