/**
 * OverrideService - Apply style/theme overrides to existing results
 *
 * Responsibility:
 * - Apply fast-path style overrides (theme, colors, fontSize)
 * - Validate override feasibility (no content regeneration required)
 * - Re-render HTML + PDF with new styles
 * - Store updated result
 *
 * Allowed overrides (style only):
 * - theme (dark → light, etc.)
 * - colorPalette (vibrant → muted, etc.)
 * - fontSize scaling (±10%)
 *
 * NOT allowed (would require regeneration):
 * - pageCount, contentDensity, chapters, medium
 */

class OverrideService {
  /**
   * Apply override to existing result (fast path)
   * @param {string} resultId - Unique result ID
   * @param {Object} overrides - Override properties { theme, colorPalette, fontSize }
   * @param {Object} db - Database instance (for mocking in tests)
   * @param {Object} themeEngine - ThemeEngine instance (for mocking in tests)
   * @param {Object} pdfGenerator - PDFGenerator instance (for mocking in tests)
   * @returns {Promise<Object>} Updated result with new theme applied
   */
  async apply(resultId, overrides, db, themeEngine, pdfGenerator) {
    // Validate inputs
    if (!resultId || typeof resultId !== "string") {
      throw new Error("OverrideService: resultId must be a non-empty string");
    }
    if (!overrides || typeof overrides !== "object") {
      throw new Error("OverrideService: overrides must be an object");
    }

    // Validate override feasibility
    const canOverride = this._canOverride(overrides);
    if (!canOverride.valid) {
      throw new Error(`OverrideService: ${canOverride.reason}`);
    }

    // Retrieve existing result from DB (mocked in tests)
    const result = db
      ? await db.getResult(resultId)
      : this._mockGetResult(resultId);
    if (!result) {
      throw new Error("OverrideService: Result UUID not found in database");
    }

    // Build new HTML with CSS overrides
    const newHTML = this._buildOverrideHTML(
      result.html,
      overrides,
      themeEngine
    );

    // Re-render PDF with new HTML
    const newPDF = pdfGenerator
      ? await pdfGenerator.generateFromHTML(newHTML)
      : this._mockGeneratePDF(newHTML);

    // Store updated result
    if (db) {
      await db.updateResult(resultId, {
        html: newHTML,
        pdf: newPDF,
        metadata: {
          ...result.metadata,
          appliedAt: new Date().toISOString(),
          regenerated: false, // Key: content NOT regenerated
          cached: true,
        },
      });
    }

    return {
      resultId,
      status: "completed",
      pdf: newPDF,
      html: newHTML,
      metadata: {
        ...result.metadata,
        theme: overrides.theme || result.metadata.theme,
        colorPalette: overrides.colorPalette || result.metadata.colorPalette,
        fontSize: overrides.fontSize || result.metadata.fontSize,
        appliedAt: new Date().toISOString(),
        regenerated: false,
        cached: true,
      },
      classification: result.classification || {},
    };
  }

  /**
   * Validate override feasibility
   * @private
   * @param {Object} overrides - Proposed overrides
   * @returns {Object} { valid: boolean, reason?: string }
   */
  _canOverride(overrides) {
    const ALLOWED_KEYS = ["theme", "colorPalette", "fontSize"];
    const FORBIDDEN_KEYS = [
      "pageCount",
      "contentDensity",
      "chapters",
      "medium",
      "content",
    ];

    const requestedKeys = Object.keys(overrides);

    // Check for forbidden overrides
    for (const key of requestedKeys) {
      if (FORBIDDEN_KEYS.includes(key)) {
        return {
          valid: false,
          reason: `Cannot override ${key} (requires content regeneration)`,
        };
      }

      if (!ALLOWED_KEYS.includes(key)) {
        return {
          valid: false,
          reason: `Unknown override property: ${key}`,
        };
      }
    }

    // Validate specific override values
    if (overrides.fontSize) {
      const fontSize = parseFloat(overrides.fontSize);
      if (isNaN(fontSize) || fontSize < 0.9 || fontSize > 1.1) {
        return {
          valid: false,
          reason: "fontSize must be between 0.9 and 1.1 (±10% scaling)",
        };
      }
    }

    return { valid: true };
  }

  /**
   * Build updated HTML with override applied
   * @private
   * @param {string} originalHTML - Original HTML content
   * @param {Object} overrides - Override properties
   * @param {Object} themeEngine - ThemeEngine instance (for mocking in tests)
   * @returns {string} Updated HTML with new CSS
   */
  _buildOverrideHTML(originalHTML, overrides, themeEngine) {
    if (!originalHTML || typeof originalHTML !== "string") {
      throw new Error(
        "OverrideService: originalHTML must be a non-empty string"
      );
    }

    let updatedHTML = originalHTML;
    let cssOverrides = "";

    // Apply theme override
    if (overrides.theme) {
      const theme = themeEngine
        ? themeEngine.getTheme(overrides.theme)
        : this._mockGetTheme(overrides.theme);

      if (!theme) {
        throw new Error(`OverrideService: Theme not found: ${overrides.theme}`);
      }

      // Build CSS variables from theme
      if (theme.colors) {
        Object.entries(theme.colors).forEach(([key, value]) => {
          cssOverrides += `--color-${key}: ${value}; `;
        });
      }
    }

    // Apply fontSize override
    if (overrides.fontSize) {
      const scale = parseFloat(overrides.fontSize);
      cssOverrides += `--font-scale: ${scale}; `;
    }

    // Apply colorPalette override
    if (overrides.colorPalette) {
      cssOverrides += `--color-palette: ${overrides.colorPalette}; `;
    }

    // Inject CSS into <head>
    if (cssOverrides) {
      const styleTag = `<style>:root { ${cssOverrides} }</style>`;

      // Try to inject before </head>
      if (updatedHTML.includes("</head>")) {
        updatedHTML = updatedHTML.replace("</head>", `${styleTag}</head>`);
      } else if (updatedHTML.includes("<body")) {
        // Fallback: inject before <body if no </head>
        updatedHTML = updatedHTML.replace("<body", `${styleTag}<body`);
      } else {
        // Last resort: prepend to HTML
        updatedHTML = styleTag + updatedHTML;
      }
    }

    return updatedHTML;
  }

  /**
   * Mock: Get result from DB (for testing without real DB)
   * @private
   * @param {string} resultId - Result UUID
   * @returns {Object} Mock result
   */
  _mockGetResult(resultId) {
    return {
      id: resultId,
      html: "<html><head></head><body><h1>Test Content</h1></body></html>",
      pdf: Buffer.from("PDF"),
      metadata: {
        theme: "dark",
        colorPalette: "default",
        fontSize: 1.0,
      },
      classification: {
        theme: ["dark"],
      },
    };
  }

  /**
   * Mock: Generate PDF from HTML (for testing without real PDF generator)
   * @private
   * @param {string} html - HTML content
   * @returns {Promise<Buffer>} Mock PDF buffer
   */
  async _mockGeneratePDF(html) {
    return Buffer.from(`PDF generated from: ${html.substring(0, 50)}`);
  }

  /**
   * Mock: Get theme from ThemeEngine (for testing)
   * @private
   * @param {string} themeName - Theme name
   * @returns {Object} Mock theme
   */
  _mockGetTheme(themeName) {
    const themes = {
      dark: {
        colors: {
          background: "#1a1a1a",
          text: "#e0e0e0",
          accent: "#4a9eff",
        },
      },
      light: {
        colors: {
          background: "#ffffff",
          text: "#1a1a1a",
          accent: "#0066cc",
        },
      },
      bold: {
        colors: {
          background: "#1a1a1a",
          text: "#ffffff",
          accent: "#d84000",
        },
      },
    };

    return themes[themeName] || null;
  }
}

export default new OverrideService();
