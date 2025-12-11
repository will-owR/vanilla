/**
 * quotaTracker - Pure quota accounting module
 *
 * Tracks API calls within a 60-second window.
 * Single responsibility: count calls and expose status.
 * No pause/resume logic, no flow control.
 *
 * Used by:
 * - genieService.process() to check availability before dispatching
 * - geminiClient.callGemini() to record successful API calls
 */

const quotaTracker = (() => {
  let callCount = 0;
  let windowStart = Date.now();

  // Gemini free tier: 20 calls per minute
  const LIMIT = 20;
  const WINDOW_MS = 60 * 1000; // 60 seconds

  /**
   * Record a successful API call
   * Called by geminiClient after each successful Gemini API request
   */
  function recordCall() {
    // Auto-rotate window if expired
    const now = Date.now();
    if (now - windowStart >= WINDOW_MS) {
      rotateWindow();
    }

    callCount++;

    // Debug logging
    const status = getStatus();
    console.log(
      `[QUOTA] Call recorded: ${status.callCount}/${status.limit} ` +
        `(${Math.round(status.percentUsed)}% used, ` +
        `${status.availableQuota} remaining)`
    );
  }

  /**
   * Get current quota status
   * Called by genieService.process() before dispatching to domain service
   *
   * @returns {Object} { callCount, limit, availableQuota, percentUsed, windowResetAt, windowExpiredMs }
   */
  function getStatus() {
    const now = Date.now();
    const elapsed = now - windowStart;
    const windowExpired = elapsed >= WINDOW_MS;

    // Auto-rotate if window expired
    if (windowExpired) {
      rotateWindow();
      return getStatus(); // Recursively get status for new window
    }

    return {
      callCount,
      limit: LIMIT,
      availableQuota: Math.max(0, LIMIT - callCount),
      percentUsed: (callCount / LIMIT) * 100,
      windowResetAt: windowStart + WINDOW_MS,
      windowExpiredMs: WINDOW_MS - elapsed, // Milliseconds until window resets
      windowStarted: windowStart,
      isExpired: false,
    };
  }

  /**
   * Rotate window: reset call count and start time
   * Called automatically when 60s window expires
   */
  function rotateWindow() {
    console.log(`[QUOTA] Window rotated: reset counter from ${callCount} to 0`);
    callCount = 0;
    windowStart = Date.now();
  }

  /**
   * Force a manual window rotation (useful for testing)
   * DO NOT call in production code
   */
  function _forceRotateForTesting() {
    rotateWindow();
  }

  // Expose public API
  return {
    recordCall,
    getStatus,
    rotateWindow,
    _forceRotateForTesting, // For tests only
  };
})();

module.exports = quotaTracker;
