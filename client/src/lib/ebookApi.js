/**
 * Phase B eBook API Client
 * HTTP client for Phase B backend endpoints
 * Handles request/response serialization, error handling, timeouts
 */

const CONFIG = {
  API_BASE_URL: "/api",
  TIMEOUTS: {
    GENERATE: 600000, // 600s (10min) for generate - Large ebooks (20 pages) can take 5+ minutes with Gemini
    OVERRIDE: 10000, // 10s for override
    THEMES: 5000, // 5s for themes
  },
};

/**
 * Fetch with timeout and error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} Response JSON
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.error || `API error ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    if (err instanceof TypeError) {
      throw new Error(`Network error: ${err.message}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * POST /api/ebook/generate
 * Generate eBook with Phase B pipeline
 * @param {Object} payload - { prompt, theme, pageCount, options }
 * @returns {Promise<Object>} Generated eBook result
 */
export async function generateEbook(payload) {
  return fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/ebook/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    CONFIG.TIMEOUTS.GENERATE
  );
}

/**
 * POST /api/override
 * Apply fast-path style overrides
 * @param {Object} payload - { ebookId, overrides }
 * @returns {Promise<Object>} Updated eBook result
 */
export async function applyOverride(payload) {
  return fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/override`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    CONFIG.TIMEOUTS.OVERRIDE
  );
}

/**
 * GET /api/themes
 * Fetch available themes and color palettes metadata
 * @returns {Promise<Object>} { themes, colorPalettes }
 */
export async function fetchThemes() {
  return fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/themes`,
    { method: "GET" },
    CONFIG.TIMEOUTS.THEMES
  );
}
