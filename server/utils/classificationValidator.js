/**
 * Classification Validator - Phase A-B Module 5
 *
 * Validates and merges classifications from rule engine + LLM
 * - Validates individual classifications (required fields, value ranges)
 * - Merges rule + AI classifications intelligently
 * - Handles disagreement/conflicts
 * - Ensures consistency and prevents invalid states
 *
 * Merge Strategy:
 * - If rule + AI agree: high confidence hybrid
 * - If disagreement: trust AI if AI confidence > 0.8, else rule
 * - Track conflicts for Phase B analysis/improvement
 */

/**
 * @typedef {Object} Classification
 * @property {string} medium
 * @property {string} style
 * @property {string[]} theme
 * @property {string} [audience]
 * @property {string} [genre]
 * @property {string} [tone]
 * @property {string} colorPalette
 * @property {number} confidence
 * @property {string} source - "rules", "ai", "hybrid"
 */

class ClassificationValidator {
  constructor() {
    this.validMediums = [
      "ebook",
      "calendar",
      "poster",
      "stickers",
      "greeting-card",
      "journal",
      "app-ui",
      "wall-art",
      "other",
    ];
    this.validStyles = [
      "minimalist",
      "gothic",
      "whimsical",
      "folk-art",
      "surrealist",
      "retro-vintage",
      "modern-flat",
      "ornate",
      "illustrative",
      "photorealistic",
      "other",
    ];
    this.validColorPalettes = [
      "vibrant",
      "muted",
      "dark",
      "earthy",
      "pastel",
      "nostalgic",
    ];
    this.validAudiences = [
      "children",
      "teens",
      "adults",
      "educators",
      "professionals",
      "general",
    ];
    this.validGenres = [
      "poetry",
      "tutorial",
      "narrative",
      "reference",
      "journal",
      "creative-writing",
      "educational",
      "commercial",
      "other",
    ];
    this.validTones = [
      "whimsical",
      "serious",
      "reflective",
      "energetic",
      "sarcastic",
      "inspirational",
      "academic",
      "casual",
      "other",
    ];
  }

  /**
   * Validate a single classification
   * @param {Classification} classification
   * @returns {boolean}
   */
  validate(classification) {
    if (!classification || typeof classification !== "object") {
      return false;
    }

    // Check required fields
    if (
      !classification.medium ||
      !classification.style ||
      !classification.colorPalette
    ) {
      return false;
    }

    // Validate medium
    if (!this.validMediums.includes(classification.medium)) {
      return false;
    }

    // Validate style
    if (!this.validStyles.includes(classification.style)) {
      return false;
    }

    // Validate colorPalette
    if (!this.validColorPalettes.includes(classification.colorPalette)) {
      return false;
    }

    // Validate confidence
    if (
      typeof classification.confidence !== "number" ||
      classification.confidence < 0 ||
      classification.confidence > 1
    ) {
      return false;
    }

    // Validate theme (must be array)
    if (!Array.isArray(classification.theme)) {
      return false;
    }

    // Validate optional fields if present
    if (
      classification.audience &&
      !this.validAudiences.includes(classification.audience)
    ) {
      return false;
    }

    if (
      classification.genre &&
      !this.validGenres.includes(classification.genre)
    ) {
      return false;
    }

    if (classification.tone && !this.validTones.includes(classification.tone)) {
      return false;
    }

    return true;
  }

  /**
   * Merge rule engine + LLM classifications
   * @param {Classification} ruleResult - From rule engine
   * @param {Classification} aiResult - From LLM
   * @returns {Classification}
   */
  merge(ruleResult, aiResult) {
    // If either is invalid, return the other
    if (!this.validate(ruleResult) && !this.validate(aiResult)) {
      return this.getDefaultClassification();
    }

    if (!this.validate(ruleResult)) {
      return { ...aiResult, source: "ai", sources: { ai: aiResult } };
    }

    if (!this.validate(aiResult)) {
      return { ...ruleResult, source: "rules", sources: { rule: ruleResult } };
    }

    // Both valid: merge intelligently
    const agreement = this.detectAgreement(ruleResult, aiResult);

    if (agreement.mediumAgrees && agreement.styleAgrees) {
      // Strong agreement: high confidence hybrid
      return {
        medium: aiResult.medium,
        style: aiResult.style,
        theme: this.mergeThemes(ruleResult.theme, aiResult.theme),
        audience: aiResult.audience || ruleResult.audience,
        genre: aiResult.genre || ruleResult.genre,
        tone: aiResult.tone || ruleResult.tone,
        colorPalette: aiResult.colorPalette || ruleResult.colorPalette,
        confidence: Math.max(ruleResult.confidence, aiResult.confidence),
        source: "hybrid",
        sources: { rule: ruleResult, ai: aiResult, agreement: "strong" },
      };
    }

    // Partial or no agreement
    if (agreement.mediumAgrees || aiResult.confidence < 0.75) {
      // Rule was right or AI uncertain: trust rule
      return {
        ...ruleResult,
        source: "hybrid",
        confidence: ruleResult.confidence * 0.95, // Slight penalty
        sources: {
          rule: ruleResult,
          ai: aiResult,
          agreement: agreement.mediumAgrees ? "medium-only" : "partial",
          conflict: true,
        },
      };
    }

    // AI confidence high but disagrees: trust AI
    return {
      ...aiResult,
      source: "hybrid",
      confidence: aiResult.confidence * 0.85, // Penalty for disagreement
      sources: {
        rule: ruleResult,
        ai: aiResult,
        agreement: "conflict",
        resolved_to: "ai",
      },
    };
  }

  /**
   * Detect agreement between rule and AI results
   * @private
   * @param {Classification} ruleResult
   * @param {Classification} aiResult
   * @returns {Object}
   */
  detectAgreement(ruleResult, aiResult) {
    return {
      mediumAgrees: ruleResult.medium === aiResult.medium,
      styleAgrees: ruleResult.style === aiResult.style,
      colorAgrees: ruleResult.colorPalette === aiResult.colorPalette,
      themeOverlap: this.calculateThemeOverlap(
        ruleResult.theme,
        aiResult.theme
      ),
    };
  }

  /**
   * Calculate overlap between theme arrays
   * @private
   * @param {string[]} themes1
   * @param {string[]} themes2
   * @returns {number} Overlap ratio (0-1)
   */
  calculateThemeOverlap(themes1, themes2) {
    if (themes1.length === 0 && themes2.length === 0) return 1.0;
    if (themes1.length === 0 || themes2.length === 0) return 0.0;

    const overlap = themes1.filter((t) => themes2.includes(t)).length;
    const total = new Set([...themes1, ...themes2]).size;

    return total > 0 ? overlap / total : 0;
  }

  /**
   * Merge theme arrays intelligently
   * @private
   * @param {string[]} themes1
   * @param {string[]} themes2
   * @returns {string[]}
   */
  mergeThemes(themes1, themes2) {
    const merged = new Set([...themes1, ...themes2]);
    return Array.from(merged).slice(0, 5); // Max 5 themes
  }

  /**
   * Get default classification (fallback)
   * @private
   * @returns {Classification}
   */
  getDefaultClassification() {
    return {
      medium: "ebook",
      style: "minimalist",
      theme: [],
      colorPalette: "muted",
      confidence: 0.5,
      source: "default",
    };
  }

  /**
   * Sanitize classification (ensure all values are valid)
   * @param {Classification} classification
   * @returns {Classification}
   */
  sanitize(classification) {
    if (!classification) {
      return this.getDefaultClassification();
    }

    return {
      medium: this.validMediums.includes(classification.medium)
        ? classification.medium
        : "ebook",
      style: this.validStyles.includes(classification.style)
        ? classification.style
        : "minimalist",
      theme: Array.isArray(classification.theme)
        ? classification.theme.slice(0, 5)
        : [],
      audience:
        !classification.audience ||
        this.validAudiences.includes(classification.audience)
          ? classification.audience
          : "general",
      genre:
        !classification.genre || this.validGenres.includes(classification.genre)
          ? classification.genre
          : undefined,
      tone:
        !classification.tone || this.validTones.includes(classification.tone)
          ? classification.tone
          : undefined,
      colorPalette: this.validColorPalettes.includes(
        classification.colorPalette
      )
        ? classification.colorPalette
        : "muted",
      confidence:
        typeof classification.confidence === "number"
          ? Math.max(0, Math.min(1, classification.confidence))
          : 0.5,
      source: classification.source || "unknown",
    };
  }

  /**
   * Get all valid options for a dimension
   * @param {string} dimension - "mediums", "styles", "colorPalettes", etc.
   * @returns {string[]}
   */
  getValidOptions(dimension) {
    const dimensionMap = {
      mediums: this.validMediums,
      styles: this.validStyles,
      colorPalettes: this.validColorPalettes,
      audiences: this.validAudiences,
      genres: this.validGenres,
      tones: this.validTones,
    };

    return dimensionMap[dimension] || [];
  }
}

// Export singleton instance
const classificationValidatorInstance = new ClassificationValidator();

module.exports = {
  ClassificationValidator,
  classificationValidatorInstance,
};
