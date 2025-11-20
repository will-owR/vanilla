const genieService = require("./genieService.js");
const exportService = require("./exportService");

(async () => {
  const payload = {
    mode: "demo",
    prompt: "Test prompt",
    metadata: {
      title: "Test Title",
      author: "Test Author",
      pages: 5,
      theme: "dark",
    },
  };

  const result = await genieService.process(payload);
  console.log("=== Envelope Structure ===");
  console.log("Mode:", result.out_envelope.metadata.mode);
  console.log("Has epilogue:", !!result.out_envelope.epilogue);
  console.log(
    "Epilogue keys:",
    result.out_envelope.epilogue
      ? Object.keys(result.out_envelope.epilogue)
      : "none"
  );
  console.log("Pages count:", result.out_envelope.pages.length);

  // Now try export
  console.log("\n=== Testing Export ===");
  const pdfResult = await exportService.generate(result.out_envelope, {
    validate: true,
  });
  console.log("PDF buffer size:", pdfResult.buffer.length);
  console.log("PDF header:", pdfResult.buffer.toString("ascii", 0, 4));
  console.log("Validation:", pdfResult.validation);

  // Try to count pages using the validatePdfBuffer result
  if (pdfResult.validation && pdfResult.validation.pageCount) {
    console.log(
      "Pages in PDF (from validation):",
      pdfResult.validation.pageCount
    );
  }
})();
