import { describe, it, expect } from "vitest";
import { generatePdfBuffer } from "../pdfGenerator.js";

describe("pdfGenerator", () => {
  it("returns buffer and validation when validate=true", async () => {
    // Skip if SKIP_PUPPETEER is not set (requires mock PDF mode)
    // In the new architecture, browser initialization is handled by puppeteerBridge
    // which tries to use the global browser from index.js or launches its own.
    // For unit tests without a real browser, set SKIP_PUPPETEER=true
    process.env.SKIP_PUPPETEER = "true";
    process.env.PDF_GENERATOR_IMPL = "mock";

    const res = await generatePdfBuffer({
      title: "Test",
      body: "<p>hello</p>",
      validate: true,
    });

    // When validate:true we expect an object with buffer and validation
    expect(res).toBeTypeOf("object");
    expect(res).toHaveProperty("buffer");
    expect(res).toHaveProperty("validation");

    const { buffer, validation } = res;
    // The mock returns a Buffer
    expect(Buffer.isBuffer(buffer) || buffer instanceof Uint8Array).toBe(true);
    expect(validation).toBeTypeOf("object");
    expect(validation).toHaveProperty("ok");
    expect(validation).toHaveProperty("warnings");
    expect(Array.isArray(validation.warnings)).toBe(true);

    // Clean up
    delete process.env.SKIP_PUPPETEER;
    delete process.env.PDF_GENERATOR_IMPL;
  });
});
