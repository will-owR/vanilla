/**
 * Batch Builder Module
 *
 * Constructs batch prompts with unified narrative context for multi-chapter
 * generation. Ensures continuity by providing full ebook narrative context
 * to Gemini, not just previous chapter summary.
 *
 * Phase 1: Batch Infrastructure
 */

/**
 * Build a unified batch prompt for multiple chapters with full narrative context
 *
 * @param {Array} batch - Array of chapter specs { chapter, title, topics, pageCount }
 * @param {Object} contextFromPrevious - Context from preceding chapters { summary, continuityNotes, narrativeVoice }
 * @param {Object} ebookMetadata - Ebook metadata { title, theme, totalPageCount, genre }
 * @param {Object} structure - Structure from generation step { title, theme, tone, outline, structure }
 * @returns {string} Unified batch prompt suitable for Gemini API
 * @throws {Error} If inputs invalid
 */
function buildBatchPrompt(
  batch,
  contextFromPrevious,
  ebookMetadata,
  structure
) {
  // Validate inputs
  if (!Array.isArray(batch) || batch.length === 0) {
    throw new Error("batchBuilder: batch must be non-empty array");
  }
  if (batch.length > 5) {
    throw new Error(
      "batchBuilder: batch size limited to 5 chapters (performance constraint)"
    );
  }
  if (!ebookMetadata || !ebookMetadata.title) {
    throw new Error("batchBuilder: ebookMetadata must include title");
  }

  // Build unified context object
  const unifiedContext = _buildUnifiedContext(
    contextFromPrevious,
    ebookMetadata,
    structure
  );

  // Build prompt for entire batch at once (not individual chapters)
  const batchPromptText = _buildBatchPromptText(
    batch,
    unifiedContext,
    ebookMetadata
  );

  return batchPromptText;
}

/**
 * Extract continuation context from batch response chapters
 *
 * @param {Array} batchResponse - Array of chapter objects from batch API response
 * @param {Object} previousContext - Previous context (for chaining multiple batches)
 * @returns {Object} Extracted context { chapters, continuityContext, summaries }
 */
function extractContextFromBatch(batchResponse, previousContext = {}) {
  if (!Array.isArray(batchResponse) || batchResponse.length === 0) {
    throw new Error("batchBuilder: batchResponse must be non-empty array");
  }

  // Extract chapter summaries and key narrative points
  const summaries = batchResponse.map((ch, idx) => ({
    chapter: ch.chapter || idx + 1,
    summary: ch.summary || "",
    keyPlots: _extractKeyPlots(ch.content),
    characterMoments: _extractCharacterMoments(ch.content),
  }));

  // Build continuity context for next batch
  const continuityContext = {
    previousChapters: summaries,
    narrativeArc: _computeNarrativeArc(summaries, previousContext),
    pacing: _analyzePacing(batchResponse, previousContext),
    unfinishedPlots: _extractUnfinishedPlots(batchResponse, previousContext),
    timestamp: new Date().toISOString(),
  };

  return {
    chapters: batchResponse,
    continuityContext,
    summaries,
  };
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Build unified context object from metadata and structure
 *
 * @private
 */
function _buildUnifiedContext(contextFromPrevious, ebookMetadata, structure) {
  return {
    ebookTitle: ebookMetadata.title,
    theme: ebookMetadata.theme || structure.theme || "",
    genre: ebookMetadata.genre || "",
    totalPages: ebookMetadata.totalPageCount,
    tone: structure.tone || "professional",
    narrativeStyle: structure.narrativeStyle || "third-person",
    targetAudience: ebookMetadata.audience || "general",
    previousSummary: contextFromPrevious.previousChapters || [],
    narrativeArc: contextFromPrevious.narrativeArc || "building",
    pacing: contextFromPrevious.pacing || "steady",
    unfinishedPlots: contextFromPrevious.unfinishedPlots || [],
  };
}

/**
 * Build the actual prompt text for batch request
 *
 * @private
 */
function _buildBatchPromptText(batch, unifiedContext, ebookMetadata) {
  const chapterSpecs = batch
    .map(
      (ch, idx) =>
        `Chapter ${ch.chapter}: "${ch.title}" (${
          ch.pageCount || 2
        } pages, topics: ${ch.topics || "unspecified"})`
    )
    .join("\n");

  const prompt = `You are generating multiple chapters for an ebook. Generate ALL the following chapters at once, maintaining narrative continuity throughout.

**Ebook Context:**
- Title: ${unifiedContext.ebookTitle}
- Theme: ${unifiedContext.theme}
- Genre: ${unifiedContext.genre}
- Total Pages: ${unifiedContext.totalPages}
- Tone: ${unifiedContext.tone}
- Narrative Style: ${unifiedContext.narrativeStyle}
- Target Audience: ${unifiedContext.targetAudience}

**Narrative Continuity:**
${_formatPreviousContext(unifiedContext)}

**Chapters to Generate (all at once):**
${chapterSpecs}

**Output Format:**
Return a JSON object with a \`chapters\` array. Each chapter object must have:
{
  "chapter": <number>,
  "title": "<string>",
  "summary": "<1-2 line summary>",
  "content": "<3-5 paragraphs of rich content>",
  "image": {
    "concept": "<visual concept for chapter>",
    "style": "<artistic style>",
    "tone": "<visual tone>"
  }
}

**Requirements:**
1. Generate ALL chapters as a cohesive narrative unit
2. Each chapter should reference or build on previous chapters
3. Maintain consistent character voice and plot continuity
4. Ensure pacing matches the narrative arc
5. Include specific details that connect to the overall theme

Return ONLY valid JSON, no additional text.`;

  return prompt;
}

/**
 * Format previous context for inclusion in prompt
 *
 * @private
 */
function _formatPreviousContext(unifiedContext) {
  if (
    !unifiedContext.previousSummary ||
    unifiedContext.previousSummary.length === 0
  ) {
    return "This is the beginning of the ebook.";
  }

  const prevSummaries = unifiedContext.previousSummary
    .map((ch) => `- Chapter ${ch.chapter}: ${ch.summary}`)
    .join("\n");

  const unfinishedNotes =
    unifiedContext.unfinishedPlots.length > 0
      ? `\nUnfinished plot threads to continue: ${unifiedContext.unfinishedPlots.join(
          ", "
        )}`
      : "";

  return `Previous chapters:\n${prevSummaries}\n\nNarrative Arc: ${unifiedContext.narrativeArc}\nCurrent Pacing: ${unifiedContext.pacing}${unfinishedNotes}`;
}

/**
 * Extract key plot points from chapter content
 *
 * @private
 */
function _extractKeyPlots(content) {
  if (!content || typeof content !== "string") return [];

  // Simple heuristic: sentences with key words
  const keywords = [
    "discovered",
    "revealed",
    "decided",
    "realized",
    "learned",
    "found",
    "changed",
    "understood",
  ];
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  return sentences
    .filter((s) => keywords.some((kw) => s.toLowerCase().includes(kw)))
    .slice(0, 3)
    .map((s) => s.trim());
}

/**
 * Extract character moments from chapter content
 *
 * @private
 */
function _extractCharacterMoments(content) {
  if (!content || typeof content !== "string") return [];

  // Simple heuristic: first person or dialogue
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  return sentences
    .filter(
      (s) =>
        s.includes('"') ||
        s.includes("'") ||
        s.match(/^[A-Z][a-z]+\s+(said|thought|wondered|asked)/)
    )
    .slice(0, 2)
    .map((s) => s.trim());
}

/**
 * Compute narrative arc state from chapters
 *
 * @private
 */
function _computeNarrativeArc(summaries, previousContext) {
  const totalChapters =
    summaries.length + (previousContext.previousChapters?.length || 0);
  const stage =
    totalChapters <= 3
      ? "setup"
      : totalChapters <= 6
      ? "development"
      : "climax/resolution";

  return stage;
}

/**
 * Analyze pacing from chapters
 *
 * @private
 */
function _analyzePacing(chapters, previousContext) {
  const avgLength =
    chapters.reduce((sum, ch) => sum + (ch.content?.length || 0), 0) /
    chapters.length;

  if (avgLength < 500) return "fast";
  if (avgLength < 1500) return "steady";
  return "slow-detailed";
}

/**
 * Extract unfinished plot threads
 *
 * @private
 */
function _extractUnfinishedPlots(chapters, previousContext) {
  const plots = [];

  // Look for common plot indicators
  chapters.forEach((ch) => {
    const content = ch.content || "";
    if (content.includes("meanwhile") || content.includes("meanwhile")) {
      plots.push("parallel storyline");
    }
    if (content.includes("mystery") || content.includes("mysterious")) {
      plots.push("unresolved mystery");
    }
    if (content.includes("foreshadow") || content.includes("soon")) {
      plots.push("upcoming event");
    }
  });

  return [...new Set(plots)]; // Deduplicate
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  buildBatchPrompt,
  extractContextFromBatch,
};
