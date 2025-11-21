/**
 * PageLayout Tests - Phase B
 * Test suite covering all 12+ test cases from PHASE_B_MODULE_SPECS.md
 */

import { describe, it, expect } from "vitest";
import PageLayout from "../utils/pageLayout.js";

describe("PageLayout", () => {
  // PL-001: Sparse layout (3 pages)
  it("PL-001: generates sparse layout for 3 pages", () => {
    const result = PageLayout.generateLayout(3, "light");

    expect(result.layouts).toHaveLength(3);
    expect(result.layouts[0].type).toBe("cover");
    expect(result.layouts[0].imageCount).toBe(1);
    expect(result.layouts[0].imageType).toBe("hero");
    expect(result.layouts[result.layouts.length - 1].type).toBe("conclusion");
  });

  // PL-002: Standard layout (8 pages)
  it("PL-002: generates standard layout for 8 pages", () => {
    const result = PageLayout.generateLayout(8, "medium");

    expect(result.layouts).toHaveLength(8);
    expect(result.layouts[0].type).toBe("cover");
    expect(result.layouts[1].type).toBe("toc");
    expect(result.layouts[result.layouts.length - 1].type).toBe("conclusion");
  });

  // PL-003: Dense layout (15 pages)
  it("PL-003: generates dense layout for 15 pages", () => {
    const result = PageLayout.generateLayout(15, "dense");

    expect(result.layouts).toHaveLength(15);
    expect(result.metadata.totalImages).toBeGreaterThan(0);
    expect(result.metadata.totalImages).toBeLessThan(20);
  });

  // PL-004: Very dense layout (20 pages)
  it("PL-004: generates very dense layout for 20 pages", () => {
    const result = PageLayout.generateLayout(20, "dense");

    expect(result.layouts).toHaveLength(20);
    expect(result.scaling.marginScale).toBeLessThan(0.85);
    expect(result.scaling.imageScale).toBeLessThan(0.9);
  });

  // PL-005: Light density impact
  it("PL-005: allocates more image space for light density", () => {
    const lightLayout = PageLayout.generateLayout(10, "light");
    const denseLayout = PageLayout.generateLayout(10, "dense");

    const lightTotalImages = lightLayout.metadata.totalImages;
    const denseTotalImages = denseLayout.metadata.totalImages;

    // Light density should have more images than dense
    expect(lightTotalImages).toBeGreaterThanOrEqual(denseTotalImages);
  });

  // PL-006: Dense density impact
  it("PL-006: reduces image space for dense density", () => {
    const denseLayout = PageLayout.generateLayout(10, "dense");
    const averageImages = parseFloat(denseLayout.metadata.averageImagesPerPage);

    expect(averageImages).toBeLessThanOrEqual(2);
  });

  // PL-007: Image scaling bounds
  it("PL-007: keeps imageScale within valid bounds (0.7-1.0)", () => {
    for (let pages = 3; pages <= 20; pages++) {
      const result = PageLayout.generateLayout(pages, "dense");
      expect(result.scaling.imageScale).toBeGreaterThanOrEqual(0.7);
      expect(result.scaling.imageScale).toBeLessThanOrEqual(1.0);
    }
  });

  // PL-008: Margin scaling bounds
  it("PL-008: keeps marginScale within valid bounds (0.7-1.0)", () => {
    for (let pages = 3; pages <= 20; pages++) {
      const result = PageLayout.generateLayout(pages, "dense");
      expect(result.scaling.marginScale).toBeGreaterThanOrEqual(0.7);
      expect(result.scaling.marginScale).toBeLessThanOrEqual(1.0);
    }
  });

  // PL-009: Page types distribution
  it("PL-009: distributes correct page types (cover, toc, content, conclusion)", () => {
    const result = PageLayout.generateLayout(10, "medium");
    const types = new Set(result.layouts.map((layout) => layout.type));

    expect(types.has("cover")).toBe(true);
    expect(types.has("toc")).toBe(true);
    expect(types.has("conclusion")).toBe(true);
    expect(result.layouts[0].type).toBe("cover");
    expect(result.layouts[result.layouts.length - 1].type).toBe("conclusion");
  });

  // PL-010: Image placement variety
  it("PL-010: uses varied image placement types", () => {
    const result = PageLayout.generateLayout(12, "medium");
    const imageTypes = new Set(
      result.layouts
        .filter((layout) => layout.imageCount > 0)
        .map((layout) => layout.imageType)
    );

    // Should have variety in placement types
    expect(imageTypes.size).toBeGreaterThan(1);
  });

  // PL-011: Invalid pageCount (too low)
  it("PL-011: throws validation error for pageCount < 3", () => {
    expect(() => PageLayout.generateLayout(2)).toThrow(/pageCount must be/);
  });

  // PL-012: Invalid pageCount (too high)
  it("PL-012: throws validation error for pageCount > 20", () => {
    expect(() => PageLayout.generateLayout(21)).toThrow(/pageCount must be/);
  });

  // PL-013: Invalid density
  it("PL-013: throws validation error for invalid density", () => {
    expect(() => PageLayout.generateLayout(8, "invalid")).toThrow(
      /contentDensity must be/
    );
  });

  // Additional tests for comprehensive coverage

  // PL-014: Page numbering sequence
  it("PL-014: pages are numbered sequentially without gaps", () => {
    const result = PageLayout.generateLayout(15, "medium");
    result.layouts.forEach((layout, index) => {
      expect(layout.pageNumber).toBe(index + 1);
    });
  });

  // PL-015: Image dimensions are valid
  it("PL-015: all image dimensions are valid", () => {
    const result = PageLayout.generateLayout(12, "medium");
    result.layouts.forEach((layout) => {
      if (layout.imageCount > 0) {
        const width = layout.dimensions.imageWidth;
        const height = layout.dimensions.imageHeight;

        // Check format (% or px)
        expect(width).toMatch(/^\d+(\.\d+)?(px|%)$/);
        expect(height).toMatch(/^\d+(\.\d+)?(px|%)$/);
      }
    });
  });

  // PL-016: TOC only appears in appropriate layouts
  it("PL-016: TOC page only appears when pageCount >= 4", () => {
    const sparse = PageLayout.generateLayout(3);
    const standard = PageLayout.generateLayout(8);

    const sparseHasTOC = sparse.layouts.some((layout) => layout.type === "toc");
    const standardHasTOC = standard.layouts.some(
      (layout) => layout.type === "toc"
    );

    expect(sparseHasTOC).toBe(false);
    expect(standardHasTOC).toBe(true);
  });

  // PL-017: Scaling is more aggressive for higher page counts
  it("PL-017: scaling becomes more aggressive for higher page counts", () => {
    const page10 = PageLayout.generateLayout(10, "dense");
    const page20 = PageLayout.generateLayout(20, "dense");

    expect(page20.scaling.imageScale).toBeLessThanOrEqual(
      page10.scaling.imageScale
    );
    expect(page20.scaling.marginScale).toBeLessThanOrEqual(
      page10.scaling.marginScale
    );
  });

  // PL-018: All layouts have required properties
  it("PL-018: all layouts have required properties", () => {
    const result = PageLayout.generateLayout(8, "medium");
    result.layouts.forEach((layout) => {
      expect(layout.pageNumber).toBeDefined();
      expect(layout.type).toBeDefined();
      expect(layout.imageCount).toBeGreaterThanOrEqual(0);
      expect(layout.imageType).toBeDefined();
      expect(layout.dimensions).toBeDefined();
    });
  });

  // PL-019: Metadata is accurate
  it("PL-019: metadata totalImages matches actual sum", () => {
    const result = PageLayout.generateLayout(10, "medium");
    const calculatedTotal = result.layouts.reduce(
      (sum, layout) => sum + layout.imageCount,
      0
    );
    expect(result.metadata.totalImages).toBe(calculatedTotal);
  });

  // PL-020: Cover and conclusion always have images
  it("PL-020: cover and conclusion pages always have images", () => {
    const result = PageLayout.generateLayout(15, "dense");
    expect(result.layouts[0].imageCount).toBe(1); // Cover
    expect(result.layouts[result.layouts.length - 1].imageCount).toBe(1); // Conclusion
  });
});
