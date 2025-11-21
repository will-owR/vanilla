import { describe, it, expect, beforeEach, vi } from "vitest";
import OverrideService from "../utils/overrideService.js";

describe("OverrideService", () => {
  let mockDb;
  let mockThemeEngine;
  let mockPdfGenerator;

  beforeEach(() => {
    // Mock database
    mockDb = {
      getResult: vi.fn(async (id) => ({
        id,
        html: "<html><head></head><body><h1>Original Content</h1></body></html>",
        pdf: Buffer.from("ORIGINAL PDF"),
        metadata: {
          theme: "dark",
          colorPalette: "default",
          fontSize: 1.0,
        },
        classification: {
          theme: ["dark"],
          density: ["medium"],
        },
      })),
      updateResult: vi.fn(async () => true),
    };

    // Mock theme engine
    mockThemeEngine = {
      getTheme: vi.fn((name) => {
        const themes = {
          dark: {
            colors: {
              background: "#1a1a1a",
              text: "#e0e0e0",
              accent: "#4a9eff",
            },
          },
          light: {
            colors: {
              background: "#ffffff",
              text: "#1a1a1a",
              accent: "#0066cc",
            },
          },
          bold: {
            colors: {
              background: "#1a1a1a",
              text: "#ffffff",
              accent: "#d84000",
            },
          },
        };
        return themes[name] || null;
      }),
    };

    // Mock PDF generator
    mockPdfGenerator = {
      generateFromHTML: vi.fn(async (html) =>
        Buffer.from(`PDF:${html.length}`)
      ),
    };
  });

  // OS-001: Apply theme override (dark → light)
  it("OS-001: applies theme override successfully", async () => {
    const result = await OverrideService.apply(
      "result-123",
      { theme: "light" },
      mockDb,
      mockThemeEngine,
      mockPdfGenerator
    );

    expect(result.resultId).toBe("result-123");
    expect(result.status).toBe("completed");
    expect(result.metadata.theme).toBe("light");
    expect(result.html).toContain("--color-background: #ffffff");
    expect(mockDb.updateResult).toHaveBeenCalled();
  });

  // OS-002: Apply color palette override
  it("OS-002: applies colorPalette override", async () => {
    const result = await OverrideService.apply(
      "result-123",
      { colorPalette: "vibrant" },
      mockDb,
      mockThemeEngine,
      mockPdfGenerator
    );

    expect(result.metadata.colorPalette).toBe("vibrant");
    expect(result.html).toContain("--color-palette: vibrant");
  });

  // OS-003: Apply fontSize override (scaling)
  it("OS-003: applies fontSize override with scaling", async () => {
    const result = await OverrideService.apply(
      "result-123",
      { fontSize: 1.05 },
      mockDb,
      mockThemeEngine,
      mockPdfGenerator
    );

    expect(result.metadata.fontSize).toBe(1.05);
    expect(result.html).toContain("--font-scale: 1.05");
  });

  // OS-004: Multiple overrides combined
  it("OS-004: applies multiple overrides together", async () => {
    const result = await OverrideService.apply(
      "result-123",
      {
        theme: "bold",
        colorPalette: "muted",
        fontSize: 0.95,
      },
      mockDb,
      mockThemeEngine,
      mockPdfGenerator
    );

    expect(result.metadata.theme).toBe("bold");
    expect(result.metadata.colorPalette).toBe("muted");
    expect(result.metadata.fontSize).toBe(0.95);
    expect(result.html).toContain("--color-");
    expect(result.html).toContain("--color-palette: muted");
    expect(result.html).toContain("--font-scale: 0.95");
  });

  // OS-005: Reject pageCount override (regeneration required)
  it("OS-005: rejects pageCount override (requires regeneration)", async () => {
    expect(async () => {
      await OverrideService.apply(
        "result-123",
        { pageCount: 10 },
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("Cannot override pageCount");
  });

  // OS-006: Reject contentDensity override
  it("OS-006: rejects contentDensity override", async () => {
    expect(async () => {
      await OverrideService.apply(
        "result-123",
        { contentDensity: "dense" },
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("Cannot override contentDensity");
  });

  // OS-007: Reject chapters override
  it("OS-007: rejects chapters override", async () => {
    expect(async () => {
      await OverrideService.apply(
        "result-123",
        { chapters: ["new", "chapters"] },
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("Cannot override chapters");
  });

  // OS-008: Result not found error
  it("OS-008: throws error when result not found", async () => {
    mockDb.getResult.mockResolvedValueOnce(null);

    expect(async () => {
      await OverrideService.apply(
        "nonexistent-id",
        { theme: "light" },
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("Result UUID not found in database");
  });

  // OS-009: Invalid theme name
  it("OS-009: throws error for invalid theme", async () => {
    expect(async () => {
      await OverrideService.apply(
        "result-123",
        { theme: "invalid-theme" },
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("Theme not found");
  });

  // OS-010: fontSize scaling boundaries
  it("OS-010: rejects fontSize outside ±10% range", async () => {
    expect(async () => {
      await OverrideService.apply(
        "result-123",
        { fontSize: 1.15 }, // > 10%
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("must be between 0.9 and 1.1");

    expect(async () => {
      await OverrideService.apply(
        "result-123",
        { fontSize: 0.85 }, // > 10%
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("must be between 0.9 and 1.1");
  });

  // OS-011: Metadata preservation
  it("OS-011: preserves existing metadata and adds new fields", async () => {
    const result = await OverrideService.apply(
      "result-123",
      { theme: "light" },
      mockDb,
      mockThemeEngine,
      mockPdfGenerator
    );

    expect(result.metadata.regenerated).toBe(false);
    expect(result.metadata.cached).toBe(true);
    expect(result.metadata.appliedAt).toBeDefined();
    expect(result.classification.density).toEqual(["medium"]); // Preserved
  });

  // OS-012: PDF regeneration
  it("OS-012: regenerates PDF with new HTML", async () => {
    await OverrideService.apply(
      "result-123",
      { theme: "light" },
      mockDb,
      mockThemeEngine,
      mockPdfGenerator
    );

    expect(mockPdfGenerator.generateFromHTML).toHaveBeenCalled();
    const calledHTML = mockPdfGenerator.generateFromHTML.mock.calls[0][0];
    expect(calledHTML).toContain("--color-");
  });

  // OS-013: Invalid resultId
  it("OS-013: throws error for invalid resultId", async () => {
    expect(async () => {
      await OverrideService.apply(
        "",
        { theme: "light" },
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("resultId must be a non-empty string");

    expect(async () => {
      await OverrideService.apply(
        null,
        { theme: "light" },
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("resultId must be a non-empty string");
  });

  // OS-014: Invalid overrides
  it("OS-014: throws error for invalid overrides object", async () => {
    expect(async () => {
      await OverrideService.apply(
        "result-123",
        null,
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("overrides must be an object");

    expect(async () => {
      await OverrideService.apply(
        "result-123",
        "not-object",
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("overrides must be an object");
  });

  // OS-015: CSS injection in HTML head
  it("OS-015: correctly injects CSS into HTML head", async () => {
    const result = await OverrideService.apply(
      "result-123",
      { theme: "bold" },
      mockDb,
      mockThemeEngine,
      mockPdfGenerator
    );

    expect(result.html).toContain("<style>:root {");
    expect(result.html).toContain("</style></head>");
  });

  // OS-016: CSS fallback injection
  it("OS-016: injects CSS before body if no head tag", async () => {
    mockDb.getResult.mockResolvedValueOnce({
      id: "result-123",
      html: "<html><body><h1>No head</h1></body></html>",
      pdf: Buffer.from("PDF"),
      metadata: {},
      classification: {},
    });

    const result = await OverrideService.apply(
      "result-123",
      { theme: "light" },
      mockDb,
      mockThemeEngine,
      mockPdfGenerator
    );

    expect(result.html).toContain("<style>:root {");
  });

  // OS-017: fontSize numeric validation
  it("OS-017: validates fontSize is numeric", async () => {
    expect(async () => {
      await OverrideService.apply(
        "result-123",
        { fontSize: "not-a-number" },
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("must be between 0.9 and 1.1");
  });

  // OS-018: Unknown override property rejected
  it("OS-018: rejects unknown override properties", async () => {
    expect(async () => {
      await OverrideService.apply(
        "result-123",
        { unknownProperty: "value" },
        mockDb,
        mockThemeEngine,
        mockPdfGenerator
      );
    }).rejects.toThrow("Unknown override property");
  });

  // OS-019: Works without DB/ThemeEngine (uses mocks)
  it("OS-019: works with internal mocks when DB not provided", async () => {
    const result = await OverrideService.apply("result-123", {
      fontSize: 1.05,
    });

    expect(result.resultId).toBe("result-123");
    expect(result.status).toBe("completed");
    expect(result.html).toBeDefined();
  });

  // OS-020: Theme colors all injected
  it("OS-020: injects all theme colors as CSS variables", async () => {
    const result = await OverrideService.apply(
      "result-123",
      { theme: "bold" },
      mockDb,
      mockThemeEngine,
      mockPdfGenerator
    );

    expect(result.html).toContain("--color-background");
    expect(result.html).toContain("--color-text");
    expect(result.html).toContain("--color-accent");
  });
});
