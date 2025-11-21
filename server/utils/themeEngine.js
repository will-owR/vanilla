/**
 * Theme Engine - Phase B
 * Supports 4 theme variants with full CSS variable generation
 * and WCAG AA accessibility validation (contrast ratio > 4.5:1)
 */

// Helper: Calculate relative luminance per WCAG spec
const calculateLuminance = (hex) => {
  const rgb = parseInt(hex.slice(1), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;

  const [rs, gs, bs] = [r, g, b].map((x) => {
    x = x / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Helper: Calculate contrast ratio between two colors (WCAG)
const calculateContrastRatio = (color1, color2) => {
  const lum1 = calculateLuminance(color1);
  const lum2 = calculateLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
};

// Helper: Add legacy theme keys for backward compatibility
const enrichThemeWithLegacyKeys = (theme) => {
  return {
    ...theme,
    colors: {
      ...theme.colors,
      border: theme.colors.text, // Use text color as border
    },
    fonts: {
      ...theme.fonts,
      header: theme.fonts.headings, // Alias for headings
      mono: "'Courier New', monospace", // Add mono font
    },
    spacing: {
      ...theme.spacing,
      sectionGap: "2em", // Add to spacing object
    },
    styles: {
      // Legacy styles object with all component styles
      coverPage: {
        backgroundColor: theme.colors.background,
        textColor: theme.colors.headings,
        accentColor: theme.colors.accent,
      },
      copyrightPage: {
        backgroundColor: theme.colors.background,
        textColor: theme.colors.text,
        fontSize: "0.9em",
      },
      epiloguePage: {
        backgroundColor: theme.colors.background,
        textColor: theme.colors.text,
        accentColor: theme.colors.accent,
      },
      contentPage: {
        backgroundColor: theme.colors.background,
        textColor: theme.colors.text,
        accentColor: theme.colors.accent,
      },
      callout: {
        backgroundColor: theme.colors.background,
        borderColor: theme.colors.accent,
        textColor: theme.colors.text,
      },
      quote: {
        textColor: theme.colors.subtleText,
        fontStyle: "italic",
        borderColor: theme.colors.accent,
      },
    },
    sectionGap: "2em", // Legacy top-level key
  };
};

const THEME_DEFINITIONS = {
  dark: {
    name: "dark",
    colors: {
      background: "#1a1a1a",
      text: "#e0e0e0",
      accent: "#00d4ff",
      headings: "#ffffff",
      subtleText: "#a0a0a0",
      success: "#28a745",
      warning: "#ffc107",
      error: "#dc3545",
    },
    fonts: {
      body: "'Georgia', serif",
      headings: "'Roboto', sans-serif",
      display: "'Playfair Display', serif",
    },
    spacing: {
      pageMargin: "1.5in",
      lineHeight: 1.8,
      paragraphGap: "1.2em",
    },
  },

  light: {
    name: "light",
    colors: {
      background: "#ffffff",
      text: "#333333",
      accent: "#0066cc",
      headings: "#000000",
      subtleText: "#666666",
      success: "#28a745",
      warning: "#ffc107",
      error: "#dc3545",
    },
    fonts: {
      body: "'Calibri', 'Segoe UI', sans-serif",
      headings: "'Arial', sans-serif",
      display: "'Georgia', serif",
    },
    spacing: {
      pageMargin: "1.25in",
      lineHeight: 1.6,
      paragraphGap: "1em",
    },
  },

  corporate: {
    name: "corporate",
    colors: {
      background: "#f5f5f5",
      text: "#1f1f1f",
      accent: "#003d82",
      headings: "#003d82",
      subtleText: "#555555",
      success: "#28a745",
      warning: "#ffc107",
      error: "#dc3545",
    },
    fonts: {
      body: "'Segoe UI', 'Helvetica Neue', sans-serif",
      headings: "'Segoe UI', sans-serif",
      display: "'Segoe UI', sans-serif",
    },
    spacing: {
      pageMargin: "1in",
      lineHeight: 1.5,
      paragraphGap: "0.8em",
    },
  },

  bold: {
    name: "bold",
    colors: {
      background: "#ffffff",
      text: "#1a1a1a",
      accent: "#ff6600",
      headings: "#cc0000",
      subtleText: "#333333",
      success: "#28a745",
      warning: "#ffc107",
      error: "#dc3545",
    },
    fonts: {
      body: "'Impact', sans-serif",
      headings: "'Impact', sans-serif",
      display: "'Bebas Neue', 'Impact', sans-serif",
    },
    spacing: {
      pageMargin: "1.5in",
      lineHeight: 1.9,
      paragraphGap: "1.5em",
    },
  },
};

class ThemeEngine {
  /**
   * Get theme configuration by name
   * @param {string} themeName - Theme name ('dark', 'light', 'corporate', 'bold')
   * @returns {Object} Theme configuration
   */
  getTheme(themeName) {
    if (!THEME_DEFINITIONS[themeName]) {
      throw new Error(`Theme not found: ${themeName}`);
    }
    return enrichThemeWithLegacyKeys(THEME_DEFINITIONS[themeName]);
  }

  /**
   * Get theme with fallback to dark theme for invalid names (backward compat)
   * @private
   * @param {string} themeName - Theme name
   * @returns {Object} Theme config
   */
  _getThemeCompat(themeName) {
    if (!THEME_DEFINITIONS[themeName]) {
      return enrichThemeWithLegacyKeys(THEME_DEFINITIONS.dark);
    }
    return enrichThemeWithLegacyKeys(THEME_DEFINITIONS[themeName]);
  }

  /**
   * List all available themes
   * @returns {string[]} Array of theme names
   */
  listThemes() {
    return Object.keys(THEME_DEFINITIONS);
  }

  /**
   * Generate full CSS string with CSS variables
   * @param {string} themeName - Theme name
   * @returns {string} CSS string with :root variables
   */
  generateCSS(themeName) {
    const theme = this.getTheme(themeName);

    const cssVars = [
      `--color-bg: ${theme.colors.background}`,
      `--color-text: ${theme.colors.text}`,
      `--color-accent: ${theme.colors.accent}`,
      `--color-headings: ${theme.colors.headings}`,
      `--color-subtle: ${theme.colors.subtleText}`,
      `--color-success: ${theme.colors.success}`,
      `--color-warning: ${theme.colors.warning}`,
      `--color-error: ${theme.colors.error}`,
      `--font-body: ${theme.fonts.body}`,
      `--font-headings: ${theme.fonts.headings}`,
      `--font-display: ${theme.fonts.display}`,
      `--spacing-margin: ${theme.spacing.pageMargin}`,
      `--spacing-line-height: ${theme.spacing.lineHeight}`,
      `--spacing-para-gap: ${theme.spacing.paragraphGap}`,
    ].join("; ");

    return `:root { ${cssVars}; }\n\nbody {\n  background-color: var(--color-bg);\n  color: var(--color-text);\n  font-family: var(--font-body);\n  line-height: var(--spacing-line-height);\n}\n\nh1, h2, h3, h4, h5, h6 {\n  color: var(--color-headings);\n  font-family: var(--font-headings);\n}\n\na { color: var(--color-accent); }\n.accent { color: var(--color-accent); }\n.subtle { color: var(--color-subtle); }`;
  }

  /**
   * Validate theme accessibility (WCAG AA standard)
   * @param {string} themeName - Theme name
   * @returns {Object} Validation result { valid, issues, contrastRatios }
   */
  validateAccessibility(themeName) {
    const theme = this.getTheme(themeName);
    const issues = [];
    const contrastRatios = {};

    // Required minimum ratio per WCAG AA: 4.5:1 for normal text
    const MIN_RATIO = 4.5;

    // Check text vs background
    const textRatio = calculateContrastRatio(
      theme.colors.text,
      theme.colors.background
    );
    contrastRatios.text = parseFloat(textRatio.toFixed(2));
    if (textRatio < MIN_RATIO) {
      issues.push(
        `Text contrast (${contrastRatios.text}:1) below minimum (${MIN_RATIO}:1)`
      );
    }

    // Check headings vs background
    const headingsRatio = calculateContrastRatio(
      theme.colors.headings,
      theme.colors.background
    );
    contrastRatios.headings = parseFloat(headingsRatio.toFixed(2));
    if (headingsRatio < MIN_RATIO) {
      issues.push(
        `Headings contrast (${contrastRatios.headings}:1) below minimum (${MIN_RATIO}:1)`
      );
    }

    // Check accent vs background (7:1 preferred for UI components)
    const accentRatio = calculateContrastRatio(
      theme.colors.accent,
      theme.colors.background
    );
    contrastRatios.accent = parseFloat(accentRatio.toFixed(2));
    if (accentRatio < MIN_RATIO) {
      issues.push(
        `Accent contrast (${contrastRatios.accent}:1) below minimum (${MIN_RATIO}:1)`
      );
    }

    return {
      valid: issues.length === 0,
      issues,
      contrastRatios,
    };
  }
}

/**
 * Legacy support: Apply theme to a component
 * @deprecated Use getTheme() and generateCSS() directly
 */
function getThemeCompat(name = "dark") {
  const engine = new ThemeEngine();
  try {
    return engine.getTheme(name);
  } catch (error) {
    // Fallback to dark theme for invalid names (backward compat)
    return engine.getTheme("dark");
  }
}

function applyTheme(component, themeName = "dark") {
  const engine = new ThemeEngine();
  const theme = engine.getTheme(themeName);
  return {
    ...component,
    _theme: theme,
  };
}

// Export singleton instance
module.exports = new ThemeEngine();

// Also export for legacy compatibility
module.exports.getTheme = getThemeCompat;
module.exports.applyTheme = applyTheme;
module.exports.THEME_DEFINITIONS = THEME_DEFINITIONS;
module.exports.themes = THEME_DEFINITIONS;
