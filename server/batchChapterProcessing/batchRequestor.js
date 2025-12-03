/**
 * Batch Requestor Module
 *
 * Handles sending batch requests to Gemini API and parsing raw responses.
 * Measures performance and error types for observability.
 *
 * Phase 1: Batch Infrastructure
 */

const aiService = require("../aiService");

/**
 * Send a batch request to Gemini API with performance tracking
 *
 * @param {string} prompt - Unified batch prompt from batchBuilder
 * @param {number} callIndex - Call index for dual-model routing (0=Pro, 1+=Flash)
 * @param {string} sessionId - UUID for session tracking in metrics
 * @returns {Promise<Object>} { success, response, metadata: { duration, tokensUsed, model } }
 * @throws {Error} Structured error with type: NETWORK, HTTP, PARSE, INCOMPLETE, TIMEOUT
 */
async function sendBatchRequest(prompt, callIndex, sessionId) {
  const startTime = Date.now();

  try {
    // Validate inputs
    if (!prompt || typeof prompt !== "string") {
      throw _createError(
        "INVALID_INPUT",
        "batchRequestor: prompt must be non-empty string",
        null
      );
    }
    if (typeof callIndex !== "number" || callIndex < 0) {
      throw _createError(
        "INVALID_INPUT",
        "batchRequestor: callIndex must be non-negative number",
        null
      );
    }

    // Log batch request start
    if (global.__DEBUG_BATCH__) {
      console.log(
        `[BATCH REQUESTOR] Sending batch request (callIndex=${callIndex}, sessionId=${sessionId.substring(
          0,
          8
        )}...)`
      );
    }

    // Send request via aiService (handles dual-model rotation)
    const response = await aiService.generateContentWithRotation(
      prompt,
      callIndex
    );

    const duration = Date.now() - startTime;

    // Validate response structure (preliminary check)
    if (!response) {
      throw _createError(
        "INCOMPLETE",
        "batchRequestor: received empty response",
        { duration }
      );
    }

    // Log success
    if (global.__DEBUG_BATCH__) {
      console.log(`[BATCH REQUESTOR] Batch request succeeded in ${duration}ms`);
    }

    // Extract model used (from aiService context if available)
    const model = callIndex === 0 ? "gemini-2.5-pro" : "gemini-2.5-flash";

    return {
      success: true,
      response,
      metadata: {
        duration,
        tokensUsed: response.tokenCount || 0,
        model,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Classify error type
    let errorType = "UNKNOWN";
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      errorType = "NETWORK";
    } else if (error.status === 429) {
      errorType = "RATE_LIMIT";
    } else if (error.status >= 500) {
      errorType = "SERVER_ERROR";
    } else if (error.status >= 400) {
      errorType = "HTTP_ERROR";
    } else if (error.message && error.message.includes("JSON")) {
      errorType = "PARSE_ERROR";
    } else if (error.message && error.message.includes("timeout")) {
      errorType = "TIMEOUT";
    }

    // Log error
    if (global.__DEBUG_BATCH__) {
      console.log(
        `[BATCH REQUESTOR] Batch request failed after ${duration}ms: ${errorType} - ${error.message}`
      );
    }

    // Create structured error
    const structuredError = _createError(
      errorType,
      `batchRequestor: ${error.message || "unknown error"}`,
      { duration, originalError: error.message }
    );

    throw structuredError;
  }
}

/**
 * Parse batch response into structured chapters
 *
 * @param {Object} response - Raw response from Gemini API
 * @param {Array} expectedChapters - Array of expected chapter numbers
 * @returns {Object} { success, chapters: [], incomplete: false, issues: [] }
 * @throws {Error} If response malformed beyond recovery
 */
function parseBatchResponse(response, expectedChapters = []) {
  try {
    // Validate response structure
    if (!response || typeof response !== "object") {
      throw _createError(
        "PARSE_ERROR",
        "batchRequestor: response must be object",
        null
      );
    }

    // Extract the raw text content from aiService response format
    let rawText = null;
    if (response.content && response.content.body) {
      // aiService response format: { content: { body: "..." }, metadata: {...} }
      rawText = response.content.body;
    } else if (typeof response === "string") {
      rawText = response;
    } else if (response.rawText) {
      rawText = response.rawText;
    }

    // Extract chapters array (might be nested under various keys)
    let chaptersArray = null;

    // First, try direct array properties
    if (Array.isArray(response.chapters)) {
      chaptersArray = response.chapters;
    } else if (Array.isArray(response.batch_response)) {
      chaptersArray = response.batch_response;
    } else if (Array.isArray(response)) {
      chaptersArray = response;
    } else if (rawText) {
      // Second, extract and parse JSON from raw text
      let jsonText = rawText;

      // Strip markdown code blocks if present (e.g., ```json\n{...}\n```)
      const codeBlockMatch = rawText.match(
        /```(?:json)?\s*\n?([\s\S]*?)\n?```/
      );
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      }

      // Try parsing as JSON
      try {
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed.chapters)) {
          chaptersArray = parsed.chapters;
        } else if (Array.isArray(parsed)) {
          chaptersArray = parsed;
        }
      } catch (parseErr) {
        // JSON parsing failed, will be handled below
      }
    }

    if (!chaptersArray) {
      throw _createError(
        "PARSE_ERROR",
        "batchRequestor: could not find chapters array in response",
        null
      );
    }

    // Parse each chapter
    const chapters = [];
    const issues = [];
    const missingChapters = [];

    expectedChapters.forEach((expectedNum) => {
      const found = chaptersArray.find(
        (ch) =>
          ch.chapter === expectedNum || ch.chapter === expectedNum.toString()
      );

      if (!found) {
        missingChapters.push(expectedNum);
      } else {
        try {
          const parsed = _parseChapterObject(found);
          chapters.push(parsed);
        } catch (err) {
          issues.push({
            chapter: expectedNum,
            issue: err.message,
          });
        }
      }
    });

    // If we got some chapters, consider it partial success
    const success = chapters.length > 0;
    const incomplete = missingChapters.length > 0 || issues.length > 0;

    if (global.__DEBUG_BATCH__) {
      console.log(
        `[BATCH RESPONSE PARSER] Parsed ${chapters.length} chapters, missing=${missingChapters.length}, issues=${issues.length}`
      );
    }

    return {
      success,
      chapters,
      incomplete,
      missingChapters,
      issues,
    };
  } catch (error) {
    if (error.code === "BATCH_PARSE_ERROR") {
      throw error;
    }
    throw _createError("PARSE_ERROR", `batchRequestor: ${error.message}`, null);
  }
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Parse a single chapter object from response
 *
 * @private
 */
function _parseChapterObject(chapterObj) {
  if (!chapterObj || typeof chapterObj !== "object") {
    throw new Error("chapter object must be valid");
  }

  const chapter = {
    chapter: chapterObj.chapter,
    title: chapterObj.title || "",
    summary: chapterObj.summary || "",
    content: chapterObj.content || "",
    image: chapterObj.image || {
      concept: "Generic",
      style: "neutral",
      tone: "professional",
    },
  };

  // Validate required fields
  if (!chapter.chapter) {
    throw new Error("missing chapter number");
  }
  if (!chapter.title) {
    throw new Error("missing title");
  }
  if (!chapter.content) {
    throw new Error("missing content");
  }

  return chapter;
}

/**
 * Create structured error object
 *
 * @private
 */
function _createError(type, message, context) {
  const error = new Error(message);
  error.code = "BATCH_" + type;
  error.errorType = type;
  error.context = context || {};
  return error;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  sendBatchRequest,
  parseBatchResponse,
};
