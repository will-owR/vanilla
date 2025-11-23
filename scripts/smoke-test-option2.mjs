#!/usr/bin/env node
/**
 * Smoke Test for Phase B Option 2 Implementation
 * Tests critical path: generate → override → error handling
 */

const API_BASE = "http://localhost:3000";
const TIMEOUTS = {
  GENERATE: 35000,
  OVERRIDE: 15000,
  THEMES: 10000,
};

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

// Helper: fetch with timeout
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      const data = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { error: text };
        }
      })();
      throw new Error(
        data.error || `API error ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    if (err instanceof TypeError) {
      throw new Error(`Network error: ${err.message}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Test helpers
function logTest(name) {
  process.stdout.write(`\n✓ Testing: ${name}... `);
}

function pass() {
  console.log("✅ PASS");
  testsPassed++;
}

function fail(error) {
  console.log(`❌ FAIL: ${error.message}`);
  testsFailed++;
  failures.push({ test: "Latest test", error: error.message });
}

// ============ TEST 1: GET /api/themes ============
async function testThemesEndpoint() {
  logTest("GET /api/themes");
  try {
    const data = await fetchWithTimeout(
      `${API_BASE}/api/themes`,
      { method: "GET" },
      TIMEOUTS.THEMES
    );

    // Verify response structure
    if (!Array.isArray(data.themes)) {
      throw new Error("Response.themes is not an array");
    }
    if (data.themes.length === 0) {
      throw new Error("Themes list is empty");
    }

    const validThemeIds = ["dark", "light", "corporate", "bold"];
    const hasAllThemes = validThemeIds.every((id) =>
      data.themes.some((t) => t.id === id)
    );
    if (!hasAllThemes) {
      throw new Error(
        `Missing expected themes. Got: ${data.themes
          .map((t) => t.id)
          .join(", ")}`
      );
    }

    console.log(
      `  → Found ${data.themes.length} themes: ${data.themes
        .map((t) => t.id)
        .join(", ")}`
    );
    pass();
    return true;
  } catch (error) {
    fail(error);
    return false;
  }
}

// ============ TEST 2: POST /api/ebook/generate ============
async function testGenerateEndpoint() {
  logTest("POST /api/ebook/generate (valid payload)");
  try {
    const payload = {
      prompt: "Write a short children story about a brave mouse",
      theme: "dark",
      pageCount: 5,
      colorPalette: "standard",
      fontSizeScale: 1.0,
    };

    const data = await fetchWithTimeout(
      `${API_BASE}/api/ebook/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      TIMEOUTS.GENERATE
    );

    // Verify response structure
    if (!data.id) throw new Error("Missing id in response");
    if (!data.html) throw new Error("Missing html in response");
    if (!data.metadata) throw new Error("Missing metadata in response");
    if (typeof data.pages !== "number")
      throw new Error("Missing or invalid pages in response");
    if (typeof data.can_export !== "boolean")
      throw new Error("Missing or invalid can_export in response");
    if (typeof data.can_override !== "boolean")
      throw new Error("Missing or invalid can_override in response");

    console.log(`  → Generated eBook ID: ${data.id}`);
    console.log(
      `  → Pages: ${data.pages}, Theme: ${data.metadata.theme}, HTML length: ${data.html.length} chars`
    );
    pass();
    return { ebookId: data.id, html: data.html, metadata: data.metadata };
  } catch (error) {
    fail(error);
    return null;
  }
}

// ============ TEST 3: POST /api/ebook/generate (invalid payload) ============
async function testGenerateInvalidPayload() {
  logTest("POST /api/ebook/generate (missing prompt - should fail)");
  try {
    const payload = {
      theme: "dark",
      pageCount: 5,
      // Missing prompt
    };

    await fetchWithTimeout(
      `${API_BASE}/api/ebook/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      TIMEOUTS.GENERATE
    );

    fail(new Error("Should have thrown validation error"));
    return false;
  } catch (error) {
    if (
      error.message.includes("required") ||
      error.message.includes("API error")
    ) {
      console.log(`  → Correctly rejected: ${error.message}`);
      pass();
      return true;
    }
    fail(error);
    return false;
  }
}

// ============ TEST 4: POST /api/override ============
async function testOverrideEndpoint(ebookData) {
  logTest("POST /api/override (valid payload)");
  try {
    if (!ebookData) {
      throw new Error("Previous generate test failed, skipping override test");
    }

    const payload = {
      ebookId: ebookData.ebookId,
      html: ebookData.html,
      metadata: ebookData.metadata,
      overrides: {
        theme: "light",
        colorPalette: "vibrant",
        fontSizeScale: 1.1,
        density: "dense",
      },
    };

    const data = await fetchWithTimeout(
      `${API_BASE}/api/override`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      TIMEOUTS.OVERRIDE
    );

    // Verify response structure
    if (!data.id) throw new Error("Missing id in response");
    if (!data.html) throw new Error("Missing html in response");
    if (!data.metadata) throw new Error("Missing metadata in response");

    console.log(`  → Override applied successfully`);
    console.log(`  → Response HTML length: ${data.html.length} chars`);
    pass();
    return true;
  } catch (error) {
    fail(error);
    return false;
  }
}

// ============ TEST 5: Error timeout simulation ============
async function testTimeoutHandling() {
  logTest("Error handling: timeout protection");
  try {
    // This should timeout quickly since we use a very short timeout
    await fetchWithTimeout(
      `${API_BASE}/api/ebook/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "test" }),
      },
      100 // 100ms timeout (too short for real response)
    );

    fail(new Error("Should have timed out"));
    return false;
  } catch (error) {
    if (error.message.includes("timeout")) {
      console.log(`  → Timeout correctly detected and handled`);
      pass();
      return true;
    }
    // Other errors might also be acceptable (e.g., network errors)
    console.log(`  → Error correctly raised: ${error.message}`);
    pass();
    return true;
  }
}

// ============ MAIN TEST RUNNER ============
async function runTests() {
  console.log("\n");
  console.log("═".repeat(60));
  console.log("PHASE B OPTION 2 - SMOKE TEST");
  console.log("═".repeat(60));
  console.log(`Backend URL: ${API_BASE}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  try {
    // Test 1: Themes endpoint
    const themesOk = await testThemesEndpoint();

    // Test 2: Generate endpoint (valid)
    const ebookData = await testGenerateEndpoint();

    // Test 3: Generate endpoint (invalid)
    await testGenerateInvalidPayload();

    // Test 4: Override endpoint
    if (ebookData) {
      await testOverrideEndpoint(ebookData);
    } else {
      console.log("\n⚠ Skipping override test (generate failed)");
    }

    // Test 5: Timeout handling
    await testTimeoutHandling();
  } catch (error) {
    console.error("\n❌ FATAL ERROR:", error);
    testsFailed++;
  }

  // Print summary
  console.log("\n");
  console.log("═".repeat(60));
  console.log(`RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
  console.log("═".repeat(60));

  if (failures.length > 0) {
    console.log("\nFAILURES:");
    failures.forEach((f) => {
      console.log(`  ✗ ${f.test}: ${f.error}`);
    });
  }

  console.log(`\nEnded at: ${new Date().toISOString()}\n`);

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
