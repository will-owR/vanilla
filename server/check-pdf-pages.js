const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
const fs = require("fs");

(async () => {
  const buf = fs.readFileSync("/tmp/test-pdf.pdf");
  const data = new Uint8Array(buf);
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  console.log("Pages in PDF:", doc.numPages);
})();
