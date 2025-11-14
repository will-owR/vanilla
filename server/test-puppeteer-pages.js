const puppeteer = require('puppeteer-core');

(async () => {
  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      executablePath: '/usr/bin/google-chrome',
    });

    const page = await browser.newPage();
    const html = `<!DOCTYPE html>
<html><head><style>
body { margin: 0; }
.page { height: 11in; page-break-after: always; padding: 1in; }
</style></head><body>
<div class="page">Page 1</div>
<div class="page">Page 2</div>
<div class="page">Page 3</div>
<div class="page">Page 4</div>
<div class="page">Page 5</div>
<div class="page">Page 6</div>
<div class="page">Page 7</div>
<div class="page">Page 8</div>
<div class="page">Page 9</div>
<div class="page">Page 10</div>
</body></html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const buffer = await page.pdf({ format: 'A4', printBackground: true });

    const count = (buffer.toString('binary').match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log('Pages:', count);

    await page.close();
    await browser.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
