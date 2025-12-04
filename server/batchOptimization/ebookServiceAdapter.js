/**
 * BatchOptimization Integration Adapter
 *
 * Bridges BatchOptimizationService (page-level batching) into ebookService (chapter-based flow)
 *
 * Stage 1 integration:
 * - Detects when structure has 3-20 chapters
 * - Routes to BatchOptimizationService for optimized generation
 * - Converts results back to chapter format expected by ebookService
 */

const { BatchOptimizationService } = require("./BatchOptimizationService");

/**
 * Sanitize chapter object to remove undefined fields
 * Solution D: Ensure all fields have valid values before serialization
 * Prevents "undefinedundefined" text in HTML output
 *
 * @param {Object} chapter - Raw chapter object
 * @returns {Object} Sanitized chapter with valid defaults
 */
function sanitizeChapter(chapter) {
  return {
    id: chapter.id || `ch_${chapter.chapter}`,
    chapter: chapter.chapter,
    title: chapter.title || "Untitled",
    content: chapter.content || "",
    summary:
      chapter.summary && typeof chapter.summary === "string"
        ? chapter.summary
        : "",
    image: {
      concept: (chapter.image && chapter.image.concept) || "Illustration",
      style: (chapter.image && chapter.image.style) || "varied",
    },
    metadata: {
      voice: (chapter.metadata && chapter.metadata.voice) || "",
      tone: (chapter.metadata && chapter.metadata.tone) || "",
      themes: (chapter.metadata && chapter.metadata.themes) || [],
    },
  };
}

/**
 * Check if ebook qualifies for batch optimization
 * Extended range: 3-25 pages to handle structure-generated metadata chapters
 * (user requests 20, structure generates 22-23 with cover/epilogue)
 *
 * @param {Object} structure - Ebook structure with outline
 * @returns {boolean}
 */
function qualifiesForBatchOptimization(structure) {
  const pageCount = structure?.outline?.length || 0;
  // Extended from 20 to 25 to handle additional metadata chapters
  return pageCount >= 3 && pageCount <= 25;
}

/**
 * Use batch optimization for ebook generation if eligible
 *
 * @param {Object} aiService - AI service instance
 * @param {Object} ebookData - Ebook metadata {title, topic, targetAudience, tone}
 * @param {Object} structure - Ebook structure with outline chapters
 * @param {string} sessionId - Session ID for metrics
 * @returns {Promise<Array|null>} Array of chapter objects, or null if not applicable
 */
async function tryBatchOptimization(
  aiService,
  ebookData,
  structure,
  sessionId
) {
  if (!qualifiesForBatchOptimization(structure)) {
    return null; // Fall back to standard orchestrator
  }

  const chapterCount = structure.outline.length;
  console.log(
    `[BatchOptimization] Eligible ebook (${chapterCount} chapters). Using Stage 1 optimization.`
  );

  const batchService = new BatchOptimizationService(aiService);

  try {
    // Convert structure outline to page-based structure
    const pageStructure = {
      chapters: structure.outline,
      totalPages: chapterCount,
    };

    // Debug: Log the structure being passed
    if (global.__DEBUG_BATCH__) {
      console.log(
        `[BatchOptimization] Input structure has ${pageStructure.chapters.length} chapters`
      );
    }

    // Generate optimized content
    const result = await batchService.generateWithBatching(
      ebookData,
      pageStructure
    );

    // Convert pages back to chapters format
    const chapters = [];
    const { pages, metadata } = result.content;

    for (let i = 0; i < structure.outline.length; i++) {
      const chapterSpec = structure.outline[i];
      const pageNum = i + 1;
      const pageContent = pages[pageNum] || "";

      chapters.push({
        id: `ch_${pageNum}`,
        chapter: chapterSpec.chapter || pageNum,
        title: chapterSpec.title || `Chapter ${pageNum}`,
        content: pageContent,
        summary: pageContent.substring(0, 300),
        image: {
          concept: chapterSpec.title || `Chapter ${pageNum} illustration`,
          style: "varied",
        },
        metadata: {
          voice: metadata.voice,
          tone: metadata.tone,
          themes: metadata.themes,
        },
      });
    }

    // Solution D: Sanitize all chapters to remove undefined fields
    const sanitizedChapters = chapters.map((ch) => sanitizeChapter(ch));

    // Solution A: Defensive sort by chapter number to ensure correct order
    sanitizedChapters.sort((a, b) => {
      const aNum =
        typeof a.chapter === "string" ? parseInt(a.chapter) : a.chapter;
      const bNum =
        typeof b.chapter === "string" ? parseInt(b.chapter) : b.chapter;
      return aNum - bNum;
    });

    // Debug logging
    if (global.__DEBUG_BATCH__) {
      console.log(
        `[BatchOptimization] Final chapters (sanitized & sorted): ${sanitizedChapters
          .map((ch) => ch.chapter)
          .join(",")}`
      );
    }

    console.log(
      `[BatchOptimization] Generated ${sanitizedChapters.length} chapters with ${result.metrics.totalLatency}ms total latency`
    );

    return sanitizedChapters;
  } catch (error) {
    console.error(`[BatchOptimization] Optimization failed: ${error.message}`);
    if (global.__DEBUG_BATCH__) {
      console.error("[BatchOptimization] Full error:", error);
    }
    console.error(
      `[BatchOptimization] Falling back to legacy batch orchestrator.`
    );
    return null;
  }
}

module.exports = {
  qualifiesForBatchOptimization,
  tryBatchOptimization,
};
