/**
 * ImageService - Generate images with SVG library caching
 *
 * Responsibility:
 * - Query SVG library first (PostgreSQL JSONB)
 * - Fallback to Gemini API on cache miss
 * - Store new images in SVG library
 * - Track usage statistics for cache optimization
 *
 * Goal: 60%+ hit rate → $24/mo cost (vs. $60 baseline)
 */

class ImageService {
  /**
   * Get image from cache or generate via Gemini
   * @param {string} topic - Image topic
   * @param {string} style - Visual style (e.g., "watercolor", "abstract")
   * @param {number} pageCount - Total page count (for context)
   * @param {Object} db - Database instance (for mocking in tests)
   * @param {Object} geminiClient - Gemini API client (for mocking in tests)
   * @returns {Promise<Object>} { svg, cached, source }
   */
  async getImage(topic, style, pageCount, db, geminiClient) {
    // Validate inputs
    if (!topic || typeof topic !== "string") {
      throw new Error("ImageService: topic must be a non-empty string");
    }
    if (!style || typeof style !== "string") {
      throw new Error("ImageService: style must be a non-empty string");
    }
    if (typeof pageCount !== "number" || pageCount < 3 || pageCount > 20) {
      throw new Error("ImageService: pageCount must be between 3 and 20");
    }

    // STEP 1: Query SVG library
    const cached = await this._querySVGLibrary(topic, style, db);
    if (cached) {
      // Increment usage for hit rate tracking
      await this._incrementUsage(cached.id, db);
      return {
        svg: cached.svg,
        cached: true,
        source: "library",
        usage: cached.usage + 1,
      };
    }

    // STEP 2: Fallback to Gemini API
    let generated;
    try {
      generated = await this._generateWithGemini(
        topic,
        style,
        pageCount,
        geminiClient
      );
    } catch (err) {
      // Graceful degradation: return SVG fallback
      return {
        svg: this._getFallbackSVG(topic, style),
        cached: false,
        source: "fallback",
        error: err.message,
      };
    }

    // STEP 3: Store in library
    await this._storeSVGLibrary(generated, { topic, style, pageCount }, db);

    return {
      svg: generated,
      cached: false,
      source: "gemini",
    };
  }

  /**
   * Query SVG library for existing image
   * @private
   * @param {string} topic - Topic to search
   * @param {string} style - Style to search
   * @param {Object} db - Database instance
   * @returns {Promise<Object|null>} Cached SVG or null
   */
  async _querySVGLibrary(topic, style, db) {
    if (!db) {
      // Mock: simulate cache hit 60% of the time
      if (Math.random() < 0.6) {
        return {
          id: `svg-${topic}-${style}`,
          svg: this._generateMockSVG(topic, style),
          usage: Math.floor(Math.random() * 50),
        };
      }
      return null;
    }

    try {
      // Real DB query (Prisma)
      return await db.svgLibrary.findFirst({
        where: {
          metadata: {
            path: ["topic"],
            equals: topic,
          },
        },
        orderBy: { usage: "desc" },
      });
    } catch (err) {
      // Silently fail DB query, fallback to generation
      return null;
    }
  }

  /**
   * Generate image via Gemini API
   * @private
   * @param {string} topic - Image topic
   * @param {string} style - Visual style
   * @param {number} pageCount - For context (e.g., dense docs get detailed images)
   * @param {Object} geminiClient - Gemini client
   * @returns {Promise<string>} SVG content
   */
  async _generateWithGemini(topic, style, pageCount, geminiClient) {
    if (!geminiClient) {
      // Mock: return generated SVG
      return this._generateMockSVG(topic, style);
    }

    // Build detailed prompt based on context
    const density =
      pageCount <= 5 ? "sparse" : pageCount <= 15 ? "medium" : "dense";
    const prompt = `Create a modern SVG illustration for a book chapter titled "${topic}". 
Style: ${style}. 
Density: ${density} (${pageCount} pages total).
Requirements:
- SVG format only (no PNG/JPEG)
- Dimensions: 512x512
- Professional, book-quality illustration
- Thematic to "${topic}"`;

    try {
      const response = await geminiClient.generateImage({
        prompt,
        size: "512x512",
        type: "svg",
      });

      return response.svg || response;
    } catch (err) {
      throw new Error(`Gemini API error: ${err.message}`);
    }
  }

  /**
   * Store image in SVG library
   * @private
   * @param {string} svg - SVG content
   * @param {Object} metadata - Metadata { topic, style, pageCount }
   * @param {Object} db - Database instance
   * @returns {Promise<Object>} Stored record
   */
  async _storeSVGLibrary(svg, metadata, db) {
    if (!db) {
      // Mock: return mock record
      return {
        id: `svg-new-${Date.now()}`,
        svg,
        metadata,
        usage: 1,
        createdAt: new Date(),
      };
    }

    try {
      // Real DB store (Prisma)
      return await db.svgLibrary.create({
        data: {
          svg,
          metadata,
          usage: 1,
          createdAt: new Date(),
        },
      });
    } catch (err) {
      // Silently fail storage (image already generated, can continue)
      console.warn("ImageService: Failed to store SVG:", err.message);
      return {
        id: "temp-" + Date.now(),
        svg,
        metadata,
        usage: 1,
      };
    }
  }

  /**
   * Increment usage counter for cache analytics
   * @private
   * @param {string} id - SVG record ID
   * @param {Object} db - Database instance
   * @returns {Promise<void>}
   */
  async _incrementUsage(id, db) {
    if (!db) {
      // Mock: no-op
      return;
    }

    try {
      await db.svgLibrary.update({
        where: { id },
        data: { usage: { increment: 1 } },
      });
    } catch (err) {
      // Silently fail (not critical)
      console.warn("ImageService: Failed to increment usage:", err.message);
    }
  }

  /**
   * Get library statistics for hit rate calculation
   * @param {Object} db - Database instance
   * @returns {Promise<Object>} { totalRequests, cacheHits, hitRate }
   */
  async getLibraryStats(db) {
    if (!db) {
      // Mock stats
      return {
        totalImages: Math.floor(Math.random() * 1000),
        totalUsage: Math.floor(Math.random() * 5000),
        hitRate: 0.6,
        topTopics: ["summer", "nature", "abstract"],
      };
    }

    try {
      const images = await db.svgLibrary.findMany();
      const totalUsage = images.reduce((sum, img) => sum + img.usage, 0);
      const totalImages = images.length;

      return {
        totalImages,
        totalUsage,
        hitRate: totalUsage / (totalUsage + totalImages * 0.4), // Rough estimate
        topTopics: [...new Set(images.map((img) => img.metadata.topic))].slice(
          0,
          5
        ),
      };
    } catch (err) {
      throw new Error(`ImageService: Failed to get stats: ${err.message}`);
    }
  }

  /**
   * Generate mock SVG for testing/fallback
   * @private
   * @param {string} topic - Topic
   * @param {string} style - Style
   * @returns {string} SVG content
   */
  _generateMockSVG(topic, style) {
    const colors = {
      watercolor: ["#7fc7af", "#d4f1f4", "#a8dadc"],
      abstract: ["#f72585", "#b5179e", "#3a0ca3"],
      minimalist: ["#000000", "#ffffff", "#cccccc"],
      vibrant: ["#ff006e", "#fb5607", "#ffbe0b"],
    };

    const palette = colors[style] || colors.abstract;
    const bgColor = palette[0];
    const fgColor = palette[1];

    return `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="${bgColor}"/>
      <circle cx="256" cy="256" r="100" fill="${fgColor}"/>
      <text x="256" y="300" text-anchor="middle" fill="white" font-size="16">
        ${topic.substring(0, 20)}
      </text>
    </svg>`;
  }

  /**
   * Fallback SVG when Gemini fails
   * @private
   * @param {string} topic - Topic
   * @param {string} style - Style
   * @returns {string} Fallback SVG
   */
  _getFallbackSVG(topic, style) {
    return `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#f0f0f0"/>
      <text x="256" y="256" text-anchor="middle" fill="#333" font-size="14">
        Image unavailable: ${topic}
      </text>
    </svg>`;
  }

  /**
   * Clear library (for maintenance/reset)
   * @param {Object} db - Database instance
   * @returns {Promise<number>} Number of records deleted
   */
  async clearLibrary(db) {
    if (!db) {
      return 0;
    }

    try {
      const result = await db.svgLibrary.deleteMany();
      return result.count;
    } catch (err) {
      throw new Error(`ImageService: Failed to clear library: ${err.message}`);
    }
  }
}

module.exports = new ImageService();
