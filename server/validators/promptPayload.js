/**
 * Payload Validator for Enhanced Prompt Endpoint
 *
 * Validates incoming request bodies for the POST /prompt endpoint.
 * Provides mode-specific validation for different generation modes.
 */

/**
 * Validates the base payload structure
 * @param {Object} body - Request body
 * @returns {Object} Validation result: { valid: boolean, error?: string, message?: string, fields?: string[] }
 */
function validatePayload(body) {
  if (!body?.mode || typeof body.prompt !== "string") {
    return {
      valid: false,
      error: "INVALID_PAYLOAD",
      message: "payload must include mode and prompt",
    };
  }

  // Mode-specific validation
  switch (body.mode) {
    case "demo":
      return validateDemoPayload(body);
    case "ebook":
      return validateEbookPayload(body);
    case "basic":
      return { valid: true };
    default:
      return {
        valid: false,
        error: "INVALID_MODE",
        message: "unsupported mode specified",
      };
  }
}

/**
 * Validates payload for demo mode
 * Demo mode requires additional metadata: title, author, pages
 * @param {Object} body - Request body
 * @returns {Object} Validation result
 */
function validateDemoPayload(body) {
  const md = body.metadata || {};
  if (!md.title || !md.author || !md.pages) {
    return {
      valid: false,
      error: "MISSING_METADATA",
      message: "demo mode requires title, author, and pages",
      fields: ["title", "author", "pages"],
    };
  }
  return { valid: true };
}

/**
 * Validates payload for ebook mode
 * Ebook mode requires additional metadata: title, author, pages
 * @param {Object} body - Request body
 * @returns {Object} Validation result
 */
function validateEbookPayload(body) {
  const md = body.metadata || {};
  if (!md.title || !md.author || !md.pages) {
    return {
      valid: false,
      error: "MISSING_METADATA",
      message: "ebook mode requires title, author, and pages",
      fields: ["title", "author", "pages"],
    };
  }
  return { valid: true };
}

module.exports = {
  validatePayload,
  validateDemoPayload,
  validateEbookPayload,
};
