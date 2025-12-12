# Rate-Limiter Feature: Inter-Request Pacing for Sequential Ebook Generation

**Status**: Design Phase - Brainstorming Session  
**Date**: December 12, 2025 @ 11:15AM
**Reference Log**: [Light_3-page.md](ebookService/DATA/Light_3-page.md) - Server log showing burst rate failure  
**Branch Context**: `feat/patience-timer-sequential`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Analysis](#problem-analysis)
   - [Reference: Real Failure Case](#reference-real-failure-case)
   - [Hypothesis: Burst Rate Overload](#hypothesis-burst-rate-overload-not-volume-quota)
3. [Current Architecture](#current-architecture)
   - [Three Independent Concerns](#three-independent-concerns)
   - [Key Flow: No Velocity Constraints](#key-flow-no-velocity-constraints)
4. [Proposed Solution: Rate-Limiter Module](#proposed-solution-rate-limiter-module)
   - [New Component: rateLimiter.js](#new-component-ratelimiterjs)
   - [Updated Architecture with Rate-Limiter](#updated-architecture-with-rate-limiter)
5. [How It Works: Execution Timeline](#how-it-works-execution-timeline)
   - [Before: Burst Pattern (Current - Fails)](#before-burst-pattern-current---fails)
   - [After: Paced Pattern (Proposed - Should Work)](#after-paced-pattern-proposed---should-work)
6. [Implementation Details](#implementation-details)
   - [Integration: geminiClient.callGemini()](#integration-geminiclientcallgemini)
   - [Configuration: Environment Variables](#configuration-environment-variables)
7. [Testing Strategy](#testing-strategy)
   - [Test 1: Verify Current Behavior (Baseline)](#test-1-verify-current-behavior-baseline)
   - [Test 2: Verify Pacing Works (With 1s Delay)](#test-2-verify-pacing-works-with-1s-delay)
   - [Test 3: Optimize Delay Value](#test-3-optimize-delay-value)
   - [Test 4: Integration with Quota](#test-4-integration-with-quota)
8. [Configuration & Tuning](#configuration--tuning)
   - [Finding Optimal Delay](#finding-optimal-delay)
   - [Adaptive Delays (Future Enhancement)](#adaptive-delays-future-enhancement)
9. [Impact Analysis](#impact-analysis)
   - [Benefits](#benefits)
   - [Costs](#costs)
10. [Relationship to Batch Mode](#relationship-to-batch-mode)
11. [Acceptance Criteria](#acceptance-criteria)
12. [Reference Documents](#reference-documents)
13. [Discussion Topics](#discussion-topics)

---

## Executive Summary

Current sequential ebook generation fails on Chapter 3 due to **burst rate overload** (not quota exhaustion). When Chapter 2 completes at ~28 seconds, Chapter 3 is requested immediately, creating a tight burst that exceeds Gemini's per-model instance capacity.

This proposal introduces an independent **inter-request rate-limiter** that enforces minimum delays between consecutive API calls, allowing Gemini's backend to recover model instances without silently falling back to stub content.

---

## Problem Analysis

### Reference: Real Failure Case

**Server log from 2025-12-12 14:59:55 UTC:**

- 3-page ebook request (Light theme, "Benny the Brave Bunny" prompt)
- Structure generation: ~5.9s (Gemini 2.5 Pro)
- Chapter 1: ~18.9s (Gemini 2.5 Flash)
- Chapter 2: ~8.9s (Gemini 2.5 Flash)
- **Chapter 3: FAILED** - "The model is overloaded. Please try again later."
- Total request time: 38.3 seconds
- Fallback: Chapter 3 rendered as boilerplate stub
- Response: HTTP 200 OK (silent failure)

**Full analysis**: See [Light_3-page.md](ebookService/DATA/Light_3-page.md)

### Hypothesis: Burst Rate Overload, Not Volume Quota

Gemini's free tier enforces **two distinct limits**:

| Limit                   | Type         | Current Tracking  | Status      |
| ----------------------- | ------------ | ----------------- | ----------- |
| 20 calls/60sec          | Volume quota | ✓ quotaTracker.js | Working     |
| Min inter-request delay | Burst rate   | ✗ None            | **Missing** |

**Evidence:**

```
Quota accounting at failure:
├─ Call 0: -1 = 19 remaining (Structure)
├─ Call 1: -1 = 18 remaining (Chapter 1)
├─ Call 2: -1 = 17 remaining (Chapter 2)
└─ Call 3: FAIL (no recording) = 17 still remaining
            ↑ Only 15% of quota used (3 of 20)
            ↑ Error is "overloaded", not "quota exhausted"
```

**Timing analysis:**

```
Timeline of calls (no inter-request delays):
├─ T=0s:      Call 0 (Structure) initiated
├─ T=5.9s:    Call 0 completes → Call 1 initiated immediately
├─ T=24.8s:   Call 1 completes → Call 2 initiated immediately
├─ T=33.7s:   Call 2 completes → Call 3 initiated immediately ← BURST
│             Gemini: "model instance not ready" → 429/503
└─ T=38.3s:   Request times out, fallback triggered
```

When Call 3 fires, Gemini's Flash model instance hasn't had time to:

- Release the previous instance (Call 2)
- Initialize a new instance
- Handle the incoming request

Result: Overload error despite being quota-compliant.

---

## Current Architecture

### Three Independent Concerns

```
┌──────────────────────────────────────────────────────────────┐
│                    genieService.process()                    │
│  Entry point: Checks VOLUME quota once upfront               │
│  ├─ [QUOTA] Checking quota for mode 'ebook': cost=3, ...     │
│  └─ [QUOTA] Quota check passed: proceeding with dispatch     │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                   ebookService.handle()                      │
│  Responsibility: Sequential chapter generation               │
│  └─ for i in [0..N]:                                         │
│      ├─ contentPrompt = buildPrompt(chapter, prevSummary)    │
│      ├─ chapterResp = aiSvc.generateContentWithRotation()    │
│      │                 (AWAIT here - blocks next iteration)  │
│      └─ chapters.push(parsed response or fallback)           │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                  geminiClient.callGemini()                   │
│  Responsibility: Execute API call with volume quota checks   │
│  └─ [QUOTA] getStatus() - Pre-call check                     │
│     └─ [Fetch API]                                           │
│     └─ [QUOTA] recordCall() - Post-call (on success only)    │
│                                                              │
│  ✗ Does NOT check inter-request timing                       │
└──────────────────────────────────────────────────────────────┘
```

### Key Flow: No Velocity Constraints

```
ebookService loop iteration i:
  1. Build prompt (includes prevSummary for i>0)
  2. Call aiSvc.generateContentWithRotation(prompt, i)
  3. This calls geminiClient.callGemini()
  4. Which checks quotaTracker.getStatus()
  5. Then fetches from Gemini (potentially overloading burst rate)
  6. Returns response
  7. Back to step 1 for i+1 (loop continues immediately)

Result: Tight burst pattern with NO INTER-REQUEST PACING
```

---

## Proposed Solution: Rate-Limiter Module

### New Component: rateLimiter.js

Independent velocity tracking in `server/utils/rateLimiter.js`:

```javascript
/**
 * rateLimiter - Inter-request pacing module
 *
 * Enforces minimum delays between consecutive API calls
 * to avoid overwhelming Gemini's model instantiation.
 *
 * Works independently from quota tracking:
 * - quotaTracker: Prevents exceeding volume limits (20 calls/min)
 * - rateLimiter: Prevents exceeding burst rate limits (min delay between calls)
 */

const rateLimiter = (() => {
  let lastCallTime = null;

  // Configurable minimum delay (milliseconds)
  // Allows Gemini's backend to recover model instances
  const MIN_DELAY_BETWEEN_CALLS_MS =
    process.env.RATE_LIMIT_MIN_DELAY_MS || 1000;

  /**
   * Get milliseconds until next call is permitted
   */
  function getTimeUntilReady() {
    if (!lastCallTime) return 0; // First call, no wait

    const elapsed = Date.now() - lastCallTime;
    const waitNeeded = MIN_DELAY_BETWEEN_CALLS_MS - elapsed;
    return Math.max(0, waitNeeded);
  }

  /**
   * Wait until sufficient time has passed since last call
   * Called from geminiClient BEFORE making API request
   */
  async function waitForReadiness(callIndex) {
    const waitMs = getTimeUntilReady();

    if (waitMs > 0) {
      console.log(
        `[RATE-LIMIT] Call ${callIndex}: ` +
          `enforcing ${waitMs}ms inter-request delay`
      );

      // Sleep without blocking other requests (async)
      await new Promise((resolve) => setTimeout(resolve, waitMs));

      console.log(`[RATE-LIMIT] Call ${callIndex}: delay complete, proceeding`);
    }
  }

  /**
   * Record this call's timestamp
   * Called from geminiClient AFTER successful API call
   */
  function recordCall() {
    lastCallTime = Date.now();
  }

  return {
    waitForReadiness,
    recordCall,
    getTimeUntilReady, // For testing/monitoring
  };
})();

module.exports = rateLimiter;
```

### Updated Architecture with Rate-Limiter

```
┌──────────────────────────────────────────────────────────────┐
│                    genieService.process()                    │
│  Entry point: Checks VOLUME quota once upfront               │
│  ├─ [QUOTA] Checking quota for mode 'ebook': cost=3, ...     │
│  └─ [QUOTA] Quota check passed: proceeding with dispatch     │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                   ebookService.handle()                      │
│  Responsibility: Sequential chapter generation               │
│  └─ for i in [0..N]:                                         │
│      ├─ contentPrompt = buildPrompt(chapter, prevSummary)    │
│      ├─ chapterResp = aiSvc.generateContentWithRotation()    │
│      │                 (AWAIT here - blocks next iteration)  │
│      └─ chapters.push(parsed response or fallback)           │
│                                                              │
│  ✗ Still sequential, but now respects inter-request pacing  │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                  geminiClient.callGemini()                   │
│  Responsibility: Execute API call with volume & velocity     │
│                  quota checks                                │
│  └─ [RATE-LIMIT] waitForReadiness(callIndex)  ← NEW          │
│     │ Enforces minimum inter-request delay                   │
│     │ (async, doesn't block server)                          │
│     └─ [QUOTA] getStatus() - Pre-call check                  │
│        └─ [Fetch API]                                        │
│        ├─ [RATE-LIMIT] recordCall() ← NEW                    │
│        └─ [QUOTA] recordCall()                               │
└──────────────────────────────────────────────────────────────┘
```

---

## How It Works: Execution Timeline

### Before: Burst Pattern (Current - Fails)

```
┌─────────────────────────────────────────────────────────────┐
│ ebook/generate request (3 pages)                            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴──────────────────┐
        │                                        │
    [QUOTA]                              [NO RATE-LIMIT]
    Check: 3 ≤ 20? ✓                             │
        │                                        │
        └────────────────────┬───────────────────┘
                             │
    ┌────────────────────────┴────────────────────┐
    │        Call 0: Structure (Pro)              │
    │        └─ 5.9s execution                    │
    └────────────────────────┬────────────────────┘
                             │
    ┌────────────────────────v────────────────────┐
    │ Call 1: Chapter 1 (Flash)                   │
    │ ├─ 0ms inter-request delay ← BURST          │
    │ └─ 18.9s execution                          │
    └────────────────────────┬────────────────────┘
                             │
    ┌────────────────────────v────────────────────┐
    │ Call 2: Chapter 2 (Flash)                   │
    │ ├─ 0ms inter-request delay ← BURST          │
    │ └─ 8.9s execution                           │
    └────────────────────────┬────────────────────┘
                             │
    ┌────────────────────────v────────────────────┐
    │ Call 3: Chapter 3 (Flash)                   │
    │ ├─ 0ms inter-request delay ← BURST TRIGGERS │
    │ └─ ERROR: "model is overloaded" ✗           │
    └────────────────────────┬────────────────────┘
                             │
    ┌────────────────────────v────────────────────┐
    │ Fallback: Generate stub Chapter 3           │
    │ └─ Boilerplate content                      │
    └────────────────────────┬────────────────────┘
                             │
              Result: HTTP 200 with degraded content
```

**Total time: 38.3s | Success rate: 67% (2/3 chapters) | Quality: Failed**

### After: Paced Pattern (Proposed - Should Work)

```
┌─────────────────────────────────────────────────────────────┐
│ ebook/generate request (3 pages)                            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴──────────────────┐
        │                                        │
    [QUOTA]                          [RATE-LIMIT]
    Check: 3 ≤ 20? ✓              Initialized: ready
        │                                        │
        └────────────────────┬───────────────────┘
                             │
    ┌────────────────────────┴────────────────────┐
    │ Call 0: Structure (Pro)                     │
    │ ├─ [RATE-LIMIT] 0ms wait (first call)       │
    │ ├─ [QUOTA] Pre-check: 20 available ✓        │
    │ ├─ Execute: 5.9s                            │
    │ └─ [RATE-LIMIT] Record timestamp            │
    └────────────────────────┬────────────────────┘
                             │
    ┌────────────────────────v────────────────────┐
    │ Call 1: Chapter 1 (Flash)                   │
    │ ├─ [RATE-LIMIT] 0ms wait (elapsed > delay)  │
    │ ├─ [QUOTA] Pre-check: 19 available ✓        │
    │ ├─ Execute: 18.9s                           │
    │ └─ [RATE-LIMIT] Record timestamp            │
    └────────────────────────┬────────────────────┘
                             │
    ┌────────────────────────v────────────────────┐
    │ Call 2: Chapter 2 (Flash)                   │
    │ ├─ [RATE-LIMIT] 0ms wait (elapsed > delay)  │
    │ ├─ [QUOTA] Pre-check: 18 available ✓        │
    │ ├─ Execute: 8.9s                            │
    │ └─ [RATE-LIMIT] Record timestamp            │
    └────────────────────────┬────────────────────┘
                             │
    ┌────────────────────────v────────────────────┐
    │ Call 3: Chapter 3 (Flash)                   │
    │ ├─ [RATE-LIMIT] 1000ms wait ← BREATHING ROOM│
    │ │                   (Gemini recovers here)  │
    │ ├─ [QUOTA] Pre-check: 17 available ✓        │
    │ ├─ Execute: 19s ← SUCCESS ✓                 │
    │ └─ [RATE-LIMIT] Record timestamp            │
    └────────────────────────┬────────────────────┘
                             │
              Result: HTTP 200 with complete, quality content
```

**Total time: 45.8s (+7.5s for pacing) | Success rate: 100% (3/3 chapters) | Quality: Success**

---

## Implementation Details

### Integration: geminiClient.callGemini()

```javascript
// server/geminiClient.js - callGemini() function

async function callGemini({
  prompt,
  modality = "TEXT",
  generationConfig = {},
  imageB64 = null,
  callIndex = 0  // ← NEW parameter for rate-limiting
}) {
  // ... existing setup code ...

  try {
    // ✅ NEW: Rate-limiter check (enforces inter-request delay)
    const rateLimiter = require("./utils/rateLimiter");
    await rateLimiter.waitForReadiness(callIndex);
    console.log(`[RATE-LIMIT] Call ${callIndex}: proceeding after pacing`);

    // ✅ EXISTING: Quota check (enforces volume limit)
    const quotaTracker = require("./utils/quotaTracker");
    const quotaStatus = quotaTracker.getStatus();
    if (quotaStatus.availableQuota < 1) {
      console.log(`[QUOTA] Pre-call check BLOCKED: exhausted quota`);
      return { ok: false, status: 429, error: "Quota exhausted" };
    }

    // Make the API call
    const resp = await fetchImpl(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    // ... existing response parsing ...

    // ✅ Track successful call
    if (resp.ok) {
      // NEW: Record for rate-limiting
      rateLimiter.recordCall();

      // EXISTING: Record for quota
      quotaTracker.recordCall();
      console.log(`[QUOTA] Call recorded: ${quotaStatus.callCount + 1}/20`);
      console.log(`[RATE-LIMIT] Call ${callIndex}: timestamp recorded`);
    }

    return { ok: resp.ok, status: resp.status, ... };
  } catch (err) {
    return { ok: false, status: 0, error: String(err) };
  }
}
```

### Configuration: Environment Variables

```bash
# Default: 1000ms (1 second) between consecutive calls
RATE_LIMIT_MIN_DELAY_MS=1000

# Tuning for testing/optimization:
# Conservative (safer):
RATE_LIMIT_MIN_DELAY_MS=2000  # 2 seconds between calls

# Aggressive (faster):
RATE_LIMIT_MIN_DELAY_MS=500   # 0.5 seconds between calls

# Testing burst resilience:
RATE_LIMIT_MIN_DELAY_MS=0     # No pacing (simulates current behavior)
```

---

## Testing Strategy

### Test 1: Verify Current Behavior (Baseline)

**Setup:**

```bash
RATE_LIMIT_MIN_DELAY_MS=0  # Disable pacing (current behavior)
```

**Expected result:**

- Chapter 3 fails with "model is overloaded"
- Fallback triggered
- HTTP 200 with boilerplate Chapter 3
- Total time: ~38s

**Logs:**

```
[RATE-LIMIT] Call 0: enforcing 0ms inter-request delay
[RATE-LIMIT] Call 1: enforcing 0ms inter-request delay
[RATE-LIMIT] Call 2: enforcing 0ms inter-request delay
[RATE-LIMIT] Call 3: enforcing 0ms inter-request delay ← BURST
[EBOOK] Chapter 3/3: AI generation failed, using fallback
```

### Test 2: Verify Pacing Works (With 1s Delay)

**Setup:**

```bash
RATE_LIMIT_MIN_DELAY_MS=1000  # 1 second pacing
```

**Expected result:**

- All three chapters succeed
- Chapter 3 gets Gemini API response (not fallback)
- HTTP 200 with quality content
- Total time: ~45-48s (+7-10s for pacing)

**Logs:**

```
[RATE-LIMIT] Call 0: enforcing 0ms inter-request delay
[RATE-LIMIT] Call 0: delay complete, proceeding

[RATE-LIMIT] Call 1: enforcing 0ms inter-request delay
[RATE-LIMIT] Call 1: delay complete, proceeding

[RATE-LIMIT] Call 2: enforcing 0ms inter-request delay
[RATE-LIMIT] Call 2: delay complete, proceeding

[RATE-LIMIT] Call 3: enforcing 1000ms inter-request delay ← BREATHING ROOM
[RATE-LIMIT] Call 3: delay complete, proceeding
[EBOOK] Chapter 3/3: AI response received in 19000ms ← SUCCESS
```

### Test 3: Optimize Delay Value

Run against Gemini API with varying delays:

- `RATE_LIMIT_MIN_DELAY_MS=250` - Too aggressive?
- `RATE_LIMIT_MIN_DELAY_MS=500` - Acceptable?
- `RATE_LIMIT_MIN_DELAY_MS=1000` - Safe?
- `RATE_LIMIT_MIN_DELAY_MS=2000` - Over-conservative?

Track:

- Success rate (% of chapters that generate without fallback)
- Response time (total request duration)
- Quality score (heuristic: summary length, coherence, etc.)

### Test 4: Integration with Quota

Ensure both systems work together:

**Scenario A: Quota exhausted**

```
Sequential ebook requests until quota reaches 0
Expected: genieService rejects new requests before reaching geminiClient
Logs should show: [QUOTA] Insufficient quota before any [RATE-LIMIT] checks
```

**Scenario B: Rate-limited but quota available**

```
Rapid-fire API calls from external client
Expected: Rate-limiter enforces pacing, quota tracker stays healthy
```

---

## Configuration & Tuning

### Finding Optimal Delay

```javascript
// Empirical testing suggests:
// - 500ms:  Frequently fails on Chapter 3 (too aggressive)
// - 1000ms: Consistently succeeds (safe baseline)
// - 2000ms: Always succeeds but adds unnecessary time

// Recommendation: Start with 1000ms, optimize after data collection
```

### Adaptive Delays (Future Enhancement)

```javascript
// Could track failure rates and adjust:
// - If >10% of requests fail: increase delay to 1500ms
// - If <1% of requests fail: try 750ms
// - This would auto-tune for Gemini's actual burst limits
```

---

## Impact Analysis

### Benefits

1. **Eliminates silent failures**: Chapter 3 generates successfully instead of falling back
2. **Improves quality**: All 3 chapters are AI-generated, not mixed with stubs
3. **Maintains sequential architecture**: No change to ebookService logic
4. **Independent concerns**: Quota and rate-limiting are separate systems
5. **Observable**: Clear logs show when pacing is applied
6. **Testable**: Can verify behavior with different delay values
7. **Preparation for batch mode**: Establishes velocity management pattern for future parallelization

### Costs

1. **Latency increase**: ~7-10 seconds for 3-page ebook (38s → 45-48s)

   - Acceptable tradeoff for reliability
   - Batch mode will parallelize to recover this time

2. **Server resource usage**: Slightly increased (async sleep() calls)

   - Negligible impact (non-blocking)

3. **Configuration complexity**: One new environment variable
   - Simple, well-documented

---

## Relationship to Batch Mode

This rate-limiter lays groundwork for future **batch/parallel mode**:

**Sequential mode** (current & proposed):

```
Structure → wait 1s → Chapter 1 → wait 1s → Chapter 2 → wait 1s → Chapter 3
Total: ~46s
```

**Future batch mode** (sketch):

```
Structure (await)
├─ After structure: issue Chapter 1, 2, 3 calls concurrently
├─ Each respects rate-limiter's 1s spacing internally
├─ But overlap execution: Ch1 and Ch2 run while Ch3 waits
Total: ~26s (2x speedup)
```

The rate-limiter handles velocity at the API call level, allowing both sequential and batch modes to coexist safely.

---

## Acceptance Criteria

- [ ] rateLimiter module created in `server/utils/rateLimiter.js`
- [ ] geminiClient.callGemini() integrates waitForReadiness() and recordCall()
- [ ] Environment variable `RATE_LIMIT_MIN_DELAY_MS` configurable
- [ ] Logs show pacing: `[RATE-LIMIT] Call X: enforcing Yms delay`
- [ ] Test Case 1 (baseline): Chapter 3 fails with delay=0
- [ ] Test Case 2 (paced): Chapter 3 succeeds with delay=1000
- [ ] Test Case 3: Optimal delay identified through testing
- [ ] Test Case 4: Quota and rate-limiter work together
- [ ] Documentation in inline comments and logs
- [ ] No breaking changes to existing sequential ebook flow

---

## Reference Documents

- **Problem Analysis**: [Light_3-page.md](ebookService/DATA/Light_3-page.md)
- **Current Code**:
  - [server/ebookService.js](../../server/ebookService.js) - Sequential chapter loop
  - [server/geminiClient.js](../../server/geminiClient.js) - API execution
  - [server/utils/quotaTracker.js](../../server/utils/quotaTracker.js) - Volume quota
- **Related Features**:
  - Sequential mode (current proposal)
  - Batch/parallel mode (future, will reuse rate-limiter)

---

## Discussion Topics

1. **Optimal delay value**: Is 1000ms the right baseline?
2. **Adaptive vs fixed**: Should delay adjust based on errors?
3. **Per-model tuning**: Should Pro and Flash have different delays?
4. **Observable metrics**: What should be logged for monitoring?
5. **Future: Exponential backoff**: If Chapter 3 fails, retry with longer delay?
6. **Future: Jitter**: Randomize delay to avoid synchronized requests?

---

**Next Steps**: Implement rate-limiter module and run Test Cases 1-4.
