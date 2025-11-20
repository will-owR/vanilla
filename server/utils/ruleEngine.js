/**
 * Rule Engine - Phase A-B Module 3
 *
 * Fast-path prompt classification using keyword extraction + scoring
 * - Tokenizes prompt into searchable tokens
 * - Scores against keyword database (Module 2)
 * - Applies semantic rules for refinement
 * - Returns classification with confidence score
 *
 * Target: >80% accuracy, <10ms latency
 * Fallback: LLM classifier (Module 4) when confidence < 0.8
 *
 * Algorithm:
 * 1. Tokenize prompt (split, lowercase, filter by length)
 * 2. Score against keywords (mediums, styles, themes)
 * 3. Extract top matches (weighted by frequency)
 * 4. Apply semantic rules (decision rules for edge cases)
 * 5. Calculate confidence based on score distribution
 * 6. Return classification with source="rules"
 */

const {
  KeywordDatabaseAPI,
  keywordDatabase: keywordData,
} = require("./keywordDatabase.js");

/**
 * @typedef {Object} Classification
 * @property {string} medium - Medium type (ebook, calendar, etc.)
 * @property {string} style - Visual style (whimsical, gothic, etc.)
 * @property {string[]} theme - Array of themes/moods
 * @property {string} [audience] - Target audience
 * @property {string} [genre] - Content genre
 * @property {string} [tone] - Writing tone
 * @property {string} colorPalette - Color scheme
 * @property {number} confidence - Confidence score (0-1)
 * @property {string} source - "rules"
 */

class RuleEngine {
  constructor(keywordDatabase = keywordData) {
    this.keywordDB = new KeywordDatabaseAPI(keywordDatabase);
    this.semanticRules = this.initializeSemanticRules();
  }

  /**
   * Extract and classify prompt
   * @param {string} prompt - User prompt to classify
   * @returns {Classification}
   */
  extract(prompt) {
    if (!prompt || !String(prompt).trim()) {
      return this.getDefaultClassification(0.0);
    }

    // STEP 1: Tokenize
    const tokens = this.tokenizePrompt(prompt);
    if (tokens.length === 0) {
      return this.getDefaultClassification(0.0);
    }

    // STEP 2: Score keywords
    const scores = this.scoreTokens(tokens);

    // STEP 3: Extract top matches
    const extracted = {
      medium: this.topMatch(scores.mediums),
      style: this.topMatch(scores.styles),
      themes: this.topMatches(scores.themes, 3),
      colorPalette: this.inferColorPalette(scores.styles, tokens),
    };

    // STEP 4: Apply semantic rules
    const refined = this.applySemanticRules(extracted, tokens, scores);

    // STEP 5: Calculate confidence
    const confidence = this.calculateConfidence(scores);

    return {
      medium: refined.medium,
      style: refined.style,
      theme: refined.themes,
      colorPalette: refined.colorPalette,
      confidence,
      source: "rules",
    };
  }

  /**
   * Tokenize prompt into searchable tokens
   * @private
   * @param {string} prompt
   * @returns {string[]}
   */
  tokenizePrompt(prompt) {
    return prompt
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 2 && token.length < 50);
  }

  /**
   * Score tokens against keyword database
   * @private
   * @param {string[]} tokens
   * @returns {Object} Scores for mediums, styles, themes
   */
  scoreTokens(tokens) {
    const scores = {
      mediums: {},
      styles: {},
      themes: {},
    };

    // Get all keywords from DB
    const mediumKeywords = this.keywordDB.getKeywords("mediums");
    const styleKeywords = this.keywordDB.getKeywords("styles");
    const themeKeywords = this.keywordDB.getKeywords("themes");

    tokens.forEach((token) => {
      // Check mediums
      for (const [medium, keywords] of Object.entries(mediumKeywords)) {
        if (keywords.some((kw) => this.matchToken(token, kw))) {
          scores.mediums[medium] = (scores.mediums[medium] || 0) + 1;
        }
      }

      // Check styles
      for (const [style, keywords] of Object.entries(styleKeywords)) {
        if (keywords.some((kw) => this.matchToken(token, kw))) {
          scores.styles[style] = (scores.styles[style] || 0) + 1;
        }
      }

      // Check themes
      for (const [theme, keywords] of Object.entries(themeKeywords)) {
        if (keywords.some((kw) => this.matchToken(token, kw))) {
          scores.themes[theme] = (scores.themes[theme] || 0) + 1;
        }
      }
    });

    return scores;
  }

  /**
   * Match token against keyword (flexible matching)
   * @private
   * @param {string} token - Token from prompt
   * @param {string} keyword - Keyword from database
   * @returns {boolean}
   */
  matchToken(token, keyword) {
    // Normalize to lowercase
    const t = token.toLowerCase();
    const k = keyword.toLowerCase();

    // Exact match
    if (t === k) return true;

    // Substring match (for compound keywords like "wall-art")
    if (k.includes(t)) return true;

    // Token is start of keyword (e.g., "ebook" matches "e-book")
    if (k.startsWith(t)) return true;

    // Levenshtein-like simple fuzzy (if token is >90% similar)
    if (t.length >= 4 && this.similarity(t, k) > 0.9) return true;

    return false;
  }

  /**
   * Simple string similarity (0-1)
   * @private
   * @param {string} str1
   * @param {string} str2
   * @returns {number}
   */
  similarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance (simple edit distance)
   * @private
   * @param {string} s1
   * @param {string} s2
   * @returns {number}
   */
  levenshteinDistance(s1, s2) {
    const costs = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }

    return costs[s2.length];
  }

  /**
   * Get top match from scores
   * @private
   * @param {Object} scores - Key -> count map
   * @returns {string}
   */
  topMatch(scores) {
    const entries = Object.entries(scores);
    if (entries.length === 0) return "other";

    return entries.reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  }

  /**
   * Get top N matches from scores
   * @private
   * @param {Object} scores
   * @param {number} limit
   * @returns {string[]}
   */
  topMatches(scores, limit = 3) {
    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key]) => key);
  }

  /**
   * Infer color palette from style and tokens
   * @private
   * @param {Object} styleScores
   * @param {string[]} tokens
   * @returns {string}
   */
  inferColorPalette(styleScores, tokens) {
    const colorHints = {
      vibrant: ["bright", "colorful", "vivid", "bold"],
      muted: ["soft", "subtle", "pale", "pastel"],
      dark: ["dark", "black", "shadow", "midnight"],
      earthy: ["earth", "brown", "natural", "rustic"],
      pastel: ["pastel", "soft", "pale", "light"],
      nostalgic: ["vintage", "retro", "old", "classic"],
    };

    // Count color hint matches (weight=3 for direct color hints)
    const colorScores = {};
    for (const [palette, hints] of Object.entries(colorHints)) {
      colorScores[palette] =
        hints.filter((hint) => tokens.some((token) => token.includes(hint)))
          .length * 3; // Boost direct color hints
    }

    // Also consider style-to-palette mapping (weight=2 for style inference)
    const styleHints = {
      gothic: "dark",
      retro: "nostalgic",
      modern: "vibrant",
      minimalist: "muted",
      whimsical: "pastel",
      folk: "earthy",
    };

    const topStyle = this.topMatch(styleScores);
    if (styleHints[topStyle]) {
      colorScores[styleHints[topStyle]] =
        (colorScores[styleHints[topStyle]] || 0) + 2;
    }

    const topPalette = this.topMatch(colorScores);
    return topPalette === "other" ? "vibrant" : topPalette;
  }

  /**
   * Apply semantic rules to refine classification
   * @private
   * @param {Object} extracted
   * @param {string[]} tokens
   * @param {Object} scores
   * @returns {Object}
   */
  applySemanticRules(extracted, tokens, scores) {
    let refined = { ...extracted };

    for (const rule of this.semanticRules) {
      if (rule.condition(tokens, extracted, scores)) {
        refined = { ...refined, ...rule.result };
      }
    }

    return refined;
  }

  /**
   * Initialize semantic decision rules
   * @private
   * @returns {Array}
   */
  initializeSemanticRules() {
    return [
      {
        condition: (tokens) =>
          tokens.some((t) => ["children", "kid", "young"].includes(t)) &&
          tokens.some((t) => ["playful", "fun", "cute"].includes(t)),
        result: {
          colorPalette: "vibrant",
          style: "whimsical",
        },
      },
      {
        condition: (tokens) =>
          tokens.includes("dark") && tokens.includes("mysterious"),
        result: {
          style: "gothic",
          colorPalette: "dark",
        },
      },
      {
        condition: (tokens) =>
          tokens.some((t) =>
            ["minimal", "simple", "clean", "minimal", "zen"].includes(t)
          ),
        result: {
          style: "minimalist",
          colorPalette: "muted",
        },
      },
      {
        condition: (tokens) =>
          tokens.some((t) =>
            ["fantasy", "magic", "magical", "wizard", "spell"].includes(t)
          ),
        result: {
          themes: ["magical-realism"],
          colorPalette: "pastel",
        },
      },
      {
        condition: (tokens) =>
          tokens.some((t) =>
            ["professional", "corporate", "business", "formal"].includes(t)
          ),
        result: {
          style: "modern-flat",
          colorPalette: "muted",
          audience: "professionals",
        },
      },
      {
        condition: (tokens) =>
          tokens.some((t) =>
            ["vintage", "retro", "nostalgic", "80s", "70s", "90s"].includes(t)
          ),
        result: {
          style: "retro-vintage",
          colorPalette: "nostalgic",
        },
      },
      {
        condition: (tokens) =>
          tokens.some((t) =>
            [
              "tech",
              "digital",
              "cyber",
              "future",
              "futuristic",
              "ai",
              "robot",
            ].includes(t)
          ),
        result: {
          style: "modern-flat",
          colorPalette: "vibrant",
          themes: ["tech-futuristic"],
        },
      },
    ];
  }

  /**
   * Calculate confidence based on score distribution
   * @private
   * @param {Object} scores
   * @returns {number}
   */
  calculateConfidence(scores) {
    const mediumScores = Object.values(scores.mediums);
    const styleScores = Object.values(scores.styles);

    if (mediumScores.length === 0 || styleScores.length === 0) {
      return 0.3; // Low confidence when no keywords matched
    }

    // Base confidence from max scores
    const maxMedium = Math.max(...mediumScores);
    const maxStyle = Math.max(...styleScores);

    // Confidence = (max score / total tokens) normalized
    const totalTokens =
      mediumScores.reduce((a, b) => a + b, 0) +
      styleScores.reduce((a, b) => a + b, 0);
    const baseConfidence =
      Math.max(maxMedium, maxStyle) / Math.max(totalTokens, 1);

    // Penalize if multiple strong contenders (ambiguity)
    const mediumContenders = Object.values(scores.mediums).filter(
      (score) => score >= maxMedium * 0.7
    ).length;
    const styleContenders = Object.values(scores.styles).filter(
      (score) => score >= maxStyle * 0.7
    ).length;

    const ambiguityPenalty =
      (mediumContenders - 1) * 0.1 + (styleContenders - 1) * 0.05;

    const confidence = Math.max(
      0,
      Math.min(1, baseConfidence - ambiguityPenalty)
    );

    return parseFloat(confidence.toFixed(2));
  }

  /**
   * Get default classification
   * @private
   * @param {number} confidence
   * @returns {Classification}
   */
  getDefaultClassification(confidence = 0.0) {
    return {
      medium: "ebook",
      style: "minimalist",
      theme: [],
      colorPalette: "muted",
      confidence,
      source: "rules",
    };
  }
}

// Export singleton instance
const ruleEngineInstance = new RuleEngine(keywordData);

module.exports = {
  RuleEngine,
  ruleEngineInstance,
};
