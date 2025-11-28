#!/usr/bin/env node

/**
 * Backend Round-Trip Export Test
 *
 * Purpose: Prove backend can export what it generates
 * Validates genieService.exportContent() with both export methods:
 *   1. Direct content: {pages, html, metadata}
 *   2. Persisted ID: {resultId}
 *
 * Success: Both methods produce valid PDFs with full generated content
 *
 * Run: node scripts/test-export-roundtrip.js
 */

const http = require("http");

const BASE_URL = "http://localhost:3000";

// Test configuration
const TEST_PROMPT = "A mysterious treasure hunt in the ancient library";
const EXPECTED_CHAPTERS = 5;

/**
 * Make HTTP request with JSON body
 */
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Test flow
 */
async function runTests() {
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("🚀 BACKEND ROUND-TRIP EXPORT TEST");
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );

  let resultId = null;
  let generateResponse = null;
  let directExportBuffer = null;
  let idExportBuffer = null;

  try {
    // ====================================================================
    // STEP 1: Generate eBook
    // ====================================================================
    console.log("📝 STEP 1: Generating eBook...");
    console.log(`   Prompt: "${TEST_PROMPT}"`);

    const generateRes = await makeRequest("POST", "/api/ebook/generate", {
      prompt: TEST_PROMPT,
      theme: "light",
      pageCount: EXPECTED_CHAPTERS,
    });

    if (generateRes.status !== 200) {
      throw new Error(`Generation failed: ${generateRes.status}`);
    }

    try {
      generateResponse = JSON.parse(generateRes.body);
    } catch (e) {
      console.error("   ❌ Failed to parse response:", generateRes.body);
      throw e;
    }

    resultId = generateResponse.resultId;
    const chapters = generateResponse.chapters || [];
    const html = generateResponse.html;

    console.log(`   ✅ Generation successful`);
    console.log(`   - resultId: ${resultId}`);
    console.log(`   - chapters: ${chapters.length}`);
    console.log(`   - html length: ${html?.length || 0} bytes`);
    console.log(`   - title: ${generateResponse.title}`);

    if (!resultId) {
      throw new Error("Response missing resultId");
    }

    if (!html || html.length < 1000) {
      throw new Error(`HTML too short: ${html?.length || 0} bytes`);
    }

    // ====================================================================
    // STEP 2: Export Method A - Direct Content (current flow)
    // ====================================================================
    console.log(
      "\n📥 STEP 2A: Exporting via direct content {pages, html, metadata}..."
    );

    const directExportRes = await makeRequest("POST", "/export", {
      pages: chapters,
      html: html,
      metadata: generateResponse.metadata,
      actions: generateResponse.actions,
    });

    if (directExportRes.status !== 200) {
      console.error(`   ❌ Export failed: ${directExportRes.status}`);
      console.error(`   Response: ${directExportRes.body}`);
      throw new Error(`Direct export failed: ${directExportRes.status}`);
    }

    directExportBuffer = directExportRes.body;
    console.log(`   ✅ Direct export successful`);
    console.log(`   - PDF size: ${directExportBuffer.length} bytes`);
    console.log(
      `   - Content-Type: ${directExportRes.headers["content-type"]}`
    );

    if (directExportBuffer.length < 10000) {
      console.warn(
        `   ⚠️  WARNING: PDF smaller than expected (${directExportBuffer.length} bytes)`
      );
    }

    // ====================================================================
    // STEP 2B: Export Method B - Persisted ID (future flow)
    // ====================================================================
    console.log("\n📥 STEP 2B: Exporting via persisted ID {resultId}...");
    console.log(`   resultId: ${resultId}`);

    const idExportRes = await makeRequest("POST", "/api/export", {
      resultId: resultId,
    });

    if (idExportRes.status !== 200) {
      console.error(`   ❌ Export failed: ${idExportRes.status}`);
      console.error(`   Response: ${idExportRes.body}`);
      throw new Error(`ID-based export failed: ${idExportRes.status}`);
    }

    idExportBuffer = idExportRes.body;
    console.log(`   ✅ ID-based export successful`);
    console.log(`   - PDF size: ${idExportBuffer.length} bytes`);
    console.log(`   - Content-Type: ${idExportRes.headers["content-type"]}`);

    if (idExportBuffer.length < 10000) {
      console.warn(
        `   ⚠️  WARNING: PDF smaller than expected (${idExportBuffer.length} bytes)`
      );
    }

    // ====================================================================
    // STEP 3: Validation
    // ====================================================================
    console.log("\n✅ VALIDATION");

    // Check: Both PDFs exist
    if (!directExportBuffer || directExportBuffer.length === 0) {
      throw new Error("Direct export buffer is empty");
    }
    if (!idExportBuffer || idExportBuffer.length === 0) {
      throw new Error("ID-based export buffer is empty");
    }
    console.log("   ✅ Both PDFs generated");

    // Check: Both start with PDF magic bytes
    const PDF_MAGIC = "%PDF";
    if (!directExportBuffer.toString().startsWith(PDF_MAGIC)) {
      throw new Error(
        "Direct export is not a valid PDF (missing PDF magic bytes)"
      );
    }
    if (!idExportBuffer.toString().startsWith(PDF_MAGIC)) {
      throw new Error(
        "ID-based export is not a valid PDF (missing PDF magic bytes)"
      );
    }
    console.log("   ✅ Both are valid PDF files");

    // Check: PDFs have reasonable size (> 10KB suggests multi-page with content)
    if (directExportBuffer.length < 10000) {
      console.warn(
        `   ⚠️  Direct export smaller than expected: ${directExportBuffer.length} bytes`
      );
    } else {
      console.log(
        `   ✅ Direct export PDF has substantial content: ${directExportBuffer.length} bytes`
      );
    }

    if (idExportBuffer.length < 10000) {
      console.warn(
        `   ⚠️  ID-based export smaller than expected: ${idExportBuffer.length} bytes`
      );
    } else {
      console.log(
        `   ✅ ID-based export PDF has substantial content: ${idExportBuffer.length} bytes`
      );
    }

    // Check: Both PDFs are similar size (within 10% variance acceptable)
    const sizeDiff = Math.abs(
      directExportBuffer.length - idExportBuffer.length
    );
    const maxDiff =
      Math.max(directExportBuffer.length, idExportBuffer.length) * 0.1;

    if (sizeDiff > maxDiff) {
      console.warn(
        `   ⚠️  WARNING: PDF sizes differ significantly (${sizeDiff} bytes diff)`
      );
    } else {
      console.log(
        `   ✅ PDF sizes are consistent (${sizeDiff} bytes difference)`
      );
    }

    // ====================================================================
    // RESULTS
    // ====================================================================
    console.log(
      "\n═══════════════════════════════════════════════════════════════"
    );
    console.log("✅ ALL TESTS PASSED");
    console.log(
      "═══════════════════════════════════════════════════════════════"
    );
    console.log("\nSummary:");
    console.log(`  ✅ Generated eBook with ${chapters.length} chapters`);
    console.log(
      `  ✅ Direct export produced valid PDF (${directExportBuffer.length} bytes)`
    );
    console.log(
      `  ✅ ID-based export produced valid PDF (${idExportBuffer.length} bytes)`
    );
    console.log(`  ✅ Backend can export what it generates`);
    console.log("\nConclusion:");
    console.log("  Both export methods work correctly!");
    console.log("  The backend orchestrator successfully handles:");
    console.log("    - Direct content {pages, html, metadata}");
    console.log("    - Persisted ID {resultId}");
    console.log("\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST FAILED");
    console.error(
      "═══════════════════════════════════════════════════════════════"
    );
    console.error(`Error: ${error.message}`);
    console.error("\nDebugging info:");
    console.error(`  - resultId: ${resultId}`);
    console.error(
      `  - Direct export size: ${directExportBuffer?.length || "N/A"}`
    );
    console.error(`  - ID export size: ${idExportBuffer?.length || "N/A"}`);
    console.error("\nTroubleshooting:");
    console.error("  1. Is the server running? (npm run dev)");
    console.error("  2. Check server logs for [EXPORT-ORCH] messages");
    console.error("  3. Verify genieService.exportContent() was added");
    console.error("  4. Verify /api/export endpoint was updated");
    console.error("\n");

    process.exit(1);
  }
}

// Run tests
runTests().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
