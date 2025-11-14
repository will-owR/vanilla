const genieService = require("./genieService.js");

(async () => {
  const payload = {
    mode: "demo",
    prompt: "Test prompt for five pages",
    metadata: { title: "Test", author: "Author", pages: 5, theme: "dark" },
  };

  const result = await genieService.process(payload);
  const envelope = result.out_envelope;

  // Manually test the export routing
  const pdfStructureBuilder = require("./utils/pdfStructureBuilder");
  const themeEngine = require("./utils/themeEngine");

  console.log("Testing pdfStructureBuilder directly...");
  const theme = themeEngine.getTheme("dark");
  console.log("Theme retrieved:", Object.keys(theme));

  const pdfResult = await pdfStructureBuilder.generatePDF(envelope, theme, {
    validate: true,
  });
  console.log(
    "Direct PDF result:",
    typeof pdfResult,
    pdfResult.buffer ? "has buffer" : "no buffer"
  );

  if (pdfResult.buffer) {
    console.log("Buffer size:", pdfResult.buffer.length);
    console.log("Buffer header:", pdfResult.buffer.toString("ascii", 0, 4));
    const pdfStr = pdfResult.buffer.toString("binary");
    const pageCount = (pdfStr.match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log("Pages in PDF:", pageCount);
  }
})();
