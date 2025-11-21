/**
 * TOCGenerator - Generate hierarchical Table of Contents
 *
 * Responsibility:
 * - Build hierarchical TOC from chapters (level 1 → level 2)
 * - Track page numbers from pageMap
 * - Generate PDF anchors (kebab-case, sanitized)
 *
 * Contract:
 * Input: chapters (array), pageMap (Map)
 * Output: { entries (hierarchy), anchors (Map) }
 */

class TOCGenerator {
  /**
   * Generate TOC from chapters and page mapping
   * @param {Array} chapters - Array of chapter objects with { id, title, level }
   * @param {Map} pageMap - Map of chapter IDs to page numbers
   * @returns {Object} { entries: hierarchical TOC, anchors: Map<id, anchor> }
   */
  generate(chapters, pageMap) {
    if (!chapters || !Array.isArray(chapters)) {
      throw new Error("chapters must be an array");
    }
    if (!pageMap || !(pageMap instanceof Map)) {
      throw new Error("pageMap must be a Map");
    }

    // Build hierarchy and track anchors
    const entries = this._buildHierarchy(chapters, pageMap);
    const anchors = this._buildAnchorsMap(chapters);

    return {
      entries,
      anchors,
    };
  }

  /**
   * Build hierarchical TOC structure
   * @private
   * @param {Array} chapters - Chapters array
   * @param {Map} pageMap - Chapter ID to page number mapping
   * @returns {Array} Hierarchical entries with children
   */
  _buildHierarchy(chapters, pageMap) {
    const result = [];
    let currentParent = null;

    for (const chapter of chapters) {
      const pageNumber = pageMap.get(chapter.id);
      if (pageNumber === undefined) {
        throw new Error(`Page number not found for chapter: ${chapter.id}`);
      }

      const entry = {
        level: chapter.level,
        title: chapter.title,
        pageNumber,
        anchor: this._generateAnchor(chapter.title, chapter.id),
        children: [],
      };

      if (chapter.level === 1) {
        result.push(entry);
        currentParent = entry;
      } else if (chapter.level === 2) {
        if (!currentParent) {
          throw new Error("Level 2 chapter without level 1 parent");
        }
        currentParent.children.push(entry);
      } else if (chapter.level > 2) {
        // Support deeper nesting if needed
        if (!currentParent) {
          throw new Error(`Level ${chapter.level} chapter without parent`);
        }
        // For now, treat level 3+ as level 2 (attach to parent)
        currentParent.children.push(entry);
      }
    }

    return result;
  }

  /**
   * Build anchors map for PDF linking
   * @private
   * @param {Array} chapters - Chapters array
   * @returns {Map} Map of chapter ID to anchor string
   */
  _buildAnchorsMap(chapters) {
    const anchors = new Map();

    for (const chapter of chapters) {
      anchors.set(chapter.id, this._generateAnchor(chapter.title, chapter.id));
    }

    return anchors;
  }

  /**
   * Generate PDF anchor from title
   * Converts "Summer's Golden Hour" → "ch1-summers-golden-hour"
   *
   * @private
   * @param {string} title - Chapter title
   * @param {string} chapterId - Chapter ID (for context)
   * @returns {string} Kebab-case anchor safe for PDF
   */
  _generateAnchor(title, chapterId) {
    if (typeof title !== "string") {
      throw new Error("title must be a string");
    }

    // Convert to lowercase and remove special characters, keep alphanumeric and spaces
    let anchor = title
      .toLowerCase()
      .replace(/['']/g, "") // Remove apostrophes
      .replace(/[^a-z0-9\s-]/g, "") // Keep alphanumeric, spaces, hyphens
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Collapse multiple hyphens
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

    // Ensure not empty - fallback to chapterId
    if (!anchor) {
      anchor = chapterId
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    // Max 80 chars for PDF
    return anchor.substring(0, 80);
  }

  /**
   * Track page numbers from pageMap
   * (Utility method for debugging/validation)
   * @private
   * @param {Array} chapters - Chapters array
   * @param {Map} pageMap - Page mapping
   * @returns {Object} Flattened page number tracker
   */
  _trackPageNumbers(chapters, pageMap) {
    const tracker = {};

    for (const chapter of chapters) {
      tracker[chapter.id] = pageMap.get(chapter.id) || null;
    }

    return tracker;
  }
}

export default new TOCGenerator();
