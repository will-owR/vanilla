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

      // Minimal actions gate: if producer provided a non-empty actions
      // object, forward to the actionsModule which will handle simple
      // actions (print-to-file, etc). If the actions module fails the
      // code will fall back to the DEFAULT pipeline below.
      try {
        const actions = (svcOut && svcOut.actions) || {};
        const hasActions = actions && Object.keys(actions).length > 0;
        if (hasActions) {
          try {
            const actionsModule = require("./actionsModule");
            if (typeof actionsModule.runActions === "function") {
              const actionResult = await actionsModule.runActions({
                actions,
                prompt,
                svcOut,
                result,
                injectedDbUtils:
                  typeof _injectedDbUtils !== "undefined"
                    ? _injectedDbUtils
                    : undefined,
              });
              return actionResult;
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("genieService: actionsModule failed", e && e.message);
            // fall through to DEFAULT
          }
        }
      } catch (e) {
        // If reading actions fails, log and continue to default
        // eslint-disable-next-line no-console
        console.warn("genieService: actions gate read failed", e && e.message);
      }

      // Delegate the original DEFAULT behavior into the new module so it can
      // be removed later when action dispatch is implemented.
      const defaultModule = require("./defaultModule");
      const { out, persistencePromise } = await defaultModule.runDefault({
        prompt,
        svcOut,
        result,
        injectedDbUtils:
          typeof _injectedDbUtils !== "undefined"
            ? _injectedDbUtils
            : undefined,
        ENABLE_PERSISTENCE,
        AWAIT_PERSISTENCE,
      });

      // Expose the persistence promise for tests to await (compat with prior behavior)
      genieService._lastPersistencePromise = persistencePromise;

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
          const row = await dbUtils.getAIResultById(
            parseInt(String(resultId), 10)
          );
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
        const pid = parseInt(String(promptId), 10);
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

  /**
   * Export content or a generated prompt to a PDF buffer
   *
   * Orchestration strategy (in priority order):
   * 1. Use canonical envelope if provided directly
   * 2. Lookup persisted content by promptId/resultId
   * 3. Generate from string prompt using process() (preferred for new envelopes)
   * 4. Generate from prompt object (legacy content object with title/body)
   *
   * All rendering is delegated to exportService which handles both
   * canonical envelope format and legacy title/body format.
   *
   * @param {{prompt?: string|Content, promptId?: number|string, resultId?: number|string, envelope?: any, validate?: boolean}} [opts]
   * @returns {Promise<{buffer: Buffer, validation?: any}>}
   */
  async export({
    prompt,
    promptId,
    resultId,
    envelope,
    validate = false,
  } = {}) {
    const exportService = require("./exportService");

    // Priority 1: Canonical envelope provided directly
    if (envelope && envelope.pages && Array.isArray(envelope.pages)) {
      return exportService.generate(envelope, { validate });
    }

    // Priority 2: Canonical envelope passed as prompt parameter
    if (
      prompt &&
      typeof prompt === "object" &&
      prompt.pages &&
      Array.isArray(prompt.pages)
    ) {
      return exportService.generate(prompt, { validate });
    }

    // Priority 3: Generate from string prompt using process()
    if (prompt && typeof prompt === "string") {
      const processResult = await genieService.process({
        mode: "basic",
        prompt,
        metadata: {},
        options: {},
      });
      if (processResult && processResult.out_envelope) {
        return exportService.generate(processResult.out_envelope, {
          validate,
        });
      }
    }

    // Priority 4: Lookup persisted content by ID
    if (promptId || resultId) {
      const persisted = await genieService.getPersistedContent({
        promptId,
        resultId,
      });
      if (persisted && persisted.content) {
        const contentObj =
          persisted.content && persisted.content.content
            ? persisted.content.content
            : persisted.content;
        // If persisted content has pages (canonical), use it
        if (contentObj && contentObj.pages && Array.isArray(contentObj.pages)) {
          return exportService.generate(contentObj, { validate });
        }
      }
    }

    // No valid export path found
    const e = new Error(
      "Export requires: canonical envelope with pages array, or valid promptId/resultId"
    );
    // @ts-ignore
    e.status = 400;
    throw e;
  },

  saveContentToFile(content) {
    return saveContentToFile(content);
  },

  /**
   * Process enhanced payload with mode-based routing
   * Routes to appropriate service handler based on mode
   * @param {Object} payload - Enhanced payload { mode, prompt, metadata, options }
   * @returns {Promise<Object>} Standardized response with out_envelope
   */
  /**
   * Process enhanced payload — Orchestrator
   *
   * Responsibilities:
   * 1. Route by mode to appropriate service handler
   * 2. Build canonical envelope with enriched metadata
   * 3. Process actions from service (e.g., persist_prompt)
   * 4. Coordinate with external concerns (persistence, etc.)
   *
   * @param {Object} payload - { mode, prompt, metadata, options }
   * @returns {Promise<Object>} Canonical response { out_envelope: { pages, metadata, actions } }
   */
  async process(payload) {
    const { mode, prompt } = payload;

    try {
      let result;

      // 1. Route by mode to appropriate service handler
      switch (mode) {
        case "demo": {
          const demoService = require("./demoService");
          result = await demoService.handle(payload);
          break;
        }
        case "ebook": {
          const ebookService = require("./ebookService");
          result = await ebookService.handle(payload);
          break;
        }
        case "basic":
        default: {
          result = await sampleService.handle(payload);
        }
      }

      // 2. Build canonical response envelope with enriched metadata
      const envelope = {
        out_envelope: {
          pages: result.pages || [],
          metadata: {
            // Service-generated fields
            ...result.metadata,
            // Orchestrator-added fields
            generated_at: new Date().toISOString(),
            mode: mode,
          },
          actions: result.actions || {},
        },
      };

      // 3. Process actions from service (orchestrator responsibility)
      // Actions allow services to express intent without handling side effects
      if (result.actions) {
        // Check for persist_prompt action
        if (result.actions.persist_prompt === true) {
          try {
            const { saveContentToFile } = require("./utils/fileUtils");
            // Fire-and-forget: save prompt in background (non-blocking)
            saveContentToFile(prompt).catch((err) => {
              // Log but do not fail the request
              // eslint-disable-next-line no-console
              console.warn(
                "genieService.process: persist_prompt action failed",
                err?.message
              );
            });
          } catch (e) {
            // Log but do not fail the request
            // eslint-disable-next-line no-console
            console.warn(
              "genieService.process: Could not process persist_prompt action",
              e?.message
            );
          }
        }

        // Other actions can be added here as needed:
        // if (result.actions.send_notification) { ... }
        // if (result.actions.trigger_webhook) { ... }
      }

      return envelope;
    } catch (error) {
      throw new Error(`Generation failed: ${error.message}`);
    }
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
