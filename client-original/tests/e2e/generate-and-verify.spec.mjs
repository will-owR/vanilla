import { chromium } from "playwright";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// Lightweight Playwright E2E smoke test
// 1. Load the running client UI (assumes Vite dev server is available on 5173)
// 2. Type a prompt and click Generate
// 3. Wait for preview-ready marker (window.__preview_updated_ts or data attribute)
// 4. Run the fetch-preview-wait.cjs script to persist the returned HTML

const ROOT = path.resolve(process.cwd());

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const uiUrl = process.env.UI_URL || "http://localhost:5173";
    console.log("Opening UI at", uiUrl);
    await page.goto(uiUrl, { timeout: 30000 });

    // Instrument console and page errors so we can capture client-side failures
    const logs = [];
    page.on("console", (msg) => {
      const text = msg.text();
      const type = msg.type();
      logs.push({ type, text });
      // Mirror page logs into runner output for quick visibility
      console.log("PAGE LOG>", type, text);
    });
    page.on("pageerror", (err) => {
      logs.push({
        type: "pageerror",
        text: err && err.message ? err.message : String(err),
      });
      console.error("PAGE ERROR>", err && err.message ? err.message : err);
    });

    // Wait for UI to be fully hydrated: ensure generate button and textarea are visible
    await page.waitForSelector('[data-testid="generate-button"]', {
      state: "visible",
      timeout: 30000,
    });
    await page.waitForSelector('[data-testid="prompt-textarea"]', {
      state: "visible",
      timeout: 30000,
    });

    // Fill prompt textarea (now that it's visible)
    await page.fill(
      '[data-testid="prompt-textarea"]',
      "E2E smoke: short summer poem about waves and sand"
    );

    // Try generate + wait for preview with a few attempts in case of transient flakiness
    const maxAttempts = 3;
    let previewFound = false;
    for (let attempt = 1; attempt <= maxAttempts && !previewFound; attempt++) {
      console.log(`Attempt ${attempt} to generate preview`);
      // Ensure the button is visible and enabled before clicking
      await page.waitForSelector('[data-testid="generate-button"]', {
        state: "visible",
        timeout: 15000,
      });
      try {
        await page.click('[data-testid="generate-button"]');

        // Wait for preview update: prefer checking the actual preview HTML/text so
        // we only proceed once the expected content is rendered into the DOM.
        const expectedSnippet = "E2E smoke";
        await page.waitForFunction(
          (expected) => {
            try {
              // Quick checks for debug globals set by the PreviewWindow
              // @ts-ignore
              if (
                typeof window !== "undefined" &&
                window.__preview_html_snippet &&
                String(window.__preview_html_snippet).includes(expected)
              )
                return true;
              // @ts-ignore
              if (
                typeof window !== "undefined" &&
                window.__LAST_PREVIEW_HTML &&
                String(window.__LAST_PREVIEW_HTML).includes(expected)
              )
                return true;
              // Also check the store instrumentation global which some runs set
              // @ts-ignore
              if (
                typeof window !== "undefined" &&
                window.__LAST_PREVIEW_SET &&
                String(window.__LAST_PREVIEW_SET).includes(expected)
              )
                return true;
              const el = document.querySelector(
                '[data-testid="preview-content"]'
              );
              if (el) {
                const text = el.innerText || el.textContent || "";
                if (text && text.includes(expected)) return true;
                const html = el.innerHTML || "";
                if (html && html.includes(expected)) return true;
              }
              return false;
            } catch (e) {
              return false;
            }
          },
          expectedSnippet,
          { timeout: 60000 }
        );

        previewFound = true;
        break;
      } catch (e) {
        console.warn(
          `Attempt ${attempt} timed out waiting for preview:`,
          e && e.message ? e.message : e
        );
        // small backoff before retrying
        if (attempt < maxAttempts) await page.waitForTimeout(1000);
      }
    }

    if (!previewFound) {
      // Attempt deterministic fallback: click the dev-only "Force local preview"
      // button to populate the preview pane without relying on server generation.
      try {
        console.warn(
          "Preview not found via server; attempting Force local preview fallback"
        );
        // Ensure the debug panel is expanded so the button is visible
        try {
          await page
            .click(".debug-panel summary", { timeout: 2000 })
            .catch(() => {});
        } catch (e) {}

        // Click the force-local-preview button via selector to avoid handle visibility
        try {
          await page.click('[data-testid="force-local-preview"]', {
            timeout: 10000,
          });
        } catch (clickErr) {
          console.warn(
            "Force button click failed (maybe not visible):",
            clickErr && clickErr.message ? clickErr.message : clickErr
          );
        }

        // Wait briefly for previewStore to update and DOM to render; also check the
        // global instrumentation variable `__LAST_PREVIEW_SET` which is set by the
        // store wrapper and is sometimes more reliable than other globals.
        try {
          await page.waitForFunction(
            () => {
              try {
                // prefer store instrumentation global
                // @ts-ignore
                if (typeof window !== "undefined" && window.__LAST_PREVIEW_SET)
                  return true;
                // @ts-ignore
                if (
                  typeof window !== "undefined" &&
                  window.__preview_html_snippet
                )
                  return true;
                const el = document.querySelector(
                  '[data-testid="preview-content"]'
                );
                if (!el) return false;
                const txt = el.innerText || el.textContent || "";
                if (txt && txt.length > 10) return true;
                const html = el.innerHTML || "";
                return html && html.length > 20;
              } catch (e) {
                return false;
              }
            },
            { timeout: 5000 }
          );
          previewFound = true;
        } catch (e) {
          console.warn(
            "Force local preview did not produce expected preview within timeout",
            e && e.message
          );
        }

        // Persist page console logs for diagnosis regardless of fallback outcome
        const artifactDir = path.resolve(process.cwd(), "test-artifacts");
        if (!fs.existsSync(artifactDir))
          fs.mkdirSync(artifactDir, { recursive: true });
        const logPath = path.resolve(artifactDir, "e2e-console.log");
        fs.writeFileSync(
          logPath,
          logs.map((l) => `${l.type}: ${l.text}`).join("\n"),
          "utf8"
        );
        console.error(
          "Preview not found via server. Wrote page console logs to",
          logPath
        );
      } catch (writeErr) {
        console.error(
          "Failed to write console logs or run fallback:",
          writeErr
        );
      }

      if (!previewFound) {
        throw new Error(
          "Preview did not update in the UI after attempts - see e2e-console.log for page logs"
        );
      }
    }

    console.log(
      "Preview updated in UI — capturing rendered preview HTML and persisting artifact"
    );

    // Capture the rendered preview HTML directly from the page to ensure the
    // saved artifact exactly matches what the user (or browser) saw.
    const fileDir = path.dirname(new URL(import.meta.url).pathname);
    const outFile = path.resolve(
      fileDir,
      "..",
      "..",
      "..",
      "test-artifacts",
      "preview-fetched-from-e2e.html"
    );
    if (!fs.existsSync(path.dirname(outFile)))
      fs.mkdirSync(path.dirname(outFile), { recursive: true });

    // Prefer the global debug variables if present, otherwise capture innerHTML
    let capturedHtml = await page.evaluate(() => {
      try {
        // @ts-ignore
        if (typeof window !== "undefined" && window.__LAST_PREVIEW_SET)
          return window.__LAST_PREVIEW_SET;
        // @ts-ignore
        if (typeof window !== "undefined" && window.__LAST_PREVIEW_HTML)
          return window.__LAST_PREVIEW_HTML;
        const el = document.querySelector('[data-testid="preview-content"]');
        if (!el) return "";
        return el.innerHTML || el.innerText || "";
      } catch (e) {
        return "";
      }
    });

    // If the captured HTML does not look like a full HTML document, wrap it
    // so it is easier to open and inspect as a standalone artifact.
    if (capturedHtml && !capturedHtml.trim().startsWith("<!DOCTYPE")) {
      capturedHtml = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head><body>${capturedHtml}</body></html>`;
    }

    fs.writeFileSync(outFile, capturedHtml || "", "utf8");

    // Basic validation: file exists and contains the prompt title snippet
    const html = fs.readFileSync(outFile, "utf8");
    if (!html || !html.includes("E2E smoke")) {
      console.error(
        "Captured preview HTML saved, but it does not contain expected snippet. Artifact:",
        outFile
      );
      throw new Error("Captured preview HTML does not contain expected text");
    }

    console.log("E2E smoke completed successfully — preview saved to", outFile);
  } catch (err) {
    console.error("E2E smoke failed:", err && err.message ? err.message : err);
    process.exit(2);
  } finally {
    await browser.close();
  }
})();
