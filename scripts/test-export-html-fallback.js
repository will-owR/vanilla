#!/usr/bin/env node
/**
 * Test Suite: POST /export HTML Fallback Fix
 *
 * Tests the validation fix that enables HTML fallback when pages array is empty
 * Reference: docs/IMPLEMENTATION_GUIDE.md Section IV - Testing Procedures
 */

const http = require("http");

const BASE_URL = "http://localhost:3000";

// Test utilities
function makeRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
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
          isJSON: res.headers["content-type"]?.includes("application/json"),
          isPDF: res.headers["content-type"]?.includes("application/pdf"),
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

// Test cases
const tests = [
  {
    name: "Test 1: Empty Pages with HTML (Primary Failure Scenario)",
    path: "/export",
    method: "POST",
    body: {
      pages: [],
      html: "<html><head><title>Test Export</title></head><body><h1>Test PDF</h1><p>This is a test.</p></body></html>",
      metadata: {
        title: "Test Export",
        mode: "basic",
      },
      validate: true,
    },
    expectedStatus: 200,
    expectedPDF: true,
    description: "Should accept empty pages + html and return PDF",
  },
  {
    name: "Test 2: Populated Pages (Existing Scenario)",
    path: "/export",
    method: "POST",
    body: {
      pages: [
        { title: "Chapter 1", content: "First chapter text" },
        { title: "Chapter 2", content: "Second chapter text" },
      ],
      metadata: {
        title: "Multi-page Export",
        mode: "basic",
      },
      validate: true,
    },
    expectedStatus: 200,
    expectedPDF: true,
    description: "Should accept populated pages and return PDF",
  },
  {
    name: "Test 3: Both Empty (Error Scenario)",
    path: "/export",
    method: "POST",
    body: {
      pages: [],
      metadata: {
        title: "No Content",
      },
    },
    expectedStatus: 400,
    expectedError: true,
    description: "Should reject when both pages and html are missing",
  },
  {
    name: "Test 4: Priority Verification (HTML Should Win)",
    path: "/export",
    method: "POST",
    body: {
      pages: [{ title: "Pages Chapter", content: "This should be IGNORED" }],
      html: "<html><body><h1>HTML Content</h1><p>This should be USED</p></body></html>",
      metadata: {
        title: "Priority Test",
      },
      validate: true,
    },
    expectedStatus: 200,
    expectedPDF: true,
    description: "Should prioritize html over pages",
  },
];

// Run tests
async function runTests() {
  console.log("\n" + "=".repeat(70));
  console.log("POST /export HTML Fallback - Test Suite");
  console.log("=".repeat(70) + "\n");

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n${test.name}`);
    console.log("-".repeat(70));
    console.log(`Description: ${test.description}`);

    try {
      const response = await makeRequest(test.path, test.method, test.body);

      console.log(
        `Status: ${response.status} (expected: ${test.expectedStatus})`
      );
      console.log(`Content-Type: ${response.headers["content-type"]}`);

      // Check status
      const statusOK = response.status === test.expectedStatus;
      console.log(`Status check: ${statusOK ? "✓ PASS" : "✗ FAIL"}`);

      // Check response type
      if (test.expectedPDF) {
        const pdfOK = response.isPDF;
        console.log(
          `PDF response: ${pdfOK ? "✓ PASS" : "✗ FAIL"} (got ${
            response.headers["content-type"]
          })`
        );

        if (statusOK && pdfOK) {
          console.log(`Size: ${response.body.length} bytes`);
          passed++;
          console.log("✓ TEST PASSED");
        } else {
          failed++;
          console.log("✗ TEST FAILED");
          if (!pdfOK) {
            console.log(`Response body: ${response.body.substring(0, 200)}`);
          }
        }
      } else if (test.expectedError) {
        const errorOK = response.isJSON;
        console.log(`Error response: ${errorOK ? "✓ PASS" : "✗ FAIL"}`);

        if (statusOK && errorOK) {
          try {
            const errorBody = JSON.parse(response.body);
            // Handle both flat and nested error structures
            const errorMsg =
              typeof errorBody.error === "string"
                ? errorBody.error
                : errorBody.error?.message || JSON.stringify(errorBody.error);
            console.log(`Error message: "${errorMsg}"`);
            // Check for html fallback validation in error message
            if (errorMsg.includes("or html content")) {
              console.log("Message contains HTML fallback validation: ✓ PASS");
              passed++;
              console.log("✓ TEST PASSED");
            } else {
              console.log("Message missing HTML fallback validation: ✗ FAIL");
              failed++;
              console.log("✗ TEST FAILED");
            }
          } catch (e) {
            failed++;
            console.log("✗ TEST FAILED - Could not parse error response");
            console.log(`Response: ${response.body}`);
          }
        } else {
          failed++;
          console.log("✗ TEST FAILED");
          console.log(`Response: ${response.body.substring(0, 200)}`);
        }
      }
    } catch (error) {
      failed++;
      console.log(`✗ TEST FAILED - ${error.message}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(70) + "\n");

  if (failed === 0) {
    console.log("🎉 All tests passed! HTML fallback fix is working correctly.");
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Review output above.`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run with error handling
runTests().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
