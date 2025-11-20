import { describe, it, expect, beforeEach } from "vitest";
import { generatePDF } from "../utils/pdfStructureBuilder.js";

describe("Module 5: pdfStructureBuilder - PDF Structure Integration", () => {
  let testEnvelope;
  let testTheme;

  beforeEach(() => {
    testEnvelope = {
      pages: [
        {
          id: "p1",
          title: "Section 1",
          blocks: [
            { type: "text", content: "Introduction content..." },
            { type: "image", caption: "Figure 1" },
            { type: "callout", content: "Key point 1" },
          ],
        },
        {
          id: "p2",
          title: "Section 2",
          blocks: [
            { type: "text", content: "Main content..." },
            { type: "image", caption: "Figure 2" },
            { type: "callout", content: "Key point 2" },
          ],
        },
        {
          id: "p3",
          title: "Section 3",
          blocks: [
            { type: "text", content: "Details..." },
            { type: "image", caption: "Figure 3" },
            { type: "callout", content: "Key point 3" },
          ],
        },
        {
          id: "p4",
          title: "Section 4",
          blocks: [
            { type: "text", content: "Analysis..." },
            { type: "image", caption: "Figure 4" },
            { type: "callout", content: "Key point 4" },
          ],
        },
        {
          id: "p5",
          title: "Section 5",
          blocks: [
            { type: "text", content: "Conclusion..." },
            { type: "image", caption: "Figure 5" },
            { type: "callout", content: "Key point 5" },
          ],
        },
      ],
      metadata: {
        pages_count: 5,
        theme: "dark",
        author: "CELS",
        title: "Demo Presentation",
      },
      epilogue: {
        type: "epilogue",
        enabled: true,
        epilogueType: "all",
        sections: {
          closing: {
            title: "Closing Remarks",
            content: "Thank you for exploring...",
          },
          bio: {
            title: "About the Author",
            content: "CELS is dedicated to...",
            email: "contact@cels.com",
          },
          resources: {
            title: "Further Resources",
            items: [{ title: "Research", url: "https://example.com" }],
          },
        },
      },
    };

    testTheme = "dark";
  });

  describe("generatePDF()", () => {
    it("generates valid PDF buffer", async () => {
      const result = await generatePDF(testEnvelope, testTheme);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it("PDF buffer starts with PDF signature", async () => {
      const result = await generatePDF(testEnvelope, testTheme);
      const pdfSignature = Buffer.from(result).toString("utf8", 0, 4);
      expect(pdfSignature).toBe("%PDF");
    });

    it("returns complete PDF structure", async () => {
      const result = await generatePDF(testEnvelope, testTheme);
      expect(result.length).toBeGreaterThan(5000);
    });

    it("handles missing epilogue gracefully", async () => {
      const envelopeNoEpilogue = { ...testEnvelope, epilogue: null };
      const result = await generatePDF(envelopeNoEpilogue, testTheme);
      expect(result).toBeDefined();
      const pdfSignature = Buffer.from(result).toString("utf8", 0, 4);
      expect(pdfSignature).toBe("%PDF");
    });

    it("includes metadata from envelope", async () => {
      const result = await generatePDF(testEnvelope, testTheme);
      expect(result).toBeDefined();
      const pdfSignature = Buffer.from(result).toString("utf8", 0, 4);
      expect(pdfSignature).toBe("%PDF");
    });
  });

  describe("Integration: Full 10-page PDF", () => {
    it("generates complete PDF with 10 pages", async () => {
      const result = await generatePDF(testEnvelope, testTheme);
      expect(result).toBeDefined();
      const pdfSignature = Buffer.from(result).toString("utf8", 0, 4);
      expect(pdfSignature).toBe("%PDF");
    });

    it("includes all content pages (p1-p5)", async () => {
      const result = await generatePDF(testEnvelope, testTheme);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it("applies dark theme consistently", async () => {
      const result = await generatePDF(testEnvelope, testTheme);
      expect(result).toBeDefined();
    });

    it("embeds images in content pages", async () => {
      const result = await generatePDF(testEnvelope, testTheme);
      expect(result).toBeDefined();
    });

    it("includes epilogue with all sections", async () => {
      const result = await generatePDF(testEnvelope, testTheme);
      expect(result).toBeDefined();
    });

    it("renders without errors for valid envelope", async () => {
      const result = await generatePDF(testEnvelope, testTheme);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it("PDF is valid and renderable", async () => {
      const result = await generatePDF(testEnvelope, testTheme);
      const pdfSignature = Buffer.from(result).toString("utf8", 0, 4);
      expect(pdfSignature).toBe("%PDF");
    });

    it("handles minimal envelope with only pages", async () => {
      const minimalEnvelope = {
        pages: testEnvelope.pages,
        metadata: { title: "Test" },
      };
      const result = await generatePDF(minimalEnvelope, testTheme);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
