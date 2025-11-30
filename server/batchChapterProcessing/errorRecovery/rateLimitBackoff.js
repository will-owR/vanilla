/**
 * Rate Limit Backoff Module
 *
 * Handles HTTP 429 (Rate Limit) responses with exponential backoff strategy.
 * Level 2 of 3-level error recovery (after throttledFallback exhausted).
 *
 * Backoff schedule: 10s → 20s → 60s → give up
 *
 * Phase 2: Error Recovery
 */

/**
 * Handle rate limit response with exponential backoff
 *
 * @param {Error} error - Error with status 429
 * @param {Function} retryFn - Function to retry (async)
 * @param {number} attemptCount - Current attempt number (0-indexed)
 * @param {string} sessionId - Session ID for metrics
 * @param {Object} options - { maxAttempts: 3 }
 * @returns {Promise<Object>} { success, result, attemptsUsed }
 * @throws {Error} If rate limit persists after max attempts
 */
async function handleRateLimit(
  error,
  retryFn,
  attemptCount = 0,
  sessionId = "",
  options = {}
) {
  const { maxAttempts = 3 } = options;

  if (!error || error.status !== 429) {
    throw new Error("rateLimitBackoff: error must be 429 rate limit");
  }

  if (typeof retryFn !== "function") {
    throw new Error("rateLimitBackoff: retryFn must be a function");
  }

  if (attemptCount >= maxAttempts) {
    if (global.__DEBUG_BATCH__) {
      console.log(
        `[RATE LIMIT BACKOFF] Max attempts (${maxAttempts}) exceeded for rate limit - giving up`
      );
    }
    throw error; // Let caller fall through to fallback
  }

  // Calculate backoff time
  const backoffMs = calculateBackoffTime(attemptCount);

  if (global.__DEBUG_BATCH__) {
    console.log(
      `[RATE LIMIT BACKOFF] Rate limit hit (429). Attempt ${
        attemptCount + 1
      }/${maxAttempts}. ` + `Waiting ${backoffMs}ms before retry...`
    );
  }

  // Wait for backoff duration
  await sleep(backoffMs);

  try {
    // Retry the function
    if (global.__DEBUG_BATCH__) {
      console.log(`[RATE LIMIT BACKOFF] Retrying after backoff...`);
    }

    const result = await retryFn();

    if (global.__DEBUG_BATCH__) {
      console.log(
        `[RATE LIMIT BACKOFF] ✅ Recovered after ${
          attemptCount + 1
        } attempts and backoff`
      );
    }

    return {
      success: true,
      result,
      attemptsUsed: attemptCount + 1,
    };
  } catch (retryError) {
    // Check if it's another rate limit
    if (retryError.status === 429) {
      if (global.__DEBUG_BATCH__) {
        console.log(
          `[RATE LIMIT BACKOFF] Rate limit hit again - attempting backoff again`
        );
      }
      // Recursively handle another rate limit
      return handleRateLimit(
        retryError,
        retryFn,
        attemptCount + 1,
        sessionId,
        options
      );
    }

    // Not a rate limit, let it propagate
    throw retryError;
  }
}

/**
 * Calculate exponential backoff time in milliseconds
 *
 * Backoff schedule:
 *   Attempt 0: 10 seconds
 *   Attempt 1: 20 seconds
 *   Attempt 2: 60 seconds
 *
 * @param {number} attemptCount - Attempt number (0-indexed)
 * @returns {number} Milliseconds to wait
 */
function calculateBackoffTime(attemptCount) {
  const baseMs = 10000; // 10 seconds

  if (attemptCount === 0) return baseMs; // 10s
  if (attemptCount === 1) return 20000; // 20s
  if (attemptCount === 2) return 60000; // 60s

  // Max out at 60s for safety
  return 60000;
}

/**
 * Retry a request with automatic backoff on rate limit
 *
 * @param {Function} requestFn - Async function that makes the request
 * @param {Object} options - { maxAttempts: 3 }
 * @param {string} sessionId - Session ID for logging
 * @returns {Promise<Object>} { success, result, attemptsUsed }
 * @throws {Error} If request fails for non-rate-limit reason
 */
async function retryWithBackoff(requestFn, options = {}, sessionId = "") {
  const { maxAttempts = 3 } = options;

  if (typeof requestFn !== "function") {
    throw new Error("rateLimitBackoff: requestFn must be a function");
  }

  let attemptCount = 0;

  while (attemptCount < maxAttempts) {
    try {
      if (global.__DEBUG_BATCH__) {
        console.log(
          `[RATE LIMIT BACKOFF] Attempt ${attemptCount + 1}/${maxAttempts}`
        );
      }

      const result = await requestFn();

      if (global.__DEBUG_BATCH__) {
        console.log(
          `[RATE LIMIT BACKOFF] ✅ Request succeeded on attempt ${
            attemptCount + 1
          }`
        );
      }

      return {
        success: true,
        result,
        attemptsUsed: attemptCount + 1,
      };
    } catch (error) {
      // Check if rate limit
      if (error.status === 429) {
        attemptCount++;

        if (attemptCount < maxAttempts) {
          const backoffMs = calculateBackoffTime(attemptCount - 1);

          if (global.__DEBUG_BATCH__) {
            console.log(
              `[RATE LIMIT BACKOFF] Rate limit (429). Waiting ${backoffMs}ms before retry ` +
                `(${attemptCount}/${maxAttempts})...`
            );
          }

          await sleep(backoffMs);
          continue; // Retry
        } else {
          if (global.__DEBUG_BATCH__) {
            console.log(
              `[RATE LIMIT BACKOFF] Max attempts reached - rate limit persists, giving up`
            );
          }
          throw error;
        }
      }

      // Not a rate limit error - propagate immediately
      throw error;
    }
  }

  // Should not reach here
  throw new Error(
    "rateLimitBackoff: unexpected state - max attempts exhausted"
  );
}

/**
 * Sleep for specified milliseconds (promise-based)
 *
 * @param {number} milliseconds - Time to sleep
 * @returns {Promise<void>}
 */
function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  handleRateLimit,
  calculateBackoffTime,
  retryWithBackoff,
  sleep,
};
