/**
 * SVG Library - Phase A-B Module 1
 *
 * PostgreSQL-backed SVG/image asset management
 * - Stores generated SVGs with searchable metadata (JSONB)
 * - Implements query-first strategy to reduce AI image generation costs
 * - Tracks usage for analytics and pruning
 *
 * Cost Optimization:
 * - SVG library hit rate target: >60%
 * - Estimated cost savings: 50-75% reduction in AI image API calls
 *
 * Database Schema:
 * CREATE TABLE svg_library (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   svg_data TEXT NOT NULL,
 *   png_url VARCHAR(512),
 *   metadata JSONB NOT NULL,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   deleted_at TIMESTAMP,
 *   created_by VARCHAR(255),
 *   file_size_bytes INTEGER,
 *   render_time_ms INTEGER
 * );
 *
 * Indexes:
 * - GIN index on metadata (concept, style, theme)
 * - Index on usage_count (descending)
 * - Index on created_at (descending)
 */

/**
 * @typedef {Object} SVGLibraryItem
 * @property {string} id - UUID
 * @property {string} svgData - Full SVG markup
 * @property {string} [pngUrl] - Rasterized fallback URL
 * @property {Object} metadata - Searchable metadata
 * @property {string} metadata.concept - Primary concept (e.g., "summer", "nature")
 * @property {string} metadata.style - Visual style (e.g., "whimsical", "gothic")
 * @property {string[]} metadata.theme - Array of themes (e.g., ["playful-colors", "magical"])
 * @property {string} [metadata.audience] - Target audience
 * @property {string} metadata.sourcePrompt - Original user request
 * @property {string} metadata.generatedPrompt - AI-refined prompt
 * @property {string} metadata.sourceProvider - "gemini", "github-models", "manual", "template"
 * @property {Date} metadata.createdAt
 * @property {number} metadata.usageCount - Number of times reused
 * @property {string[]} metadata.tags - Searchable tags
 * @property {string} metadata.license - "cc0", "proprietary", "custom"
 */

let db = null; // Lazy-loaded Prisma client

/**
 * Initialize database connection
 * @private
 */
function getDB() {
  if (!db) {
    try {
      const { PrismaClient } = require("@prisma/client");
      db = new PrismaClient();
    } catch (error) {
      // Provide a clearer error message
      const err = new Error(
        `Prisma Client initialization failed: ${error.message}. Please ensure DATABASE_URL is set and "prisma generate" has been run.`
      );
      err.originalError = error;
      throw err;
    }
  }
  return db;
}

class SVGLibrary {
  /**
   * Search SVG library by concept + style
   * @param {string} concept - Concept to search (e.g., "summer")
   * @param {string} style - Style to search (e.g., "whimsical")
   * @param {Object} [options] - Search options
   * @param {string} [options.theme] - Optional theme filter
   * @param {string} [options.audience] - Optional audience filter
   * @param {number} [options.limit] - Result limit (default: 1)
   * @returns {Promise<SVGLibraryItem|null>}
   */
  async search(concept, style, options = {}) {
    try {
      const db = getDB();
      const limit = options.limit || 1;

      // Build metadata filter conditions
      const whereConditions = {
        AND: [
          {
            metadata: {
              path: ["concept"],
              string_contains: concept.toLowerCase(),
            },
          },
          {
            metadata: {
              path: ["style"],
              string_contains: style.toLowerCase(),
            },
          },
          { deletedAt: null },
        ],
      };

      // Add optional filters
      if (options.theme) {
        whereConditions.AND.push({
          metadata: {
            path: ["theme", "0"],
            string_contains: options.theme.toLowerCase(),
          },
        });
      }

      if (options.audience) {
        whereConditions.AND.push({
          metadata: {
            path: ["audience"],
            string_contains: options.audience.toLowerCase(),
          },
        });
      }

      // Query: sort by usage count (most reused first)
      const results = await db.$queryRaw`
        SELECT * FROM svg_library
        WHERE metadata->>'concept' ILIKE ${`%${concept}%`}
          AND metadata->>'style' ILIKE ${`%${style}%`}
          AND deleted_at IS NULL
        ORDER BY CAST(metadata->>'usageCount' AS INTEGER) DESC
        LIMIT ${limit}
      `;

      return results && results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error("SVG Library search failed:", error.message);
      return null;
    }
  }

  /**
   * Store SVG + metadata in library
   * @param {string} svgData - Full SVG markup
   * @param {Object} metadata - Asset metadata
   * @returns {Promise<string>} UUID of stored item
   */
  async store(svgData, metadata) {
    // Validate parameters first (before connecting to DB)
    if (!svgData || !metadata) {
      throw new Error("svgData and metadata required");
    }

    try {
      const db = getDB();

      // Ensure metadata has required fields
      const normalizedMetadata = {
        concept: metadata.concept || "uncategorized",
        style: metadata.style || "default",
        theme: Array.isArray(metadata.theme) ? metadata.theme : [],
        audience: metadata.audience || null,
        sourcePrompt: metadata.sourcePrompt || "",
        generatedPrompt: metadata.generatedPrompt || "",
        sourceProvider: metadata.sourceProvider || "manual",
        createdAt: new Date().toISOString(),
        usageCount: 0,
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        license: metadata.license || "proprietary",
      };

      const result = await db.$queryRaw`
        INSERT INTO svg_library (svg_data, metadata, created_at, updated_at)
        VALUES (${svgData}, ${JSON.stringify(normalizedMetadata)}, NOW(), NOW())
        RETURNING id
      `;

      return result[0].id;
    } catch (error) {
      console.error("SVG Library store failed:", error.message);
      throw error;
    }
  }

  /**
   * Retrieve SVG by ID
   * @param {string} id - UUID
   * @returns {Promise<SVGLibraryItem|null>}
   */
  async get(id) {
    try {
      const db = getDB();
      const result = await db.$queryRaw`
        SELECT * FROM svg_library WHERE id = ${id} AND deleted_at IS NULL
      `;
      return result && result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error("SVG Library get failed:", error.message);
      return null;
    }
  }

  /**
   * Increment usage counter
   * @param {string} id - UUID
   * @returns {Promise<void>}
   */
  async incrementUsage(id) {
    try {
      const db = getDB();
      await db.$queryRaw`
        UPDATE svg_library
        SET metadata = jsonb_set(
              metadata,
              '{usageCount}',
              to_jsonb((COALESCE(metadata->>'usageCount', '0')::int + 1))
            ),
            updated_at = NOW()
        WHERE id = ${id}
      `;
    } catch (error) {
      console.error("SVG Library incrementUsage failed:", error.message);
      throw error;
    }
  }

  /**
   * Semantic search (placeholder for future embeddings)
   * @param {string} query - Search query
   * @param {number} [limit] - Result limit
   * @returns {Promise<SVGLibraryItem[]>}
   */
  async semanticSearch(query, limit = 5) {
    try {
      // Phase B+: Use vector embeddings for fuzzy matching
      // For now: fallback to keyword matching
      const db = getDB();
      const results = await db.$queryRaw`
        SELECT * FROM svg_library
        WHERE (metadata->>'concept' ILIKE ${`%${query}%`}
           OR metadata->>'tags' ILIKE ${`%${query}%`}
           OR metadata->>'sourcePrompt' ILIKE ${`%${query}%`})
          AND deleted_at IS NULL
        ORDER BY CAST(metadata->>'usageCount' AS INTEGER) DESC
        LIMIT ${limit}
      `;
      return results || [];
    } catch (error) {
      console.error("SVG Library semanticSearch failed:", error.message);
      return [];
    }
  }

  /**
   * Prune unused old items
   * @param {Date} olderThan - Delete items created before this date
   * @param {number} [threshold] - Min usage count to keep (default: 0)
   * @returns {Promise<number>} Number of items deleted
   */
  async pruneUnused(olderThan, threshold = 0) {
    try {
      const db = getDB();
      const result = await db.$queryRaw`
        DELETE FROM svg_library
        WHERE created_at < ${olderThan}
          AND CAST(metadata->>'usageCount' AS INTEGER) <= ${threshold}
        RETURNING id
      `;
      return result ? result.length : 0;
    } catch (error) {
      console.error("SVG Library pruneUnused failed:", error.message);
      return 0;
    }
  }

  /**
   * Get library statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const db = getDB();
      const stats = await db.$queryRaw`
        SELECT
          COUNT(*)::integer as "totalItems",
          COALESCE(AVG(CAST(metadata->>'usageCount' AS INTEGER)), 0)::float as "avgUsage",
          COALESCE(MAX(CAST(metadata->>'usageCount' AS INTEGER)), 0)::integer as "maxUsage",
          COUNT(DISTINCT metadata->>'concept')::integer as "uniqueConcepts",
          COUNT(DISTINCT metadata->>'style')::integer as "uniqueStyles",
          MAX(created_at) as "newestItem",
          MIN(created_at) as "oldestItem"
        FROM svg_library
        WHERE deleted_at IS NULL
      `;
      return stats && stats.length > 0
        ? stats[0]
        : {
            totalItems: 0,
            avgUsage: 0,
            maxUsage: 0,
            uniqueConcepts: 0,
            uniqueStyles: 0,
          };
    } catch (error) {
      console.error("SVG Library getStats failed:", error.message);
      return { error: error.message };
    }
  }

  /**
   * Soft delete an item
   * @param {string} id - UUID
   * @returns {Promise<void>}
   */
  async delete(id) {
    try {
      const db = getDB();
      await db.$queryRaw`
        UPDATE svg_library
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = ${id}
      `;
    } catch (error) {
      console.error("SVG Library delete failed:", error.message);
      throw error;
    }
  }
}

// Export singleton instance
const svgLibraryInstance = new SVGLibrary();

module.exports = {
  SVGLibrary,
  svgLibraryInstance,
};
