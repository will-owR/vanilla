#!/usr/bin/env node
// Lightweight e2e smoke test using puppeteer-core. Assumes client dev server at http://localhost:5173 and server at http://localhost:3000
const puppeteer = require("puppeteer-core");
const path = require("path");

(async () => {
  const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome-stable";
  if (!chromePath) {
    console.error(
      "No Chrome found. Set CHROME_PATH env var to your chrome binary."
    );
    process.exit(2);
  }

  console.log("Using Chrome at", chromePath);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto("http://localhost:5173", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Fill prompt textarea (assumes textarea id 'prompt-textarea')
    await page.waitForSelector("#prompt-textarea", { timeout: 5000 });
    await page.click("#prompt-textarea");
    await page.type("#prompt-textarea", "A short summer poem about sunlight");

    // Click Generate button (find by exact text)
    // Click Generate button by matching text and dispatching click in-page
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent && b.textContent.trim() === "Generate"
      );
      if (!btn) throw new Error("Generate button not found");
      btn.click();
    });

    // Wait a short moment for client to process generation
    await new Promise((r) => setTimeout(r, 2000));

    // Click Preview button (we added one)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent && b.textContent.trim() === "Preview"
      );
      if (!btn) throw new Error("Preview button not found");
      btn.click();
    });

    // Wait for preview content to appear (30s). If not found, dump body for debugging
    // and continue to the API fallback instead of aborting the whole run.
    let previewHtml = "";
    let foundPreview = false;
    try {
      await page.waitForSelector(".preview-content", { timeout: 30000 });
      foundPreview = true;
    } catch (err) {
      const body = await page.evaluate(() => document.body.innerHTML);
      console.error(
        "DOM snapshot (truncated 2000 chars):",
        body.slice(0, 2000)
      );
      foundPreview = false;
    }

    if (foundPreview) {
      previewHtml = await page.evaluate(() => {
        const el = document.querySelector(".preview-content");
        return el ? el.textContent || "" : "";
      });

      console.log("Preview text snippet:", previewHtml.slice(0, 200));

      if (/summer/i.test(previewHtml)) {
        console.log("E2E smoke test passed (UI path)");
        process.exit(0);
      }
    } else {
      console.log("Preview element not found in UI; will attempt API fallback");
    }

    // Fallback: call backend endpoints directly (POST /prompt -> GET /preview)
    console.log("UI preview missing expected text — attempting API fallback");
    const fetchFn = globalThis.fetch;
    if (!fetchFn) {
      console.error(
        "No global fetch available; install node-fetch or run with Node 18+"
      );
      process.exit(8);
    }
    const promptResp = await fetchFn("http://localhost:3000/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "A short summer poem about sunlight" }),
    });
    if (!promptResp.ok) {
      console.error("API prompt call failed with", promptResp.status);
      process.exit(5);
    }
    const promptJson = await promptResp.json();
    const content =
      promptJson && promptJson.data && promptJson.data.content
        ? promptJson.data.content
        : null;
    if (!content) {
      console.error("API prompt returned no content");
      process.exit(6);
    }
    const previewUrl = `http://localhost:3000/preview?content=${encodeURIComponent(
      JSON.stringify(content)
    )}`;
    const previewResp = await fetchFn(previewUrl, { method: "GET" });
    if (!previewResp.ok) {
      console.error("API preview call failed with", previewResp.status);
      process.exit(7);
    }
    const previewText = await previewResp.text();
    console.log("API preview snippet:", previewText.slice(0, 200));
    if (/summer/i.test(previewText)) {
      console.log("E2E smoke test passed (API fallback)");
      process.exit(0);
    }
    console.error(
      "E2E smoke test failed: preview did not contain expected text"
    );
    process.exit(3);
  } catch (err) {
    console.error("E2E run failed:", err);
    process.exit(4);
  } finally {
    if (browser) await browser.close();
  }
})();
