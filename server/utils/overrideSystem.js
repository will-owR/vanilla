/**
 * Override System - Module 8
 * Allows users to re-style without regeneration
 * Detects changes, applies transforms, validates compatibility
 */

/**
 * Custom error for override operations
 */
class OverrideError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = "OverrideError";
    this.context = context;
    this.statusCode = context.statusCode || 400;
  }
}

/**
 * Override System - change detection, validation, transforms
 * Enables medium/style/color switching without full regeneration
 */
class OverrideSystem {
  constructor() {
    // Compatibility matrix: which mediums can be transformed to which
    this.compatibilityMatrix = {
      ebook: {
        calendar: true, // ✅ compatible
        poster: true,
        stickers: true,
        "greeting-card": true,
        journal: true,
        "app-ui": true,
        "wall-art": true,
      },
      calendar: {
        ebook: true,
        poster: true, // ⚠️ layout differs but compatible
        stickers: true,
        "greeting-card": true,
        journal: true,
        "app-ui": false,
        "wall-art": true,
      },
      poster: {
        ebook: true,
        calendar: true,
        stickers: true,
        "greeting-card": true,
        journal: true,
        "app-ui": false,
        "wall-art": true,
      },
      stickers: {
        ebook: true,
        calendar: true,
        poster: true,
        "greeting-card": true,
        journal: false,
        "app-ui": false,
        "wall-art": false,
      },
      "greeting-card": {
        ebook: true,
        calendar: true,
        poster: true,
        stickers: true,
        journal: true,
        "app-ui": false,
        "wall-art": true,
      },
      journal: {
        ebook: true,
        calendar: true,
        poster: false,
        stickers: false,
        "greeting-card": true,
        "app-ui": false,
        "wall-art": false,
      },
      "app-ui": {
        ebook: false,
        calendar: false,
        poster: false,
        stickers: false,
        "greeting-card": false,
        journal: false,
        "wall-art": false,
      },
      "wall-art": {
        ebook: true,
        calendar: true,
        poster: true,
        stickers: false,
        "greeting-card": true,
        journal: false,
        "app-ui": false,
      },
    };

    // Valid mediums
    this.validMediums = [
      "ebook",
      "calendar",
      "poster",
      "stickers",
      "greeting-card",
      "journal",
      "app-ui",
      "wall-art",
    ];

    // Style compatibility - which styles work with which mediums
    this.styleCompatibility = {
      ebook: ["minimalist", "gothic", "retro", "modern", "whimsical"],
      calendar: ["minimalist", "modern", "artistic", "corporate", "playful"],
      poster: ["bold", "minimalist", "artistic", "retro", "modern"],
      stickers: ["playful", "modern", "retro", "artistic"],
      "greeting-card": [
        "romantic",
        "playful",
        "minimalist",
        "artistic",
        "elegant",
      ],
      journal: ["minimalist", "artistic", "whimsical", "vintage"],
      "app-ui": ["modern", "minimalist", "bold"],
      "wall-art": ["artistic", "minimalist", "bold", "retro", "modern"],
    };
  }

  /**
   * Detect what changed between old and new classifications
   * @param {Object} oldClassification - Previous classification
   * @param {Object} newClassification - New classification
   * @returns {Object} { changedMedium, changedStyle, changedColors, changedTheme }
   */
  detectChanges(oldClassification, newClassification) {
    if (!oldClassification || !newClassification) {
      throw new OverrideError("Classification objects are required", {
        statusCode: 400,
      });
    }

    return {
      changedMedium: oldClassification.medium !== newClassification.medium,
      changedStyle: oldClassification.style !== newClassification.style,
      changedColors:
        oldClassification.colorPalette !== newClassification.colorPalette,
      changedTheme:
        JSON.stringify(oldClassification.theme || []) !==
        JSON.stringify(newClassification.theme || []),
      oldMedium: oldClassification.medium,
      newMedium: newClassification.medium,
      oldStyle: oldClassification.style,
      newStyle: newClassification.style,
      oldColorPalette: oldClassification.colorPalette,
      newColorPalette: newClassification.colorPalette,
    };
  }

  /**
   * Check if a medium can be transformed to another medium
   * @param {string} fromMedium - Source medium
   * @param {string} toMedium - Target medium
   * @returns {boolean} True if transformation is possible
   */
  canTransform(fromMedium, toMedium) {
    if (!this.validMediums.includes(fromMedium)) {
      throw new OverrideError(`Invalid source medium: ${fromMedium}`, {
        statusCode: 400,
      });
    }

    if (!this.validMediums.includes(toMedium)) {
      throw new OverrideError(`Invalid target medium: ${toMedium}`, {
        statusCode: 400,
      });
    }

    // Same medium always compatible
    if (fromMedium === toMedium) return true;

    return this.compatibilityMatrix[fromMedium]?.[toMedium] === true;
  }

  /**
   * Check if a style is compatible with a medium
   * @param {string} medium - Medium type
   * @param {string} style - Style name
   * @returns {boolean} True if style is compatible
   */
  isStyleCompatible(medium, style) {
    if (!this.validMediums.includes(medium)) {
      return false;
    }

    const supportedStyles = this.styleCompatibility[medium] || [];
    return supportedStyles.includes(style);
  }

  /**
   * Estimate cost of transformation as percentage of original (0.05-1.0)
   * @param {Object} changes - Result from detectChanges()
   * @returns {number} Cost multiplier (0.05 = 5%, 1.0 = 100% regen needed)
   */
  estimateCost(changes) {
    if (!changes || typeof changes !== "object") {
      throw new OverrideError("Changes object required", { statusCode: 400 });
    }

    let cost = 0.0;

    // Medium change costs the most (full layout regeneration)
    if (changes.changedMedium) {
      cost += 1.0; // 100% = full regeneration
    }

    // Style change: significant cost
    if (changes.changedStyle && !changes.changedMedium) {
      cost += 0.4; // 40% of original cost
    }

    // Color change: minimal cost (simple remap)
    if (changes.changedColors && !changes.changedStyle) {
      cost += 0.05; // 5% of original cost
    }

    // Theme change: moderate cost
    if (
      changes.changedTheme &&
      !changes.changedStyle &&
      !changes.changedMedium
    ) {
      cost += 0.2; // 20% of original cost
    }

    // Cap at 1.0 (never exceed 100%)
    return Math.min(cost, 1.0);
  }

  /**
   * Apply layout transform for medium change
   * @param {Object} output - Original output
   * @param {string} fromMedium - Source medium
   * @param {string} toMedium - Target medium
   * @returns {Object} Transformed output
   * @private
   */
  _applyLayoutTransform(output, fromMedium, toMedium) {
    if (fromMedium === toMedium) return output;

    // Create layout-adjusted output
    // This is a simplified transformation - real implementation would handle
    // aspect ratios, page counts, grid layouts, etc.
    const transformed = JSON.parse(JSON.stringify(output));

    // Add metadata about the transformation
    transformed.layoutTransformed = true;
    transformed.originalMedium = fromMedium;
    transformed.targetMedium = toMedium;

    return transformed;
  }

  /**
   * Apply style transform (colors + fonts)
   * @param {Object} output - Original output
   * @param {string} oldStyle - Old style
   * @param {string} newStyle - New style
   * @param {Object} classification - Classification with color info
   * @returns {Object} Transformed output
   * @private
   */
  _applyStyleTransform(output, oldStyle, newStyle, classification) {
    const transformed = JSON.parse(JSON.stringify(output));

    // Apply style-specific transformations
    transformed.styleTransformed = true;
    transformed.oldStyle = oldStyle;
    transformed.newStyle = newStyle;

    // Style transformations would include:
    // - Font adjustments
    // - Spacing changes
    // - Border/decoration styles

    return transformed;
  }

  /**
   * Apply color transform (remap colors)
   * @param {Object} output - Original output
   * @param {string} oldPalette - Old color palette
   * @param {string} newPalette - New color palette
   * @returns {Object} Transformed output
   * @private
   */
  _applyColorTransform(output, oldPalette, newPalette) {
    const transformed = JSON.parse(JSON.stringify(output));

    // Simple color remapping
    transformed.colorTransformed = true;
    transformed.oldPalette = oldPalette;
    transformed.newPalette = newPalette;

    // Color transformations are the simplest:
    // - Vibrant → muted: reduce saturation
    // - Warm → cool: adjust hue
    // - etc.

    return transformed;
  }

  /**
   * Apply override transformation to output
   * @param {Object} output - Original generated output
   * @param {Object} oldClassification - Previous classification
   * @param {Object} newClassification - New classification
   * @returns {Object} { output, costMultiplier, changedDimensions }
   */
  applyOverride(output, oldClassification, newClassification) {
    if (!output || typeof output !== "object") {
      throw new OverrideError("Valid output object required", {
        statusCode: 400,
      });
    }

    // Step 1: Detect changes
    const changes = this.detectChanges(oldClassification, newClassification);

    // Step 2: Validate compatibility (if medium is changing)
    if (changes.changedMedium) {
      if (!this.canTransform(changes.oldMedium, changes.newMedium)) {
        throw new OverrideError(
          `Cannot transform from ${changes.oldMedium} to ${changes.newMedium}`,
          { statusCode: 400 }
        );
      }
    }

    // Step 3: Validate style compatibility
    if (changes.changedStyle) {
      if (
        !this.isStyleCompatible(
          newClassification.medium,
          newClassification.style
        )
      ) {
        throw new OverrideError(
          `Style "${newClassification.style}" not compatible with ${newClassification.medium}`,
          { statusCode: 400 }
        );
      }
    }

    // Step 4: Calculate cost
    const costMultiplier = this.estimateCost(changes);

    // Step 5: Apply transformations in order
    let transformed = output;

    if (changes.changedMedium) {
      transformed = this._applyLayoutTransform(
        transformed,
        changes.oldMedium,
        changes.newMedium
      );
    }

    if (changes.changedStyle) {
      transformed = this._applyStyleTransform(
        transformed,
        changes.oldStyle,
        changes.newStyle,
        newClassification
      );
    }

    if (changes.changedColors) {
      transformed = this._applyColorTransform(
        transformed,
        changes.oldColorPalette,
        changes.newColorPalette
      );
    }

    return {
      output: transformed,
      costMultiplier,
      changedDimensions: {
        medium: changes.changedMedium,
        style: changes.changedStyle,
        colors: changes.changedColors,
        theme: changes.changedTheme,
      },
    };
  }

  /**
   * Get all valid mediums
   * @returns {Array<string>} List of valid mediums
   */
  getValidMediums() {
    return [...this.validMediums];
  }

  /**
   * Get styles compatible with a medium
   * @param {string} medium - Medium type
   * @returns {Array<string>} List of compatible styles
   */
  getCompatibleStyles(medium) {
    if (!this.validMediums.includes(medium)) {
      throw new OverrideError(`Invalid medium: ${medium}`, {
        statusCode: 400,
      });
    }

    return [...(this.styleCompatibility[medium] || [])];
  }

  /**
   * Get mediums that a given medium can transform to
   * @param {string} fromMedium - Source medium
   * @returns {Array<string>} List of compatible target mediums
   */
  getCompatibleTransforms(fromMedium) {
    if (!this.validMediums.includes(fromMedium)) {
      throw new OverrideError(`Invalid medium: ${fromMedium}`, {
        statusCode: 400,
      });
    }

    return this.validMediums.filter((medium) =>
      this.canTransform(fromMedium, medium)
    );
  }
}

// Export
module.exports = { OverrideSystem, OverrideError };
