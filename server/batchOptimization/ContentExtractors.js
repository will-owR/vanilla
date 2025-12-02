/**
 * ContentExtractors
 *
 * Extract narrative voice, tone, and summaries from generated content.
 * Used to build unified batch context from Page 1.
 */

class ContentExtractors {
  /**
   * Extract summary from page content
   * Strategy: First 2-3 sentences or first 300 characters
   *
   * @param {string} content - Page content
   * @returns {string} - Summary (150-300 chars)
   */
  static extractSummary(content) {
    if (!content) return "";

    // Split by sentences (simplified: period followed by space)
    const sentences = content.split(/\.\s+/).slice(0, 2);
    let summary = sentences.join(". ").trim();

    // Add period if missing
    if (summary && !summary.endsWith(".")) {
      summary += ".";
    }

    // Truncate to max 300 chars
    if (summary.length > 300) {
      summary = summary.substring(0, 297) + "...";
    }

    return summary;
  }

  /**
   * Detect narrative voice
   * Detects: First-person vs Third-person, Formal vs Conversational
   *
   * @param {string} content - Page content
   * @returns {string} - Voice description (e.g., "first-person, conversational")
   */
  static extractVoice(content) {
    if (!content) return "unknown";

    const firstPersonMatches =
      content.match(/\bI\s|my\s|me\s|we\s|our\s/gi) || [];
    const thirdPersonMatches =
      content.match(/\bhe\s|she\s|they\s|his\s|her\s|their\s/gi) || [];

    const perspective =
      firstPersonMatches.length > thirdPersonMatches.length
        ? "first-person"
        : "third-person";

    // Detect formality
    const formalWords =
      content.match(
        /shall|ought|henceforth|verily|aforementioned|endeavor|hence/gi
      ) || [];
    const casualWords =
      content.match(/gonna|wanna|yeah|nope|kinda|sorta/gi) || [];

    const formality =
      formalWords.length > casualWords.length ? "formal" : "conversational";

    return `${perspective}, ${formality}`;
  }

  /**
   * Detect emotional tone
   * Detects: Humorous, Serious, Romantic, Dark, Neutral, etc.
   *
   * @param {string} content - Page content
   * @returns {string} - Tone description (e.g., "serious, dark")
   */
  static extractTone(content) {
    if (!content) return "neutral";

    const toneIndicators = {
      humorous: /joke|laugh|funny|witty|chuckle|grin|chuckled|laughed/gi,
      serious: /grave|solemn|dire|critical|gravely|earnestly/gi,
      romantic: /love|passion|heart|tender|affection|beloved|cherish/gi,
      dark: /shadow|grim|despair|horror|sinister|dread|ominous/gi,
      hopeful: /hope|inspire|triumph|victory|overcome|bright|light/gi,
      melancholic: /sorrow|sadness|mourned|grief|lonely|desolate/gi,
    };

    const detectedTones = Object.entries(toneIndicators)
      .filter(([toneKey]) => toneIndicators[toneKey].test(content))
      .map(([tone]) => tone)
      .slice(0, 2); // Top 2 tones

    return detectedTones.length > 0 ? detectedTones.join(", ") : "neutral";
  }

  /**
   * Extract key themes/concepts
   * Uses: Keyword frequency, thematic language
   *
   * @param {string} content - Page content
   * @returns {Array<string>} - List of themes (e.g., ["love", "betrayal", "redemption"])
   */
  static extractThemes(content) {
    if (!content) return [];

    const themePatterns = {
      love: /love|passion|romantic|affection/gi,
      betrayal: /betray|trust|deceit|backstab/gi,
      redemption: /redeem|forgive|atone|salvation/gi,
      conflict: /fight|battle|war|clash|struggle/gi,
      mystery: /mystery|secret|hidden|unknown|riddle/gi,
      journey: /journey|travel|quest|adventure|discover/gi,
      loss: /loss|lost|grief|mourn|death/gi,
      growth: /grow|change|evolve|transform|develop/gi,
    };

    const themes = Object.entries(themePatterns)
      .filter(([themeKey]) => {
        const regex = themePatterns[themeKey];
        const matches = content.match(regex) || [];
        return matches.length >= 2; // At least 2 mentions
      })
      .map(([theme]) => theme);

    return themes;
  }

  /**
   * Extract character names and descriptions
   * Uses: NER (named entity recognition) heuristics
   *
   * @param {string} content - Page content
   * @returns {Object} - {name: description, ...}
   */
  static extractCharacters(content) {
    if (!content) return {};

    // Simple NER heuristic: Capitalized words
    const characters = {};

    const properNounsPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;

    let match;
    const nameFrequency = {};

    while ((match = properNounsPattern.exec(content)) !== null) {
      const name = match[1];
      // Skip common non-character words
      if (
        !["The", "A", "An", "I", "He", "She", "It", "We", "They"].includes(name)
      ) {
        nameFrequency[name] = (nameFrequency[name] || 0) + 1;
      }
    }

    // Extract top characters (mentioned 2+ times)
    Object.entries(nameFrequency)
      .filter(([, count]) => count >= 2)
      .slice(0, 5) // Top 5 characters
      .forEach(([name]) => {
        // Try to find description near character name
        const regex = new RegExp(`${name}[^.!?]{0,200}[.!?]`, "i");
        const descMatch = content.match(regex);
        characters[name] = descMatch ? descMatch[0].substring(0, 150) : "";
      });

    return characters;
  }
}

module.exports = { ContentExtractors };
