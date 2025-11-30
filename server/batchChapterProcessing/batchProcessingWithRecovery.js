/**
 * Batch Processing with Error Recovery Orchestrator
 *
 * Integrates Phase 1 (batchBuilder, batchRequestor, batchResponseParser) with
 * Phase 2 error recovery (throttledFallback, rateLimitBackoff, fallbackChapterGenerator).
 *
 * 3-Level Error Recovery Strategy:
 * 1. Batch fails → Try individual requests (throttled)
 * 2. Individual fails → Apply exponential backoff for rate limits
 * 3. Everything fails → Use placeholder fallback
 *
 * Phase 1 + Phase 2: Complete Resilience Pipeline
 */

import batchBuilder from "./batchBuilder.js";
import batchRequestor from "./batchRequestor.js";
import batchResponseParser from "./batchResponseParser.js";
import throttledFallback from "./errorRecovery/throttledFallback.js";
import rateLimitBackoff from "./errorRecovery/rateLimitBackoff.js";
import fallbackChapterGenerator from "./errorRecovery/fallbackChapterGenerator.js";

/**
 * Process batch with automatic error recovery
 *
 * Attempts batch request. If fails:
 * 1. Try individual chapter requests (throttled 6.5s apart)
 * 2. For rate limits: apply exponential backoff (10s, 20s, 60s)
 * 3. For persistent failures: use placeholder fallback chapters
 *
 * @param {Array} batch - Array of chapter specs to generate
 * @param {Object} contextFromPrevious - Context from preceding chapters
 * @param {Object} ebookMetadata - Ebook metadata
 * @param {Object} structure - Structure from generation step
 * @param {number} callIndex - Call index for dual-model routing
 * @param {string} sessionId - Session ID for metrics
 * @param {Object} options - Recovery options { maxRecoveryAttempts: 1, rateLimitMaxAttempts: 3 }
 * @returns {Promise<Object>} {
 *   success: boolean,
 *   chapters: Array (recovered chapters),
 *   recoveryStatus: 'batch_success' | 'batch_recovered' | 'individual_recovered' | 'partial_fallback' | 'full_fallback',
 *   attempts: { batch: 1, individual: ?, rateLimit: ?, fallback: ? },
 *   degradedChapters: Array (chapters that are placeholders),
 *   metadata: { duration, strategy }
 * }
 */
async function processBatchWithRecovery(
  batch,
  contextFromPrevious,
  ebookMetadata,
  structure,
  callIndex,
  sessionId,
  options = {}
) {
  const startTime = Date.now();
  const {
    maxRecoveryAttempts = 1,
    rateLimitMaxAttempts = 3,
    enableFallback = true,
  } = options;

  if (!Array.isArray(batch) || batch.length === 0) {
    throw new Error("processBatchWithRecovery: batch must be non-empty array");
  }

  const attempts = {
    batch: 0,
    individual: 0,
    rateLimit: 0,
    fallback: 0,
  };

  const degradedChapters = [];
  let recoveryStatus = "batch_success"; // Default: assume success

  try {
    // LEVEL 0: Try batch request first
    attempts.batch = 1;

    if (global.__DEBUG_BATCH__) {
      console.log(
        `[BATCH + RECOVERY] Attempting batch request for ${batch.length} chapters`
      );
    }

    const prompt = batchBuilder.buildBatchPrompt(
      batch,
      contextFromPrevious,
      ebookMetadata,
      structure
    );
    const requestResult = await batchRequestor.sendBatchRequest(
      prompt,
      callIndex,
      sessionId
    );
    const parseResult = batchResponseParser.parseBatchResponse(
      requestResult.response,
      batch
    );

    if (parseResult.success && parseResult.chapters.length === batch.length) {
      // Perfect success - batch worked
      if (global.__DEBUG_BATCH__) {
        console.log(
          `[BATCH + RECOVERY] ✅ Batch succeeded - all chapters recovered`
        );
      }

      const duration = Date.now() - startTime;
      return {
        success: true,
        chapters: parseResult.chapters,
        recoveryStatus: "batch_success",
        attempts,
        degradedChapters: [],
        metadata: { duration, strategy: "batch_success" },
      };
    }

    // Batch partial or complete failure - move to recovery
    if (global.__DEBUG_BATCH__) {
      console.log(
        `[BATCH + RECOVERY] Batch failed or incomplete - starting recovery (${parseResult.chapters.length}/${batch.length})`
      );
    }

    recoveryStatus = "batch_failed";
  } catch (batchError) {
    if (global.__DEBUG_BATCH__) {
      console.log(
        `[BATCH + RECOVERY] Batch error: ${batchError.message} - starting recovery`
      );
    }
    // Fall through to recovery
  }

  // LEVEL 1: Try individual chapter requests with throttling
  let recoveredChapters = [];
  let remainingChapters = batch;

  try {
    attempts.individual++;

    if (global.__DEBUG_BATCH__) {
      console.log(
        `[BATCH + RECOVERY] Level 1: Attempting individual requests (${remainingChapters.length} chapters)`
      );
    }

    const individualResult =
      await throttledFallback.recoverWithIndividualRequests(
        remainingChapters,
        contextFromPrevious,
        sessionId,
        { maxRetries: maxRecoveryAttempts }
      );

    recoveredChapters = individualResult.chapters;
    remainingChapters = batch.filter(
      (ch) => !recoveredChapters.find((rc) => rc.chapter === ch.chapter)
    );

    if (recoveredChapters.length > 0) {
      recoveryStatus = "individual_recovered";
      if (global.__DEBUG_BATCH__) {
        console.log(
          `[BATCH + RECOVERY] ✅ Individual recovery recovered ${recoveredChapters.length}/${batch.length}`
        );
      }
    }
  } catch (individualError) {
    // Check if rate limit
    if (
      individualError.code === "BATCH_RATE_LIMIT" ||
      individualError.status === 429
    ) {
      if (global.__DEBUG_BATCH__) {
        console.log(
          `[BATCH + RECOVERY] Rate limit detected during individual recovery - applying backoff`
        );
      }

      // LEVEL 2: Apply exponential backoff for rate limits
      try {
        attempts.rateLimit++;

        const backoffResult = await rateLimitBackoff.retryWithBackoff(
          async () => {
            const retryResult =
              await throttledFallback.recoverWithIndividualRequests(
                remainingChapters,
                contextFromPrevious,
                sessionId,
                { maxRetries: maxRecoveryAttempts }
              );
            return retryResult;
          },
          { maxAttempts: rateLimitMaxAttempts },
          sessionId
        );

        if (backoffResult.success) {
          const backoffRecovered = backoffResult.result.chapters;
          recoveredChapters = [...recoveredChapters, ...backoffRecovered];
          remainingChapters = batch.filter(
            (ch) => !recoveredChapters.find((rc) => rc.chapter === ch.chapter)
          );

          if (global.__DEBUG_BATCH__) {
            console.log(
              `[BATCH + RECOVERY] ✅ Rate limit backoff recovered ${backoffRecovered.length} chapters`
            );
          }
        }
      } catch (backoffError) {
        if (global.__DEBUG_BATCH__) {
          console.log(
            `[BATCH + RECOVERY] Rate limit backoff failed: ${backoffError.message} - falling through to fallback`
          );
        }
      }
    } else {
      if (global.__DEBUG_BATCH__) {
        console.log(
          `[BATCH + RECOVERY] Individual recovery error: ${individualError.message}`
        );
      }
    }
  }

  // LEVEL 3: Use fallback chapters for any remaining failures
  if (remainingChapters.length > 0) {
    if (!enableFallback) {
      throw new Error(
        `processBatchWithRecovery: ${remainingChapters.length} chapters could not be recovered ` +
          `and fallback is disabled`
      );
    }

    attempts.fallback++;

    if (global.__DEBUG_BATCH__) {
      console.log(
        `[BATCH + RECOVERY] Level 3: Creating fallback chapters for ${remainingChapters.length} failures`
      );
    }

    const fallbackChapters = remainingChapters.map((chapterSpec) => {
      const fallback = fallbackChapterGenerator.createFallbackChapter(
        chapterSpec,
        contextFromPrevious,
        "batch_and_individual_exhausted"
      );
      degradedChapters.push(chapterSpec.chapter);
      return fallback;
    });

    recoveredChapters = [...recoveredChapters, ...fallbackChapters];
    recoveryStatus =
      recoveredChapters.length === batch.length
        ? "partial_fallback"
        : "full_fallback";

    if (global.__DEBUG_BATCH__) {
      console.log(
        `[BATCH + RECOVERY] ✅ Created ${fallbackChapters.length} fallback chapters - recovery complete`
      );
    }
  }

  // Final result
  const success = recoveredChapters.length > 0;
  const duration = Date.now() - startTime;

  if (global.__DEBUG_BATCH__) {
    console.log(
      `[BATCH + RECOVERY] Final result: ${recoveredChapters.length}/${batch.length} chapters recovered ` +
        `(${degradedChapters.length} degraded) in ${duration}ms via ${recoveryStatus}`
    );
  }

  return {
    success,
    chapters: recoveredChapters,
    recoveryStatus,
    attempts,
    degradedChapters,
    metadata: {
      duration,
      strategy: recoveryStatus,
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  processBatchWithRecovery,

  // Direct access to sub-modules for fine-grained control
  builder: batchBuilder,
  requestor: batchRequestor,
  parser: batchResponseParser,
  throttledFallback,
  rateLimitBackoff,
  fallbackChapterGenerator,
};
