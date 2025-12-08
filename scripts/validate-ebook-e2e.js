#!/usr/bin/env node

/**
 * E2E Ebook Generation and Export Validator
 *
 * Tests complete ebook pipeline (generation -> composition -> export)
 * across 3, 10, and 20-page scenarios with real Gemini API.
 *
 * Usage: node ./scripts/validate-ebook-e2e.js
 */

const http = require("http");
const https = require("https");

const BASE_URL = "http://localhost:5173"; // Vite dev server
const API_BASE = "http://localhost:3000"; // Express backend

const TEST_SCENARIOS = [
  { pages: 3, name: "Small (3 pages)" },
  { pages: 10, name: "Medium (10 pages)" },
  { pages: 20, name: "Large (20 pages)" },
];

const POLL_TIMEOUT = 300000; // 5 minutes max wait per generation
const POLL_INTERVAL = 2000; // Check every 2 seconds

// ============================================================================
// HTTP Utilities
// ============================================================================

function request(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";
    const client = isHttps ? https : http;

    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body && method !== "GET") {
      const bodyStr = JSON.stringify(body);
      options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    }

    const req = client.request(url, options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw: data,
          });
        } catch (e) {
          // Binary data (PDF) or non-JSON response
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            raw: data,
            isBuffer: true,
          });
        }
      });
    });

    req.on("error", reject);

    if (body && method !== "GET") {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// ============================================================================
// Validation Functions
// ============================================================================

function log(level, message) {
  const timestamp = new Date().toISOString().substring(11, 19);
  const prefix =
    {
      INFO: "✓",
      STEP: "→",
      PASS: "✅",
      FAIL: "❌",
      WARN: "⚠️ ",
    }[level] || " ";

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function generateEbook(pages) {
  log("STEP", `Generating ${pages}-page ebook...`);

  const startTime = Date.now();
  const payload = {
    title: `Test Ebook ${pages}p`,
    pages,
    prompt: "Generate a mystery story with chapters.",
  };

  const response = await request("POST", `${API_BASE}/api/ebook`, payload);

  if (response.status !== 202) {
    throw new Error(`Expected 202, got ${response.status}: ${response.raw}`);
  }

  const ebookId = response.body.id;
  log("INFO", `Generation started, ID: ${ebookId}`);

  return { ebookId, startTime };
}

async function pollStatus(ebookId, maxWait = POLL_TIMEOUT) {
  log("STEP", `Polling generation status...`);

  const startTime = Date.now();
  const deadline = startTime + maxWait;

  while (Date.now() < deadline) {
    const response = await request(
      "GET",
      `${API_BASE}/api/ebook/status/${ebookId}`
    );

    if (response.status !== 200) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    const { status, progress } = response.body;
    log("INFO", `Status: ${status} (${progress || 0}%)`);

    if (status === "completed") {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      log("PASS", `Generation completed in ${elapsed}s`);
      return true;
    }

    if (status === "failed") {
      throw new Error(`Generation failed: ${response.body.error}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error(`Generation timeout after ${maxWait / 1000}s`);
}

async function retrieveEbook(ebookId) {
  log("STEP", `Retrieving generated ebook...`);

  const response = await request("GET", `${API_BASE}/api/ebook/${ebookId}`);

  if (response.status !== 200) {
    throw new Error(`Retrieval failed: ${response.status}`);
  }

  const { content, metadata } = response.body;

  if (!content || !content.pages) {
    throw new Error("No pages in retrieved ebook");
  }

  log(
    "INFO",
    `Retrieved: ${content.pages.length} chapters, ${
      content.html?.length || 0
    } bytes HTML`
  );
  log("INFO", `Structure: ${metadata?.title || "UNKNOWN"}`);

  return { content, metadata };
}

async function exportPdf(content, metadata) {
  log("STEP", `Exporting to PDF...`);

  const payload = {
    pages: content.pages,
    html: content.html,
    metadata: metadata || {},
    actions: [],
  };

  const response = await request("POST", `${API_BASE}/export`, payload);

  if (response.status !== 200) {
    throw new Error(`Export failed: ${response.status}: ${response.raw}`);
  }

  if (!response.raw || response.raw.length === 0) {
    throw new Error("Export returned empty PDF");
  }

  log("PASS", `PDF exported successfully (${response.raw.length} bytes)`);
  return response.raw;
}

// ============================================================================
// Main Test Loop
// ============================================================================

async function testScenario(scenario) {
  console.log(`\n${"=".repeat(70)}`);
  log("INFO", `Starting: ${scenario.name}`);
  console.log(`${"=".repeat(70)}`);

  const scenarioStart = Date.now();

  try {
    // Step 1: Generate
    const { ebookId, startTime } = await generateEbook(scenario.pages);
    const genStart = Date.now() - startTime;

    // Step 2: Poll
    await pollStatus(ebookId);
    const genElapsed = Math.round((Date.now() - startTime) / 1000);

    // Step 3: Retrieve
    const { content, metadata } = await retrieveEbook(ebookId);

    if (content.pages.length !== scenario.pages) {
      throw new Error(
        `Expected ${scenario.pages} chapters, got ${content.pages.length}`
      );
    }

    // Step 4: Export
    const pdfData = await exportPdf(content, metadata);

    // Success
    const totalTime = Math.round((Date.now() - scenarioStart) / 1000);
    log("PASS", `✅ SCENARIO PASSED: ${scenario.name} (${totalTime}s total)`);

    return {
      scenario: scenario.name,
      pages: scenario.pages,
      status: "PASS",
      totalTime,
      generationTime: genElapsed,
      chapters: content.pages.length,
      htmlSize: content.html?.length || 0,
      pdfSize: pdfData.length,
    };
  } catch (error) {
    log("FAIL", `❌ SCENARIO FAILED: ${scenario.name}`);
    log("FAIL", `Error: ${error.message}`);

    return {
      scenario: scenario.name,
      pages: scenario.pages,
      status: "FAIL",
      error: error.message,
      totalTime: Math.round((Date.now() - scenarioStart) / 1000),
    };
  }
}

async function main() {
  console.log(
    "\n╔══════════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║        E2E Ebook Generation and Export Validation                     ║"
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════════════╝\n"
  );

  log("INFO", `Starting validation with ${TEST_SCENARIOS.length} scenarios`);
  log("INFO", `Backend: ${API_BASE}`);
  log("INFO", `Frontend: ${BASE_URL}`);

  const results = [];
  const mainStart = Date.now();

  for (const scenario of TEST_SCENARIOS) {
    const result = await testScenario(scenario);
    results.push(result);

    // Delay between scenarios to respect quota
    if (scenario !== TEST_SCENARIOS[TEST_SCENARIOS.length - 1]) {
      log("INFO", "Waiting 5 seconds before next scenario...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Summary
  console.log(`\n${"=".repeat(70)}`);
  console.log("VALIDATION SUMMARY");
  console.log(`${"=".repeat(70)}\n`);

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  results.forEach((result) => {
    const emoji = result.status === "PASS" ? "✅" : "❌";
    const status =
      result.status === "PASS"
        ? `${result.pages} pages, ${result.generationTime}s gen, ${result.pdfSize} bytes PDF`
        : result.error;
    console.log(`${emoji} ${result.scenario.padEnd(25)} | ${status}`);
  });

  console.log(
    `\n${passed === TEST_SCENARIOS.length ? "✅" : "❌"} Result: ${passed}/${
      TEST_SCENARIOS.length
    } passed`
  );
  console.log(`Total time: ${Math.round((Date.now() - mainStart) / 1000)}s\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  log("FAIL", `Fatal error: ${error.message}`);
  process.exit(1);
});
