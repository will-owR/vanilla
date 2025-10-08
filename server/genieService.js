// genieService.js
// Orchestrator: calls application services (sampleService), validates and
// sanitizes results, assigns requestId, converts persistIntents ->
// persistInstructions and returns the envelope for plumbing to persist.

const sampleService = require("./sampleService");
const helloWorldService = require("./helloWorldService");
const crypto = require("crypto");

function makeRequestId() {
  if (crypto && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return "req-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}

function sanitizeHtmlSimple(str = "") {
  // Minimal sanitizer: escape angle brackets and ampersand. Not a full sanitizer.
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function generate(payload) {
  // Accept either a string prompt or an object payload
  const input =
    typeof payload === "string" ? { prompt: payload } : payload || {};

  // Prefer any incoming requestId provided by plumbing so logs and persistence
  // can be correlated end-to-end. Fall back to generated id when not present.
  const requestId = (input && input.requestId) || makeRequestId();

  // Server-side sanitizer for any HTML content returned by application services
  const { sanitizeHtml } = require("./sanitizer");

  // Minimal default selector set: adjust if client uses different keys
  const DEFAULTS = { preset: "default" };

  // Helper: are selections exactly the defaults? (shallow equality)
  function isDefaultSelections(sel) {
    if (!sel) return true; // treat missing selections as defaults
    try {
      return Object.keys(DEFAULTS).every(
        (k) => String(sel[k]) === String(DEFAULTS[k])
      );
    } catch (e) {
      return false;
    }
  }

  // If prompt contains 'hello' (case-insensitive) AND selections are defaults, short-circuit
  const promptText = input && input.prompt ? String(input.prompt) : "";
  const promptHasHello = /\bhello\b/i.test(promptText);
  if (
    promptHasHello &&
    isDefaultSelections(input.selections || input.options || input.settings)
  ) {
    const hw = await helloWorldService.generateFromPrompt(input);
    if (hw && hw.success) {
      const {
        content = {},
        metadata = {},
        persistIntents = [],
      } = hw.data || {};
      const safeTitleHw = sanitizeHtml(String(content.title || ""));
      const safeBodyHw =
        content && content.html
          ? sanitizeHtml(String(content.html))
          : sanitizeHtmlSimple(String(content.body || ""));
      const safeContent = {
        ...content,
        title: safeTitleHw,
        body: safeBodyHw,
      };
      const persistInstructions = (persistIntents || []).map((intent, idx) => ({
        purpose: intent.purpose,
        filenameHint: intent.filenameHint || `artifact-${requestId}-${idx}`,
        folderHint: intent.folderHint || "exports",
        content: intent.content || "",
        encoding: intent.encoding || "utf8",
        originalIntent: intent,
      }));
      return {
        success: true,
        data: {
          content: safeContent,
          metadata: { ...metadata, requestId },
          persistInstructions,
          requestId,
        },
      };
    }
    // else fallthrough to normal sampleService path
  }

  // Call AI application service by default to produce content/metadata. Fall
  // back to sampleService only if AI provider is not available.
  let svcRes;
  try {
    const aiFactory = require("./aiService").createAIService;
    const ai = aiFactory();
    // ai.generateContent returns { content, metadata }
    const aiResult = await ai.generateContent(promptText);
    svcRes = { success: true, data: { ...aiResult, persistIntents: [] } };
  } catch (e) {
    // If AI service is unavailable (module missing) fall back to deterministic sampleService.
    // However, runtime errors produced by the AI provider should be propagated
    // so callers (and tests) can observe failure modes explicitly.
    if (e && e.code === "MODULE_NOT_FOUND") {
      svcRes = await sampleService.generateFromPrompt(input);
    } else {
      // Re-throw to allow upper layers (plumbing) to surface a 5xx
      // when the application service fails unexpectedly.
      throw e;
    }
  }
  if (!svcRes || !svcRes.success) {
    return { success: false, error: "application-service-failed", requestId };
  }

  const {
    content = {},
    metadata = {},
    persistIntents = [],
  } = svcRes.data || {};

  // Defensive sanitization on content fields. If the application service
  // produced safe HTML (content.html), prefer that for `body` so clients
  // receive display-ready HTML. Sanitize with the server-side sanitizer.
  const safeTitle = sanitizeHtml(String(content.title || ""));
  const safeBody =
    content && content.html
      ? sanitizeHtml(String(content.html))
      : sanitizeHtmlSimple(String(content.body || ""));
  const safeContent = {
    ...content,
    title: safeTitle,
    body: safeBody,
  };

  // Convert intents -> instructions
  const persistInstructions = (persistIntents || []).map((intent, idx) => ({
    purpose: intent.purpose,
    filenameHint: intent.filenameHint || `artifact-${requestId}-${idx}`,
    folderHint: intent.folderHint || "exports",
    content: intent.content || "",
    encoding: intent.encoding || "utf8",
    originalIntent: intent,
  }));

  return {
    success: true,
    data: {
      content: safeContent,
      metadata: { ...metadata, requestId },
      persistInstructions,
      requestId,
    },
  };
}

module.exports = {
  generate,
  // Optional readLatest: delegate if implementation supports
  readLatest:
    typeof sampleService.readLatest === "function"
      ? sampleService.readLatest
      : undefined,
};
