/**
 * puppeteerBridge - Browser lifecycle and rendering management
 *
 * Singleton pattern: maintains single browser instance per process.
 * Handles:
 * - Browser startup/shutdown
 * - Page creation and cleanup
 * - HTML to PDF rendering
 * - Error recovery
 *
 * Reusing a browser instance is much faster than launching one per render.
 */

let puppeteer;
try {
  puppeteer = require("puppeteer-core");
} catch (e) {
  try {
    puppeteer = require("puppeteer");
  } catch (er) {
    puppeteer = null;
  }
}

/**
 * PuppeteerBridge - Singleton browser manager
 *
 * Uses the global browserInstance from index.js if available.
 * Falls back to launching its own browser if needed.
 */
class PuppeteerBridge {
  constructor() {
    this.browser = null;
    this.isConnected = false;
    this._globalBrowserAttempted = false;
  }

  /**
   * Try to use the global browser instance from index.js
   */
  _tryUseGlobalBrowser() {
    if (this._globalBrowserAttempted) {
      return; // Already tried
    }
    this._globalBrowserAttempted = true;

    try {
      const indexModule = require("./index");
      if (indexModule.browser) {
        this.browser = indexModule.browser;
        this.isConnected = true;
        console.log(
          "[puppeteerBridge] Using global browser instance from index.js"
        );
      }
    } catch (e) {
      // index.js not available or browser not initialized yet
      // Will attempt local initialization below
    }
  }

  /**
   * Initialize browser instance
   *
   * Uses global browser from index.js if available.
   * Falls back to launching its own browser if needed.
   *
   * @returns {Promise<any>} Browser instance
   * @throws {Error} If startup fails
   */
  async initBrowser() {
    if (this.browser && this.isConnected) {
      console.log("[puppeteerBridge] Browser already initialized");
      return this.browser;
    }

    try {
      // Try to use global browser from index.js first
      this._tryUseGlobalBrowser();
      if (this.browser && this.isConnected) {
        return this.browser;
      }

      // Fall back to launching our own browser
      if (!puppeteer) {
        throw new Error("Puppeteer not available");
      }

      // Get Chrome path from environment
      const execPath =
        process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;

      const launchOptions = {
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
        timeout: Number(process.env.PUPPETEER_LAUNCH_TIMEOUT_MS) || 30000,
      };

      if (execPath) {
        launchOptions.executablePath = execPath;
      }

      // Retry a couple times for flaky CI/launcher issues
      const maxAttempts = 2;
      let lastErr;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          this.browser = await puppeteer.launch(launchOptions);
          this.isConnected = true;
          console.log(
            `[puppeteerBridge] ✓ Browser initialized locally (attempt ${attempt})`
          );
          return this.browser;
        } catch (err) {
          lastErr = err;
          // Small backoff before retry
          await new Promise((r) => setTimeout(r, attempt * 250));
        }
      }

      throw new Error(
        `Puppeteer launch failed after ${maxAttempts} attempts: ${lastErr.message}`
      );
    } catch (error) {
      console.error("[puppeteerBridge] Init failed:", error.message);
      throw error;
    }
  }

  /**
   * Gracefully shutdown browser
   *
   * Called on server shutdown or cleanup.
   *
   * @returns {Promise<void>}
   */
  async closeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        this.isConnected = false;
        console.log("[puppeteerBridge] ✓ Browser closed");
      } catch (error) {
        console.error("[puppeteerBridge] Close failed:", error.message);
      }
    }
  }

  /**
   * Render HTML to PDF using Puppeteer
   *
   * Creates a new page, sets HTML content, and generates PDF.
   * Always cleans up the page afterward.
   *
   * @param {string} html - HTML content to render
   * @param {Object} options - Puppeteer PDF options
   *   - format: 'A4' (default)
   *   - margin: { top, bottom, left, right }
   *   - printBackground: boolean
   *   - timeout: milliseconds
   *   - etc. (all Puppeteer page.pdf() options supported)
   *
   * @returns {Promise<Buffer>} PDF file content
   * @throws {Error} If rendering fails
   */
  async renderToPDF(html, options = {}) {
    if (!this.isConnected) {
      throw new Error("Browser not initialized. Call initBrowser() first");
    }

    if (!html || typeof html !== "string") {
      throw new Error("renderToPDF: html must be non-empty string");
    }

    let page;
    try {
      // Create new page
      page = await this.browser.newPage();

      // Set HTML content with DOM content loaded (fastest, still sufficient)
      // Use timeout from options, or default to 90s
      const setContentTimeout = options.timeout || 90000;

      // Set resource timeout and error handlers
      page.setDefaultNavigationTimeout(setContentTimeout);
      page.setDefaultTimeout(setContentTimeout);

      // Log HTML size for debugging large document issues
      const htmlSize = Buffer.byteLength(html, "utf8");
      console.log(
        `[puppeteerBridge] Setting content: ${(htmlSize / 1024).toFixed(2)}KB`
      );

      // Handle network errors gracefully - don't fail on them
      const networkErrors = [];
      page.on("error", (err) => {
        console.warn("[puppeteerBridge] Page error event:", err.message);
      });

      // Track failed requests but don't fail the whole render
      page.on("requestfailed", (request) => {
        const error = request.failure?.errorText || "Unknown error";
        console.warn(
          `[puppeteerBridge] Request failed: ${request.url()} - ${error}`
        );
        networkErrors.push({ url: request.url(), error });
      });

      // Abort certain resource requests to speed up rendering and avoid timeouts
      // Block external CDN requests that might timeout with large documents
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const url = request.url().toLowerCase();
        // Allow: data URIs, same-origin, basic fonts
        // Block: tracking, ads, slow CDNs
        if (
          url.includes("google-analytics") ||
          url.includes("doubleclick") ||
          url.includes("ads.") ||
          url.includes("tracking")
        ) {
          request.abort("blockedbyclient");
        } else {
          // For external requests like Google Fonts, use shorter timeout
          const timeoutMs = 5000; // 5 second timeout per request
          const requestTimeout = setTimeout(() => {
            request.abort("timedout").catch(() => {});
          }, timeoutMs);

          request
            .continue()
            .catch(() => {})
            .finally(() => clearTimeout(requestTimeout));
        }
      });
      try {
        await page.setContent(html, {
          waitUntil: "domcontentloaded", // Even faster: just wait for DOM, no load event
          timeout: setContentTimeout,
        });
      } catch (setContentErr) {
        // If setContent times out, try a more lenient approach
        console.warn(
          "[puppeteerBridge] setContent failed, retrying with domcontentloaded:",
          setContentErr.message
        );
        // Continue anyway - page might still be usable
      }

      // Wait for fonts to load (with timeout)
      try {
        await page.evaluate(() => {
          return new Promise((resolve) => {
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(resolve);
            } else {
              setTimeout(resolve, 1000);
            }
          });
        });
      } catch (err) {
        console.warn("[puppeteerBridge] Font loading check failed (non-fatal)");
      }

      // Generate PDF with options
      const pdfBuffer = await page.pdf(options);
      console.log(
        `[puppeteerBridge] PDF generated: ${(pdfBuffer.length / 1024).toFixed(
          2
        )}KB`
      );

      return pdfBuffer;
    } catch (error) {
      console.error("[puppeteerBridge] Detailed error info:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw new Error(`PDF rendering failed: ${error.message}`);
    } finally {
      // Always clean up page
      if (page) {
        try {
          await page.close();
        } catch (err) {
          console.warn("[puppeteerBridge] Page close failed (non-fatal)");
        }
      }
    }
  }

  /**
   * Get browser metrics for debugging/monitoring
   *
   * @returns {Object} Current state and metrics
   */
  getMetrics() {
    return {
      isConnected: this.isConnected,
      browser: this.browser ? "active" : "inactive",
      pages: this.browser ? this.browser.pages?.length || 0 : 0,
    };
  }
}

// Export singleton instance
const puppeteerBridge = new PuppeteerBridge();

module.exports = puppeteerBridge;
