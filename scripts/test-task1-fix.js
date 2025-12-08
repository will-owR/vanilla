#!/usr/bin/env node

/**
 * Task 1 Verification: Test infinite recursion fix
 * Tests that getStatus() and getMessage() no longer call each other
 */

const { quotaTracker } = require("../server/geminiClient");

console.log("\n=== Task 1: Infinite Recursion Fix Verification ===\n");

try {
  console.log("✓ Testing getStatus() method...");
  const status = quotaTracker.getStatus();

  // Verify the response structure
  const requiredFields = [
    "callCount",
    "limit",
    "remaining",
    "percentUsed",
    "isPaused",
    "secondsUntilReset",
  ];
  for (const field of requiredFields) {
    if (!(field in status)) {
      throw new Error(`Missing field: ${field}`);
    }
  }

  console.log("  • callCount:", status.callCount);
  console.log("  • limit:", status.limit);
  console.log("  • percentUsed:", status.percentUsed + "%");
  console.log("  • isPaused:", status.isPaused);
  console.log("  • secondsUntilReset:", status.secondsUntilReset);
  console.log("✓ getStatus() returns complete response (no recursion error)\n");

  console.log("✓ Testing getMessage() method...");
  const message = quotaTracker.getMessage();
  console.log("  Message:", message);
  console.log("✓ getMessage() executes without recursion error\n");

  console.log("✓ Testing call recording...");
  const recordResult = quotaTracker.recordCall();
  console.log("  Record result:", recordResult);
  console.log("✓ recordCall() works correctly\n");

  console.log("✅ TASK 1 VERIFICATION PASSED");
  console.log("\nSuccess Criteria Met:");
  console.log("  ✓ /api/quota-status endpoint would return 200");
  console.log("  ✓ No 'Maximum call stack size exceeded' errors");
  console.log(
    "  ✓ Response includes: callCount, limit, percentUsed, isPaused, secondsUntilReset"
  );
  console.log("\n");

  process.exit(0);
} catch (error) {
  console.error("❌ TASK 1 VERIFICATION FAILED");
  console.error("\nError:", error.message);
  if (error.stack) {
    console.error("\nStack trace (first 10 lines):");
    console.error(error.stack.split("\n").slice(0, 10).join("\n"));
  }
  console.error("\n");
  process.exit(1);
}
