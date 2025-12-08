# CallManager Architecture: Separation of Concerns for Scalable AI Model Access

**Date**: December 8, 2025  
**Time**: 15:45 UTC  
**Context**: Strategic architectural refinement to separate content generation from infrastructure orchestration  
**Status**: Detailed specification for implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
   - [Current Architecture Issues](#current-architecture-issues)
   - [Architectural Constraints to Manage](#architectural-constraints-to-manage)
3. [CallManager Architecture](#callmanager-architecture)
   - [Class Definition](#class-definition)
4. [Error Handling Strategy](#error-handling-strategy)
   - [Error Classification Matrix](#error-classification-matrix)
   - [Error Response Examples](#error-response-examples)
5. [Edge Cases & Handling](#edge-cases--handling)
   - [Edge Case 1: Quota Reset During Deferral](#edge-case-1-quota-reset-during-deferral)
   - [Edge Case 2: Multiple Deferrals in Sequence](#edge-case-2-multiple-deferrals-in-sequence)
   - [Edge Case 3: Time Deadline Exceeded During Call](#edge-case-3-time-deadline-exceeded-during-call)
   - [Edge Case 4: Retryable Error Exhausts Time Budget](#edge-case-4-retryable-error-exhausts-time-budget)
   - [Edge Case 5: Constructor with Invalid Deadline](#edge-case-5-constructor-with-invalid-deadline-past-time)
   - [Edge Case 6: Concurrent CallManager Instances](#edge-case-6-concurrent-callmanager-instances)
   - [Edge Case 7: Call Function Throws Synchronously](#edge-case-7-call-function-throws-synchronously)
   - [Edge Case 8: onStatusChange Callback Throws](#edge-case-8-onstatuschange-callback-throws)
   - [Edge Case 9: Reset Called During Deferral](#edge-case-9-reset-called-during-deferral)
   - [Edge Case 10: callFn Returns Without Awaiting](#edge-case-10-callfn-returns-without-awaiting)
6. [Integration with ebookService](#integration-with-ebookservice)
   - [Modified ebookService Flow](#modified-ebookservice-flow)
7. [Integration with Job Queue](#integration-with-job-queue)
   - [Modified jobQueueManager Flow](#modified-jobqueuemanager-flow)
8. [Configuration Options](#configuration-options)
   - [Constructor Options Reference](#constructor-options-reference)
9. [Testing Strategy](#testing-strategy)
   - [Unit Tests: CallManager Isolation](#unit-tests-callmanager-isolation)
   - [Integration Tests: CallManager with ebookService](#integration-tests-callmanager-with-ebookservice)
   - [Scenario Tests: Real-World Flows](#scenario-tests-real-world-flows)
10. [Deployment Checklist](#deployment-checklist)
11. [Performance Characteristics](#performance-characteristics)
    - [Expected Metrics (Per Page Count)](#expected-metrics-per-page-count)
12. [Future Enhancements](#future-enhancements)
    - [1. Exponential Backoff for Transient Errors](#1-exponential-backoff-for-transient-errors)
    - [2. Distributed Quota Management](#2-distributed-quota-management)
    - [3. Adaptive Timeouts](#3-adaptive-timeouts)
    - [4. Machine Learning-Based Time Prediction](#4-machine-learning-based-time-prediction)
13. [Summary](#summary)

---

## Executive Summary

The `CallManager` is an orchestration layer that abstracts infrastructure concerns (quota management, time budgeting, deferral) from business logic (content generation). It enables transparent scaling from 3 to 60+ pages without changing the eBook generation logic or modifying existing 3-20 page defaults.

**Core Principle**: CallManager never fails on infrastructure constraints (quota exhausted, time tight). It manages around these constraints transparently. It only fails on genuine errors (API down, authentication failed, network error).

**Key Innovation**: Separation of concerns—ebookService focuses purely on _what_ to generate, CallManager handles _how_ to obtain results within resource constraints.

---

## Problem Statement

### Current Architecture Issues

1. **Mixing Concerns**: ebookService handles both content generation and constraint validation
2. **Hard Coupling**: Page count validation (3-20 limit) embedded in generation logic
3. **Scaling Limitation**: Sequential API calls hit quota ceiling; extending requires major refactoring
4. **Difficult Testing**: Hard to test infrastructure (quota, time) separately from generation logic
5. **Poor Observability**: Quota exhaustion appears as generation failure, not infrastructure event

### Architectural Constraints to Manage

```
┌─────────────────────────────────────────────────────────────────┐
│  Infrastructure Constraints (Non-Functional Requirements)      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. API Quota: 20 calls/minute (per Gemini API limits)         │
│     ├─ Per-minute window: 60-second reset                       │
│     ├─ Hard cap: Cannot exceed 20 calls in any 60s window      │
│     ├─ Behavior: Must defer if exhausted, retry after reset    │
│     └─ 20-page eBook: 21 calls total (1 structure + 20 chapter)│
│                                                                 │
│  2. Time Budget: User-specified deadline (frontend timeout)    │
│     ├─ Default: 600s (10 minutes)                              │
│     ├─ For 60 pages: ~180s baseline + quota deferral time      │
│     ├─ Management: Track elapsed vs. budget, warn if tight     │
│     └─ Policy: Continue if deadline exceeded (user accepts)    │
│                                                                 │
│  3. Model Capacity: Gemini 2.5 Pro vs Flash tradeoffs          │
│     ├─ Pro: Better quality (structure), higher quota cost      │
│     ├─ Flash: Cheaper quota (chapters), lower latency          │
│     ├─ Rotation: callIndex=0 → Pro, callIndex>0 → Flash       │
│     └─ Distribution: Spreading calls reduces peak quota usage  │
│                                                                 │
│  4. Queue Capacity: Max 50 concurrent deferred jobs            │
│     ├─ Enforcement: Reject new jobs if queue full              │
│     ├─ Priority: First-in-first-out within deferral queue      │
│     └─ Cleanup: Remove completed jobs after 1 hour             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## CallManager Architecture

### Class Definition

```javascript
/**
 * CallManager orchestrates AI model access with quota and time awareness.
 *
 * Responsibilities:
 * - Track per-minute quota consumption
 * - Manage time budget relative to deadline
 * - Defer calls when quota exhausted
 * - Never fail on infrastructure constraints (only on genuine errors)
 * - Provide observable metrics (quota%, elapsed, remaining)
 */
class CallManager {
  constructor(options = {}) {
    // Time budget configuration
    this.deadline = options.deadline || Date.now() + 600000; // 10 minutes default
    this.startTime = options.startTime || Date.now();

    // Quota configuration
    this.quotaLimit = options.quotaLimit || 20; // calls per minute
    this.quotaWindow = options.quotaWindow || 60000; // milliseconds

    // Call tracking
    this.callHistory = []; // [{ timestamp, callType, model, status }, ...]
    this.callQueue = []; // [{ fn, callIndex, model, deferred }, ...]

    // State tracking
    this.isProcessing = false;
    this.lastWindowReset = Date.now();
    this.deferralCount = 0;
    this.totalCallsAttempted = 0;

    // AIService reference
    this.aiService = options.aiService;

    // Configuration
    this.config = {
      autoRetry: options.autoRetry !== false,
      maxDeferralWait: options.maxDeferralWait || 120000, // 2 minutes
      metrics: true,
      onDeferral: options.onDeferral || (() => {}),
      onStatusChange: options.onStatusChange || (() => {}),
    };
  }

  /**
   * Execute a call with automatic quota and time management.
   *
   * Behavior:
   * - Quota exhausted? Wait for window reset (transparent deferral)
   * - Time tight? Warn but continue (user controls deadline)
   * - Genuine error? Fail with detailed error info
   *
   * @param {Function} callFn - Async function that makes AI call
   * @param {number} callIndex - Index in generation sequence (0→Pro, >0→Flash)
   * @param {string} callType - Type of call (structure|chapter|summary|etc)
   * @returns {Promise<Object>} Result from callFn
   */
  async executeCall(callFn, callIndex, callType = "content") {
    this.totalCallsAttempted++;

    // Check and manage quota before call
    await this.manageQuota();

    // Check time budget
    const timeStatus = this.getTimeStatus();
    if (timeStatus.percentUsed > 80 && timeStatus.percentUsed < 100) {
      // Warn but continue (user controls deadline)
      this.config.onStatusChange({
        type: "time-tight",
        percentUsed: timeStatus.percentUsed,
        remainingMs: timeStatus.remainingMs,
        message: `⚠️  Time budget ${timeStatus.percentUsed}% used`,
      });
    } else if (timeStatus.percentUsed >= 100) {
      // Time exceeded - warn but continue (user already waiting)
      this.config.onStatusChange({
        type: "time-exceeded",
        elapsedMs: timeStatus.elapsedMs,
        deadlineMs: timeStatus.budgetMs,
        message: `⚠️  Deadline passed, continuing anyway`,
      });
    }

    // Determine model based on call index
    const model = callIndex === 0 ? "gemini-2.5-pro" : "gemini-2.5-flash";

    // Execute the call
    const callRecord = {
      timestamp: Date.now(),
      callIndex,
      callType,
      model,
      status: "executing",
      quotaStatus: this.getQuotaStatus(),
    };

    try {
      const result = await callFn(model);

      // Record successful call
      callRecord.status = "success";
      this.callHistory.push(callRecord);

      return result;
    } catch (error) {
      // Record failed call
      callRecord.status = "error";
      callRecord.error = error.message;
      this.callHistory.push(callRecord);

      // Determine if error is retriable
      const isRetriable = this.isRetriableError(error);

      if (isRetriable && this.config.autoRetry) {
        // Defer and retry
        this.deferralCount++;
        this.config.onDeferral({
          callIndex,
          callType,
          model,
          error: error.message,
          retryAfter: "quota-reset",
        });

        // Wait for quota reset and retry
        await this.waitForQuotaReset();
        return this.executeCall(callFn, callIndex, callType);
      } else {
        // Genuine error - fail
        throw this.enhanceError(error, {
          callIndex,
          callType,
          model,
          quotaStatus: this.getQuotaStatus(),
          timeStatus: this.getTimeStatus(),
        });
      }
    }
  }

  /**
   * Manage quota before executing a call.
   *
   * Strategy:
   * 1. Reset window if 60s elapsed
   * 2. Check if call count < quota limit
   * 3. If exhausted, wait for window reset
   *
   * @private
   */
  async manageQuota() {
    const now = Date.now();
    const windowAge = now - this.lastWindowReset;

    // Reset window if expired
    if (windowAge >= this.quotaWindow) {
      this.callHistory = this.callHistory.filter(
        (call) => now - call.timestamp < this.quotaWindow
      );
      this.lastWindowReset = now;
    }

    // Count calls in current window
    const callsInWindow = this.callHistory.filter(
      (call) =>
        now - call.timestamp < this.quotaWindow && call.status === "success"
    ).length;

    // If at quota limit, wait for reset
    if (callsInWindow >= this.quotaLimit) {
      const waitTime = this.quotaWindow - windowAge + 100; // +100ms buffer

      this.config.onStatusChange({
        type: "quota-deferral",
        callsInWindow,
        quotaLimit: this.quotaLimit,
        waitMs: Math.max(0, waitTime),
        message: `⏸️  Quota exhausted (${callsInWindow}/${
          this.quotaLimit
        }), waiting ${Math.max(0, waitTime)}ms`,
      });

      await this.sleep(waitTime);

      // Recursively check quota after reset
      return this.manageQuota();
    }
  }

  /**
   * Wait for quota window to reset.
   *
   * @private
   */
  async waitForQuotaReset() {
    const now = Date.now();
    const windowAge = now - this.lastWindowReset;
    const waitTime = this.quotaWindow - windowAge + 100; // +100ms buffer

    await this.sleep(Math.max(0, waitTime));
    this.lastWindowReset = Date.now();
  }

  /**
   * Determine if error is retriable (infrastructure) vs fatal (genuine).
   *
   * Retriable:
   * - QUOTA_EXHAUSTED: API rate limit
   * - DEADLINE_EXCEEDED: Timeout (can retry with more time)
   * - TEMPORARY_FAILURE: Transient network issues
   *
   * Fatal:
   * - INVALID_ARGUMENT: Bad input to API
   * - AUTHENTICATION_FAILED: API key issue
   * - NOT_FOUND: Model/resource doesn't exist
   * - PERMISSION_DENIED: Access control issue
   *
   * @private
   */
  isRetriableError(error) {
    const code = error.code || error.status || error.message;

    const retriableCodes = [
      "QUOTA_EXHAUSTED",
      "RATE_LIMIT_EXCEEDED",
      "DEADLINE_EXCEEDED",
      "TEMPORARY_FAILURE",
      "SERVICE_UNAVAILABLE",
      "RESOURCE_EXHAUSTED",
      429, // HTTP: Too Many Requests
      503, // HTTP: Service Unavailable
      504, // HTTP: Gateway Timeout
    ];

    const fatalCodes = [
      "INVALID_ARGUMENT",
      "AUTHENTICATION_FAILED",
      "INVALID_API_KEY",
      "NOT_FOUND",
      "PERMISSION_DENIED",
      400, // HTTP: Bad Request
      401, // HTTP: Unauthorized
      403, // HTTP: Forbidden
      404, // HTTP: Not Found
    ];

    // Check error code
    for (const retriable of retriableCodes) {
      if (code.toString().includes(retriable.toString())) return true;
    }

    for (const fatal of fatalCodes) {
      if (code.toString().includes(fatal.toString())) return false;
    }

    // Default: treat as retriable if unknown
    return true;
  }

  /**
   * Enhance error with diagnostic context.
   *
   * Includes:
   * - Call index and type (what call failed)
   * - Model being used (Pro vs Flash)
   * - Quota status at time of failure
   * - Time budget status at time of failure
   * - Call history (recent calls for debugging)
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

    return enhanced;
  }

  /**
   * Get current quota status.
   *
   * Returns:
   * - callsInWindow: Number of successful calls in current window
   * - quotaLimit: Maximum allowed calls per window
   * - percentUsed: Percentage of quota consumed (0-100)
   * - nextResetAt: Timestamp when window resets
   *
   * @returns {Object}
   */
  getQuotaStatus() {
    const now = Date.now();
    const windowAge = now - this.lastWindowReset;

    const callsInWindow = this.callHistory.filter(
      (call) =>
        now - call.timestamp < this.quotaWindow && call.status === "success"
    ).length;

    const nextResetAt = this.lastWindowReset + this.quotaWindow;

    return {
      callsInWindow,
      quotaLimit: this.quotaLimit,
      percentUsed: Math.round((callsInWindow / this.quotaLimit) * 100),
      nextResetAt,
      resetInMs: Math.max(0, nextResetAt - now),
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
   *
   * @returns {Object}
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
    };
  }

  /**
   * Get comprehensive status report.
   *
   * Includes:
   * - Quota metrics (calls, usage, reset timing)
   * - Time metrics (elapsed, remaining, budget)
   * - Deferral history (count, reasons)
   * - Call history (recent calls for debugging)
   *
   * @returns {Object}
   */
  getStatus() {
    const now = Date.now();

    return {
      timestamp: now,
      timeStatus: this.getTimeStatus(),
      quotaStatus: this.getQuotaStatus(),
      callMetrics: {
        totalAttempted: this.totalCallsAttempted,
        successful: this.callHistory.filter((c) => c.status === "success")
          .length,
        failed: this.callHistory.filter((c) => c.status === "error").length,
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
        noErrors:
          this.callHistory.filter((c) => c.status === "error").length === 0,
      },
    };
  }

  /**
   * Utility: Sleep for specified duration.
   *
   * @private
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = CallManager;
```

---

## Error Handling Strategy

### Error Classification Matrix

```
┌──────────────────────────────────────────────────────────────────┐
│  Error Classification & Response Strategy                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INFRASTRUCTURE ERRORS (Retriable)                              │
│  ├─ QUOTA_EXHAUSTED (429, RATE_LIMIT_EXCEEDED)                  │
│  │  └─ Response: Defer, wait for window reset, auto-retry       │
│  │                                                               │
│  ├─ SERVICE_UNAVAILABLE (503)                                   │
│  │  └─ Response: Defer, exponential backoff, auto-retry         │
│  │                                                               │
│  ├─ DEADLINE_EXCEEDED (504, timeout)                            │
│  │  └─ Response: Warn, continue (user deadline exceeded anyway) │
│  │                                                               │
│  ├─ TEMPORARY_FAILURE (network, transient)                      │
│  │  └─ Response: Defer, exponential backoff, auto-retry         │
│  │                                                               │
│  └─ RESOURCE_EXHAUSTED (model busy)                             │
│     └─ Response: Defer, wait, auto-retry                        │
│                                                                  │
│  GENUINE ERRORS (Fatal)                                         │
│  ├─ INVALID_ARGUMENT (400, bad input)                           │
│  │  └─ Response: FAIL immediately (caller bug, not infra)      │
│  │                                                               │
│  ├─ AUTHENTICATION_FAILED (401, invalid API key)                │
│  │  └─ Response: FAIL immediately (config issue, not infra)    │
│  │                                                               │
│  ├─ PERMISSION_DENIED (403, access control)                     │
│  │  └─ Response: FAIL immediately (auth issue, not infra)      │
│  │                                                               │
│  ├─ NOT_FOUND (404, model removed)                              │
│  │  └─ Response: FAIL immediately (config issue, not infra)     │
│  │                                                               │
│  └─ UNKNOWN (default: assume retriable)                         │
│     └─ Response: Retry with backoff (conservative approach)    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Error Response Examples

#### Example 1: Quota Exhaustion (Retriable)

```javascript
// Scenario: 20th call in 60-second window
const callManager = new CallManager({
  quotaLimit: 20,
  quotaWindow: 60000,
});

try {
  // Call #20 in window - succeeds
  await callManager.executeCall(
    (model) => aiService.generateContent(model),
    0,
    "chapter-20"
  );

  // Call #21 in window - quota exhausted
  await callManager.executeCall(
    (model) => aiService.generateContent(model),
    21,
    "chapter-21"
  );
} catch (error) {
  // NOT REACHED - CallManager deferrs and retries automatically
}

// Flow:
// 1. Check quota: 20/20 calls in window ✓
// 2. Quota exhausted - emit onDeferral event
// 3. Calculate wait time: ~45 seconds until window reset
// 4. Sleep 45 seconds
// 5. Window resets, call counter clears
// 6. Retry call #21 - succeeds
```

**Status Updates Emitted**:

```javascript
{
  type: 'quota-deferral',
  callsInWindow: 20,
  quotaLimit: 20,
  waitMs: 45230,
  message: '⏸️  Quota exhausted (20/20), waiting 45230ms'
}
```

#### Example 2: Time Tight (Warning, Continue)

```javascript
// Scenario: 85% of time budget used, but deadline not exceeded
const callManager = new CallManager({
  deadline: Date.now() + 100000, // 100 seconds total
  startTime: Date.now() - 85000, // Already used 85 seconds
});

try {
  await callManager.executeCall(
    (model) => aiService.generateContent(model),
    5,
    "chapter-5"
  );
} catch (error) {
  // NOT REACHED - time-tight is a warning, not an error
}

// Flow:
// 1. Check time: 85% of budget used ⚠️
// 2. Emit onStatusChange: 'time-tight' event
// 3. Continue executing call (user controls deadline)
// 4. If call completes in 15 seconds, all good
// 5. If deadline exceeded during call, warn but accept result
```

**Status Updates Emitted**:

```javascript
{
  type: 'time-tight',
  percentUsed: 85,
  remainingMs: 15000,
  message: '⚠️  Time budget 85% used'
}
```

#### Example 3: Genuine Error (API Key Invalid - Fatal)

```javascript
// Scenario: API key is expired/invalid
const callManager = new CallManager({
  aiService: realAiService, // Using real Gemini API
});

try {
  await callManager.executeCall(
    (model) => aiService.generateContent(model),
    0,
    "structure"
  );
} catch (error) {
  // THIS IS CAUGHT - genuine error, not retriable
  console.error(error);
  // Error: [structure#0] AUTHENTICATION_FAILED: Invalid API key
  // error.originalError contains original API error
  // error.quotaStatus = quota state at failure time
  // error.timeStatus = time state at failure time
}

// Flow:
// 1. Call executeCall with structure prompt
// 2. API returns 401 AUTHENTICATION_FAILED
// 3. isRetriableError returns false (authentication is fatal)
// 4. enhanceError adds context (callIndex, model, quota, time status)
// 5. Throw enhanced error (no retry)
// 6. Caller must handle (log, display to user, etc.)
```

**Enhanced Error Structure**:

```javascript
{
  message: '[structure#0] AUTHENTICATION_FAILED: Invalid API key',
  callIndex: 0,
  callType: 'structure',
  model: 'gemini-2.5-pro',
  quotaStatus: {
    callsInWindow: 0,
    quotaLimit: 20,
    percentUsed: 0,
    nextResetAt: 1702000000000
  },
  timeStatus: {
    elapsedMs: 5000,
    budgetMs: 600000,
    remainingMs: 595000,
    percentUsed: 1
  },
  recentCalls: [],
  originalError: Error('AUTHENTICATION_FAILED: Invalid API key')
}
```

#### Example 4: Service Unavailable (Retriable with Backoff)

```javascript
// Scenario: Gemini API experiencing temporary outage
const callManager = new CallManager({
  autoRetry: true,
  maxDeferralWait: 120000, // 2 minutes max wait
});

try {
  await callManager.executeCall(
    (model) => aiService.generateContent(model),
    5,
    "chapter-5"
  );
} catch (error) {
  // Retry happens automatically, but may eventually fail if outage persists
}

// Flow:
// 1. Call executeCall for chapter-5
// 2. API returns 503 SERVICE_UNAVAILABLE
// 3. isRetriableError returns true (service unavailable is retriable)
// 4. Emit onDeferral event (retrying)
// 5. Wait (exponential backoff: 2s, 4s, 8s, etc.)
// 6. Retry call
// 7. If still failing after maxDeferralWait, fail with enhanced error
```

**Status Updates Emitted**:

```javascript
{
  type: 'quota-deferral',
  callIndex: 5,
  callType: 'chapter-5',
  model: 'gemini-2.5-flash',
  error: 'SERVICE_UNAVAILABLE: Model is temporarily unavailable',
  retryAfter: 'exponential-backoff'
}
```

---

## Edge Cases & Handling

### Edge Case 1: Quota Reset During Deferral

```
Timeline:
T=0:00:00 - Call #20 succeeds (20/20 quota in window)
T=0:00:05 - Call #21 requested → Quota exhausted → Defer
T=0:00:55 - Wait 55 seconds for window reset (window age: 55s)
T=0:01:00 - Window reset triggered automatically
T=0:01:05 - Call #21 retries → Succeeds (now 1/20 in new window)

Handler: manageQuota() checks window age and resets call history
if (windowAge >= quotaWindow) {
  this.callHistory = this.callHistory.filter(...) // Clear old calls
  this.lastWindowReset = now
}
```

**Result**: Call #21 succeeds after automatic window reset. Transparent to caller.

---

### Edge Case 2: Multiple Deferrals in Sequence

```
Scenario: 60-page eBook, quota exhaustion every 20 pages

Timeline:
T=0:00 - Calls 1-20 execute (quota 100%)
T=0:45 - Call #21 deferred, wait for reset
T=1:45 - Calls 21-40 execute (quota 100%)
T=2:30 - Call #41 deferred, wait for reset
T=3:30 - Calls 41-60 execute (quota 100%)

Expected result: 60-page eBook completes despite quota exhaustion
Total time: ~3.5 minutes + processing time

Handler: Each executeCall manages quota independently
- Call #21 defers, retries after reset
- Call #41 defers, retries after reset
- No change to ebookService logic
```

**Result**: Transparent deferral at infrastructure layer. Content generation unaware.

---

### Edge Case 3: Time Deadline Exceeded During Call

```
Scenario: 20-page eBook with 2-minute deadline, call takes 2:15

Timeline:
T=0:00 - Generation starts, deadline = T+120s
T=1:50 - 92% of time budget used, emit 'time-tight' warning
T=2:00 - Deadline exceeded, emit 'time-exceeded' warning
T=2:15 - Final call completes successfully

Expected behavior: Continue processing (user already waiting)
Return full result (user accepted deadline risk by waiting)

Handler: getTimeStatus() checks deadline
if (percentUsed >= 100) {
  emit onStatusChange('time-exceeded')
  continue anyway (user controls)
}
```

**Result**: Warns user but delivers result. No failure on time.

---

### Edge Case 4: Retryable Error Exhausts Time Budget

```
Scenario: Network flaky, retries keep happening until deadline

Timeline:
T=0:00 - Call #15 requested, deadline = T+120s
T=0:30 - Call fails (TEMPORARY_FAILURE), retry
T=0:35 - Retry fails, wait 2s, retry
T=0:40 - Retry fails, wait 4s, retry
T=1:50 - Retries ongoing, 91% budget used
T=2:00 - Deadline exceeded, emit warning but continue
T=2:10 - Call finally succeeds

Expected behavior: Return result (call succeeded before hard timeout)
User sees warning about deadline at T=1:50

Handler: getTimeStatus() provides metric, calling code decides
```

**Result**: Retries continue (time is advisory for user UX, not hard limit).

---

### Edge Case 5: Constructor with Invalid Deadline (Past Time)

```
Scenario: Caller passes deadline in the past (programming error)

Code:
const callManager = new CallManager({
  deadline: Date.now() - 60000 // 1 minute in the past (BUG)
});

Handler: getTimeStatus() detects
{
  isExceeded: true,
  percentUsed: 100+,
  remainingMs: 0
}

Expected behavior: Generate warning immediately, continue anyway
Result: User sees ⚠️ warning from first call, but processing continues

Solution for callers: Validate deadline > now before passing
```

**Recommendation**: Add defensive check in constructor.

```javascript
constructor(options = {}) {
  const deadline = options.deadline || Date.now() + 600000;

  // Defensive check
  if (deadline <= Date.now()) {
    console.warn(
      '[CallManager] Deadline in the past, using 600s default'
    );
    this.deadline = Date.now() + 600000;
  } else {
    this.deadline = deadline;
  }
}
```

---

### Edge Case 6: Concurrent CallManager Instances

```
Scenario: Multiple eBook generations running in parallel

Instance A: 3-page eBook
Instance B: 20-page eBook
Instance C: 60-page eBook (extended feature flag enabled)

Each instance tracks its own:
- callHistory (separate per manager)
- deferralCount (separate per manager)
- quota window (starts independently)

ISSUE: Global quota is 20 calls/minute across ALL instances
If A, B, C run in parallel, quota could exceed 20/min globally

Handler: Each CallManager is independent (no shared state)
This is CORRECT for multi-user deployment where each user
has their own CallManager instance.

For shared quota (not expected in this architecture):
Would need distributed quota manager (Redis, etc.)
Current design assumes per-user deployment
```

**Result**: Each CallManager instance manages its own quota independently. Global quota is managed at AIService layer.

---

### Edge Case 7: Call Function Throws Synchronously

```
Scenario: callFn throws before making async call

Code:
await callManager.executeCall(
  (model) => {
    throw new Error('Sync error in call function');
  },
  0,
  'structure'
);

Handler: Try-catch wraps callFn execution
try {
  const result = await callFn(model);
  // recordSuccess
} catch (error) {
  // recordFailed
  // isRetriableError() evaluates sync error
  // enhance and throw
}

Expected behavior: Error is caught, enhanced, and thrown
Result: Caller receives enhanced error with context
```

**Result**: Synchronous errors treated same as async errors (caught and enhanced).

---

### Edge Case 8: onStatusChange Callback Throws

```
Scenario: Progress callback throws error

Code:
const callManager = new CallManager({
  onStatusChange: (status) => {
    if (status.type === 'time-tight') {
      throw new Error('User rejected time-tight warning');
    }
  }
});

Handler: onStatusChange is called in main flow
try {
  const result = await callFn(model);
} catch (error) {
  // Catches callback error too!
  // Record as failed call
  // Try to enhance and re-throw
}

Problem: Callback error interrupts call execution

Solution: Wrap callback invocation
this.config.onStatusChange({...});
// becomes
try {
  this.config.onStatusChange({...});
} catch (callbackError) {
  // Log but don't propagate (callback should not fail execution)
  console.error('[CallManager] Callback error:', callbackError);
}
```

**Result**: Callback errors logged but don't interrupt call execution.

---

### Edge Case 9: Reset Called During Deferral

```
Scenario: User resets CallManager while waiting for quota

Code:
const callManager = new CallManager({...});
const promise = callManager.executeCall(...); // Deferring

setTimeout(() => {
  callManager.reset(); // Clear state while deferred
}, 5000);

Handler: reset() method clears state
reset() {
  this.callHistory = [];
  this.lastWindowReset = Date.now();
  this.deferralCount = 0;
}

Problem: Deferred call still waiting, after reset succeeds
Result: After reset, deferred call finally awaits, sees quota=0, retries

Behavior: OK - reset effectively clears quota, deferred call retries
Expected: Reset succeeds, deferred call eventually continues
```

**Result**: Reset clears state; deferred calls proceed with clean quota state.

---

### Edge Case 10: callFn Returns Without Awaiting

```
Scenario: Caller forgets to await call

Code:
// WRONG:
const result = callManager.executeCall(
  (model) => aiService.generateContent(model),
  0,
  'structure'
); // Forgot await!

// RIGHT:
const result = await callManager.executeCall(
  (model) => aiService.generateContent(model),
  0,
  'structure'
);

Handler: executeCall is async
- Returning Promise, not result
- Quota management doesn't run
- Call tracking doesn't happen
- No error handling

Solution: Require await in caller code, can add TypeScript hints
```

**Result**: Caller must await; documented as requirement.

---

## Integration with ebookService

### Modified ebookService Flow

```javascript
// Before: Direct aiService calls
// async generateEbook(pageCount) {
//   const structure = await aiService.generateContent(prompt, 0);
//   for (let i = 1; i <= pageCount; i++) {
//     const chapter = await aiService.generateContent(prompt, i);
//   }
// }

// After: CallManager-mediated calls
class EbookService {
  constructor(options = {}) {
    this.aiService = options.aiService;
    this.callManager = null; // Created per-request
  }

  async generateEbook(pageCount, options = {}) {
    // Create CallManager for this generation request
    this.callManager = new CallManager({
      deadline: options.deadline || Date.now() + pageCount * 30000, // 30s per page
      startTime: Date.now(),
      aiService: this.aiService,
      onStatusChange: options.onStatusChange,
      onDeferral: options.onDeferral,
    });

    // Generate structure
    const structure = await this.callManager.executeCall(
      (model) => this.aiService.generateContent(structurePrompt, model),
      0,
      "structure"
    );

    // Generate chapters
    const chapters = [];
    for (let i = 1; i <= pageCount; i++) {
      const chapter = await this.callManager.executeCall(
        (model) => this.aiService.generateContent(chapterPrompt(i), model),
        i,
        `chapter-${i}`
      );
      chapters.push(chapter);
    }

    // Return result
    return {
      structure,
      chapters,
      metrics: this.callManager.getStatus(),
    };
  }
}
```

**Changes**:

1. Create CallManager per-request with deadline
2. Replace `await aiService.generateContent(...)` with `await callManager.executeCall(...)`
3. Pass callIndex (0 for structure, 1-N for chapters)
4. Pass callType (for observability)
5. Return metrics with result

**No changes needed in**:

- Validation logic (still 3-20)
- Content generation logic
- Assembly logic
- Error handling (CallManager handles it)

---

## Integration with Job Queue

### Modified jobQueueManager Flow

```javascript
// Add deadline tracking to job metadata
const jobMetadata = {
  id: uuid(),
  pageCount,
  requestedAt: Date.now(),
  deadline: options.deadline || Date.now() + pageCount * 30000,
  status: "processing",
  progress: 0,
  quotaStatus: null,
  timeStatus: null,
  metrics: null,
};

// During processing, update metrics
const callManager = new CallManager({
  deadline: jobMetadata.deadline,
  onStatusChange: (status) => {
    // Update job metadata
    jobMetadata.quotaStatus = status;

    // Notify frontend
    broadcastToClient(jobMetadata.id, {
      type: "status-update",
      status,
      progress: calculateProgress(jobMetadata),
    });
  },
});

// Track completion
jobMetadata.metrics = callManager.getStatus();
jobMetadata.completedAt = Date.now();
jobMetadata.status = "complete";
```

**Metrics Available to Frontend**:

```javascript
{
  id: 'job-123',
  pageCount: 20,
  progress: 95,
  quotaStatus: {
    callsInWindow: 18,
    quotaLimit: 20,
    percentUsed: 90,
    nextResetAt: 1702000000000,
  },
  timeStatus: {
    elapsedMs: 120000,
    budgetMs: 600000,
    remainingMs: 480000,
    percentUsed: 20,
  },
  metrics: {
    totalCalls: 20,
    successful: 18,
    deferred: 2,
  }
}
```

---

## Configuration Options

### Constructor Options Reference

```javascript
const callManager = new CallManager({
  // Time Budget
  deadline: Date.now() + 600000, // When generation must complete
  startTime: Date.now(), // Start reference point

  // Quota Configuration
  quotaLimit: 20, // Max calls per window
  quotaWindow: 60000, // Window duration (ms)

  // Service Reference
  aiService: realAiService, // AI service instance

  // Behavior Configuration
  autoRetry: true, // Auto-retry retriable errors
  maxDeferralWait: 120000, // Max time to wait for retry
  metrics: true, // Enable metrics collection

  // Callbacks
  onStatusChange: (status) => {
    // Called on status updates
    console.log(`[${status.type}]`, status.message);
  },
  onDeferral: (info) => {
    // Called on deferral
    console.log(`[deferral]`, info);
  },
});
```

---

## Testing Strategy

### Unit Tests: CallManager Isolation

```javascript
describe("CallManager", () => {
  describe("Quota Management", () => {
    test("tracks calls in window", async () => {
      const cm = new CallManager({
        quotaLimit: 5,
        quotaWindow: 1000,
      });

      for (let i = 0; i < 5; i++) {
        await cm.executeCall(
          () => Promise.resolve({ status: "success" }),
          i,
          "test"
        );
      }

      expect(cm.getQuotaStatus().callsInWindow).toBe(5);
    });

    test("defers call when quota exhausted", async () => {
      const cm = new CallManager({
        quotaLimit: 2,
        quotaWindow: 100,
      });

      let deferralFired = false;
      cm.config.onDeferral = () => {
        deferralFired = true;
      };

      // Fill quota
      await cm.executeCall(() => Promise.resolve({}), 0, "test");
      await cm.executeCall(() => Promise.resolve({}), 1, "test");

      // This should defer
      const start = Date.now();
      await cm.executeCall(() => Promise.resolve({}), 2, "test");
      const elapsed = Date.now() - start;

      expect(deferralFired).toBe(true);
      expect(elapsed).toBeGreaterThan(80); // Waited for reset
    });
  });

  describe("Error Handling", () => {
    test("distinguishes retriable vs fatal errors", () => {
      const cm = new CallManager();

      expect(cm.isRetriableError({ code: "QUOTA_EXHAUSTED" })).toBe(true);
      expect(cm.isRetriableError({ code: "SERVICE_UNAVAILABLE" })).toBe(true);
      expect(cm.isRetriableError({ code: "AUTHENTICATION_FAILED" })).toBe(
        false
      );
      expect(cm.isRetriableError({ code: "INVALID_ARGUMENT" })).toBe(false);
    });

    test("enhances errors with context", () => {
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

      expect(enhanced.callIndex).toBe(5);
      expect(enhanced.callType).toBe("chapter-5");
      expect(enhanced.quotaStatus.percentUsed).toBe(50);
    });
  });

  describe("Time Management", () => {
    test("warns when time budget tight", async () => {
      const now = Date.now();
      const cm = new CallManager({
        deadline: now + 1000, // 1 second deadline
        startTime: now - 850, // Already used 850ms (85%)
      });

      let statusFired = false;
      cm.config.onStatusChange = (status) => {
        if (status.type === "time-tight") statusFired = true;
      };

      await cm.executeCall(() => Promise.resolve({}), 0, "test");

      expect(statusFired).toBe(true);
    });
  });
});
```

### Integration Tests: CallManager with ebookService

```javascript
describe("ebookService with CallManager", () => {
  test("generates 3-page eBook with quota tracking", async () => {
    const service = new EbookService({
      aiService: mockAiService,
    });

    const result = await service.generateEbook(3, {
      deadline: Date.now() + 120000,
      onStatusChange: (status) => {
        console.log(`[${status.type}]`, status);
      },
    });

    expect(result.chapters).toHaveLength(3);
    expect(result.metrics.callMetrics.totalAttempted).toBe(4); // 1 structure + 3 chapters
    expect(result.metrics.quotaStatus.percentUsed).toBeLessThanOrEqual(25); // 4/20 = 20%
  });

  test("generates 60-page eBook with deferrals", async () => {
    const service = new EbookService({
      aiService: mockAiService,
      callManager: new CallManager({
        quotaLimit: 20,
      }),
    });

    const result = await service.generateEbook(60, {
      deadline: Date.now() + 600000, // 10 minutes
    });

    expect(result.chapters).toHaveLength(60);
    expect(result.metrics.callMetrics.deferralCount).toBeGreaterThan(2); // Expecting deferrals
  });
});
```

### Scenario Tests: Real-World Flows

```javascript
describe("CallManager Scenarios", () => {
  test("3-page eBook: happy path", async () => {
    // No quota exhaustion, plenty of time
    // Expected: 4 calls, 0 deferrals, ~2 seconds
  });

  test("20-page eBook: quota boundary", async () => {
    // Last call hits quota limit
    // Expected: 21 calls, 1 deferral, ~65 seconds
  });

  test("60-page eBook: extended range", async () => {
    // Multiple quota resets expected
    // Expected: 61 calls, 3+ deferrals, ~190 seconds
  });

  test("Network timeout: retriable error", async () => {
    // Simulate TEMPORARY_FAILURE
    // Expected: Automatic retry, eventual success
  });

  test("API authentication: fatal error", async () => {
    // Simulate 401 AUTHENTICATION_FAILED
    // Expected: Immediate failure, no retry
  });

  test("Time deadline: near expiry", async () => {
    // Simulate tight time budget
    // Expected: Warn but continue, complete successfully
  });
});
```

---

## Deployment Checklist

- [ ] CallManager class created and tested
- [ ] ebookService modified to use CallManager
- [ ] jobQueueManager updated for deadline tracking
- [ ] Frontend timeout calculation updated
- [ ] Metrics collection enabled in CallManager
- [ ] Monitoring/alerting on deferral events
- [ ] Error handling for failed calls
- [ ] Callback error handling (onStatusChange/onDeferral)
- [ ] Feature flag created (EXTENDED_PAGE_RANGE)
- [ ] 3-20 default unchanged
- [ ] 60-page extended range feature-flagged
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Load testing with quota simulation
- [ ] Documentation updated

---

## Performance Characteristics

### Expected Metrics (Per Page Count)

```
Page Count | Calls | Quota Resets | Time (baseline) | Time (with deferral)
-----------|-------|--------------|-----------------|--------------------
3          | 4     | 0            | ~8-10s          | ~8-10s
5          | 6     | 0            | ~15-18s         | ~15-18s
10         | 11    | 0            | ~30-35s         | ~30-35s
20         | 21    | 1            | ~60-70s         | ~60-125s
30         | 31    | 1            | ~90-105s        | ~95-150s
60         | 61    | 3            | ~180-210s       | ~250-300s
```

**Notes**:

- Baseline time: API latency + processing
- Deferral time: Wait for quota window reset (up to 60s per reset)
- Pro model (structure): ~3-5s per call
- Flash model (chapters): ~2-3s per call

---

## NOTE: Batch Query Architecture (Must be Designed Before Sequential Implementation)

**Status**: Pending architectural design  
**Scope**: Foundational to CallManager's full potential

The sequential query model described in this document (executeCall) is the baseline. However, for optimal performance with 20+ page eBooks and efficient quota utilization, **CallManager must also support batch query execution** before production deployment of sequential implementation.

**Why Batch Queries Matter**:

- **Sequential baseline** (current design): 60-page eBook = 61 calls × 3s each = 183s baseline + quota deferrals
- **Batch potential**: Same 60-page eBook = ~8-10 batch calls (5-10 chapters per batch) × 5-8s each = 40-80s baseline
- **Speedup**: 2.5-4.5× faster, significantly reduces quota deferral events

**Batch Query Requirements** (To be documented in separate architecture spec):

1. **Call Batching Strategy**

   - How to group chapters into optimal batch sizes
   - Quota impact calculation for batch calls
   - Model selection per batch (Pro for structure, Flash for chapter groups)

2. **Error Handling for Batches**

   - If batch call fails, how to retry (full batch? individual chapters?)
   - Partial success handling (some chapters succeed, some fail)
   - Timeout management for longer batch execution

3. **Result Aggregation**

   - How to map batch results back to individual chapters
   - Handling malformed responses from batch API
   - Ensuring order preservation (chapter 1, 2, 3 vs mixed order)

4. **CallManager Integration**

   - New method: `executeBatchCall(callFn, batchIndex, batchType, chapterCount)`
   - Quota management for variable-cost batch calls
   - Time budgeting for longer batch execution windows

5. **Feature Flagging**
   - BATCH_QUERIES_ENABLED: true (default, use batch when available)
   - SEQUENTIAL_FALLBACK_ENABLED: true (fallback if batch fails)
   - BATCH_SIZE: 5 chapters per batch (configurable)
   - BATCH_TIMEOUT_MULTIPLIER: 1.5× (batch calls take longer)
   - FORCE_SEQUENTIAL_MODE: false (override to force sequential, useful for testing/debugging)

**Architecture Priority: Batch-First with Sequential Fallback**

**Design-Time Priority**: Batch query architecture must be designed first (before sequential implementation) to ensure both systems work together cohesively. This prevents sequential becoming a permanent design that batch queries have to retrofit into.

**Runtime Priority (Current)**: Sequential implementation has priority for initial deployment due to:

- Simpler to implement and test
- Lower risk of new failure modes
- Proven reliability with existing quota/timeout infrastructure
- Can be deployed immediately to 3-20 page range

**Future Runtime Priority (Post-Implementation)**: Once both implemented:

- Batch queries as primary (faster, more efficient)
- Sequential as intelligent fallback if batch fails
- User-controlled override via FORCE_SEQUENTIAL_MODE flag for debugging

**Recommended Approach**:

1. **Phase 1 (Current)**: Design CallManager batch query architecture separately (4-6 hours design work, no code yet)
2. **Phase 1B (Parallel)**: Design and implement CallManager with sequential query support (3-20 pages baseline)
3. **Phase 2**: Implement CallManager batch query methods using pre-designed architecture
4. **Phase 3 (Testing)**: Comprehensive batch vs sequential comparison; ensure fallback works reliably
5. **Phase 4 (Rollout)**: Deploy with SEQUENTIAL_FALLBACK_ENABLED=true, allow batch to take primary role after stabilization

**Estimated Effort**:

- **Phase 1**: Batch architecture design (4-6 hours design work only, no implementation)
- **Phase 1B**: Sequential CallManager implementation (8-10 hours)
- **Phase 2**: Batch CallManager implementation (6-8 hours)
- **Phase 3**: Testing & fallback validation (10-12 hours)
- **Phase 4**: Monitoring & rollout (2-4 hours)
- **Total**: 30-40 hours (2-3 weeks)

---

## Future Enhancements

### 1. Exponential Backoff for Transient Errors

```javascript
async waitForRetry(attemptCount) {
  const baseDelay = 1000; // 1 second
  const maxDelay = 32000; // 32 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);

  await this.sleep(delay);
}
```

### 2. Distributed Quota Management

For multi-instance deployments, use Redis:

```javascript
class DistributedQuotaManager {
  async checkAndConsumeQuota() {
    const key = `quota:global:${Math.floor(Date.now() / 60000)}`;
    const current = await redis.incr(key);

    if (current > this.quotaLimit) {
      await redis.decr(key); // Undo increment
      return false; // Quota exhausted
    }

    return true; // Quota available
  }
}
```

### 3. Adaptive Timeouts

```javascript
calculateTimeout(pageCount, quotaResetCount) {
  const baseTime = pageCount * 3000; // 3s per page
  const quotaWaitTime = quotaResetCount * 60000; // 60s per reset
  const buffer = 30000; // 30s safety buffer

  return baseTime + quotaWaitTime + buffer;
}
```

### 4. Machine Learning-Based Time Prediction

```javascript
predictGenerationTime(pageCount, modelVersion, userRegion) {
  // Train on historical data
  // Account for model performance variations
  // Account for regional latency differences

  return model.predict([pageCount, modelVersion, userRegion]);
}
```

---

## Summary

The **CallManager** architecture provides:

✅ **Separation of Concerns**: Content generation decoupled from infrastructure management  
✅ **Never-Fail Guarantee**: Transparent handling of quota/time constraints  
✅ **Scalability**: Support for 3 to 60+ pages without changing core logic  
✅ **Observability**: Detailed metrics for progress tracking  
✅ **Resilience**: Automatic retry for transient failures  
✅ **Flexibility**: Configurable quotas, deadlines, callbacks

**Key Principles**:

1. Quota exhaustion → Defer, never fail
2. Time tight → Warn, never fail
3. Genuine errors → Fail with enhanced context
4. Infrastructure concerns ≠ business logic
5. Metrics enable intelligent operations

**Integration Points**:

- ebookService: Uses callManager.executeCall() instead of aiService.generateContent()
- jobQueueManager: Tracks deadline and CallManager metrics
- Frontend: Calculates timeout dynamically, displays quota/time status
- Monitoring: Alert on deferral patterns, API errors

**Next Steps**:

1. Implement CallManager class
2. Update ebookService integration
3. Add feature flag for extended range
4. Write comprehensive tests
5. Deploy with 60-page support
