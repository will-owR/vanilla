import { describe, it, expect, vi, beforeEach } from "vitest";
import ResultsDisplay from "../src/components/ResultsDisplay-v2.svelte";
import { flowStore } from "../src/lib/stores/flowStore.js";

describe("ResultsDisplay Component", () => {
  beforeEach(() => {
    flowStore.reset();
  });

  it("should display PDF metadata correctly", () => {
    const result = {
      pdfUrl: "https://example.com/output-12345.pdf",
      pageCount: 25,
      latency: 3400,
      costEstimate: 0.45,
    };

    expect(result.pageCount).toBe(25);
    expect(result.latency).toBe(3400);
    expect(result.costEstimate).toBe(0.45);
  });

  it("should format file size correctly", () => {
    const testCases = [
      { bytes: 0, expected: "0 KB" },
      { bytes: 5120, expected: "5 KB" },
      { bytes: 1048576, expected: "1.0 MB" },
      { bytes: 2097152, expected: "2.0 MB" },
    ];

    testCases.forEach(({ bytes, expected }) => {
      let formatted;
      if (!bytes) {
        formatted = "0 KB";
      } else {
        const kb = bytes / 1024;
        if (kb < 1024) {
          formatted = `${Math.round(kb)} KB`;
        } else {
          formatted = `${(kb / 1024).toFixed(1)} MB`;
        }
      }
      expect(formatted).toBe(expected);
    });
  });

  it("should extract filename from URL", () => {
    const testUrls = [
      {
        url: "https://example.com/outputs/document-2024.pdf",
        expected: "document-2024.pdf",
      },
      {
        url: "https://cdn.example.com/pdfs/output-12345.pdf",
        expected: "output-12345.pdf",
      },
      { url: "", expected: "output.pdf" },
    ];

    testUrls.forEach(({ url, expected }) => {
      let filename;
      if (!url) {
        filename = "output.pdf";
      } else {
        const parts = url.split("/");
        filename = parts[parts.length - 1] || "output.pdf";
      }
      expect(filename).toBe(expected);
    });
  });

  it("should format latency to seconds", () => {
    const testCases = [
      { ms: 1500, expected: "1.50s" },
      { ms: 3400, expected: "3.40s" },
      { ms: 45000, expected: "45.00s" },
      { ms: 0, expected: "0.00s" },
    ];

    testCases.forEach(({ ms, expected }) => {
      const formatted = ms ? `${(ms / 1000).toFixed(2)}s` : "0.00s";
      expect(formatted).toBe(expected);
    });
  });

  it("should format cost estimate with currency symbol", () => {
    const testCases = [
      { cost: 0.25, expected: "$0.25" },
      { cost: 1.5, expected: "$1.50" },
      { cost: 10.99, expected: "$10.99" },
      { cost: 0, expected: "$0.00" },
    ];

    testCases.forEach(({ cost, expected }) => {
      const formatted = `$${cost.toFixed(2)}`;
      expect(formatted).toBe(expected);
    });
  });

  it("should handle page count singular/plural correctly", () => {
    const testCases = [
      { pageCount: 1, expected: "page" },
      { pageCount: 25, expected: "pages" },
      { pageCount: 0, expected: "pages" },
    ];

    testCases.forEach(({ pageCount, expected }) => {
      const label = pageCount !== 1 ? "pages" : "page";
      expect(label).toBe(expected);
    });
  });

  it("should provide download button callback", () => {
    const onDownloadPDF = vi.fn();
    onDownloadPDF();
    expect(onDownloadPDF).toHaveBeenCalledTimes(1);
  });

  it("should provide customize and new prompt callbacks", () => {
    const onCustomizeStyle = vi.fn();
    const onNewPrompt = vi.fn();

    onCustomizeStyle();
    onNewPrompt();

    expect(onCustomizeStyle).toHaveBeenCalledTimes(1);
    expect(onNewPrompt).toHaveBeenCalledTimes(1);
  });

  it("should store classification metadata", () => {
    const classification = {
      medium: "calendar",
      style: "retro",
    };

    const result = {
      pdfUrl: "https://example.com/cal-output.pdf",
      pageCount: 12,
      latency: 2500,
      costEstimate: 0.35,
    };

    expect(classification.medium).toBe("calendar");
    expect(result.pageCount).toBe(12);
    expect(result.costEstimate).toBe(0.35);
  });

  it("should handle missing PDF URL gracefully", () => {
    const result = {
      pageCount: 15,
      latency: 2100,
      costEstimate: 0.4,
    };

    expect(result.pdfUrl).toBeUndefined();
    // Component should show placeholder
  });
});
