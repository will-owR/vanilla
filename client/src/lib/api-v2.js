/**
 * API Client Wrapper for Phase 1+2
 * Handles all communication with new backend endpoints (classify, generate, override)
 * with validation, timeout, and error handling
 */

/**
 * Configuration - MUST match backend config exactly
 */
export const CONFIG = {
  API_BASE_URL: "/api",
  CONFIDENCE_THRESHOLD: 0.85,
  TIMEOUTS: {
    CLASSIFY: 30000, // 30 seconds
    GENERATE: 30000, // 30 seconds
    OVERRIDE: 10000, // 10 seconds
  },
  SUPPORTED_MEDIA: ["ebook", "calendar", "poster", "stickers", "card"],
  SUPPORTED_STYLES: ["minimalist", "gothic", "abstract", "retro", "modern"],
};

/**
 * Error normalizer - converts any error into standard format
 * @param {*} error - Error from fetch or validation
 * @param {number} timeout - Timeout in ms
 * @returns {{status: number, message: string, retryable: boolean}}
 */
function normalizeError(error, timeout) {
  // Timeout error
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      status: 408,
      message: `Request timeout after ${timeout}ms`,
      retryable: true,
    };
  }

  // Network error
  if (error instanceof TypeError) {
    return {
      status: 0,
      message: "Network error: " + error.message,
      retryable: true,
    };
  }

  // API response error (already has status + message)
  if (error.status !== undefined) {
    return error;
  }

  // Unknown error
  return {
    status: 500,
    message: error.message || "Unknown error",
    retryable: false,
  };
}

/**
 * Fetch wrapper with timeout and error handling
 * @param {string} endpoint - API endpoint (e.g., '/api/classify')
 * @param {Object} body - Request body
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {{status, message, retryable}}
 */
async function fetchWithTimeout(endpoint, body, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-200 responses
    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { message: response.statusText };
      }

      const error = {
        status: response.status,
        message: errorBody.message || errorBody.error || response.statusText,
        retryable:
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500,
      };

      throw error;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw normalizeError(error, timeout);
  }
}

/**
 * Classify endpoint - get classification for a prompt
 *
 * @param {string} prompt - User's prompt (min 10 characters)
 * @param {string} selectedMedium - Selected medium (ebook, calendar, poster, stickers, card)
 * @returns {Promise<Object>} Classification object:
 *   {
 *     id,
 *     medium,
 *     confidence,
 *     style,
 *     themes,
 *     audience,
 *     genre,
 *     tone,
 *     source,
 *     metadata
 *   }
 * @throws {{status, message, retryable}}
 */
export async function classify(prompt, selectedMedium) {
  // Validation
  if (typeof prompt !== "string" || prompt.trim().length < 10) {
    throw {
      status: 400,
      message: "Prompt must be at least 10 characters",
      retryable: false,
    };
  }

  if (!CONFIG.SUPPORTED_MEDIA.includes(selectedMedium)) {
    throw {
      status: 400,
      message: `Invalid medium. Supported: ${CONFIG.SUPPORTED_MEDIA.join(
        ", "
      )}`,
      retryable: false,
    };
  }

  return await fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/classify`,
    {
      prompt: prompt.trim(),
      selectedMedium,
    },
    CONFIG.TIMEOUTS.CLASSIFY
  );
}

/**
 * Generate endpoint - generate PDF based on classification
 *
 * @param {string} prompt - Original prompt
 * @param {string} medium - Selected medium
 * @param {Object} classification - Classification object from classify()
 * @returns {Promise<Object>} Generation result:
 *   {
 *     id,
 *     pdfUrl,
 *     pageCount,
 *     medium,
 *     style,
 *     classification,
 *     metadata,
 *     latency,
 *     costEstimate
 *   }
 * @throws {{status, message, retryable}}
 */
export async function generate(prompt, medium, classification) {
  // Validation
  if (typeof prompt !== "string" || prompt.trim().length < 10) {
    throw {
      status: 400,
      message: "Prompt must be at least 10 characters",
      retryable: false,
    };
  }

  if (!medium || !CONFIG.SUPPORTED_MEDIA.includes(medium)) {
    throw {
      status: 400,
      message: "Invalid or missing medium",
      retryable: false,
    };
  }

  if (!classification || !classification.id) {
    throw {
      status: 400,
      message: "Missing classification data",
      retryable: false,
    };
  }

  return await fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/generate`,
    {
      prompt: prompt.trim(),
      medium,
      classification,
    },
    CONFIG.TIMEOUTS.GENERATE
  );
}

/**
 * Apply override endpoint - regenerate with style overrides
 *
 * @param {string} generationId - Generation ID to override
 * @param {Object} classification - Original classification
 * @param {Object} overrides - Override selections:
 *   {
 *     style,
 *     tone,
 *     themes
 *   }
 * @returns {Promise<Object>} Override result:
 *   {
 *     id,
 *     pdfUrl,
 *     costMultiplier,
 *     costBreakdown,
 *     regenerationStrategy,
 *     metadata
 *   }
 * @throws {{status, message, retryable}}
 */
export async function applyOverride(generationId, classification, overrides) {
  // Validation
  if (!generationId || typeof generationId !== "string") {
    throw {
      status: 400,
      message: "Invalid generation ID",
      retryable: false,
    };
  }

  if (!classification || !classification.id) {
    throw {
      status: 400,
      message: "Missing classification data",
      retryable: false,
    };
  }

  if (!overrides || Object.keys(overrides).length === 0) {
    throw {
      status: 400,
      message: "No overrides provided",
      retryable: false,
    };
  }

  return await fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/override`,
    {
      generationId,
      classification,
      overrides,
    },
    CONFIG.TIMEOUTS.OVERRIDE
  );
}
