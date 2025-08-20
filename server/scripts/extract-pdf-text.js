const fs = require("fs");
const path = require("path");

// The pdfjs-dist package exposes ESM builds (pdf.mjs). To use it from a
// CommonJS script, dynamically import the .mjs entry so Node can resolve it.
async function extractText(pdfPath) {
  const pdfjsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjsLib = pdfjsModule && (pdfjsModule.default || pdfjsModule);
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Some items may not have a 'str' property according to typings (TextMarkedContent).
    // Safely extract strings and ignore non-text items.
    const pageText = content.items
      .map((it) =>
        it && "str" in it && typeof it.str === "string" ? it.str : ""
      )
      .filter(Boolean)
      .join(" ");
    fullText += pageText + "\n\n";
  }
  return fullText;
}

async function run() {
  const argPath = process.argv[2];
  const pdfPath = argPath
    ? path.resolve(process.cwd(), argPath)
    : path.resolve(__dirname, "../../samples/ebook.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found at", pdfPath);
    process.exitCode = 2;
    return;
  }
  try {
    const text = await extractText(pdfPath);
    console.log("--- Extracted text (first 240 lines) ---");
    console.log(text.split("\n").slice(0, 240).join("\n"));
  } catch (err) {
    console.error(
      "Failed to parse PDF:",
      err && err.message ? err.message : err
    );
    process.exitCode = 3;
  }
}

run();
