const puppeteer = require("puppeteer-core");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox"],
    executablePath: "/usr/bin/google-chrome",
  });
  const page = await browser.newPage();

  const html = `<!DOCTYPE html>
<html><head><style>
body { margin: 0; }
.page { height: 11in; page-break-after: always; padding: 1in; background: #f0f0f0; }
</style></head><body>
<div class='page'>1</div>
<div class='page'>2</div>
<div class='page'>3</div>
<div class='page'>4</div>
<div class='page'>5</div>
<div class='page'>6</div>
<div class='page'>7</div>
<div class='page'>8</div>
<div class='page'>9</div>
<div class='page'>10</div>
</body></html>`;

  await page.setContent(html, { waitUntil: "domcontentloaded" });
  const buf = await page.pdf({ format: "A4" });

  // Try different ways to count
  const str = buf.toString("latin1");
  console.log("Buffer size:", buf.length);
  console.log("Has /Pages:", str.includes("/Pages"));

  // Look for pages differently
  const pageMatches = str.match(/\/Type\s*\/Page\s*\/Parent/g) || [];
  console.log("Page objects:", pageMatches.length);

  // Save to file for inspection
  fs.writeFileSync("/tmp/test-pdf.pdf", buf);
  console.log("PDF saved to /tmp/test-pdf.pdf");

  await page.close();
  await browser.close();
})();
