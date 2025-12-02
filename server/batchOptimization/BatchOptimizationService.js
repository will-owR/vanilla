/**
 * BatchOptimizationService
 *
 * Core orchestrator for batch-optimized ebook generation.
 * Implements Stage 1: Fixed 3-page sequential batches for 3-20 page ebooks.
 *
 * Flow:
 * 1. Generate structure (Pro model, individual request)
 * 2. Generate Page 1 (Flash model, individual request - voice establishment)
 * 3. Generate middle pages in 3-page batches (Flash model, batched)
 * 4. Generate final page (Flash model, individual request - conclusion)
 * 5. Return complete ebook + metrics
 */

const { RateLimiter } = require("./RateLimiter");
const { GenerationMetrics } = require("./GenerationMetrics");
const { ContentExtractors } = require("./ContentExtractors");
const { PromptTemplates } = require("./PromptTemplates");

class BatchOptimizationService {
  /**
   * Constructor
   *
   * @param {Object} aiService - AI service (e.g., from aiService.js)
   * @param {Object} logger - Optional logger (defaults to console)
   */
  constructor(aiService, logger) {
    this.aiService = aiService;
    this.logger = logger || console;
    this.rateLimiter = new RateLimiter();
    this.metrics = new GenerationMetrics();
  }

  /**
   * Main entry point: Generate ebook with batch optimization
   *
   * @param {Object} ebookData - {title, subtitle, topic, targetAudience, tone}
   * @param {Object} structure - {chapters: [...], totalPages: number}
   * @returns {Promise<{content, metrics, sessionId}>}
   */
  async generateWithBatching(ebookData, structure) {
    const sessionId = this.metrics.startSession(ebookData);

    try {
      const totalPages = structure?.chapters?.length || 0;

      // Validate page count for Stage 1
      if (totalPages < 3 || totalPages > 20) {
        throw new Error(
          `Stage 1 only supports 3-20 pages. Got ${totalPages} pages.`
        );
      }

      this.logger.log(
        `[BatchOptimization] Starting generation for "${ebookData.title}" (${totalPages} pages)`
      );

      // Step 1: Generate structure
      const generatedStructure = await this._generateStructure(
        sessionId,
        ebookData
      );

      // Step 2: Generate Page 1 (voice establishment)
      const page1 = await this._generatePage(sessionId, 1, {
        ...ebookData,
        structure: generatedStructure,
      });

      // Step 3: Extract voice/tone/themes from Page 1
      const voice = ContentExtractors.extractVoice(page1);
      const tone = ContentExtractors.extractTone(page1);
      const themes = ContentExtractors.extractThemes(page1);
      const characters = ContentExtractors.extractCharacters(page1);

      this.logger.log(
        `[BatchOptimization] Extracted voice: ${voice}, tone: ${tone}`
      );

      // Step 4: Generate middle pages in 3-page batches
      const pages = { 1: page1 };
      const middlePages = Array.from(
        { length: totalPages - 2 },
        (_, i) => i + 2
      );

      if (middlePages.length > 0) {
        await this._generateMiddlePageBatches(sessionId, middlePages, {
          ...ebookData,
          structure: generatedStructure,
          voice,
          tone,
          themes,
          characters,
          page1,
          pages,
        });
      }

      // Step 5: Generate final page
      if (totalPages > 1) {
        const finalPageNum = totalPages;
        const page = await this._generatePage(sessionId, finalPageNum, {
          ...ebookData,
          structure: generatedStructure,
          voice,
          tone,
          themes,
          characters,
          narrativeSummary: this._buildNarrativeSummary(
            pages,
            finalPageNum - 1
          ),
        });
        pages[finalPageNum] = page;
      }

      // Finalize metrics
      this.metrics.finalizeSession(sessionId, pages);

      const sessionMetrics = this.metrics.getSessionMetrics(sessionId);
      this.logger.log(
        `[BatchOptimization] Generation complete. API calls: ${sessionMetrics.apiCallsCount}`
      );

      return {
        content: {
          structure: generatedStructure,
          pages,
          metadata: {
            title: ebookData.title,
            topic: ebookData.topic,
            voice,
            tone,
            themes,
            totalPages,
          },
        },
        metrics: sessionMetrics,
        sessionId,
      };
    } catch (error) {
      this.metrics.recordError(sessionId, error);
      this.logger.error(
        `[BatchOptimization] Generation failed: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Step 1: Generate structure (Pro model, individual request)
   *
   * @private
   * @param {string} sessionId
   * @param {Object} ebookData
   * @returns {Promise<Object>}
   */
  async _generateStructure(sessionId, ebookData) {
    const prompt = PromptTemplates.structurePrompt(ebookData);

    const startTime = Date.now();
    const structure = await this.rateLimiter.enqueue(async () => {
      try {
        // Structure generation uses callIndex=0 to target Pro model via rotation
        const response = await this.aiService.generateContentWithRotation(
          prompt,
          0
        );
        // Extract text from response object
        const text =
          response?.content?.body || response?.text || String(response);
        return this._parseJsonResponse(text);
      } catch (error) {
        throw new Error(`Structure generation failed: ${error.message}`);
      }
    });
    const latencyMs = Date.now() - startTime;

    this.metrics.recordStructure(sessionId, structure, latencyMs);
    return structure;
  }

  /**
   * Step 2/5: Generate individual page (Flash model)
   * Used for Page 1, final page, and fallback pages
   *
   * @private
   * @param {string} sessionId
   * @param {number} pageNumber
   * @param {Object} params - Generation parameters
   * @returns {Promise<string>}
   */
  async _generatePage(sessionId, pageNumber, params) {
    let prompt;

    if (pageNumber === 1) {
      prompt = PromptTemplates.page1Prompt({
        title: params.title,
        subtitle: params.subtitle,
        topic: params.topic,
        targetAudience: params.targetAudience,
        tone: params.tone,
        voiceStyle: params.voiceStyle || "natural and engaging",
        structure: params.structure,
      });
    } else if (pageNumber === params.structure?.chapters?.length) {
      // Final page
      const previousPageNum = pageNumber - 1;
      const previousPageSummary = params.pages?.[previousPageNum]
        ? ContentExtractors.extractSummary(params.pages[previousPageNum])
        : "";

      prompt = PromptTemplates.finalPagePrompt({
        structure: params.structure,
        voice: params.voice,
        tone: params.tone,
        themes: params.themes,
        characters: params.characters,
        narrativeSummary: previousPageSummary,
      });
    } else {
      // Middle page fallback
      const previousPageNum = pageNumber - 1;
      const nextPageNum = pageNumber + 1;
      const previousPageSummary = params.pages?.[previousPageNum]
        ? ContentExtractors.extractSummary(params.pages[previousPageNum])
        : "";

      const upcomingChapter = params.structure?.chapters?.[nextPageNum - 1];
      const upcomingPageTitle =
        upcomingChapter?.title || `Chapter ${nextPageNum}`;

      prompt = PromptTemplates.fallbackPagePrompt({
        pageNumber,
        structure: params.structure,
        voice: params.voice,
        tone: params.tone,
        themes: params.themes,
        previousPageSummary,
        upcomingPageTitle,
      });
    }

    const startTime = Date.now();
    let pageContent;

    try {
      pageContent = await this.rateLimiter.enqueue(async () => {
        // Page generation uses callIndex > 0 to target Flash model via rotation
        const response = await this.aiService.generateContentWithRotation(
          prompt,
          1
        );
        const text =
          response?.content?.body || response?.text || String(response);
        return this._extractPageContent(text);
      });

      const latencyMs = Date.now() - startTime;
      this.metrics.recordPage(sessionId, pageNumber, latencyMs);

      return pageContent;
    } catch (error) {
      this.metrics.recordFailedPage(sessionId, pageNumber);
      throw new Error(
        `Failed to generate page ${pageNumber}: ${error.message}`
      );
    }
  }

  /**
   * Step 4: Generate middle pages in 3-page batches
   *
   * @private
   * @param {string} sessionId
   * @param {Array<number>} pageNumbers - Pages to generate (2 through N-1)
   * @param {Object} params - Generation parameters
   * @returns {Promise<void>}
   */
  async _generateMiddlePageBatches(sessionId, pageNumbers, params) {
    // Split into 3-page batches
    const batchSize = 3;
    const batches = [];

    for (let i = 0; i < pageNumbers.length; i += batchSize) {
      batches.push(pageNumbers.slice(i, i + batchSize));
    }

    this.logger.log(
      `[BatchOptimization] Generating ${pageNumbers.length} middle pages in ${batches.length} batches`
    );

    for (const batchPageNumbers of batches) {
      try {
        const batchContent = await this._generateBatch(
          sessionId,
          batchPageNumbers,
          params
        );
        Object.assign(params.pages, batchContent);
      } catch (error) {
        this.logger.warn(
          `[BatchOptimization] Batch failed for pages ${batchPageNumbers.join(
            ", "
          )}, falling back to individual pages`
        );

        // Fallback: Generate each page individually
        for (const pageNum of batchPageNumbers) {
          try {
            const page = await this._generatePageWithFallback(
              sessionId,
              pageNum,
              params
            );
            params.pages[pageNum] = page;
          } catch (fallbackError) {
            this.logger.error(
              `[BatchOptimization] Fallback failed for page ${pageNum}: ${fallbackError.message}`
            );
            throw fallbackError;
          }
        }
      }
    }
  }

  /**
   * Generate a batch of 3 pages in one request
   *
   * @private
   * @param {string} sessionId
   * @param {Array<number>} pageNumbers - 3 page numbers
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} - {pageNumber: content, ...}
   */
  async _generateBatch(sessionId, pageNumbers, params) {
    const previousPageNum = pageNumbers[0] - 1;
    const previousPageSummary = params.pages?.[previousPageNum]
      ? ContentExtractors.extractSummary(params.pages[previousPageNum])
      : "";

    const nextPageNum = pageNumbers[pageNumbers.length - 1] + 1;
    const upcomingChapter = params.structure?.chapters?.[nextPageNum - 1];
    const upcomingPageTitle =
      upcomingChapter?.title || `Chapter ${nextPageNum}`;

    const prompt = PromptTemplates.batchPrompt({
      pageNumbers,
      structure: params.structure,
      voice: params.voice,
      tone: params.tone,
      themes: params.themes,
      characters: params.characters,
      previousPageSummary,
      upcomingPageTitle,
    });

    const startTime = Date.now();

    const batchResponse = await this.rateLimiter.enqueue(async () => {
      // Batch generation uses callIndex > 0 to target Flash model via rotation
      const response = await this.aiService.generateContentWithRotation(
        prompt,
        1
      );
      const text =
        response?.content?.body || response?.text || String(response);
      return text;
    });

    const latencyMs = Date.now() - startTime;
    const batchContent = this._parseBatchResponse(batchResponse, pageNumbers);

    this.metrics.recordBatch(sessionId, pageNumbers, latencyMs);

    // Record each page from batch
    pageNumbers.forEach((pageNum) => {
      if (batchContent[pageNum]) {
        this.metrics.recordPage(
          sessionId,
          pageNum,
          latencyMs / pageNumbers.length
        );
      }
    });

    return batchContent;
  }

  /**
   * Generate page with fallback to individual generation
   *
   * @private
   * @param {string} sessionId
   * @param {number} pageNumber
   * @param {Object} params
   * @returns {Promise<string>}
   */
  async _generatePageWithFallback(sessionId, pageNumber, params) {
    try {
      const page = await this._generatePage(sessionId, pageNumber, params);
      this.metrics.recordPage(sessionId, pageNumber, 0);
      return page;
    } catch (error) {
      this.metrics.recordFallbackPage(sessionId, pageNumber);
      this.logger.warn(
        `[BatchOptimization] Using fallback for page ${pageNumber}`
      );
      throw error;
    }
  }

  /**
   * Parse batch response into individual pages
   * Assumes response contains clear page breaks (e.g., "--- PAGE 2 ---")
   *
   * @private
   * @param {string} response - Raw batch response
   * @param {Array<number>} pageNumbers - Page numbers in batch
   * @returns {Object} - {pageNumber: content, ...}
   */
  _parseBatchResponse(response, pageNumbers) {
    const pages = {};

    // Try to split by page markers
    const pagePattern =
      /(?:---\s*PAGE\s*(\d+)\s*---|Page\s+(\d+):|Chapter\s+(\d+):)/i;
    const splits = response.split(pagePattern);

    let currentPageNum = null;
    let currentContent = "";

    for (let i = 0; i < splits.length; i++) {
      const part = splits[i];

      // Check if this is a page number marker
      const pageNum = parseInt(part);
      if (!isNaN(pageNum) && pageNumbers.includes(pageNum)) {
        // Save previous page if it exists
        if (currentPageNum !== null && currentContent.trim()) {
          pages[currentPageNum] = currentContent.trim();
        }
        currentPageNum = pageNum;
        currentContent = "";
      } else if (currentPageNum !== null) {
        // Accumulate content for current page
        currentContent += part;
      }
    }

    // Save last page
    if (currentPageNum !== null && currentContent.trim()) {
      pages[currentPageNum] = currentContent.trim();
    }

    // Handle case where batch response doesn't have clear page breaks
    // Fallback: Split content approximately equally
    if (Object.keys(pages).length === 0) {
      const wordsPerPage = response.split(/\s+/).length / pageNumbers.length;
      const wordThreshold = Math.ceil(wordsPerPage);
      const words = response.split(/\s+/);

      let pageIndex = 0;
      let pageContent = [];

      for (let i = 0; i < words.length; i++) {
        pageContent.push(words[i]);

        if (
          pageContent.length >= wordThreshold ||
          pageIndex === pageNumbers.length - 1
        ) {
          pages[pageNumbers[pageIndex]] = pageContent.join(" ");
          pageContent = [];
          pageIndex++;
        }
      }

      // Add remaining content to last page
      if (pageContent.length > 0 && pageIndex > 0) {
        pages[pageNumbers[pageIndex - 1]] += " " + pageContent.join(" ");
      }
    }

    return pages;
  }

  /**
   * Extract page content from response
   * Removes metadata/markers, keeps clean text
   *
   * @private
   * @param {string} response - Raw response
   * @returns {string} - Clean page content
   */
  _extractPageContent(response) {
    // Remove page markers if present
    let content = response
      .replace(/^[-\s]*PAGE\s+\d+[-\s]*$/gim, "")
      .replace(/^[-\s]*Chapter\s+\d+[-\s]*$/gim, "")
      .trim();

    return content;
  }

  /**
   * Parse JSON from response (structure generation)
   *
   * @private
   * @param {string} response
   * @returns {Object}
   */
  _parseJsonResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: return as-is if already parsed
      if (typeof response === "object") {
        return response;
      }

      throw new Error("No valid JSON found in response");
    } catch (error) {
      throw new Error(`Failed to parse structure response: ${error.message}`);
    }
  }

  /**
   * Build narrative summary from generated pages
   *
   * @private
   * @param {Object} pages - {pageNumber: content}
   * @param {number} upToPage - Include pages up to this number
   * @returns {string}
   */
  _buildNarrativeSummary(pages, upToPage) {
    const summaries = [];

    for (let i = 1; i <= upToPage; i++) {
      if (pages[i]) {
        summaries.push(ContentExtractors.extractSummary(pages[i]));
      }
    }

    return summaries.join(" ");
  }
}

module.exports = { BatchOptimizationService };
