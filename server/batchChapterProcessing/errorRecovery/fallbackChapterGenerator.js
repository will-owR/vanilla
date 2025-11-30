/**
 * Fallback Chapter Generator Module
 *
 * Creates placeholder chapters when all else fails (batch error recovery exhausted).
 * Level 3 of 3-level error recovery strategy.
 * Always produces valid chapter object (never crashes).
 *
 * Phase 2: Error Recovery
 */

/**
 * Create a fallback (placeholder) chapter
 *
 * @param {Object} chapterSpec - Chapter spec { chapter, title, topics, pageCount }
 * @param {Object} contextFromPrevious - Previous narrative context
 * @param {string} reason - Why fallback is being used (error reason)
 * @returns {Object} Chapter object { chapter, title, summary, content, image, degraded, reason }
 */
function createFallbackChapter(
  chapterSpec,
  contextFromPrevious = {},
  reason = "unknown"
) {
  if (!chapterSpec || !chapterSpec.chapter || !chapterSpec.title) {
    throw new Error(
      "fallbackChapterGenerator: chapterSpec must include chapter and title"
    );
  }

  const chapterNum = chapterSpec.chapter;
  const title = chapterSpec.title;
  const topics = chapterSpec.topics || "development";

  if (global.__DEBUG_BATCH__) {
    console.log(
      `[FALLBACK GENERATOR] Creating fallback chapter ${chapterNum}: "${title}" (reason: ${reason})`
    );
  }

  // Build fallback content
  const content = _buildFallbackContent(chapterSpec, contextFromPrevious);
  const summary = _buildFallbackSummary(title, topics);

  const fallbackChapter = {
    chapter: chapterNum,
    title: title,
    summary: summary,
    content: content,
    image: {
      concept: _conceptFromTopics(topics),
      style: "professional",
      tone: "neutral",
    },
    // Mark as degraded for tracking
    degraded: true,
    degradationReason: reason,
    createdAt: new Date().toISOString(),
    fallbackIndicator: "generated_placeholder",
  };

  if (global.__DEBUG_BATCH__) {
    console.log(
      `[FALLBACK GENERATOR] ✅ Created fallback chapter ${chapterNum} (${content.length} chars)`
    );
  }

  return fallbackChapter;
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Build fallback content for chapter
 *
 * @private
 */
function _buildFallbackContent(chapterSpec, contextFromPrevious) {
  const chapterNum = chapterSpec.chapter;
  const title = chapterSpec.title;
  const topics = chapterSpec.topics || "topic";
  const totalChapters = contextFromPrevious.totalChapters || 10;

  // Determine narrative position
  let position = "middle";
  if (chapterNum === 1) position = "opening";
  else if (chapterNum >= totalChapters - 1) position = "closing";

  // Build structured fallback content
  const sections = [];

  // Opening section
  sections.push(`# Chapter ${chapterNum}: ${title}\n`);
  sections.push(_buildOpeningSection(chapterNum, title, topics, position));

  // Body section
  sections.push(_buildBodySection(topics, contextFromPrevious));

  // Closing section
  sections.push(_buildClosingSection(chapterNum, totalChapters, position));

  const content = sections.join("\n\n");
  return content;
}

/**
 * Build opening section of fallback content
 *
 * @private
 */
function _buildOpeningSection(chapterNum, title, topics, position) {
  const topicList = topics
    .split(",")
    .map((t) => t.trim())
    .slice(0, 3);

  if (position === "opening") {
    return (
      `This chapter introduces the narrative with a focus on ${
        topicList[0] || "the main theme"
      }. ` +
      `We begin by setting the stage and establishing context for the journey ahead. ` +
      `The reader is invited to engage with the core concepts and characters that will drive the story forward.`
    );
  }

  if (position === "closing") {
    return (
      `In this final chapter, we bring together the threads of the narrative. ` +
      `The focus is on ${topicList[0] || "resolution and reflection"}. ` +
      `As we approach the conclusion, the significance of earlier events becomes clear.`
    );
  }

  // Middle position
  return (
    `Chapter ${chapterNum} continues the narrative with emphasis on ${
      topicList[0] || "development"
    }. ` +
    `Building on what came before, this section explores ${
      topicList[1] || "new dimensions"
    }. ` +
    `The progression moves the story toward greater depth and complexity.`
  );
}

/**
 * Build body section of fallback content
 *
 * @private
 */
function _buildBodySection(topics, contextFromPrevious) {
  const topicList = topics.split(",").map((t) => t.trim());

  const body = [];

  // Reference previous context if available
  if (
    contextFromPrevious.previousChapters &&
    contextFromPrevious.previousChapters.length > 0
  ) {
    const lastChapter =
      contextFromPrevious.previousChapters[
        contextFromPrevious.previousChapters.length - 1
      ];
    body.push(
      `Building upon the developments in Chapter ${lastChapter.chapter}, ` +
        `which focused on ${lastChapter.summary || "prior events"}, ` +
        `we now turn our attention to additional aspects of the narrative.`
    );
  } else {
    body.push(
      `This section explores the primary topic of ${
        topicList[0] || "the subject matter"
      } ` + `in greater detail, providing context and perspective.`
    );
  }

  // Add topic-specific content
  topicList.forEach((topic, idx) => {
    if (idx < 2) {
      body.push(
        `Regarding ${topic.toLowerCase()}: This represents an important dimension ` +
          `of the narrative being developed in this chapter, with implications for the broader arc.`
      );
    }
  });

  // Add forward-looking element
  body.push(
    `These elements combine to create momentum toward the next phase, ` +
      `where further developments will build on the foundation established here.`
  );

  return body.join(" ");
}

/**
 * Build closing section of fallback content
 *
 * @private
 */
function _buildClosingSection(chapterNum, totalChapters, position) {
  const sections = [];

  if (position === "closing") {
    sections.push(
      `As we conclude this chapter and reach the end of our narrative, ` +
        `we reflect on the journey taken and the themes that have emerged. ` +
        `The lessons and insights gained throughout this work come into focus.`
    );
  } else {
    sections.push(
      `This chapter establishes important groundwork for what follows. ` +
        `The insights and developments presented here will resonate through subsequent chapters. ` +
        `We are positioned for continued exploration and deeper understanding.`
    );
  }

  return sections.join(" ");
}

/**
 * Build fallback summary from title and topics
 *
 * @private
 */
function _buildFallbackSummary(title, topics) {
  const topicList = topics
    .split(",")
    .map((t) => t.trim())
    .slice(0, 2);
  const topicStr = topicList.join(" and ");

  return `${title} explores ${topicStr}`;
}

/**
 * Derive visual concept from topics
 *
 * @private
 */
function _conceptFromTopics(topics) {
  if (!topics || typeof topics !== "string") {
    return "Chapter Concept";
  }

  const topicStr = topics.toLowerCase();

  // Simple keyword matching for common concepts
  if (topicStr.includes("conflict")) return "Conflict and Resolution";
  if (topicStr.includes("growth")) return "Growth and Development";
  if (topicStr.includes("journey")) return "Journey and Discovery";
  if (topicStr.includes("mystery")) return "Mystery and Revelation";
  if (topicStr.includes("action")) return "Action and Motion";
  if (topicStr.includes("reflection")) return "Reflection and Insight";
  if (topicStr.includes("climax")) return "Climactic Moment";
  if (topicStr.includes("setup")) return "Foundation and Setup";
  if (topicStr.includes("resolution")) return "Resolution";

  // Default to generic concept from first topic
  const firstTopic = topics.split(",")[0].trim();
  return `${firstTopic} Theme`;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createFallbackChapter,
};
