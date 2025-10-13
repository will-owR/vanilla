#!/usr/bin/env node
/*
  fetch-preview-wait.cjs

  Fetches the preview HTML from the running backend and saves it to a file
  after verifying the preview contains the provided title. Useful for local
  smoke tests and debugging preview HTML returned by the server.

  Usage (from repo root):
    node client/scripts/fetch-preview-wait.cjs --url http://localhost:3000 --out client/test-artifacts/preview-fetched.html

*/
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Minimal arg parsing to avoid external deps (supports --url, --out, --retries, --interval)
const rawArgs = process.argv.slice(2);
function getArg(name) {
  const idx = rawArgs.findIndex((a) => a === `--${name}`);
  if (idx !== -1 && rawArgs.length > idx + 1) return rawArgs[idx + 1];
  // support --key=value form
  const pair = rawArgs.find((a) => a.startsWith(`--${name}=`));
  if (pair) return pair.split("=")[1];
  return undefined;
}

const BASE = getArg("url") || process.env.BASE_URL || "http://localhost:3000";
const OUT =
  getArg("out") ||
  path.join(__dirname, "..", "test-artifacts", "preview-fetched.html");
const MAX_RETRIES = parseInt(
  getArg("retries") || process.env.PREVIEW_FETCH_RETRIES || "6",
  10
); // attempts
const RETRY_INTERVAL_MS = parseInt(
  getArg("interval") || process.env.PREVIEW_FETCH_INTERVAL_MS || "1500",
  10
);

const sample = {
  title: "Smoke Test: Summer Poem (preview fetch)",
  body: "This is a test body used to verify preview rendering.\nLine two of the sample poem body.",
};

async function fetchPreviewOnce() {
  const payloadStr = JSON.stringify({
    title: sample.title,
    body: sample.body,
    layout: "poem-single-column",
  });
  // Use GET /preview?content= for small payloads
  if (payloadStr.length <= 2000) {
    const url = `${BASE.replace(
      /\/$/,
      ""
    )}/preview?content=${encodeURIComponent(payloadStr)}`;
    return fetchUrl(url, { method: "GET" });
  }
  const url = `${BASE.replace(/\/$/, "")}/api/preview`;
  return fetchUrl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { title: sample.title, body: sample.body },
    }),
  });
}

function fetchUrl(urlStr, opts = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const lib = urlObj.protocol === "https:" ? https : http;
    const method = opts.method || "GET";
    const headers = opts.headers || {};
    const req = lib.request(urlObj, { method, headers }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // /api/preview returns JSON { preview }
          const ct = (res.headers["content-type"] || "").toLowerCase();
          if (ct.includes("application/json")) {
            try {
              const j = JSON.parse(data);
              resolve(j.preview || "");
            } catch (e) {
              resolve(data);
            }
          } else {
            resolve(data);
          }
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function main() {
  // ensure out dir
  const outDir = path.dirname(OUT);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log(`Fetching preview from ${BASE} and saving to ${OUT}`);
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const html = await fetchPreviewOnce();
      if (!html || !String(html).trim())
        throw new Error("Empty preview returned");
      // sanity check: ensure title is present
      if (
        String(html).includes(sample.title) ||
        String(html).includes(sample.body.split("\n")[0])
      ) {
        fs.writeFileSync(OUT, html, "utf8");
        console.log(
          `SUCCESS: Preview fetched and saved to ${OUT} (attempt ${attempt})`
        );
        return process.exit(0);
      }
      // If HTML returned but doesn't include title, we may be hitting a fallback or stale cache
      console.warn(
        `Attempt ${attempt}: Preview returned but does not contain expected title. Retrying in ${RETRY_INTERVAL_MS}ms...`
      );
    } catch (err) {
      console.warn(
        `Attempt ${attempt} failed: ${err.message}. Retrying in ${RETRY_INTERVAL_MS}ms...`
      );
    }
    await sleep(RETRY_INTERVAL_MS);
  }
  console.error(
    `FAILED: Could not fetch preview containing title after ${MAX_RETRIES} attempts`
  );
  process.exit(2);
}

if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
