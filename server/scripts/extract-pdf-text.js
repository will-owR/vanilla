const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

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
  const data = fs.readFileSync(pdfPath);
  try {
    const res = await pdf(data);
    console.log("--- Extracted text (first 240 lines) ---");
    console.log(res.text.split("\n").slice(0, 240).join("\n"));
  } catch (err) {
    console.error("Failed to parse PDF:", err.message);
    process.exitCode = 3;
  }
}

run();
