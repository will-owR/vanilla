/**
 * PageLayout Module - Phase B
 * Calculates dynamic page layouts based on page count and content density.
 * Determines image placement (1-3 per page) and scaling factors for optimal PDF rendering.
 */

class PageLayout {
  /**
   * Generate layout plan for given page count
   * @param {number} pageCount - Target page count (3-20)
   * @param {string} contentDensity - 'light' | 'medium' | 'dense'
   * @returns {Object} PageLayoutPlan with layouts and scaling factors
   */
  generateLayout(pageCount, contentDensity = "medium") {
    // Validate page count
    if (typeof pageCount !== "number" || pageCount < 3 || pageCount > 20) {
      throw new Error(
        "PageLayout: pageCount must be a number between 3 and 20"
      );
    }

    // Validate density
    if (!["light", "medium", "dense"].includes(contentDensity)) {
      throw new Error(
        "PageLayout: contentDensity must be light, medium, or dense"
      );
    }

    try {
      // Generate page layouts
      const layouts = this._createPageLayouts(pageCount, contentDensity);

      // Calculate scaling factors
      const scaling = this._calculateScaling(pageCount, contentDensity);

      return {
        layouts,
        scaling,
        metadata: {
          pageCount,
          contentDensity,
          totalImages: layouts.reduce(
            (sum, layout) => sum + layout.imageCount,
            0
          ),
          averageImagesPerPage: (
            layouts.reduce((sum, layout) => sum + layout.imageCount, 0) /
            layouts.length
          ).toFixed(2),
        },
      };
    } catch (err) {
      if (err.message.includes("PageLayout:")) {
        throw err;
      }
      throw new Error(`PageLayout: Layout generation failed - ${err.message}`);
    }
  }

  /**
   * Create individual page layouts for each page
   * @private
   */
  _createPageLayouts(pageCount, contentDensity) {
    const layouts = [];

    // Page 1: Cover (always hero image)
    layouts.push({
      pageNumber: 1,
      type: "cover",
      imageCount: 1,
      imageType: "hero",
      dimensions: {
        imageWidth: "100%",
        imageHeight: "80%",
        position: "center",
      },
    });

    // Page 2: TOC (only if enough pages for meaningful TOC)
    if (pageCount >= 4) {
      layouts.push({
        pageNumber: 2,
        type: "toc",
        imageCount: 0,
        imageType: "none",
        dimensions: {
          imageWidth: "0",
          imageHeight: "0",
        },
      });
    }

    // Pages 3 to N-1: Content pages with varied image placement
    const contentPageStart = pageCount >= 4 ? 3 : 2;
    const contentPageEnd = pageCount - 1;

    for (let i = contentPageStart; i <= contentPageEnd; i++) {
      const imageCount = this._calculateImageCount(
        i,
        pageCount,
        contentDensity
      );
      const imageType = this._selectImageType(imageCount, i);

      layouts.push({
        pageNumber: i,
        type: this._determinePageType(i, pageCount),
        imageCount,
        imageType,
        dimensions: this._calculateImageDimensions(
          imageType,
          imageCount,
          contentDensity
        ),
      });
    }

    // Last page: Conclusion (hero image)
    layouts.push({
      pageNumber: pageCount,
      type: "conclusion",
      imageCount: 1,
      imageType: "hero",
      dimensions: {
        imageWidth: "100%",
        imageHeight: "70%",
        position: "center",
      },
    });

    return layouts;
  }

  /**
   * Determine page type based on page number and total
   * @private
   */
  _determinePageType(pageNumber, totalPages) {
    const midpoint = Math.ceil(totalPages / 2);
    if (pageNumber <= 3 || pageNumber === midpoint) {
      return "chapter";
    }
    return "content";
  }

  /**
   * Calculate number of images for a page based on density
   * @private
   */
  _calculateImageCount(pageIndex, totalPages, density) {
    // Sparse (3-5 pages): 1 image per page
    if (totalPages <= 5) {
      return 1;
    }

    // Standard (6-10 pages): Alternate 1-2 images
    if (totalPages <= 10) {
      if (density === "light") {
        return pageIndex % 2 === 0 ? 1 : 2;
      } else if (density === "dense") {
        return 1;
      } else {
        return pageIndex % 3 === 0 ? 2 : 1;
      }
    }

    // Dense (11-15 pages): Mostly 1 image, occasional 2
    if (totalPages <= 15) {
      return pageIndex % 5 === 0 ? 2 : 1;
    }

    // Very dense (16-20 pages): Mostly 1 image, some pages with 0 (text-heavy)
    if (density === "light") {
      return 1;
    } else if (density === "dense") {
      return pageIndex % 3 === 0 ? 0 : 1;
    } else {
      return pageIndex % 4 === 0 ? 0 : 1;
    }
  }

  /**
   * Select image layout type based on image count
   * @private
   */
  _selectImageType(imageCount, pageIndex) {
    if (imageCount === 0) {
      return "none";
    }

    if (imageCount === 1) {
      // Vary between hero and side-by-side
      return pageIndex % 3 === 0 ? "hero" : "side-by-side";
    }

    if (imageCount === 2) {
      // Vary between dual and side-by-side
      return pageIndex % 2 === 0 ? "dual" : "side-by-side";
    }

    if (imageCount === 3) {
      return "overlay";
    }

    return "none";
  }

  /**
   * Calculate image dimensions based on layout type and density
   * @private
   */
  _calculateImageDimensions(imageType, imageCount, contentDensity) {
    const dimensions = {};

    switch (imageType) {
      case "hero":
        dimensions.imageWidth = "100%";
        dimensions.imageHeight = contentDensity === "light" ? "450px" : "350px";
        dimensions.position = "center";
        break;

      case "side-by-side":
        dimensions.imageWidth = contentDensity === "dense" ? "40%" : "45%";
        dimensions.imageHeight = contentDensity === "dense" ? "300px" : "350px";
        dimensions.position = "right";
        break;

      case "dual":
        dimensions.imageWidth = contentDensity === "dense" ? "45%" : "48%";
        dimensions.imageHeight = contentDensity === "dense" ? "280px" : "300px";
        dimensions.position = "side-by-side";
        break;

      case "overlay":
        dimensions.imageWidth = "100%";
        dimensions.imageHeight = contentDensity === "light" ? "300px" : "200px";
        dimensions.position = "overlay";
        break;

      case "none":
      default:
        dimensions.imageWidth = "0";
        dimensions.imageHeight = "0";
        break;
    }

    return dimensions;
  }

  /**
   * Calculate scaling factors based on page count and density
   * @private
   * Adjusts image, text, and margin scaling for tight layouts
   */
  _calculateScaling(pageCount, contentDensity) {
    let imageScale = 1.0;
    let textScale = 1.0;
    let marginScale = 1.0;

    // Very dense (16-20 pages): Aggressive scaling
    if (pageCount >= 16) {
      if (contentDensity === "dense") {
        imageScale = 0.75;
        textScale = 0.95;
        marginScale = 0.7;
      } else if (contentDensity === "medium") {
        imageScale = 0.85;
        textScale = 1.0;
        marginScale = 0.8;
      } else {
        imageScale = 0.9;
        marginScale = 0.85;
      }
    }
    // Dense (11-15 pages): Moderate scaling
    else if (pageCount >= 11) {
      if (contentDensity === "dense") {
        imageScale = 0.85;
        marginScale = 0.8;
      } else if (contentDensity === "medium") {
        imageScale = 0.9;
        marginScale = 0.85;
      }
    }
    // Standard (6-10 pages): Minimal scaling
    else if (pageCount >= 6) {
      if (contentDensity === "dense") {
        imageScale = 0.9;
        marginScale = 0.9;
      }
    }
    // Sparse (3-5 pages): No scaling needed

    // Validate ranges
    imageScale = Math.max(0.7, Math.min(1.0, imageScale));
    textScale = Math.max(0.9, Math.min(1.0, textScale));
    marginScale = Math.max(0.7, Math.min(1.0, marginScale));

    return {
      imageScale: parseFloat(imageScale.toFixed(2)),
      textScale: parseFloat(textScale.toFixed(2)),
      marginScale: parseFloat(marginScale.toFixed(2)),
    };
  }
}

// Export singleton instance
module.exports = new PageLayout();
