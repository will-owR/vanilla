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

const serviceState = require("./index").serviceState || {};

/**
 * PuppeteerBridge - Singleton browser manager
 */
class PuppeteerBridge {
  constructor() {
    this.browser = null;
    this.isConnected = false;
  }

  /**
   * Initialize browser instance
   *
   * Starts Puppeteer browser with appropriate configuration.
   * Should be called once on server startup.
   *
   * @returns {Promise<Browser>} Browser instance
   * @throws {Error} If startup fails
   */
  async initBrowser() {
    if (this.browser) {
      console.log("[puppeteerBridge] Browser already initialized");
      return this.browser;
    }

    try {
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
            `[puppeteerBridge] ✓ Browser initialized (attempt ${attempt})`
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

      // Set HTML content with network idle timeout
      await page.setContent(html, { waitUntil: "networkidle0" });

      // Wait for fonts to load
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

      return pdfBuffer;
    } catch (error) {
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
