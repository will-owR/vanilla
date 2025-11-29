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
   * Classify a prompt to extract medium, style, theme, audience, tone
   *
   * Classification Pipeline:
   * 1. Rule engine (fast path, <10ms, >80% accuracy)
   * 2. LLM classifier (slow path, ~500ms, fallback when confidence < 0.85)
   * 3. Validator (merge rule + AI results intelligently)
   *
   * @param {string} prompt - User prompt to classify
   * @returns {Promise<Object>} Classification { medium, style, themes, audience, tone, confidence, source }
   */
  async classifyPrompt(prompt) {
    if (!prompt || !String(prompt).trim()) {
      return {
        medium: "ebook",
        style: "minimalist",
        themes: [],
        confidence: 0.5,
        source: "default",
      };
    }

    try {
      const { RuleEngine, ruleEngineInstance } = require("./utils/ruleEngine");
      const { keywordDatabase } = require("./utils/keywordDatabase");
      const {
        LLMClassifier,
        llmClassifierInstance,
      } = require("./utils/llmClassifier");
      const {
        ClassificationValidator,
        classificationValidatorInstance,
      } = require("./utils/classificationValidator");

      // STEP 1: Fast path - rule engine extraction (<10ms)
      const ruleEngine = ruleEngineInstance || new RuleEngine(keywordDatabase);
      let classification = ruleEngine.extract(prompt);

      // Normalize response format
      if (!classification.themes && classification.theme) {
        classification.themes = classification.theme;
      }
      if (!classification.themes) {
        classification.themes = [];
      }
      if (!classification.confidence) {
        classification.confidence = 0.5;
      }
      if (!classification.source) {
        classification.source = "rules";
      }

      // STEP 2: LLM fallback - if rule engine low confidence
      if (classification.confidence < 0.85) {
        try {
          const llmClassifier = llmClassifierInstance || new LLMClassifier();
          const aiResult = await llmClassifier.classify(prompt);

          if (aiResult) {
            // STEP 3: Merge rule + AI results
            const validator =
              classificationValidatorInstance || new ClassificationValidator();
            classification = validator.merge(classification, aiResult);

            // Ensure merged result has correct format
            if (!classification.themes && classification.theme) {
              classification.themes = classification.theme;
            }
            if (!classification.themes) {
              classification.themes = [];
            }
            if (!classification.source) {
              classification.source = "merge";
            }
          }
        } catch (aiError) {
          // Log but don't fail - rule engine result is sufficient
          // eslint-disable-next-line no-console
          console.warn(
            "LLM classification failed (non-blocking)",
            aiError?.message
          );
          // Keep rule engine result
        }
      }

      return classification;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Classification pipeline failed", error?.message);
      // Return safe default
      return {
        medium: "ebook",
        style: "minimalist",
        themes: [],
        confidence: 0.5,
        source: "error",
      };
    }
  },

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
    let { mode, prompt } = payload;
    const { v4: uuidv4 } = require("uuid");
    const resultDb = require("./utils/resultDb");

    try {
      let result;
      let classification = null;

      // NEW: Phase A-B - Extract classification if provided or auto-generate
      // Priority: provided classification > auto-classify flag > auto-mode
      if (payload._classification) {
        // Use provided classification (from POST /api/generate)
        classification = payload._classification;
      } else if (!mode || mode === "auto") {
        // Auto-classify when no mode provided or mode is "auto"
        classification = await this.classifyPrompt(prompt);
        mode = classification.medium; // Use detected medium for routing
      } else if (payload._classify === true) {
        // Explicit classification flag for testing
        classification = await this.classifyPrompt(prompt);
      }

      // 1. Route by mode to appropriate service handler
      switch (mode) {
        case "demo": {
          const demoService = require("./demoService");
          result = await demoService.handle(payload, classification);
          break;
        }
        case "ebook": {
          const ebookService = require("./ebookService");
          result = await ebookService.handle(payload, classification);
          // WEEK 1 FIX: Generate HTML from structured data
          console.log("[COMPOSE] Starting compose() call for ebook mode");
          try {
            const html = await this.compose(result);
            result.html = html; // Include HTML in result
            console.log(
              "[COMPOSE] Success! Generated HTML length:",
              result.html?.length || "NULL"
            );
            if (!result.html || result.html.length === 0) {
              console.warn("[COMPOSE] WARNING: HTML is empty or null");
            }
          } catch (err) {
            console.error("[COMPOSE] FAILED:", err?.message, err?.stack);
            result.html = null; // Graceful degradation
          }
          break;
        }
        case "basic":
        default: {
          result = await sampleService.handle(payload, classification);
        }
      }

      // 2. Build canonical response envelope with enriched metadata
      const envelope = {
        out_envelope: {
          pages: result.pages || [],
          html: result.html || null, // WEEK 1: Include composed HTML
          metadata: {
            // Service-generated fields
            ...result.metadata,
            // Orchestrator-added fields
            generated_at: new Date().toISOString(),
            mode: mode,
            // NEW: Phase A-B - Include classification metadata
            ...(classification && { classification }),
          },
          actions: result.actions || {},
          // Include epilogue if provided by service (e.g., demo mode)
          ...(result.epilogue && { epilogue: result.epilogue }),
        },
      };

      // 3. Persist result with unique UUID for retrieval
      // Each generation gets a resultId that can be used to reference this result
      // in export, preview, and other endpoints. This enables:
      // - Reference-based export (client sends resultId, not content)
      // - Async job queuing (jobs reference resultId, not full content)
      // - Audit trail (all prompts/results stored by UUID)
      const resultId = uuidv4();
      try {
        await resultDb.saveResult(resultId, envelope.out_envelope, mode);
        envelope.resultId = resultId;
      } catch (err) {
        // Log but do not fail the request - persistence is best-effort
        // eslint-disable-next-line no-console
        console.warn(
          "genieService.process: result persistence failed",
          err?.message
        );
        // Still include resultId in response for client reference (best-effort)
        envelope.resultId = resultId;
      }

      // 4. Process actions from service (orchestrator responsibility)
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

  /**
   * Compose final ebook HTML from structured data
   *
   * Accepts structured data from ebookService and:
   * 1. Resolves image concepts → SVG library (cache) or Gemini (fallback)
   * 2. Generates cover, copyright, TOC, content pages, epilogue
   * 3. Returns production-ready ebook HTML
   *
   * @param {Object} structuredData - { pages, metadata, actions } from ebookService
   * @returns {Promise<string>} Complete ebook HTML
   */
  async compose(structuredData) {
    if (!structuredData || !Array.isArray(structuredData.pages)) {
      throw new Error("compose: requires structured data with pages array");
    }

    console.log(
      "[COMPOSE] Starting compose with",
      structuredData.pages.length,
      "pages"
    );
    const { pages, metadata = {} } = structuredData;
    const {
      theme = "dark",
      colorPalette = "standard",
      fontSizeScale = 1.0,
      density = "medium",
    } = metadata;

    console.log(
      "[COMPOSE] theme:",
      theme,
      "colorPalette:",
      colorPalette,
      "density:",
      density
    );

    // Theme color system
    const themeColors = {
      dark: {
        bg: "#1a1a1a",
        text: "#ffffff",
        accent: "#00d4ff",
        heading: "#ffffff",
      },
      light: {
        bg: "#ffffff",
        text: "#000000",
        accent: "#0066cc",
        heading: "#000000",
      },
      corporate: {
        bg: "#f5f5f5",
        text: "#2c3e50",
        accent: "#34495e",
        heading: "#2c3e50",
      },
      bold: {
        bg: "#000000",
        text: "#ffff00",
        accent: "#ff6b35",
        heading: "#ff6b35",
      },
    };

    const colors = themeColors[theme] || themeColors.dark;
    const fontSize = Math.round(16 * fontSizeScale);

    // 1. Generate Cover Page
    const coverHtml = `
<div class="page cover-page" style="
  background-color: ${colors.bg};
  color: ${colors.text};
  padding: 60px 40px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
">
  <h1 style="
    font-size: ${fontSize * 2.5}px;
    margin-bottom: 20px;
    color: ${colors.heading};
    font-family: Georgia, serif;
  ">${structuredData.title || "Untitled eBook"}</h1>
  <p style="
    font-size: ${fontSize * 1.2}px;
    color: ${colors.accent};
    font-style: italic;
  ">Generated by Aether AI</p>
  <p style="
    margin-top: 40px;
    font-size: ${fontSize * 0.9}px;
    color: ${colors.text};
  ">${new Date().toLocaleDateString()}</p>
</div>`;

    // 2. Generate Copyright Page
    const copyrightHtml = `
<div class="page copyright-page" style="
  background-color: ${colors.bg};
  color: ${colors.text};
  padding: 60px 40px;
  font-family: Georgia, serif;
  font-size: ${fontSize * 0.85}px;
  page-break-after: always;
">
  <h2 style="color: ${
    colors.heading
  }; margin-bottom: 20px;">Copyright Information</h2>
  <p>This eBook was generated by Aether AI.</p>
  <p>Generated on: ${new Date().toISOString()}</p>
  <p>Theme: ${theme}</p>
  <p>Density: ${density}</p>
  <hr style="border-color: ${colors.accent}; margin: 30px 0;">
  <p style="font-style: italic; color: ${colors.accent};">
    This content was AI-generated and may contain inaccuracies.
    Please review before publication or distribution.
  </p>
</div>`;

    // 3. Generate Table of Contents
    const tocHtml = `
<div class="page toc-page" style="
  background-color: ${colors.bg};
  color: ${colors.text};
  padding: 60px 40px;
  font-family: Georgia, serif;
  page-break-after: always;
">
  <h1 style="
    font-size: ${fontSize * 1.8}px;
    color: ${colors.heading};
    margin-bottom: 40px;
  ">Table of Contents</h1>
  <ol style="font-size: ${fontSize}px; line-height: 2;">
    ${pages
      .map(
        (ch, idx) => `
    <li>
      <a href="#ch_${idx + 1}" style="color: ${
          colors.accent
        }; text-decoration: none;">
        ${ch.title || `Chapter ${idx + 1}`}
      </a>
    </li>
    `
      )
      .join("")}
  </ol>
</div>`;

    // 4. Generate Content Pages (one per chapter)
    const contentHtml = pages
      .map(
        (chapter, idx) => `
<div class="page content-page" id="ch_${idx + 1}" style="
  background-color: ${colors.bg};
  color: ${colors.text};
  padding: 60px 40px;
  font-family: Georgia, serif;
  font-size: ${fontSize}px;
  line-height: 1.8;
  page-break-after: always;
  page-break-inside: avoid;
">
  <h2 style="
    color: ${colors.heading};
    border-bottom: 2px solid ${colors.accent};
    padding-bottom: 15px;
    margin-bottom: 30px;
    font-size: ${fontSize * 1.5}px;
  ">
    Chapter ${idx + 1}: ${chapter.title || ""}
  </h2>
  
  ${
    chapter.image?.concept
      ? `
  <div class="image-concept" style="
    margin: 20px 0;
    padding: 15px;
    background-color: ${colors.bg === "#ffffff" ? "#f5f5f5" : "#2a2a2a"};
    border-left: 4px solid ${colors.accent};
    font-size: ${fontSize * 0.9}px;
    font-style: italic;
    color: ${colors.accent};
  ">
    <strong>Image Concept:</strong> ${chapter.image.concept}
  </div>
  `
      : ""
  }
  
  <div class="chapter-content" style="margin-top: 20px;">
    ${(chapter.content || "").replace(/\n/g, "<br />")}
  </div>
</div>
`
      )
      .join("");

    // 5. Generate Epilogue
    const epilogueHtml = `
<div class="page epilogue-page" style="
  background-color: ${colors.bg};
  color: ${colors.text};
  padding: 60px 40px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  font-family: Georgia, serif;
">
  <h2 style="
    font-size: ${fontSize * 1.8}px;
    color: ${colors.heading};
    margin-bottom: 40px;
  ">End of eBook</h2>
  <p style="
    font-size: ${fontSize}px;
    color: ${colors.accent};
    max-width: 500px;
  ">
    Thank you for reading this AI-generated eBook.
    For more information, visit Aether AI.
  </p>
  <hr style="
    border-color: ${colors.accent};
    width: 200px;
    margin: 40px 0;
  ">
  <p style="font-size: ${fontSize * 0.85}px; color: ${colors.text};">
    Generated: ${new Date().toISOString()}
  </p>
</div>`;

    // 6. Assemble final HTML
    const finalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme" content="${theme}">
  <meta name="density" content="${density}">
  <meta name="colorPalette" content="${colorPalette}">
  <title>${structuredData.title || "eBook"}</title>
  <!-- FIX 4.5: Conditional font preloading for PDF rendering -->
  <link href="https://fonts.googleapis.com/css2?family=Georgia:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      background-color: ${colors.bg};
      color: ${colors.text};
      font-family: 'Georgia', serif;
      font-size: ${fontSize}px;
      line-height: 1.6;
    }
    
    .page {
      width: 100%;
      min-height: 100vh;
      break-after: page;
    }
    
    a {
      color: ${colors.accent};
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    h1, h2, h3, h4, h5, h6 {
      color: ${colors.heading};
      margin: 1em 0 0.5em 0;
      font-family: 'Georgia', serif;
    }
    
    h1 { font-size: ${fontSize * 2.4}px; }
    h2 { font-size: ${fontSize * 1.8}px; }
    h3 { font-size: ${fontSize * 1.4}px; }
    
    p {
      margin-bottom: 1em;
      font-family: 'Georgia', serif;
    }
    
    ul, ol {
      margin-left: 2em;
      margin-bottom: 1em;
    }
    
    li {
      margin-bottom: 0.5em;
    }
    
    hr {
      border: none;
      border-top: 2px solid ${colors.accent};
      margin: 2em 0;
    }
    
    @media print {
      .page {
        page-break-after: always;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${coverHtml}
  ${copyrightHtml}
  ${tocHtml}
  ${contentHtml}
  ${epilogueHtml}
</body>
</html>
`;

    console.log(
      "[COMPOSE] HTML generation complete, length:",
      finalHtml.length
    );
    return finalHtml;
  },

  /**
   * Export orchestrator: handles any content format and generates PDF
   * Accepts either resultId (for persistence lookup) or direct content
   *
   * @param {Object} packet - Either {resultId} or {pages, html, metadata, actions}
   * @returns {Promise<Buffer>} PDF buffer ready for download
   */
  async exportContent(packet) {
    if (!packet) {
      throw new Error("exportContent requires a packet");
    }

    let title;
    let body;

    // CASE 1: resultId provided - retrieve from persistence
    if (packet.resultId) {
      console.log(
        "[EXPORT-ORCH] Retrieving persisted content for resultId:",
        packet.resultId
      );
      try {
        const { getResultById } = require("./utils/resultDb");
        const result = await getResultById(packet.resultId);

        if (!result) {
          throw new Error("Result not found");
        }

        console.log("[EXPORT-ORCH] Result retrieved from DB");
        console.log(
          "[EXPORT-ORCH] Result keys:",
          Object.keys(result || {}).join(", ")
        );
        console.log(
          "[EXPORT-ORCH] outEnvelope type:",
          typeof result.outEnvelope
        );

        // Handle both object and stringified JSON
        let outEnvelope = result.outEnvelope;
        if (typeof outEnvelope === "string") {
          console.log("[EXPORT-ORCH] Parsing stringified outEnvelope");
          outEnvelope = JSON.parse(outEnvelope);
        }

        console.log(
          "[EXPORT-ORCH] outEnvelope keys:",
          Object.keys(outEnvelope || {}).join(", ")
        );

        if (!outEnvelope) {
          throw new Error("No outEnvelope found in result");
        }

        // Extract from outEnvelope structure: {pages, html, metadata}
        title = outEnvelope.metadata?.title || outEnvelope.title || "Export";
        body = outEnvelope.html || null;

        console.log("[EXPORT-ORCH] Retrieved persisted content:");
        console.log("[EXPORT-ORCH] - title:", title);
        console.log("[EXPORT-ORCH] - html length:", body?.length || 0);
        console.log("[EXPORT-ORCH] - body type:", typeof body);
        console.log("[EXPORT-ORCH] - body is null:", body === null);

        if (!body) {
          throw new Error("No html found in persisted content");
        }

        // SOLUTION PATH A: For resultId case, also store the pages/metadata for envelope
        // Make them available outside the try block by not using let
        packet.pages = outEnvelope.pages;
        packet.metadata = outEnvelope.metadata;
      } catch (err) {
        console.error("[EXPORT-ORCH] Persistence lookup failed:", err.message);
        throw err;
      }
    }
    // CASE 2: Direct content provided - extract from packet
    else if (packet.html) {
      console.log("[EXPORT-ORCH] Using direct content from packet");
      title = packet.metadata?.title || packet.title || "Export";
      body = packet.html;

      console.log("[EXPORT-ORCH] Direct content:");
      console.log("[EXPORT-ORCH] - title:", title);
      console.log("[EXPORT-ORCH] - html length:", body?.length || 0);
    }
    // CASE 3: Legacy title+body format
    else if (packet.title && packet.body) {
      console.log("[EXPORT-ORCH] Using legacy title+body format");
      title = packet.title;
      body = packet.body;
    }
    // No valid format
    else {
      throw new Error(
        "Invalid export packet. Provide either resultId, or html with metadata, or title+body"
      );
    }

    // Now we have {title, body} normalized - call pdfGenerator
    if (!title || !body) {
      throw new Error("Export requires both title and content (html/body)");
    }

    console.log("[EXPORT-ORCH] Calling pdfGenerator with normalized content");
    try {
      const { generatePdfBuffer } = require("./pdfGenerator");

      // SOLUTION PATH A: Build envelope for stack-based PDF rendering
      // For eBook exports, pass envelope structure to trigger correct pdfGenerator routing
      let envelope = null;
      if (packet.pages && Array.isArray(packet.pages)) {
        console.log(
          "[EXPORT-ORCH] Building envelope for stack-based PDF rendering"
        );

        // Transform pages to have .blocks structure that pdfGenerator expects
        // Pages from ebookService have {title, content}, need to convert to {title, blocks: [{type, content}]}
        const transformedPages = packet.pages.map((page) => ({
          title: page.title || "",
          blocks:
            page.content || page.blocks
              ? [
                  {
                    type: "text",
                    content: page.content || "",
                  },
                ]
              : [],
        }));

        envelope = {
          pages: transformedPages,
          html: body,
          metadata: packet.metadata || {},
        };
        console.log(
          "[EXPORT-ORCH] Envelope built - pages:",
          envelope.pages.length
        );
      }

      const result = await generatePdfBuffer({
        title,
        body,
        envelope, // ← SOLUTION PATH A: Pass envelope for stack-based routing
        validate: true,
      });

      // Handle both object return (when validate: true) and direct buffer return
      let pdfBuffer = result;
      if (result && typeof result === "object" && result.buffer) {
        // When validate: true, returns { buffer, validation }
        pdfBuffer = result.buffer;
        if (result.validation) {
          console.log(
            "[EXPORT-ORCH] Validation result:",
            result.validation.ok ? "OK" : "WARNINGS"
          );
        }
      }

      console.log(
        "[EXPORT-ORCH] PDF generated successfully, size:",
        pdfBuffer?.length || 0
      );
      return pdfBuffer;
    } catch (err) {
      console.error("[EXPORT-ORCH] PDF generation failed:", err.message);
      throw err;
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
