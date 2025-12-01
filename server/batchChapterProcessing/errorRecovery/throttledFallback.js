/**
 * Throttled Fallback Module
 *
 * Recovers from batch failures by decomposing into individual chapter requests.
 * Respects rate limits via 6.5s throttle (10 requests/minute).
 * Level 1 of 3-level error recovery strategy.
 *
 * Phase 2: Error Recovery
 */

import aiService from "../../aiService.js";
import batchResponseParser from "../batchResponseParser.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
let METRICS;
try {
  METRICS = require("../../metrics/GenerationMetrics");
} catch (e) {
  METRICS = null;
}

/**
 * Recover from batch failure by requesting chapters individually
 *
 * @param {Array} failedBatch - Array of chapter specs from failed batch
 * @param {Object} originalContext - Context that was used in failed batch
 * @param {string} sessionId - Session ID for metrics
 * @param {Object} options - { maxRetries: 3, throttleMs: 6500 }
 * @returns {Promise<Object>} {
 *   success: boolean,
 *   chapters: Array (recovered chapters),
 *   failedChapters: Array (chapters that couldn't be recovered),
 *   attempts: { total, succeeded, failed }
 * }
 */
async function recoverWithIndividualRequests(
  failedBatch,
  originalContext,
  sessionId,
  options = {}
) {
  const {
    maxRetries = 1, // Only retry individual once (Phase 3 does more)
    throttleMs = 6500, // 6.5s = respects 10 req/min limit
  } = options;

  if (!Array.isArray(failedBatch) || failedBatch.length === 0) {
    throw new Error("throttledFallback: failedBatch must be non-empty array");
  }

  if (global.__DEBUG_BATCH__) {
    console.log(
      `[THROTTLED FALLBACK] Recovering ${failedBatch.length} chapters individually (throttle: ${throttleMs}ms)`
    );
  }

  const recovered = [];
  const failedChapters = [];
  let totalAttempts = 0;
  let succeededAttempts = 0;
  let failedAttempts = 0;

  // Process each chapter individually with throttling
  for (let i = 0; i < failedBatch.length; i++) {
    const chapterSpec = failedBatch[i];

    // Throttle: wait before each request (except first)
    if (i > 0) {
      if (global.__DEBUG_BATCH__) {
        console.log(
          `[THROTTLED FALLBACK] Waiting ${throttleMs}ms before next request...`
        );
      }
      await sleep(throttleMs);
    }

    try {
      // Build individual chapter prompt (similar to batch, but single chapter)
      const individualPrompt = _buildIndividualChapterPrompt(
        chapterSpec,
        originalContext
      );

      // Send individual request (use callIndex based on chapter position for rotation)
      const callIndex = (i + 1) % 2; // Rotate between models if multiple chapters
      const response = await aiService.generateContentWithRotation(
        individualPrompt,
        callIndex
      );

      // Parse individual response
      const parseResult = batchResponseParser.parseBatchResponse(response, [
        chapterSpec,
      ]);

      totalAttempts++;

      if (parseResult.success && parseResult.chapters.length > 0) {
        recovered.push(parseResult.chapters[0]);
        succeededAttempts++;

        // Record individual chapter success in metrics
        try {
          if (METRICS && sessionId) {
            METRICS.recordIndividualChapter(sessionId, {
              chapter: chapterSpec.chapter,
              status: "success",
              duration: null,
              timestamp: new Date(),
              reason: "recovery_individual",
            });
          }
        } catch (e) {
          // Non-fatal
        }

        if (global.__DEBUG_BATCH__) {
          console.log(
            `[THROTTLED FALLBACK] ✅ Recovered chapter ${
              chapterSpec.chapter
            } (${i + 1}/${failedBatch.length})`
          );
        }
      } else {
        failedChapters.push(chapterSpec.chapter);
        failedAttempts++;

        if (global.__DEBUG_BATCH__) {
          console.log(
            `[THROTTLED FALLBACK] ❌ Failed to recover chapter ${
              chapterSpec.chapter
            }: ${parseResult.issues[0]?.issue || "unknown error"}`
          );
        }
      }
    } catch (error) {
      totalAttempts++;
      failedAttempts++;
      failedChapters.push(chapterSpec.chapter);

      // Check if rate limit - if so, caller will handle via Phase 2.2
      if (error.code === "BATCH_RATE_LIMIT" || error.status === 429) {
        if (global.__DEBUG_BATCH__) {
          console.log(
            `[THROTTLED FALLBACK] Rate limit hit on chapter ${chapterSpec.chapter} - delegating to backoff handler`
          );
        }
        // Rethrow so caller (batchProcessingWithRecovery) can handle via rateLimitBackoff
        throw error;
      }

      if (global.__DEBUG_BATCH__) {
        console.log(
          `[THROTTLED FALLBACK] ❌ Error recovering chapter ${chapterSpec.chapter}: ${error.message}`
        );
      }
    }
  }

  const success = recovered.length > 0;

  if (global.__DEBUG_BATCH__) {
    console.log(
      `[THROTTLED FALLBACK] Recovery complete: ${succeededAttempts}/${totalAttempts} succeeded, ` +
        `${failedChapters.length} still failed`
    );
  }

  return {
    success,
    chapters: recovered,
    failedChapters,
    attempts: {
      total: totalAttempts,
      succeeded: succeededAttempts,
      failed: failedAttempts,
    },
  };
}

/**
 * Sleep for specified milliseconds
 *
 * @param {number} milliseconds - Time to sleep
 * @returns {Promise<void>}
 */
function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Build individual chapter prompt (similar to batch, but single chapter)
 *
 * @private
 */
function _buildIndividualChapterPrompt(chapterSpec, originalContext) {
  const prompt = `You are generating a single chapter for an ebook. Generate the following chapter with the full narrative context provided.

**Chapter to Generate**:
- Chapter ${chapterSpec.chapter}: "${chapterSpec.title}"
- Topics: ${chapterSpec.topics || "unspecified"}
- Page count: ${chapterSpec.pageCount || 2}

**Narrative Context** (for continuity):
${_formatNarrativeContext(originalContext)}

**Output Format**:
Return a JSON object with a single chapter:
{
  "chapter": ${chapterSpec.chapter},
  "title": "${chapterSpec.title}",
  "summary": "<1-2 line summary>",
  "content": "<3-5 paragraphs of rich content>",
  "image": {
    "concept": "<visual concept for chapter>",
    "style": "<artistic style>",
    "tone": "<visual tone>"
  }
}

**Requirements**:
1. Maintain narrative continuity with previous chapters
2. Follow established character voice and plot arcs
3. Include specific narrative connections from context
4. Generate exactly this chapter (not multiple)
5. Return ONLY valid JSON, no additional text.`;

  return prompt;
}

/**
 * Format narrative context for prompt
 *
 * @private
 */
function _formatNarrativeContext(context) {
  if (!context || typeof context !== "object") {
    return "This is a standard ebook chapter.";
  }

  const parts = [];

  if (context.previousChapters && context.previousChapters.length > 0) {
    const summaries = context.previousChapters
      .slice(-3) // Last 3 chapters for context
      .map((ch) => `- Chapter ${ch.chapter}: ${ch.summary}`)
      .join("\n");
    parts.push(`Recent chapters:\n${summaries}`);
  }

  if (context.narrativeArc) {
    parts.push(`Narrative arc: ${context.narrativeArc}`);
  }

  if (context.unfinishedPlots && context.unfinishedPlots.length > 0) {
    parts.push(`Active plot threads: ${context.unfinishedPlots.join(", ")}`);
  }

  if (context.characterDevelopment && context.characterDevelopment.length > 0) {
    parts.push(`Key characters: ${context.characterDevelopment.join(", ")}`);
  }

  return parts.length > 0 ? parts.join("\n\n") : "Standard ebook generation.";
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  recoverWithIndividualRequests,
  sleep,
};
