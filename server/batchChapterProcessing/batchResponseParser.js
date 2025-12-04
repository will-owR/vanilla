/**
 * Batch Response Parser Module
 *
 * Validates batch response structure, extracts chapters, and builds
 * continuation context for next batch. Ensures data integrity.
 *
 * Phase 1: Batch Infrastructure
 */

/**
 * Comprehensive batch response validation and parsing
 *
 * @param {Object} response - Raw response from Gemini API
 * @param {Array} expectedChapters - Array of expected chapter specs { chapter, title }
 * @returns {Object} {
 *   success: boolean,
 *   chapters: Array,
 *   missingChapters: Array,
 *   validationIssues: Array,
 *   canContinue: boolean
 * }
 * @throws {Error} If response structure is fundamentally broken
 */
function parseBatchResponse(response, expectedChapters = []) {
  if (!response || typeof response !== "object") {
    throw new Error("parseBatchResponse: response must be object");
  }

  // Find chapters array in response
  const chaptersData = _extractChaptersArray(response);
  if (!chaptersData || chaptersData.length === 0) {
    throw new Error("parseBatchResponse: no chapters found in response");
  }

  // =========================================================================
  // DEBUG: Log batch response structure and chapter details
  // =========================================================================
  if (global.__DEBUG_BATCH__) {
    console.log("[DEBUG] === BATCH RESPONSE ANALYSIS ===");
    console.log(`[DEBUG] Total chapters in response: ${chaptersData.length}`);

    console.log("[DEBUG] Chapter numbers received:");
    chaptersData.forEach((ch, idx) => {
      const contentPreview = ch.content
        ? ch.content.substring(0, 50).replace(/\n/g, " ")
        : "(empty)";
      console.log(
        `  [${idx}] Ch${ch.chapter}: "${ch.title}" (${
          ch.content?.length || 0
        } chars) - "${contentPreview}..."`
      );
    });

    console.log(
      `[DEBUG] Expected chapters: [${expectedChapters
        .map((e) => e.chapter)
        .join(", ")}]`
    );
    console.log(
      `[DEBUG] Received chapters:  [${chaptersData
        .map((c) => c.chapter)
        .join(", ")}]`
    );

    // Check for chapter order mismatch
    const receivedNumbers = chaptersData.map((c) => c.chapter);
    const expectedNumbers = expectedChapters.map((e) => e.chapter);
    const ordered = receivedNumbers.every(
      (n, i) => i === 0 || n > receivedNumbers[i - 1]
    );
    console.log(
      `[DEBUG] Chapter order: ${ordered ? "✓ ORDERED" : "❌ OUT OF ORDER"}`
    );
  }
  // =========================================================================

  // Validate each chapter
  const validatedChapters = [];
  const validationIssues = [];
  const missingChapters = [];

  expectedChapters.forEach((expected) => {
    const foundData = chaptersData.find(
      (ch) =>
        ch.chapter === expected.chapter ||
        ch.chapter === expected.chapter.toString()
    );

    if (!foundData) {
      missingChapters.push(expected.chapter);
      return;
    }

    // Validate chapter structure
    const validation = validateChapterObject(foundData);
    if (!validation.valid) {
      validationIssues.push({
        chapter: expected.chapter,
        errors: validation.errors,
      });
    } else {
      validatedChapters.push(foundData);
    }
  });

  const success = validatedChapters.length === expectedChapters.length;
  const canContinue = validatedChapters.length > 0;

  if (global.__DEBUG_BATCH__) {
    console.log(
      `[RESPONSE PARSER] Parsed ${validatedChapters.length}/${expectedChapters.length} chapters, ` +
        `missing=${missingChapters.length}, issues=${validationIssues.length}`
    );
    if (missingChapters.length > 0) {
      console.warn(
        `[RESPONSE PARSER] ❌ Missing chapters: [${missingChapters.join(", ")}]`
      );
    }
  }

  // =========================================================================
  // SOLUTION B: Reorder chapters to match expected chapter order
  // Ensures that even if batch response returns chapters out of order,
  // they will be in correct sequence for composition
  // =========================================================================
  const sortedChapters = [];
  const foundChapterNumbers = new Set();

  for (const expected of expectedChapters) {
    const found = validatedChapters.find(
      (ch) =>
        ch.chapter === expected.chapter ||
        parseInt(ch.chapter) === expected.chapter
    );

    if (found) {
      sortedChapters.push(found);
      foundChapterNumbers.add(expected.chapter);
    }
  }

  // Log reordering activity
  if (global.__DEBUG_BATCH__) {
    const beforeOrder = validatedChapters.map((ch) => ch.chapter).join(",");
    const afterOrder = sortedChapters.map((ch) => ch.chapter).join(",");
    console.log(
      `[RESPONSE PARSER] Chapter reordering: [${beforeOrder}] → [${afterOrder}]`
    );
  }

  // =========================================================================
  // SOLUTION D: Sanitize all chapters to ensure no undefined fields
  // Prevents "undefinedundefined" garbage text in HTML output
  // =========================================================================
  const sanitizedChapters = sortedChapters.map((ch) => sanitizeChapter(ch));

  if (global.__DEBUG_BATCH__) {
    console.log(
      `[RESPONSE PARSER] Sanitized ${sanitizedChapters.length} chapters (undefined fields removed)`
    );
  }

  return {
    success,
    chapters: sanitizedChapters,
    missingChapters,
    validationIssues,
    canContinue,
  };
}

/**
 * Validate individual chapter object structure and content
 *
 * @param {Object} chapter - Chapter object from response
 * @returns {Object} { valid: boolean, errors: Array }
 */
function validateChapterObject(chapter) {
  const errors = [];

  // Type check
  if (!chapter || typeof chapter !== "object") {
    return { valid: false, errors: ["chapter must be object"] };
  }

  // Required fields
  if (
    typeof chapter.chapter !== "number" &&
    typeof chapter.chapter !== "string"
  ) {
    errors.push("missing or invalid chapter number");
  }
  if (
    !chapter.title ||
    typeof chapter.title !== "string" ||
    chapter.title.trim().length === 0
  ) {
    errors.push("missing or empty title");
  }
  if (
    !chapter.content ||
    typeof chapter.content !== "string" ||
    chapter.content.trim().length < 100
  ) {
    errors.push("missing or too-short content (minimum 100 chars)");
  }
  if (
    !chapter.summary ||
    typeof chapter.summary !== "string" ||
    chapter.summary.trim().length === 0
  ) {
    errors.push("missing or empty summary");
  }

  // Image object validation
  if (chapter.image) {
    if (typeof chapter.image !== "object") {
      errors.push("image must be object");
    } else {
      if (!chapter.image.concept || typeof chapter.image.concept !== "string") {
        errors.push("image.concept must be non-empty string");
      }
    }
  }

  // Content length sanity checks
  if (chapter.content && chapter.content.length > 50000) {
    errors.push("content exceeds maximum length (50000 chars)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * SOLUTION D: Sanitize chapter object to remove undefined fields
 * Prevents "undefinedundefined" text from appearing in HTML composition
 *
 * @param {Object} chapter - Chapter object potentially with undefined fields
 * @returns {Object} Sanitized chapter object with safe defaults
 */
function sanitizeChapter(chapter) {
  if (!chapter || typeof chapter !== "object") {
    // Return minimal valid chapter
    return {
      chapter: 0,
      title: "Untitled",
      content: "",
      summary: "",
      image: {
        concept: "Placeholder",
        style: "neutral",
        tone: "neutral",
      },
    };
  }

  return {
    // Ensure chapter number is always present and valid
    chapter: chapter.chapter !== undefined ? chapter.chapter : 0,
    // Ensure title is always a string
    title:
      chapter.title && typeof chapter.title === "string"
        ? chapter.title
        : "Untitled",
    // Ensure content is always a string (never undefined)
    content:
      chapter.content && typeof chapter.content === "string"
        ? chapter.content
        : "",
    // Ensure summary is always a string
    summary:
      chapter.summary && typeof chapter.summary === "string"
        ? chapter.summary
        : "",
    // Ensure image object has all fields
    image: {
      concept:
        chapter.image && chapter.image.concept
          ? chapter.image.concept
          : "Scene concept",
      style:
        chapter.image && chapter.image.style ? chapter.image.style : "neutral",
      tone:
        chapter.image && chapter.image.tone ? chapter.image.tone : "neutral",
    },
    // Pass through any additional fields safely
    ...(chapter.id && { id: chapter.id }),
    ...(chapter.pageCount && { pageCount: chapter.pageCount }),
  };
}

/**
 * Merge validated chapters with previous context to build next batch context
 *
 * @param {Array} validatedChapters - Chapters from current batch
 * @param {Object} previousContext - Context from preceding batches
 * @returns {Object} Merged context for next batch
 */
function mergeWithPreviousContext(validatedChapters, previousContext = {}) {
  if (!Array.isArray(validatedChapters)) {
    throw new Error(
      "mergeWithPreviousContext: validatedChapters must be array"
    );
  }

  // Extract summaries and plot threads
  const currentSummaries = validatedChapters.map((ch) => ({
    chapter: ch.chapter,
    title: ch.title,
    summary: ch.summary,
    keyPoints: _extractKeyPoints(ch.content),
  }));

  // Combine with previous
  const allSummaries = [
    ...(previousContext.previousChapters || []),
    ...currentSummaries,
  ];

  // Build merged context
  const mergedContext = {
    previousChapters: allSummaries,
    narrativeVoice: _analyzeNarrativeVoice(validatedChapters, previousContext),
    pacing: _analyzePacing(validatedChapters, previousContext),
    narrativeArc: _computeNarrativeArc(allSummaries),
    unfinishedPlots: _extractUnfinishedPlots(
      validatedChapters,
      previousContext
    ),
    characterDevelopment: _analyzeCharacterDevelopment(
      validatedChapters,
      previousContext
    ),
    thematicElements: _extractThematicElements(
      validatedChapters,
      previousContext
    ),
    continuityNotes: _buildContinuityNotes(validatedChapters, previousContext),
    timestamp: new Date().toISOString(),
  };

  if (global.__DEBUG_BATCH__) {
    console.log(
      `[RESPONSE PARSER] Merged context: ${allSummaries.length} total chapters tracked`
    );
  }

  return mergedContext;
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Extract chapters array from various possible response formats
 *
 * @private
 */
function _extractChaptersArray(response) {
  // Handle aiService response format: { content: { body: "..." }, metadata: {...} }
  if (response.content && response.content.body) {
    const rawText = response.content.body;

    // Strip markdown code blocks if present (e.g., ```json\n{...}\n```)
    const codeBlockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonText = codeBlockMatch ? codeBlockMatch[1] : rawText;

    try {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed.chapters)) {
        return parsed.chapters;
      } else if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Fall through to other extraction methods
    }
  }

  // Handle direct array properties
  if (Array.isArray(response.chapters)) return response.chapters;
  if (Array.isArray(response.batch_response)) return response.batch_response;
  if (Array.isArray(response.chapters_batch)) return response.chapters_batch;
  if (Array.isArray(response)) return response;

  return null;
}

/**
 * Extract key narrative points from chapter content
 *
 * @private
 */
function _extractKeyPoints(content) {
  if (!content || typeof content !== "string") return [];

  const keywordPatterns = [
    /discovered that/gi,
    /revealed/gi,
    /decided to/gi,
    /realized/gi,
    /learned/gi,
    /changed/gi,
    /understood/gi,
    /found/gi,
  ];

  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 20);

  const keyPoints = sentences
    .filter((s) => keywordPatterns.some((pattern) => pattern.test(s)))
    .slice(0, 3)
    .map((s) => s.trim().substring(0, 100));

  return keyPoints;
}

/**
 * Analyze narrative voice/tone from current chapters
 *
 * @private
 */
function _analyzeNarrativeVoice(chapters, previousContext) {
  const currentTone = previousContext.narrativeVoice || "professional";

  // Simple heuristic: check for first/second person vs. third
  let firstPersonCount = 0;
  let thirdPersonCount = 0;

  chapters.forEach((ch) => {
    if (ch.content && typeof ch.content === "string") {
      if (ch.content.match(/\b(I|we|me|us)\b/gi)) firstPersonCount++;
      if (ch.content.match(/\b(he|she|they|it)\b/gi)) thirdPersonCount++;
    }
  });

  const isFirstPerson = firstPersonCount > thirdPersonCount;
  const tone = isFirstPerson ? "first-person" : "third-person";

  return tone || currentTone;
}

/**
 * Analyze pacing from current chapters
 *
 * @private
 */
function _analyzePacing(chapters, previousContext) {
  const avgLength =
    chapters.reduce((sum, ch) => sum + (ch.content?.length || 0), 0) /
    chapters.length;

  if (avgLength < 500) return "fast-paced";
  if (avgLength < 1500) return "steady";
  return "detailed-slow";
}

/**
 * Compute overall narrative arc stage
 *
 * @private
 */
function _computeNarrativeArc(allSummaries) {
  const totalChapters = allSummaries.length;

  if (totalChapters <= 2) return "setup";
  if (totalChapters <= Math.ceil(totalChapters * 0.6)) return "rising-action";
  if (totalChapters <= Math.ceil(totalChapters * 0.8)) return "climax";
  return "resolution";
}

/**
 * Extract unfinished plot threads from chapters
 *
 * @private
 */
function _extractUnfinishedPlots(chapters, previousContext) {
  const plots = new Set(previousContext.unfinishedPlots || []);

  chapters.forEach((ch) => {
    const content = (ch.content || "").toLowerCase();

    if (content.includes("meanwhile") || content.includes("elsewhere")) {
      plots.add("parallel storyline");
    }
    if (
      content.includes("mystery") ||
      content.includes("secret") ||
      content.includes("hidden")
    ) {
      plots.add("unresolved mystery");
    }
    if (
      content.includes("foreshadow") ||
      content.includes("soon to") ||
      content.includes("will")
    ) {
      plots.add("upcoming event");
    }
    if (content.includes("conflict") || content.includes("tension")) {
      plots.add("unresolved conflict");
    }
  });

  return Array.from(plots);
}

/**
 * Analyze character development across chapters
 *
 * @private
 */
function _analyzeCharacterDevelopment(chapters, previousContext) {
  const characters = previousContext.characterDevelopment || [];

  chapters.forEach((ch) => {
    const content = (ch.content || "").match(/\b[A-Z][a-z]+\b/g) || [];
    content.forEach((name) => {
      if (!characters.includes(name) && name.length > 2) {
        characters.push(name);
      }
    });
  });

  return characters.slice(0, 10); // Keep top 10
}

/**
 * Extract thematic elements from chapters
 *
 * @private
 */
function _extractThematicElements(chapters, previousContext) {
  const themes = previousContext.thematicElements || [];

  const keywords = [
    "love",
    "power",
    "growth",
    "loss",
    "journey",
    "transformation",
    "freedom",
    "conflict",
    "hope",
  ];

  chapters.forEach((ch) => {
    const content = (ch.content || "").toLowerCase();
    keywords.forEach((theme) => {
      if (content.includes(theme) && !themes.includes(theme)) {
        themes.push(theme);
      }
    });
  });

  return themes;
}

/**
 * Build detailed continuity notes for handoff to next batch
 *
 * @private
 */
function _buildContinuityNotes(chapters, previousContext) {
  const notes = [];

  chapters.forEach((ch, idx) => {
    if (ch.summary) {
      notes.push(`Ch${ch.chapter}: ${ch.summary}`);
    }
  });

  return notes;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  parseBatchResponse,
  validateChapterObject,
  mergeWithPreviousContext,
};
