/**
 * ContentChunker Module - Phase B
 * Analyzes prompt text, extracts topics via NLP, estimates content density,
 * and calculates intelligent chapter distribution.
 *
 * Dependencies: (compromise.js will be added to package.json)
 * - Topic extraction via keyword analysis
 * - Density classification (light/medium/dense)
 * - Chapter distribution based on target page count
 */

class ContentChunker {
  /**
   * Analyze prompt and return chunked structure
   * @param {string} prompt - Input prompt text
   * @param {Object} [options] - Configuration options (all optional)
   * @param {number} [options.targetPageCount] - Desired page count (3-20), default 8
   * @param {number} [options.maxChapters] - Max chapters (default 8)
   * @param {number} [options.minChaptersForPages] - Min chapters per page type (default 1)
   * @returns {Promise<Object>} ChunkedContent with chapters, structure, density
   */
  async analyze(prompt, options = {}) {
    // Input validation
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new Error("ContentChunker: prompt must be a non-empty string");
    }

    const targetPageCount = options.targetPageCount || 8;
    if (targetPageCount < 3 || targetPageCount > 20) {
      throw new Error(
        "ContentChunker: targetPageCount must be between 3 and 20"
      );
    }

    const maxChapters = options.maxChapters || 8;

    try {
      // Extract topics and calculate metrics
      const wordCount = this._calculateWordCount(prompt);
      const topics = this._extractTopics(prompt);
      const density = this._classifyDensity(wordCount, topics.length);

      // Distribute chapters based on target page count and density
      const chapters = this._distributeChapters(
        topics,
        targetPageCount,
        density,
        maxChapters
      );

      // Build structure mapping
      const structure = this._buildStructure(chapters, targetPageCount);

      return {
        chapters,
        structure,
        totalPages: targetPageCount,
        density,
        metadata: {
          wordCount,
          estimatedTopics: topics,
          complexity: this._calculateComplexity(wordCount, topics.length),
          chapterCount: chapters.length,
          estimatedWordsPerPage: Math.ceil(wordCount / targetPageCount),
        },
      };
    } catch (err) {
      if (err.message.includes("ContentChunker:")) {
        throw err;
      }
      throw new Error(`ContentChunker: Analysis failed - ${err.message}`);
    }
  }

  /**
   * Calculate word count from text
   * @private
   */
  _calculateWordCount(text) {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  /**
   * Extract topics and keywords from text
   * @private
   * Uses a hybrid approach:
   * 1. Capitalize-first-letter keywords (likely proper nouns/topics)
   * 2. Common significant words (length > 4, not stopwords)
   * 3. Phrase detection (consecutive capitalized words)
   */
  _extractTopics(text) {
    const stopwords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "have",
      "has",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "can",
      "that",
      "this",
      "which",
      "who",
      "what",
      "when",
      "where",
      "why",
      "how",
      "if",
      "as",
      "it",
      "its",
      "not",
      "no",
      "yes",
      "it's",
      "i'm",
      "you're",
      "they're",
      "we're",
      "don't",
      "doesn't",
      "didn't",
      "won't",
      "wouldn't",
      "can't",
      "couldn't",
    ]);

    // Extract capitalized words (likely topics/proper nouns)
    const capitalizedWords = (
      text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
    )
      .map((word) => word.toLowerCase())
      .filter((word) => word.length > 2);

    // Extract significant words (length > 4, not stopwords)
    const significantWords = (text.match(/\b\w{5,}\b/g) || [])
      .map((word) => word.toLowerCase())
      .filter((word) => !stopwords.has(word) && word.length > 4);

    // Combine and deduplicate
    const allTopics = [...new Set([...capitalizedWords, ...significantWords])];

    // Sort by frequency and return top 8
    const topicFreq = {};
    allTopics.forEach((topic) => {
      topicFreq[topic] = (
        text.match(new RegExp(`\\b${topic}\\b`, "gi")) || []
      ).length;
    });

    return allTopics
      .sort((a, b) => (topicFreq[b] || 0) - (topicFreq[a] || 0))
      .slice(0, 4);
  }

  /**
   * Classify content density based on word count and topic count
   * @private
   * light: < 500 words AND < 3 topics
   * medium: 500-2000 words AND 3-6 topics
   * dense: > 2000 words AND > 6 topics
   */
  _classifyDensity(wordCount, topicCount) {
    if (wordCount < 500 || topicCount <= 1) return "light";
    if (wordCount > 1500 && topicCount > 3) return "dense";
    return "medium";
  }

  /**
   * Calculate complexity score (0-1)
   * @private
   */
  _calculateComplexity(wordCount, topicCount) {
    const wordComplexity = Math.min(wordCount / 3000, 1); // Max at 3000 words
    const topicComplexity = Math.min(topicCount / 8, 1); // Max at 8 topics
    return ((wordComplexity + topicComplexity) / 2).toFixed(2);
  }

  /**
   * Distribute topics into chapters based on target page count and density
   * @private
   * Creates hierarchical structure (level 1 = chapters, level 2 = subsections)
   */
  _distributeChapters(topics, targetPageCount, density, maxChapters) {
    if (topics.length === 0) {
      // Fallback: create generic chapters if no topics extracted
      return this._createGenericChapters(targetPageCount);
    }

    const chapters = [];
    let chapterId = 1;
    let subsectionId = 1;

    // Distribute topics across chapters
    // Calculate topics per chapter: more chapters for dense content
    // For dense, aim for ~1 topic per chapter; for light, group more topics
    const targetChapters =
      density === "dense"
        ? topics.length
        : Math.max(1, Math.ceil(topics.length / 2));
    const topicsPerChapter = Math.max(
      1,
      Math.ceil(topics.length / Math.min(targetChapters, maxChapters))
    );

    for (let i = 0; i < topics.length; i += topicsPerChapter) {
      const chapterTopics = topics.slice(i, i + topicsPerChapter);
      const mainTopic = chapterTopics[0];
      const mainChapterId = `ch${chapterId}`;

      // Main chapter
      chapters.push({
        id: mainChapterId,
        title: this._generateChapterTitle(mainTopic),
        topic: mainTopic,
        content: null, // To be filled by content generator
        estimatedPages: this._estimateChapterPages(targetPageCount, density),
        level: 1,
      });

      // Subsections (level 2)
      for (let j = 1; j < chapterTopics.length; j++) {
        const subTopic = chapterTopics[j];
        chapters.push({
          id: `${mainChapterId}-${subsectionId}`,
          title: this._generateSectionTitle(subTopic),
          topic: subTopic,
          content: null,
          estimatedPages: Math.max(
            1,
            this._estimateChapterPages(targetPageCount, density) - 1
          ),
          level: 2,
        });
        subsectionId++;
      }

      chapterId++;
    }

    // Ensure we don't exceed max chapters
    if (chapters.length > maxChapters) {
      return chapters.slice(0, maxChapters);
    }

    // Add front/back matter chapters for dense content to reach minimum chapter count
    if (density === "dense" && chapters.length <= 4) {
      chapters.unshift({
        title: "Introduction",
        sections: ["Overview", "Motivation"],
        level: 1,
      });
      if (chapters.length < 5) {
        chapters.push({
          title: "Conclusion",
          sections: ["Summary", "Next Steps"],
          level: 1,
        });
      }
    }

    return chapters;
  }

  /**
   * Generate chapter title from topic
   * @private
   */
  _generateChapterTitle(topic) {
    const words = topic.split(/\s+/);
    const capitalized = words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    return `Chapter: ${capitalized}`;
  }

  /**
   * Generate section title from topic
   * @private
   */
  _generateSectionTitle(topic) {
    const words = topic.split(/\s+/);
    const capitalized = words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    return `Section: ${capitalized}`;
  }

  /**
   * Estimate pages per chapter based on target and density
   * @private
   */
  _estimateChapterPages(targetPageCount, density) {
    if (density === "light") return Math.max(1, Math.ceil(targetPageCount / 6));
    if (density === "dense") return Math.max(2, Math.ceil(targetPageCount / 4));
    return Math.max(1, Math.ceil(targetPageCount / 5));
  }

  /**
   * Create generic chapters if no topics can be extracted
   * @private
   */
  _createGenericChapters(targetPageCount) {
    const chapters = [];
    const baseChapterCount = Math.max(
      2,
      Math.min(5, Math.ceil(targetPageCount / 3))
    );

    for (let i = 1; i <= baseChapterCount; i++) {
      chapters.push({
        id: `ch${i}`,
        title: `Chapter ${i}`,
        topic: `topic-${i}`,
        content: null,
        estimatedPages: Math.ceil(targetPageCount / baseChapterCount),
        level: 1,
      });
    }

    return chapters;
  }

  /**
   * Build structure mapping (page ranges for each chapter)
   * @private
   */
  _buildStructure(chapters, totalPages) {
    const structure = [];
    let currentPage = 1;

    chapters.forEach((chapter, i) => {
      let pageEnd = Math.min(
        currentPage + chapter.estimatedPages - 1,
        totalPages
      );
      // Force last chapter to end at totalPages
      if (i === chapters.length - 1) pageEnd = totalPages;
      structure.push({
        chapterId: chapter.id,
        chapterName: chapter.title,
        pageStart: currentPage,
        pageEnd,
        topicTags: [chapter.topic],
      });
      currentPage = pageEnd + 1;
    });

    return structure;
  }
}

// Export singleton instance
module.exports = new ContentChunker();
