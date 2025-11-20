/**
 * Theme Engine - Phase A (Demo Mode)
 * Defines dark theme styling for PDF generation
 * Single hardcoded dark theme for Phase A
 * Future: Phase B will support theme selection (dark/light/corporate)
 */

const themes = {
  dark: {
    // Color Palette: Dark theme optimized for readability
    colors: {
      background: "#1a1a1a", // Nearly black background
      text: "#ffffff", // Pure white text
      accent: "#007bff", // Blue accent for highlights
      border: "#333333", // Dark gray borders
      secondaryText: "#cccccc", // Light gray for secondary text
      success: "#28a745", // Green for success states
      warning: "#ffc107", // Amber for warnings
      error: "#dc3545", // Red for errors
    },

    // Typography
    fonts: {
      header: "Helvetica", // Sans-serif for headers
      body: "Georgia", // Serif for body text
      mono: "Courier New", // Monospace for code
    },

    // Spacing & Layout
    spacing: {
      pageMargin: "1in", // 1 inch margins on all sides
      sectionGap: "0.5in", // Gap between sections
      blockGap: "0.25in", // Gap between blocks
      lineHeight: 1.6, // Line spacing multiplier
      paragraphSpacing: "0.3in", // Space between paragraphs
    },

    // Component-specific Styles
    styles: {
      coverPage: {
        backgroundColor: "#1a1a1a",
        textColor: "#ffffff",
        accentColor: "#007bff",
        titleFontSize: 48,
        authorFontSize: 24,
        dateColor: "#cccccc",
      },
      copyrightPage: {
        backgroundColor: "#1a1a1a",
        textColor: "#cccccc",
        fontSize: 12,
        borderColor: "#333333",
        borderWidth: 1,
      },
      contentPage: {
        backgroundColor: "#1a1a1a",
        textColor: "#ffffff",
        fontSize: 14,
        headingFontSize: 24,
        headingColor: "#007bff",
        headingMarginBottom: "0.25in",
      },
      epiloguePage: {
        backgroundColor: "#1a1a1a",
        textColor: "#ffffff",
        sectionTitleColor: "#007bff",
        sectionTitleFontSize: 18,
        contentFontSize: 12,
      },
      callout: {
        backgroundColor: "#252525", // Slightly lighter than page background
        borderColor: "#007bff",
        borderWidth: 2,
        borderLeft: true,
        textColor: "#ffffff",
        accentColor: "#007bff",
        padding: "0.25in",
        marginTop: "0.2in",
        marginBottom: "0.2in",
      },
      quote: {
        textColor: "#cccccc",
        fontStyle: "italic",
        fontSize: 13,
        borderLeft: true,
        borderColor: "#007bff",
        borderWidth: 3,
        paddingLeft: "0.5in",
        marginLeft: "0.5in",
      },
      table: {
        headerBackgroundColor: "#252525",
        headerTextColor: "#007bff",
        rowBackgroundColor: "#1a1a1a",
        rowAlternateBackgroundColor: "#222222",
        textColor: "#ffffff",
        borderColor: "#333333",
      },
      link: {
        textColor: "#007bff",
        underline: true,
      },
    },

    // Image styling
    images: {
      maxWidth: "4in", // Max image width
      maxHeight: "3in", // Max image height
      alignment: "center", // Center alignment
      captionFontSize: 11,
      captionColor: "#cccccc",
      border: true,
      borderColor: "#333333",
      borderWidth: 1,
    },

    // Footer & Header
    headerFooter: {
      enabled: true,
      fontSize: 10,
      textColor: "#cccccc",
      backgroundColor: "transparent",
      borderTop: true,
      borderColor: "#333333",
      marginTop: "0.5in",
      paddingTop: "0.25in",
    },

    // Page numbering
    pageNumbers: {
      enabled: true,
      position: "bottom-right", // or 'bottom-center', 'bottom-left'
      fontSize: 10,
      textColor: "#cccccc",
      romanNumeralsFront: true, // Roman numerals for front matter (i, ii, iii)
    },
  },
};

/**
 * Get theme object by name
 * @param {string} name - Theme name ('dark' for Phase A)
 * @returns {Object} Theme object with colors, fonts, spacing, styles
 */
function getTheme(name = "dark") {
  return themes[name] || themes.dark;
}

/**
 * Apply theme to a component (future enhancement)
 * @param {Object} component - Component to style
 * @param {string} themeName - Theme name
 * @returns {Object} Styled component
 */
function applyTheme(component, themeName = "dark") {
  const theme = getTheme(themeName);
  // Merge theme styles with component
  return {
    ...component,
    _theme: theme,
  };
}

module.exports = {
  getTheme,
  applyTheme,
  themes,
};
