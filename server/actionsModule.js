/**
 * actionsModule - minimal actions runner
 *
 * This module implements a very small, safe subset of possible actions so
 * the orchestrator can forward producer-declared actions without changing
 * the DEFAULT pipeline. It intentionally keeps behavior simple and
 * fail-safe; real handlers can be added later.
 */

const { saveContentToFile } = require("./utils/fileUtils");

/**
 * @param {{actions: any, prompt: string, svcOut: any, result: any, injectedDbUtils?: any, ENABLE_PERSISTENCE?: boolean, AWAIT_PERSISTENCE?: boolean}} opts
 */
async function runActions({ actions = {}, prompt, svcOut, result } = {}) {
  try {
    // Normalize action detection for common keys
    const wantsPrint =
      Boolean(actions["print-to-file"]) ||
      Boolean(actions.printToFile) ||
      Boolean(actions.print_to_file) ||
      (Array.isArray(actions) && actions.includes("print-to-file"));

    if (wantsPrint) {
      // Prefer explicit payload when provided, otherwise stringify svcOut
      const payload =
        (actions["print-to-file"] && actions["print-to-file"].content) ||
        (actions.printToFile && actions.printToFile.content) ||
        JSON.stringify(svcOut || { prompt, result }, null, 2);

      // saveContentToFile returns the saved path
      const savedPath = await saveContentToFile(payload);

      return {
        success: true,
        data: {
          content: {
            title: "print-to-file",
            body: `Saved output to ${savedPath}`,
          },
          copies: [],
          metadata: { action: "print-to-file", path: savedPath },
        },
      };
    }

    // Unknown/no-op actions: return a typed-compatible envelope indicating
    // that the actions were received but no handler matched.
    return {
      success: false,
      data: {
        content: { title: "no-op", body: "No action handler matched" },
        copies: [],
        metadata: { actionsReceived: actions },
      },
    };
  } catch (e) {
    // Fail-safe: log and return failure envelope so callers can fall back
    // to DEFAULT behavior if desired.
    // eslint-disable-next-line no-console
    console.warn("actionsModule.runActions failed", e && e.message);
    return {
      success: false,
      data: {
        content: { title: "action-failed", body: String(e && e.message) },
        copies: [],
        metadata: { error: String(e && e.message) },
      },
    };
  }
}

module.exports = { runActions };
