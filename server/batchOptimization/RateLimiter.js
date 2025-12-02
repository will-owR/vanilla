/**
 * RateLimiter
 *
 * Manages API request queue with rate limiting.
 * Constraint: 10 requests/minute = 6 seconds minimum between requests
 * Handles: 429 errors with exponential backoff
 */

class RateLimiter {
  /**
   * @param {Object} options
   * @param {number} [options.requestsPerMinute] - Gemini API limit (default: 10)
   */
  constructor(options = {}) {
    this.requestsPerMinute = options.requestsPerMinute || 10;
    this.minIntervalMs = (60 * 1000) / this.requestsPerMinute; // 6000ms for 10 req/min
    this.queue = [];
    this.lastRequestTime = 0;
    this.isProcessing = false;
  }

  /**
   * Enqueue a request function
   *
   * @param {Function} requestFn - Async function that makes API call
   * @returns {Promise<*>} - Result of requestFn when executed
   *
   * Handles:
   * - Timing: Respects 6s minimum between sequential requests
   * - 429 errors: Exponential backoff (1s → 2s → 4s → ... → 30s max)
   * - Queue: FIFO ordering of requests
   */
  enqueue(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject, retryCount: 0 });
      this._processQueue();
    });
  }

  /**
   * Process queue
   * Respects rate limit timing and handles errors
   */
  async _processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      const { requestFn, resolve, reject, retryCount } = item;

      // Calculate wait time to respect rate limit
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      const waitTime = Math.max(0, this.minIntervalMs - timeSinceLastRequest);

      if (waitTime > 0) {
        await this._sleep(waitTime);
      }

      try {
        const result = await requestFn();
        this.lastRequestTime = Date.now();
        resolve(result);
      } catch (error) {
        // Handle 429 (rate limit exceeded) with exponential backoff
        if (error.status === 429 && retryCount < 5) {
          const backoffMs = this._calculateBackoff(retryCount);
          await this._sleep(backoffMs);
          // Re-enqueue with incremented retry count
          this.queue.unshift({
            requestFn,
            resolve,
            reject,
            retryCount: retryCount + 1,
          });
        } else {
          reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Calculate exponential backoff for 429 errors
   * Base: 1000ms, doubles per retry, capped at 30000ms
   */
  _calculateBackoff(retryCount) {
    const baseWait = 1000;
    const maxWait = 30000;
    return Math.min(baseWait * Math.pow(2, retryCount), maxWait);
  }

  /**
   * Sleep utility
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { RateLimiter };
