/**
 * Batch Chapter Processing Module
 *
 * Main entry point for batch processing infrastructure (Phase 1).
 * Orchestrates: Builder → Requestor → Parser flow
 *
 * Phase 1: Batch Infrastructure
 */

const batchBuilder = require("./batchBuilder");
const batchRequestor = require("./batchRequestor");
const batchResponseParser = require("./batchResponseParser");
// Metrics (optional) - record batch success/failure when sessionId provided
let METRICS;
try {
  METRICS = require("../metrics/GenerationMetrics");
} catch (e) {
  METRICS = null;
}

/**
 * Execute complete batch processing pipeline
 *
 * @param {Array} batch - Array of chapter specs to generate
 * @param {Object} contextFromPrevious - Context from preceding chapters
 * @param {Object} ebookMetadata - Ebook metadata for unified context
 * @param {Object} structure - Structure from generation step
 * @param {number} callIndex - Call index for dual-model routing
 * @param {string} sessionId - Session ID for metrics tracking
 * @returns {Promise<Object>} {
 *   success: boolean,
 *   chapters: Array,
 *   nextContext: Object,
 *   metadata: { duration, model, attempt }
 * }
 */
async function processBatch(
  batch,
  contextFromPrevious,
  ebookMetadata,
  structure,
  callIndex,
  sessionId
) {
  const startTime = Date.now();

  try {
    // Step 1: Build batch prompt with unified context
    const prompt = batchBuilder.buildBatchPrompt(
      batch,
      contextFromPrevious,
      ebookMetadata,
      structure
    );

    // Step 2: Send batch request to Gemini
    const requestResult = await batchRequestor.sendBatchRequest(
      prompt,
      callIndex,
      sessionId
    );

    // Step 3: Parse batch response
    const parseResult = batchResponseParser.parseBatchResponse(
      requestResult.response,
      batch
    );

    // Step 4: Extract context for next batch
    const nextContext = batchBuilder.extractContextFromBatch(
      parseResult.chapters,
      contextFromPrevious
    );

    const duration = Date.now() - startTime;
    // Record metrics if sessionId provided
    try {
      if (METRICS && sessionId) {
        METRICS.recordBatchSuccess(sessionId, {
          batchNumber: null,
          chapters: batch.map((b) => b.chapter),
          status: "success",
          duration,
          timestamp: new Date(),
          attempts: 1,
          tokensUsed: requestResult.metadata.tokensUsed,
        });
      }
    } catch (e) {
      // Non-fatal: metrics failure should not break pipeline
      console.warn("Metrics.recordBatchSuccess failed:", e && e.message);
    }

    return {
      success: parseResult.success,
      chapters: parseResult.chapters,
      incomplete: parseResult.incomplete,
      missingChapters: parseResult.missingChapters,
      nextContext: nextContext.continuityContext,
      metadata: {
        duration,
        model: requestResult.metadata.model,
        attempt: 1,
        tokensUsed: requestResult.metadata.tokensUsed,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    // Record failure to metrics if possible
    try {
      if (METRICS && sessionId) {
        METRICS.recordBatchFailure(sessionId, {
          batchNumber: null,
          chapters: batch.map((b) => b.chapter),
          status: "failed",
          duration,
          timestamp: new Date(),
          attempts: 1,
        });
      }
    } catch (e) {
      console.warn("Metrics.recordBatchFailure failed:", e && e.message);
    }

    console.error(
      `[BATCH PROCESSOR] Batch processing failed: ${error.message}`
    );

    return {
      success: false,
      chapters: [],
      error: {
        type: error.errorType || "UNKNOWN",
        message: error.message,
      },
      metadata: {
        duration,
        attempt: 1,
      },
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Direct access to modules for flexibility
  builder: batchBuilder,
  requestor: batchRequestor,
  parser: batchResponseParser,

  // High-level pipeline function
  processBatch,

  // Individual functions for fine-grained control
  buildBatchPrompt: batchBuilder.buildBatchPrompt,
  extractContextFromBatch: batchBuilder.extractContextFromBatch,
  sendBatchRequest: batchRequestor.sendBatchRequest,
  parseBatchResponse: batchResponseParser.parseBatchResponse,
  validateChapterObject: batchResponseParser.validateChapterObject,
  mergeWithPreviousContext: batchResponseParser.mergeWithPreviousContext,
};
