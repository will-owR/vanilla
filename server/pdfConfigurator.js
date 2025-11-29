/**
 * pdfConfigurator - PDF options and configuration management
 *
 * Centralizes all PDF generation configuration in one place.
 * Enables themes, formats, and options tweaking without touching rendering code.
 */

/**
 * Get default PDF rendering options
 *
 * Returns baseline options suitable for most documents.
 * These can be overridden by theme or caller options.
 *
 * @returns {Object} Default Puppeteer PDF options
 */
function getDefaultOptions() {
  return {
    format: "A4",
    margin: {
      top: "1cm",
      bottom: "1cm",
      left: "1.5cm",
      right: "1.5cm",
    },
    displayHeaderFooter: false,
    printBackground: true,
    timeout: 90000, // 90 seconds (increased for larger documents)
    preferCSSPageSize: true,
  };
}

/**
 * Apply theme-specific PDF options
 *
 * Modifies options based on selected theme.
 * Supports: 'dark', 'light', 'corporate', 'bold'
 *
 * @param {Object} options - Current options to modify
 * @param {string} theme - Theme name
 * @returns {Object} Modified options with theme applied
 */
function applyTheme(options, theme = "light") {
  const themes = {
    dark: {
      printBackground: true,
      margin: {
        top: "1cm",
        bottom: "1cm",
        left: "1cm",
        right: "1cm",
      },
    },
    light: {
      printBackground: false,
      margin: {
        top: "1.5cm",
        bottom: "1.5cm",
        left: "1.5cm",
        right: "1.5cm",
      },
    },
    corporate: {
      format: "A4",
      margin: {
        top: "2cm",
        bottom: "2cm",
        left: "2cm",
        right: "2cm",
      },
      printBackground: true,
    },
    bold: {
      printBackground: true,
      scale: 1.1,
      margin: {
        top: "0.8cm",
        bottom: "0.8cm",
        left: "1cm",
        right: "1cm",
      },
    },
  };

  const themeOptions = themes[theme] || themes.light;
  return { ...options, ...themeOptions };
}

/**
 * Validate PDF options
 *
 * Ensures options are valid before passing to Puppeteer.
 * Throws with clear error message if validation fails.
 *
 * @param {Object} options - Options to validate
 * @returns {boolean} true if valid
 * @throws {Error} If validation fails
 */
function validateOptions(options) {
  const validFormats = ["A4", "Letter", "A3", "A5", "Tabloid", "Ledger"];

  if (options.format && !validFormats.includes(options.format)) {
    throw new Error(
      `Invalid PDF format: ${options.format}. ` +
        `Expected one of: ${validFormats.join(", ")}`
    );
  }

  if (
    options.scale &&
    (typeof options.scale !== "number" ||
      options.scale < 0.1 ||
      options.scale > 2)
  ) {
    throw new Error("PDF scale must be a number between 0.1 and 2");
  }

  if (options.timeout && typeof options.timeout !== "number") {
    throw new Error("PDF timeout must be a number (milliseconds)");
  }

  if (options.margin) {
    const margin = options.margin;
    const validMarginFields = ["top", "bottom", "left", "right"];
    for (const field of Object.keys(margin)) {
      if (!validMarginFields.includes(field)) {
        throw new Error(
          `Invalid margin field: ${field}. ` +
            `Expected one of: ${validMarginFields.join(", ")}`
        );
      }
    }
  }

  return true;
}

/**
 * Get options for specific quality level
 *
 * Adjusts rendering options based on quality preference.
 * Higher quality = better rendering but slower.
 *
 * @param {string} quality - 'low' | 'medium' | 'high'
 * @returns {Object} Quality-appropriate options
 */
function getQualityOptions(quality = "medium") {
  const qualityProfiles = {
    low: {
      scale: 0.8,
      timeout: 45000, // Shorter for lower quality
      printBackground: false,
    },
    medium: {
      scale: 1.0,
      timeout: 90000, // Standard for medium quality
      printBackground: true,
    },
    high: {
      scale: 1.2,
      timeout: 120000, // Higher for better quality (increased from 120s)
      printBackground: true,
    },
  };

  return qualityProfiles[quality] || qualityProfiles.medium;
}

/**
 * Merge multiple option objects safely
 *
 * Combines options from multiple sources with proper precedence.
 * Later options override earlier ones.
 *
 * @param {...Object} optionSets - Multiple option objects to merge
 * @returns {Object} Merged options
 */
function mergeOptions(...optionSets) {
  const result = {};

  for (const opts of optionSets) {
    if (!opts || typeof opts !== "object") continue;

    for (const [key, value] of Object.entries(opts)) {
      if (key === "margin" && value && typeof value === "object") {
        // Merge margin objects
        result.margin = { ...result.margin, ...value };
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

module.exports = {
  getDefaultOptions,
  applyTheme,
  validateOptions,
  getQualityOptions,
  mergeOptions,
};
