/**
 * LLM Classifier - Phase A-B Module 4
 *
 * Gemini-based fallback classification for prompt enrichment
 * - Fast-path: rule engine (Module 3)
 * - Fallback: LLM classification when confidence < threshold
 *
 * Uses Google Gemini API for:
 * - Medium classification (ebook, calendar, poster, etc.)
 * - Style extraction (whimsical, gothic, minimalist, etc.)
 * - Theme/mood identification
 * - Audience & tone detection
 * - Color palette suggestion
 *
 * Cost Control:
 * - Only triggered when rule engine confidence < 0.8 (< 20% of requests)
 * - Lightweight prompt (no examples, fast token usage)
 * - Cached results in classification layer
 */

/**
 * @typedef {Object} Classification
 * @property {string} medium - Medium type (ebook, calendar, poster, etc.)
 * @property {string} style - Visual style (whimsical, gothic, minimalist, etc.)
 * @property {string[]} theme - Array of themes/moods
 * @property {string} [audience] - Target audience (children, adults, professionals, etc.)
 * @property {string} [genre] - Content genre (poetry, tutorial, narrative, etc.)
 * @property {string} [tone] - Writing tone (reflective, energetic, sarcastic, etc.)
 * @property {string} colorPalette - Color scheme (vibrant, muted, dark, earthy, pastel, nostalgic)
 * @property {number} confidence - Confidence score (0-1)
 * @property {string} source - Source of classification ("ai", "rules", "hybrid")
 */

let geminiClient = null;

/**
 * Get or initialize Gemini client
 * @private
 */
function getGeminiClient() {
  if (!geminiClient) {
    try {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.warn(
          "GEMINI_API_KEY not set. LLM classifier will not be available."
        );
        return null;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      geminiClient = genAI.getGenerativeModel({ model: "gemini-pro" });
    } catch (error) {
      console.error("Failed to initialize Gemini client:", error.message);
      return null;
    }
  }
  return geminiClient;
}

class LLMClassifier {
  /**
   * Classify a prompt using Gemini
   * @param {string} prompt - User prompt to classify
   * @returns {Promise<Classification|null>} Classification or null on error
   */
  async classify(prompt) {
    const client = getGeminiClient();
    if (!client) {
      console.warn("Gemini client unavailable, skipping LLM classification");
      return null;
    }

    try {
      const systemPrompt = this.buildSystemPrompt();
      const fullPrompt = systemPrompt + "\n\nUser Prompt:\n" + prompt;

      // Call Gemini with conservative settings for consistency
      const result = await client.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: fullPrompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.3, // Low temperature for consistency
          topP: 0.9,
        },
      });

      const responseText = result.response.text();
      const classification = this.parseResponse(responseText);

      if (classification) {
        classification.source = "ai";
        return classification;
      }

      return null;
    } catch (error) {
      console.warn(
        "LLM classification failed, falling back to rules:",
        error.message
      );
      return null;
    }
  }

  /**
   * Build system prompt for Gemini
   * @private
   * @returns {string}
   */
  buildSystemPrompt() {
    return `You are an artistic director and creative classification expert. 
Analyze the user's prompt and classify it across multiple dimensions.

Return a JSON object with EXACTLY this structure (and only JSON, no other text):
{
  "medium": "ebook" | "calendar" | "poster" | "stickers" | "greeting-card" | "journal" | "app-ui" | "wall-art" | "other",
  "style": "minimalist" | "gothic" | "whimsical" | "folk-art" | "surrealist" | "retro-vintage" | "modern-flat" | "ornate" | "illustrative" | "photorealistic" | "other",
  "theme": ["theme1", "theme2", "theme3"],
  "audience": "children" | "teens" | "adults" | "educators" | "professionals" | "general",
  "genre": "poetry" | "tutorial" | "narrative" | "reference" | "journal" | "creative-writing" | "educational" | "commercial" | "other",
  "tone": "whimsical" | "serious" | "reflective" | "energetic" | "sarcastic" | "inspirational" | "academic" | "casual" | "other",
  "colorPalette": "vibrant" | "muted" | "dark" | "earthy" | "pastel" | "nostalgic",
  "confidence": 0.85
}

Choose only from the listed options. Be conservative with confidence (0.0-1.0 range).
For themes, provide 1-3 most relevant themes from: playful-colors, magical-realism, dark-tones, ornate-details, earthy-textures, minimalist-zen, tech-futuristic, nature-inspired, vintage-retro, bold-geometric, soft-dreamy, luxury-premium, cultural-diverse, whimsical-creatures, moody-atmospheric`;
  }

  /**
   * Parse and validate Gemini response
   * @private
   * @param {string} responseText - Raw response from Gemini
   * @returns {Classification|null}
   */
  parseResponse(responseText) {
    try {
      // Try to extract JSON from response (in case there's surrounding text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("No JSON found in Gemini response");
        return null;
      }

      const json = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!json.medium || !json.style || !json.colorPalette) {
        console.warn("Missing required fields in Gemini response");
        return null;
      }

      // Ensure confidence is in valid range
      const confidence =
        typeof json.confidence === "number" ? json.confidence : 0.7;
      json.confidence = Math.max(0, Math.min(1, confidence));

      // Ensure theme is an array
      if (!Array.isArray(json.theme)) {
        json.theme = json.theme ? [String(json.theme)] : [];
      }

      return json;
    } catch (error) {
      console.warn("Failed to parse Gemini response:", error.message);
      return null;
    }
  }

  /**
   * Validate a classification object
   * @param {Classification} classification
   * @returns {boolean}
   */
  isValid(classification) {
    if (!classification) return false;

    // Check required fields exist
    const required = ["medium", "style", "colorPalette", "confidence"];
    for (const field of required) {
      if (!classification[field]) return false;
    }

    // Validate confidence range
    if (
      typeof classification.confidence !== "number" ||
      classification.confidence < 0 ||
      classification.confidence > 1
    ) {
      return false;
    }

    // Validate theme is array
    if (!Array.isArray(classification.theme)) {
      return false;
    }

    return true;
  }

  /**
   * Test Gemini connectivity (for diagnostics)
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const result = await this.classify("test prompt for connectivity");
      return result !== null;
    } catch (error) {
      console.error("Gemini connectivity test failed:", error.message);
      return false;
    }
  }
}

// Export singleton instance
const llmClassifierInstance = new LLMClassifier();

module.exports = {
  LLMClassifier,
  llmClassifierInstance,
};
