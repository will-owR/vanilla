/**
 * Wraps a Promise with a timeout. If the promise does not resolve within the
 * specified time, it rejects with a timeout error.
 *
 * @template T The type of the Promise result
 * @param {Promise<T>} promise The promise to wrap with a timeout
 * @param {number} timeoutMs The timeout duration in milliseconds
 * @returns {Promise<T>} A promise that rejects if the timeout is reached
 */
export function withTimeout(promise, timeoutMs = 5000) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Request timed out"));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    // Clean up any pending timers
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}
