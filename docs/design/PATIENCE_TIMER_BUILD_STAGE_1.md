# Patience Timer Build: Stage 1 - Foundation & Branch Setup

**Document ID**: PATIENCE_TIMER_BUILD_STAGE_1  
**Date**: December 9, 2025  
**Status**: Implementation Stage 1 of 5  
**Branch**: `feat/patience-timer-sequential` (CREATE THIS FIRST)

---

## ⚠️ WORK IN PROGRESS - MULTI-STAGE DELIVERY

This is **Stage 1 of 5** in the Patience Timer implementation. This document covers only the foundation layer.

**Stage Progression**:

- ✅ **STAGE 1** (THIS DOCUMENT): CallManager class, quota/time tracking, unit tests
- 📋 **STAGE 2**: ebookService integration, job queue updates, integration tests
- 📋 **STAGE 3**: Frontend Timer component, SSE event handling, UI/UX
- 📋 **STAGE 4**: Full job queue metrics, deadline tracking, backend-frontend events
- 📋 **STAGE 5**: End-to-end testing, performance validation, deployment procedures

**Next Steps**: Once you complete Stage 1 and all tests pass, **PATIENCE_TIMER_BUILD_STAGE_2** will be created covering ebookService integration, then Stages 3-5 follow.

**All parties should understand**: This is intentionally staged to manage scope and allow incremental validation at each step.

---

## Table of Contents

1. [Critical: Branch Management](#critical-branch-management)
2. [Stage 1 Overview](#stage-1-overview)
3. [IMPL-SETUP-001: Git Branch Creation](#impl-setup-001-git-branch-creation)
4. [IMPL-SETUP-002: Project Structure Changes](#impl-setup-002-project-structure-changes)
5. [IMPL-CORE-001: CallManager Class - Part A](#impl-core-001-callmanager-class---part-a)
6. [IMPL-CORE-002: CallManager Class - Part B](#impl-core-002-callmanager-class---part-b)
7. [IMPL-UNIT-001: CallManager Unit Tests](#impl-unit-001-callmanager-unit-tests)
8. [Stage 1 Validation Checklist](#stage-1-validation-checklist)
9. [Next Stage: Preview](#next-stage-preview)

---

## ⚠️ CRITICAL: Branch Management

**STOP AND READ THIS FIRST**

This implementation **MUST** be carried out in its own isolated branch. Do NOT work on `main` or any other branches.

### [IMPL-SETUP-001: Git Branch Creation](#impl-setup-001-git-branch-creation)

**Prerequisites**:

- You are currently on `feat/revert` (confirmed in context)
- Local repository is clean (no uncommitted changes)

**Step 1: Create New Branch**

```bash
# Verify you're on feat/revert
git branch -v
# Expected: * feat/revert

# Create new branch from main (NOT from feat/revert)
git checkout main
git pull origin main
git checkout -b feat/patience-timer-sequential

# Verify branch created
git branch -v
# Expected: * feat/patience-timer-sequential

# Push to remote to create upstream
git push -u origin feat/patience-timer-sequential
```

**Why from main, not feat/revert?**

- `feat/revert` may contain incomplete/experimental work
- `feat/patience-timer-sequential` should be clean, isolated, and traceable
- This prevents accidental merge of unrelated changes

**Step 2: Verify Branch Isolation**

```bash
# Check branch history (should match main)
git log --oneline -5

# Check for any local modifications
git status
# Expected: "On branch feat/patience-timer-sequential" and "working tree clean"
```

**Step 3: Create Branch Protection (Optional but Recommended)**

In GitHub repo settings:

- Add `feat/patience-timer-sequential` to protected branches
- Require pull request reviews before merge
- This ensures code review before merging to main

---

## Stage 1 Overview

**Scope**: Implement CallManager class with quota/time tracking and error handling.

**Deliverables**:

- ✅ CallManager class (complete)
- ✅ Quota management system
- ✅ Time budget tracking
- ✅ Error classification & enhancement
- ✅ Unit tests for CallManager

**Timeline**: 2-3 hours  
**Files Created/Modified**: 2 files (1 new class, 1 test file)

**Not Included in Stage 1** (defer to later stages):

- ebookService integration (Stage 2)
- Frontend Timer component (Stage 3)
- Job Queue integration (Stage 4)
- Full E2E testing (Stage 5)

---

## IMPL-SETUP-002: Project Structure Changes

**Current Structure** (before Stage 1):

```
server/
├── index.js
├── genieService.js
├── ebookService.js
├── aiService.js
├── ... (other files)
└── __tests__/
    └── (test files)
```

**After Stage 1** (changes only):

```
server/
├── CallManager.js                          [NEW FILE]
├── index.js                                (no changes)
├── genieService.js                         (no changes yet)
├── ebookService.js                         (no changes yet)
├── aiService.js                            (no changes yet)
└── __tests__/
    └── CallManager.test.js                 [NEW FILE]
```

**Total Changes**:

- 1 new file: `server/CallManager.js` (~350 lines)
- 1 new test file: `server/__tests__/CallManager.test.js` (~280 lines)
- 0 modified files in Stage 1 (safe, no breaking changes)

---

## IMPL-CORE-001: CallManager Class - Part A

**File**: `server/CallManager.js` (lines 1-180)

**Create the file**:

```bash
touch server/CallManager.js
```

**Add Part A code**:

```javascript
/**
 * CallManager - Orchestrates AI model access with quota and time awareness
 *
 * Purpose:
 * - Track per-minute quota consumption (20 calls/min for Gemini free tier)
 * - Manage time budget relative to deadline
 * - Defer calls transparently when quota exhausted
 * - Never fail on infrastructure constraints (only on genuine errors)
 * - Provide observable metrics for frontend progress tracking
 *
 * Architecture Document: PATIENCE_TIMER_BLUEPRINT.md [SEQ-CORE-001]
 */

class CallManager {
  /**
   * Initialize CallManager with time and quota configuration.
   *
   * @param {Object} options - Configuration options
   * @param {number} options.deadline - When generation must complete (ms timestamp)
   * @param {number} options.startTime - Start reference point (defaults to now)
   * @param {number} options.quotaLimit - Max calls per window (default 20)
   * @param {number} options.quotaWindow - Window duration in ms (default 60000)
   * @param {Object} options.aiService - AI service instance (optional)
   * @param {boolean} options.autoRetry - Auto-retry retriable errors (default true)
   * @param {number} options.maxDeferralWait - Max time to wait for retry (default 120000)
   * @param {Function} options.onStatusChange - Callback for status updates
   * @param {Function} options.onDeferral - Callback for deferral events
   */
  constructor(options = {}) {
    // Validate deadline
    const deadline = options.deadline || Date.now() + 600000; // 10min default
    const now = Date.now();

    if (deadline <= now) {
      console.warn(
        "[CallManager] Deadline in the past, using 600s default instead"
      );
      this.deadline = now + 600000;
    } else {
      this.deadline = deadline;
    }

    // Time Management
    this.startTime = options.startTime || Date.now();

    // Quota Management
    this.quotaLimit = options.quotaLimit || 20; // calls per minute
    this.quotaWindow = options.quotaWindow || 60000; // milliseconds

    // Call Tracking
    this.callHistory = []; // [{ timestamp, callIndex, callType, model, status }, ...]

    // State Tracking
    this.isProcessing = false;
    this.lastWindowReset = Date.now();
    this.deferralCount = 0;
    this.totalCallsAttempted = 0;
    this.totalCallsSucceeded = 0;
    this.totalCallsFailed = 0;

    // Configuration
    this.config = {
      autoRetry: options.autoRetry !== false,
      maxDeferralWait: options.maxDeferralWait || 120000, // 2 minutes
      onStatusChange: options.onStatusChange || (() => {}),
      onDeferral: options.onDeferral || (() => {}),
    };

    // Diagnostics
    this.createdAt = Date.now();
    this.logDiagnostics();
  }

  /**
   * Log diagnostic information for debugging.
   * @private
   */
  logDiagnostics() {
    const now = Date.now();
    const deadline = this.deadline;
    const budgetMs = deadline - this.startTime;
    const budgetSeconds = Math.round(budgetMs / 1000);

    console.log("[CallManager] Initialized");
    console.log(`  - Deadline: ${budgetSeconds}s from start`);
    console.log(
      `  - Quota limit: ${this.quotaLimit} calls per ${this.quotaWindow}ms`
    );
    console.log(`  - Auto-retry: ${this.config.autoRetry}`);
  }

  /**
   * Execute a single API call with quota and time management.
   *
   * Behavior:
   * - Quota exhausted? Defer transparently, wait for window reset, retry automatically
   * - Time tight (>80%)? Warn but continue (user controls deadline)
   * - Genuine error? Fail with enhanced context
   *
   * @param {Function} callFn - Async function that makes AI call
   *                            Signature: async (model) => result
   * @param {number} callIndex - Sequential index (0=Pro/structure, >0=Flash/chapters)
   * @param {string} callType - Type identifier for logging (structure|chapter-1|etc)
   * @returns {Promise<Object>} Result from callFn
   * @throws {Error} Enhanced error with context if call fails permanently
   */
  async executeCall(callFn, callIndex, callType = "content") {
    this.totalCallsAttempted++;

    // [SEQ-QUOTA-001] Manage quota before executing call
    await this.manageQuota();

    // [SEQ-TIME-001] Check time budget and warn if tight
    const timeStatus = this.getTimeStatus();
    if (timeStatus.percentUsed > 80 && timeStatus.percentUsed < 100) {
      this.emitStatus({
        type: "time-tight",
        phase: callType,
        percentUsed: timeStatus.percentUsed,
        remainingMs: timeStatus.remainingMs,
        message: `⚠️ Time budget ${
          timeStatus.percentUsed
        }% used (${this.formatMs(timeStatus.remainingMs)} remaining)`,
      });
    } else if (timeStatus.percentUsed >= 100) {
      this.emitStatus({
        type: "time-exceeded",
        elapsedMs: timeStatus.elapsedMs,
        budgetMs: timeStatus.budgetMs,
        message: `⏳ Deadline exceeded, continuing anyway...`,
      });
    }

    // Determine model based on call index (Pro for structure, Flash for chapters)
    const model = callIndex === 0 ? "gemini-2.5-pro" : "gemini-2.5-flash";

    // Record call start
    const callRecord = {
      timestamp: Date.now(),
      callIndex,
      callType,
      model,
      status: "executing",
      error: null,
    };

    try {
      // Execute the call
      const result = await callFn(model);

      // Record successful call
      callRecord.status = "success";
      this.callHistory.push(callRecord);
      this.totalCallsSucceeded++;

      return result;
    } catch (error) {
      // Record failed call
      callRecord.status = "error";
      callRecord.error = error.message;
      this.callHistory.push(callRecord);
      this.totalCallsFailed++;

      // [SEQ-ERROR-001] Classify error
      const isRetriable = this.isRetriableError(error);

      if (isRetriable && this.config.autoRetry) {
        // Deferrable error - emit event and retry
        this.deferralCount++;

        this.emitDeferral({
          callIndex,
          callType,
          model,
          error: error.message,
          retryAfter: "quota-reset",
          attemptNumber: 1,
        });

        // Wait for quota window reset
        await this.waitForQuotaReset();

        // Recursively retry
        return this.executeCall(callFn, callIndex, callType);
      } else {
        // Genuine error - fail with enhanced context
        const enhanced = this.enhanceError(error, {
          callIndex,
          callType,
          model,
          quotaStatus: this.getQuotaStatus(),
          timeStatus: this.getTimeStatus(),
        });

        throw enhanced;
      }
    }
  }

  /**
   * Manage quota before executing a call.
   *
   * Strategy:
   * 1. Check if quota window has expired (60s)
   * 2. Count successful calls in current window
   * 3. If at limit, wait for window to reset
   *
   * @private
   */
  async manageQuota() {
    const now = Date.now();
    const windowAge = now - this.lastWindowReset;

    // [SEQ-QUOTA-001-A] Reset window if expired
    if (windowAge >= this.quotaWindow) {
      // Clear old call history
      this.callHistory = this.callHistory.filter(
        (call) => now - call.timestamp < this.quotaWindow
      );
      this.lastWindowReset = now;
      return; // Window reset, quota available
    }

    // [SEQ-QUOTA-001-B] Count successful calls in current window
    const callsInWindow = this.callHistory.filter(
      (call) =>
        call.status === "success" && now - call.timestamp < this.quotaWindow
    ).length;

    // [SEQ-QUOTA-001-C] If at quota limit, wait for reset
    if (callsInWindow >= this.quotaLimit) {
      const waitTime = this.quotaWindow - windowAge + 100; // +100ms buffer

      this.emitStatus({
        type: "quota-deferral",
        callsInWindow,
        quotaLimit: this.quotaLimit,
        waitMs: Math.max(0, waitTime),
        percentUsed: Math.round((callsInWindow / this.quotaLimit) * 100),
        message: `⏸️ Quota exhausted (${callsInWindow}/${
          this.quotaLimit
        }). Waiting ${this.formatMs(Math.max(0, waitTime))} for reset.`,
      });

      // Sleep transparently
      await this.sleep(Math.max(0, waitTime));

      // Recursively check quota (should be OK now)
      return this.manageQuota();
    }
  }

  /**
   * Wait for quota window to reset after deferral.
   *
   * @private
   */
  async waitForQuotaReset() {
    const now = Date.now();
    const windowAge = now - this.lastWindowReset;
    const waitTime = this.quotaWindow - windowAge + 100; // +100ms buffer

    if (waitTime > 0) {
      this.emitStatus({
        type: "quota-wait-reset",
        waitMs: waitTime,
        message: `Waiting ${this.formatMs(waitTime)} for quota window reset...`,
      });

      await this.sleep(waitTime);
    }

    this.lastWindowReset = Date.now();
  }

  /**
   * Determine if error is retriable (infrastructure) vs fatal (genuine).
   *
   * Retriable errors cause automatic deferral and retry:
   * - QUOTA_EXHAUSTED: API rate limit
   * - SERVICE_UNAVAILABLE: Transient service issue
   * - TEMPORARY_FAILURE: Network timeout
   *
   * Fatal errors cause immediate failure:
   * - AUTHENTICATION_FAILED: API key invalid
   * - INVALID_ARGUMENT: Bad input to API
   * - PERMISSION_DENIED: Access control
   *
   * @private
   */
  isRetriableError(error) {
    const code = (error.code || error.status || error.message || "").toString();

    const retriableCodes = [
      "QUOTA_EXHAUSTED",
      "RATE_LIMIT_EXCEEDED",
      "SERVICE_UNAVAILABLE",
      "TEMPORARY_FAILURE",
      "RESOURCE_EXHAUSTED",
      "429", // HTTP: Too Many Requests
      "503", // HTTP: Service Unavailable
      "504", // HTTP: Gateway Timeout
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
    ];

    const fatalCodes = [
      "INVALID_ARGUMENT",
      "AUTHENTICATION_FAILED",
      "INVALID_API_KEY",
      "PERMISSION_DENIED",
      "NOT_FOUND",
      "400", // HTTP: Bad Request
      "401", // HTTP: Unauthorized
      "403", // HTTP: Forbidden
      "404", // HTTP: Not Found
    ];

    // Check retriable codes
    for (const retriable of retriableCodes) {
      if (code.includes(retriable)) {
        return true;
      }
    }

    // Check fatal codes
    for (const fatal of fatalCodes) {
      if (code.includes(fatal)) {
        return false;
      }
    }

    // Default: assume retriable (conservative approach)
    return true;
  }

  /**
   * Enhance error with diagnostic context.
   *
   * Includes:
   * - Call index, type, model
   * - Quota status at failure time
   * - Time status at failure time
   * - Recent call history for context
   *
   * @private
   */
  enhanceError(error, context) {
    const enhanced = new Error(
      `[${context.callType}#${context.callIndex}] ${error.message}`
    );

    enhanced.callIndex = context.callIndex;
    enhanced.callType = context.callType;
    enhanced.model = context.model;
    enhanced.quotaStatus = context.quotaStatus;
    enhanced.timeStatus = context.timeStatus;
    enhanced.recentCalls = this.callHistory.slice(-5); // Last 5 calls for context
    enhanced.originalError = error;
    enhanced.timestamp = Date.now();

    return enhanced;
  }

  // [Continued in IMPL-CORE-002...]
}

module.exports = CallManager;
```

**File Size**: ~350 lines total (Part A is ~180 lines, see Part B for continuation)

**Verification**:

```bash
# Check file created
ls -lh server/CallManager.js
# Expected: -rw-r--r-- ... CallManager.js

# Check no syntax errors
node -c server/CallManager.js
# Expected: (no output = syntax OK)
```

---

## IMPL-CORE-002: CallManager Class - Part B

**File**: `server/CallManager.js` (lines 181-350, append to Part A)

**Add Part B code** (append to CallManager.js):

```javascript
  /**
   * Get current quota status.
   *
   * Returns:
   * - callsInWindow: Successful calls in current 60s window
   * - quotaLimit: Maximum allowed calls per window
   * - percentUsed: Percentage of quota consumed
   * - nextResetAt: Timestamp when window resets
   * - resetInMs: Milliseconds until reset
   *
   * @returns {Object} Quota status object
   */
  getQuotaStatus() {
    const now = Date.now();
    const windowAge = now - this.lastWindowReset;

    const callsInWindow = this.callHistory.filter(
      (call) =>
        call.status === 'success' &&
        now - call.timestamp < this.quotaWindow
    ).length;

    const nextResetAt = this.lastWindowReset + this.quotaWindow;

    return {
      callsInWindow,
      quotaLimit: this.quotaLimit,
      percentUsed: Math.round((callsInWindow / this.quotaLimit) * 100),
      nextResetAt,
      resetInMs: Math.max(0, nextResetAt - now),
      isExhausted: callsInWindow >= this.quotaLimit,
    };
  }

  /**
   * Get current time budget status.
   *
   * Returns:
   * - elapsedMs: Time elapsed since start
   * - budgetMs: Total time budget
   * - remainingMs: Time remaining until deadline
   * - percentUsed: Percentage of budget consumed (0-100+)
   * - isExceeded: Whether deadline has passed
   *
   * @returns {Object} Time status object
   */
  getTimeStatus() {
    const now = Date.now();
    const elapsedMs = now - this.startTime;
    const budgetMs = this.deadline - this.startTime;
    const remainingMs = Math.max(0, this.deadline - now);

    return {
      elapsedMs,
      budgetMs,
      remainingMs,
      percentUsed: Math.round((elapsedMs / budgetMs) * 100),
      isExceeded: now > this.deadline,
      formattedRemaining: this.formatMs(remainingMs),
    };
  }

  /**
   * Get comprehensive status report.
   *
   * Includes:
   * - Current time (for debugging)
   * - Quota metrics
   * - Time metrics
   * - Call metrics (total, successful, failed)
   * - Recent call history (last 10 calls)
   * - Health assessment (quota ok, time ok, no errors)
   *
   * @returns {Object} Comprehensive status
   */
  getStatus() {
    const now = Date.now();

    return {
      timestamp: now,
      quotaStatus: this.getQuotaStatus(),
      timeStatus: this.getTimeStatus(),
      callMetrics: {
        totalAttempted: this.totalCallsAttempted,
        totalSucceeded: this.totalCallsSucceeded,
        totalFailed: this.totalCallsFailed,
        deferralCount: this.deferralCount,
      },
      recentCalls: this.callHistory.slice(-10).map((call) => ({
        timestamp: call.timestamp,
        callType: call.callType,
        callIndex: call.callIndex,
        model: call.model,
        status: call.status,
        age: now - call.timestamp,
      })),
      isHealthy: {
        quotaOk: this.getQuotaStatus().percentUsed < 100,
        timeOk: this.getTimeStatus().percentUsed < 100,
        noErrors: this.totalCallsFailed === 0,
      },
    };
  }

  /**
   * Emit status change event to listeners.
   *
   * @private
   */
  emitStatus(status) {
    try {
      this.config.onStatusChange(status);
    } catch (callbackError) {
      // Don't let callback errors interrupt execution
      console.error('[CallManager] onStatusChange callback error:', callbackError);
    }
  }

  /**
   * Emit deferral event to listeners.
   *
   * @private
   */
  emitDeferral(info) {
    try {
      this.config.onDeferral(info);
    } catch (callbackError) {
      console.error('[CallManager] onDeferral callback error:', callbackError);
    }
  }

  /**
   * Sleep for specified duration.
   *
   * @private
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Format milliseconds as human-readable string (e.g., "2m 30s").
   *
   * @private
   */
  formatMs(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    const hours = Math.floor(ms / 1000 / 60 / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Reset CallManager state (clears call history and deferral count).
   * Useful for testing or starting fresh.
   *
   * @public
   */
  reset() {
    this.callHistory = [];
    this.lastWindowReset = Date.now();
    this.deferralCount = 0;
    this.totalCallsAttempted = 0;
    this.totalCallsSucceeded = 0;
    this.totalCallsFailed = 0;
  }
}

module.exports = CallManager;
```

**Verification**:

```bash
# Verify complete file
wc -l server/CallManager.js
# Expected: ~360 lines

# Test require/import
node -e "const CM = require('./server/CallManager.js'); console.log('✅ CallManager imports successfully')"
# Expected: ✅ CallManager imports successfully
```

---

## IMPL-UNIT-001: CallManager Unit Tests

**File**: `server/__tests__/CallManager.test.js`

**Create the test file**:

```bash
touch server/__tests__/CallManager.test.js
```

**Add test code**:

```javascript
/**
 * Unit Tests for CallManager [SEQ-CORE-001]
 *
 * Architecture Document: PATIENCE_TIMER_BLUEPRINT.md
 */

const CallManager = require("../CallManager");

describe("[IMPL-CORE-001] CallManager - Quota Management", () => {
  test("[SEQ-QUOTA-001-A] Tracks calls in current window", async () => {
    const cm = new CallManager({
      quotaLimit: 5,
      quotaWindow: 1000,
    });

    // Execute 5 calls (all successful)
    for (let i = 0; i < 5; i++) {
      await cm.executeCall(
        () => Promise.resolve({ result: `call-${i}` }),
        i,
        `test-${i}`
      );
    }

    const quotaStatus = cm.getQuotaStatus();
    expect(quotaStatus.callsInWindow).toBe(5);
    expect(quotaStatus.percentUsed).toBe(100);
  });

  test("[SEQ-QUOTA-001-C] Defers call when quota exhausted", async () => {
    const cm = new CallManager({
      quotaLimit: 2,
      quotaWindow: 100, // 100ms window for faster testing
    });

    let deferralCount = 0;
    cm.config.onDeferral = () => {
      deferralCount++;
    };

    // Fill quota with 2 calls
    await cm.executeCall(() => Promise.resolve({}), 0, "test-0");
    await cm.executeCall(() => Promise.resolve({}), 1, "test-1");

    expect(cm.getQuotaStatus().callsInWindow).toBe(2);

    // Third call should defer
    const start = Date.now();
    await cm.executeCall(() => Promise.resolve({}), 2, "test-2");
    const elapsed = Date.now() - start;

    expect(deferralCount).toBe(1);
    expect(elapsed).toBeGreaterThan(80); // Waited at least 80ms
    expect(cm.totalCallsSucceeded).toBe(3); // All 3 succeeded (after deferral)
  });

  test("[SEQ-QUOTA-001-A] Resets window after expiry", async () => {
    const cm = new CallManager({
      quotaLimit: 2,
      quotaWindow: 100,
    });

    // First call in window 1
    await cm.executeCall(() => Promise.resolve({}), 0, "test-0");
    expect(cm.getQuotaStatus().callsInWindow).toBe(1);

    // Wait for window to expire
    await cm.sleep(120);

    // Next call should be in new window
    await cm.executeCall(() => Promise.resolve({}), 1, "test-1");
    expect(cm.getQuotaStatus().callsInWindow).toBe(1); // Reset to 1, not 2
  });
});

describe("[IMPL-CORE-001] CallManager - Time Management", () => {
  test("[SEQ-TIME-001] Warns when time budget is tight (>80%)", async () => {
    const now = Date.now();
    const cm = new CallManager({
      deadline: now + 1000, // 1 second total budget
      startTime: now - 850, // Already 85% used
    });

    let timeTightFired = false;
    cm.config.onStatusChange = (status) => {
      if (status.type === "time-tight") {
        timeTightFired = true;
      }
    };

    await cm.executeCall(() => Promise.resolve({}), 0, "test");

    expect(timeTightFired).toBe(true);
    expect(cm.getTimeStatus().percentUsed).toBeGreaterThan(80);
  });

  test("[SEQ-TIME-001] Continues if time exceeded", async () => {
    const now = Date.now();
    const cm = new CallManager({
      deadline: now - 1000, // Already exceeded
      startTime: now - 2000,
    });

    let timeExceededFired = false;
    cm.config.onStatusChange = (status) => {
      if (status.type === "time-exceeded") {
        timeExceededFired = true;
      }
    };

    const result = await cm.executeCall(
      () => Promise.resolve({ success: true }),
      0,
      "test"
    );

    expect(timeExceededFired).toBe(true);
    expect(result.success).toBe(true); // Still completed
  });

  test("[SEQ-TIME-001] Validates deadline in constructor", () => {
    const now = Date.now();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();

    const cm = new CallManager({
      deadline: now - 1000, // Past time
    });

    expect(warnSpy).toHaveBeenCalled();
    expect(cm.deadline).toBeGreaterThan(now); // Fallback to 600s default

    warnSpy.mockRestore();
  });
});

describe("[IMPL-CORE-001] CallManager - Error Classification", () => {
  test("[SEQ-ERROR-001] Classifies retriable vs fatal errors", () => {
    const cm = new CallManager();

    // Retriable errors
    expect(cm.isRetriableError({ code: "QUOTA_EXHAUSTED" })).toBe(true);
    expect(cm.isRetriableError({ code: "RATE_LIMIT_EXCEEDED" })).toBe(true);
    expect(cm.isRetriableError({ code: "SERVICE_UNAVAILABLE" })).toBe(true);
    expect(cm.isRetriableError({ code: "429" })).toBe(true);
    expect(cm.isRetriableError({ code: "503" })).toBe(true);
    expect(cm.isRetriableError({ code: "ECONNRESET" })).toBe(true);

    // Fatal errors
    expect(cm.isRetriableError({ code: "AUTHENTICATION_FAILED" })).toBe(false);
    expect(cm.isRetriableError({ code: "INVALID_API_KEY" })).toBe(false);
    expect(cm.isRetriableError({ code: "PERMISSION_DENIED" })).toBe(false);
    expect(cm.isRetriableError({ code: "401" })).toBe(false);
    expect(cm.isRetriableError({ code: "403" })).toBe(false);
  });

  test("[SEQ-ERROR-001] Retries retriable errors automatically", async () => {
    const cm = new CallManager({
      autoRetry: true,
    });

    let callCount = 0;
    let deferralCount = 0;

    cm.config.onDeferral = () => {
      deferralCount++;
    };

    // Call fails first time (retriable), succeeds second time
    const result = await cm.executeCall(
      async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Temporary network error");
        }
        return { success: true };
      },
      0,
      "test"
    );

    expect(callCount).toBe(2); // Called twice
    expect(deferralCount).toBe(1); // Deferred once
    expect(result.success).toBe(true);
  });

  test("[SEQ-ERROR-001] Fails immediately on fatal errors", async () => {
    const cm = new CallManager();

    await expect(
      cm.executeCall(
        async () => {
          throw new Error("AUTHENTICATION_FAILED: Invalid API key");
        },
        0,
        "structure"
      )
    ).rejects.toThrow("AUTHENTICATION_FAILED");
  });

  test("[SEQ-ERROR-001] Enhances errors with context", () => {
    const cm = new CallManager();

    const originalError = new Error("API Error");
    const context = {
      callIndex: 5,
      callType: "chapter-5",
      model: "gemini-2.5-flash",
      quotaStatus: { percentUsed: 50 },
      timeStatus: { percentUsed: 30 },
    };

    const enhanced = cm.enhanceError(originalError, context);

    expect(enhanced.message).toContain("chapter-5");
    expect(enhanced.callIndex).toBe(5);
    expect(enhanced.model).toBe("gemini-2.5-flash");
    expect(enhanced.quotaStatus.percentUsed).toBe(50);
    expect(enhanced.timeStatus.percentUsed).toBe(30);
  });
});

describe("[IMPL-CORE-001] CallManager - Status Methods", () => {
  test("[SEQ-CORE-001] getQuotaStatus returns correct metrics", async () => {
    const cm = new CallManager({
      quotaLimit: 20,
      quotaWindow: 60000,
    });

    // Execute 5 calls
    for (let i = 0; i < 5; i++) {
      await cm.executeCall(() => Promise.resolve({}), i, `test-${i}`);
    }

    const quota = cm.getQuotaStatus();

    expect(quota.callsInWindow).toBe(5);
    expect(quota.quotaLimit).toBe(20);
    expect(quota.percentUsed).toBe(25);
    expect(quota.isExhausted).toBe(false);
    expect(quota.nextResetAt).toBeDefined();
    expect(quota.resetInMs).toBeDefined();
  });

  test("[SEQ-CORE-001] getTimeStatus returns correct metrics", async () => {
    const now = Date.now();
    const cm = new CallManager({
      deadline: now + 10000, // 10 second budget
      startTime: now - 3000, // Already 3 seconds elapsed
    });

    const time = cm.getTimeStatus();

    expect(time.budgetMs).toBe(10000);
    expect(time.elapsedMs).toBeCloseTo(3000, 100); // ~3000ms, allow 100ms variance
    expect(time.remainingMs).toBeCloseTo(7000, 100);
    expect(time.percentUsed).toBe(30);
    expect(time.isExceeded).toBe(false);
  });

  test("[SEQ-CORE-001] getStatus returns comprehensive metrics", async () => {
    const cm = new CallManager();

    // Execute 3 successful calls, 0 failures
    for (let i = 0; i < 3; i++) {
      await cm.executeCall(() => Promise.resolve({}), i, `test-${i}`);
    }

    const status = cm.getStatus();

    expect(status.timestamp).toBeDefined();
    expect(status.quotaStatus).toBeDefined();
    expect(status.timeStatus).toBeDefined();
    expect(status.callMetrics.totalAttempted).toBe(3);
    expect(status.callMetrics.totalSucceeded).toBe(3);
    expect(status.callMetrics.totalFailed).toBe(0);
    expect(status.recentCalls).toHaveLength(3);
    expect(status.isHealthy.quotaOk).toBe(true);
    expect(status.isHealthy.timeOk).toBe(true);
    expect(status.isHealthy.noErrors).toBe(true);
  });
});

describe("[IMPL-CORE-001] CallManager - Utilities", () => {
  test("Formats milliseconds correctly", () => {
    const cm = new CallManager();

    expect(cm.formatMs(45000)).toBe("45s");
    expect(cm.formatMs(65000)).toBe("1m 5s");
    expect(cm.formatMs(125000)).toBe("2m 5s");
    expect(cm.formatMs(3665000)).toBe("1h 1m 5s");
  });

  test("Reset clears state", async () => {
    const cm = new CallManager();

    // Execute calls
    for (let i = 0; i < 5; i++) {
      await cm.executeCall(() => Promise.resolve({}), i, `test-${i}`);
    }

    expect(cm.totalCallsAttempted).toBe(5);

    // Reset
    cm.reset();

    expect(cm.totalCallsAttempted).toBe(0);
    expect(cm.totalCallsSucceeded).toBe(0);
    expect(cm.callHistory).toHaveLength(0);
  });
});
```

**File Size**: ~280 lines

**Verification**:

```bash
# Check file created
ls -lh server/__tests__/CallManager.test.js

# Run tests
npm test -- CallManager.test.js
# Expected: All tests pass
```

---

## Stage 1 Validation Checklist

Before proceeding to Stage 2, complete this checklist:

### Code Quality

- [ ] `server/CallManager.js` created (360 lines)
- [ ] `server/__tests__/CallManager.test.js` created (280 lines)
- [ ] Both files have no syntax errors (`node -c` passes)
- [ ] All tests pass (`npm test CallManager.test.js`)

### Git & Branch

- [ ] Working on `feat/patience-timer-sequential` branch
- [ ] No uncommitted changes on other branches
- [ ] All new files committed to feature branch

### Functional Verification

- [ ] CallManager constructs without errors
- [ ] Quota tracking works (fills quota, defers correctly)
- [ ] Time tracking works (warns, continues past deadline)
- [ ] Error classification works (retriable vs fatal)
- [ ] Status methods return correct data

### Documentation

- [ ] Code comments present and clear
- [ ] Architecture comments reference PATIENCE_TIMER_BLUEPRINT.md
- [ ] Test names follow [IMPL-XXX] naming convention

---

## Next Stage: Preview

**Stage 2: ebookService Integration** (coming next)

Will integrate CallManager into ebookService:

- Modify `ebookService.js` to create CallManager per-request
- Update chapter generation loop to use `callManager.executeCall()`
- Add progress callbacks for frontend
- Update jobQueueManager for deadline tracking
- Integration tests for ebookService + CallManager

**Files Modified in Stage 2**:

- `server/ebookService.js` (existing file)
- `server/jobQueueManager.js` (existing file)
- `server/__tests__/ebookService.integration.test.js` (new test file)

**Estimated Time**: 2-3 hours

**Not to be confused with**: Later stages (Stage 3 = Frontend Timer, Stage 4 = Job Queue, Stage 5 = E2E)

---

## Commit Your Stage 1 Work

When ready to checkpoint:

```bash
git add server/CallManager.js server/__tests__/CallManager.test.js
git commit -m "feat(patience-timer): Stage 1 - CallManager class with quota/time tracking

- Implement CallManager orchestration layer [SEQ-CORE-001]
- Add quota management with deferral [SEQ-QUOTA-001]
- Add time budget tracking [SEQ-TIME-001]
- Add error classification [SEQ-ERROR-001]
- Add comprehensive unit tests

Branch: feat/patience-timer-sequential
Architecture: PATIENCE_TIMER_BLUEPRINT.md"

git push origin feat/patience-timer-sequential
```

---

## ⚠️ STAGE 1 COMPLETION = READY FOR STAGE 2

**Once you complete Stage 1 and all tests pass:**

1. ✅ Verify all test cases pass (`npm test CallManager.test.js`)
2. ✅ Commit your work to `feat/patience-timer-sequential`
3. ✅ Notify completion

**Then**: I will create **PATIENCE_TIMER_BUILD_STAGE_2** (ebookService Integration)

**Following that**: Stages 3, 4, and 5 will be created sequentially

**This ensures**:

- Each stage is independently validated
- Incremental progress is tracked
- Complexity is manageable (not monolithic)
- All stakeholders know what's remaining

**DO NOT proceed to Stage 2 instructions from another source** — wait for the official PATIENCE_TIMER_BUILD_STAGE_2 document.

---

**Ready for Stage 1?** Proceed with the steps above, then notify when complete for Stage 2 (ebookService Integration).
