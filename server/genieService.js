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

  const requestId = makeRequestId();

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
      const safeContent = {
        ...content,
        title: sanitizeHtmlSimple(String(content.title || "")),
        body: sanitizeHtmlSimple(String(content.body || "")),
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

  // Call application service to produce intents and content
  const svcRes = await sampleService.generateFromPrompt(input);
  if (!svcRes || !svcRes.success) {
    return { success: false, error: "application-service-failed", requestId };
  }

  const {
    content = {},
    metadata = {},
    persistIntents = [],
  } = svcRes.data || {};

  // Defensive sanitization on content fields
  const safeContent = {
    ...content,
    title: sanitizeHtmlSimple(String(content.title || "")),
    body: sanitizeHtmlSimple(String(content.body || "")),
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
