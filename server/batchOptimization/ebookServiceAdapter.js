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
 * Check if ebook qualifies for batch optimization
 * @param {Object} structure - Ebook structure with outline
 * @returns {boolean}
 */
function qualifiesForBatchOptimization(structure) {
  const pageCount = structure?.outline?.length || 0;
  return pageCount >= 3 && pageCount <= 20;
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

  console.log(
    `[BatchOptimization] Eligible ebook (${structure.outline.length} chapters). Using Stage 1 optimization.`
  );

  const batchService = new BatchOptimizationService(aiService);

  try {
    // Convert structure outline to page-based structure
    const pageStructure = {
      chapters: structure.outline,
      totalPages: structure.outline.length,
    };

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

    console.log(
      `[BatchOptimization] Generated ${chapters.length} chapters with ${result.metrics.totalLatency}ms total latency`
    );

    return chapters;
  } catch (error) {
    console.error(
      `[BatchOptimization] Optimization failed: ${error.message}. Falling back to standard orchestrator.`
    );
    return null;
  }
}

module.exports = {
  qualifiesForBatchOptimization,
  tryBatchOptimization,
};
