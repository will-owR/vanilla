# Gemini API Quota Management Implementation Guide

**Date**: December 6, 2025  
**Branch**: `feat/revert`  
**Audience**: Developers, DevOps, QA engineers  
**Status**: Ready for Implementation

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Architecture Overview](#architecture-overview)
3. [Component Specifications](#component-specifications)
4. [Implementation Steps](#implementation-steps)
5. [Testing Strategy](#testing-strategy)
6. [Monitoring & Debugging](#monitoring--debugging)
7. [Deployment Checklist](#deployment-checklist)

---

## Quick Reference

### What We're Building

A **rate-limiting system** that:

- Tracks Gemini API calls in real-time
- Pauses job execution when quota approaching (18/20 calls used)
- Queues jobs during cooldown (65-second wait)
- Exposes quota status to frontend

### Key Constraints

- **Gemini free tier limit**: 20 calls/minute
- **Ebook cost**: 1 structure + N chapters (avg 9 calls/ebook)
- **Max queue size**: 50 jobs (prevent memory exhaustion)
- **Backoff window**: 65 seconds (safe buffer for quota reset)

### File Changes Required

| File                         | Change Type  | Impact                   |
| ---------------------------- | ------------ | ------------------------ |
| `server/geminiClient.js`     | Create new   | Quota tracking wrapper   |
| `server/jobQueueManager.js`  | Modify       | Add deferral logic       |
| `server/genieService.js`     | Modify       | Use quota-aware wrapper  |
| `server/index.js`            | Add endpoint | `/api/quota-status`      |
| `client/src/lib/ebookApi.js` | Modify       | Show quota in polling    |
| Tests                        | Create       | Unit + integration tests |

---

## Architecture Overview

### System Flow

```
┌─────────────────┐
│  User Request   │
│  Generate 20pg  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  POST /api/ebook/generate       │
│  → Returns 202 + jobId (fast)   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  jobQueueManager.createJob()    │
│  → Checks quota status          │
│     - If quota OK: status=queued│
│     - If quota full: deferred   │
└────────┬────────────────────────┘
         │
         ├─ QUOTA_OK ───────────────┐
         │                          │
         ▼                          ▼
    [Processing]              [Deferred Queue]
         │                          │
         │                    (Wait 65s)
         │                          │
         └──────────────┬───────────┘
                        │
                        ▼
              [genieService.process()]
                        │
              [Makes Gemini API calls]
                        │
         ┌──────────────┴──────────────┐
         │                             │
         ▼                             ▼
    [Success]                    [Quota Error]
         │                             │
         ▼                             ▼
  [completeJob]          [Retry with backoff]
         │                             │
         ▼                             ▼
    [Result]                   [Exponential backoff]
```

### Data Structures

```javascript
// QuotaTracker (singleton in geminiClient.js)
{
  callCount: 18,                    // calls in current minute
  windowStart: 1702000000000,       // when this minute started (ms)
  lastCallTime: 1702000045000,      // timestamp of last call
  pauseUntil: null,                 // if quota exhausted, pause until this time
  dailyCallCount: 342,              // track for monitoring
}

// Job with defer status (in jobQueueManager.js)
{
  jobId: "uuid",
  status: "processing" | "deferred" | "complete" | "error",
  deferredUntil: 1702000065000,     // if deferred, wait until this time
  reason: "quota_cooldown",         // why it's deferred
  message: "Quota limit reached. Your request will start in ~30s",
}

// Status response (from /api/quota-status)
{
  quotaCallCount: 18,               // calls in current window
  quotaLimit: 20,
  quotaPercentUsed: 90,
  nextResetTime: 1702000060000,     // epoch ms
  secondsUntilReset: 15,
  isPaused: true,
  pauseUntil: 1702000065000,
  queueLength: 3,
  message: "Quota at 90%. New requests will be queued.",
}
```

---

## Component Specifications

### 1. QuotaTracker (geminiClient.js)

**Purpose**: Track Gemini API calls in real-time, detect exhaustion, manage backoff

**New File**: `server/geminiClient.js`

```javascript
/**
 * Quota Tracker for Gemini API
 * Manages per-minute call counting and backoff logic
 */
class QuotaTracker {
  constructor(limit = 20, windowMs = 60000) {
    this.limit = limit; // 20 calls/minute
    this.windowMs = windowMs; // 60000ms = 1 minute
    this.callCount = 0;
    this.windowStart = Date.now();
    this.pauseUntil = null;
    this.dailyCallCount = 0;
    this.lastError = null;
  }

  /**
   * Record an API call
   * @returns {Object} - { success: bool, reason?: string }
   */
  recordCall() {
    this.rotateWindow();

    if (this.isPaused()) {
      return { success: false, reason: "paused" };
    }

    if (this.callCount >= this.limit) {
      // Quota exhausted; initiate pause
      this.pause();
      return { success: false, reason: "quota_exhausted" };
    }

    this.callCount++;
    this.dailyCallCount++;
    return { success: true };
  }

  /**
   * Get quota status
   * @returns {Object} - Current quota state
   */
  getStatus() {
    this.rotateWindow();
    return {
      callCount: this.callCount,
      limit: this.limit,
      percentUsed: Math.round((this.callCount / this.limit) * 100),
      remaining: Math.max(0, this.limit - this.callCount),
      isPaused: this.isPaused(),
      pauseUntil: this.pauseUntil,
      secondsUntilReset: Math.max(
        0,
        Math.ceil((this.pauseUntil - Date.now()) / 1000)
      ),
      dailyCallCount: this.dailyCallCount,
    };
  }

  /**
   * Check if quota window has rotated; reset if needed
   */
  rotateWindow() {
    const now = Date.now();
    if (now - this.windowStart > this.windowMs) {
      this.windowStart = now;
      this.callCount = 0;
      this.pauseUntil = null;
    }
  }

  /**
   * Check if currently paused
   */
  isPaused() {
    return this.pauseUntil && Date.now() < this.pauseUntil;
  }

  /**
   * Initiate pause (when quota exhausted)
   */
  pause() {
    const pauseDuration = 65000; // 65 seconds (safe buffer for quota reset)
    this.pauseUntil = Date.now() + pauseDuration;
    console.log(
      `[QuotaTracker] Quota exhausted. Pausing until ${new Date(
        this.pauseUntil
      ).toISOString()}`
    );
  }

  /**
   * Handle quota error from Gemini API
   * @param {Error} error - The Gemini API error
   */
  handleQuotaError(error) {
    this.lastError = error.message;
    const retryAfter = this.parseRetryAfter(error);
    if (retryAfter) {
      this.pauseUntil = Date.now() + retryAfter * 1000;
    } else {
      this.pause();
    }
  }

  /**
   * Parse "Retry in X seconds" from error message
   */
  parseRetryAfter(error) {
    const match = error.message?.match(/retry in (\d+\.?\d*)/i);
    return match ? Math.ceil(parseFloat(match[1])) : null;
  }
}

// Export singleton
module.exports = new QuotaTracker();
```

**Usage**:

```javascript
const quotaTracker = require('./geminiClient');

// Before making API call
const quota = quotaTracker.recordCall();
if (!quota.success) {
  // Defer job instead of making call
  return { shouldDefer: true, reason: quota.reason };
}

// Make API call
const result = await geminiApi.call(...);

// Get status for monitoring
const status = quotaTracker.getStatus();
console.log(`[Quota] ${status.percentUsed}% used (${status.callCount}/${status.limit})`);
```

---

### 2. Job Deferral Logic (jobQueueManager.js)

**Modifications to existing file**

```javascript
// Add to top of jobQueueManager.js
const quotaTracker = require('./geminiClient');

// Modify Job object structure
class Job {
  constructor(jobId, params) {
    this.jobId = jobId;
    this.status = 'processing';        // 'processing', 'deferred', 'complete', 'error'
    this.deferredUntil = null;         // timestamp if deferred
    this.reason = null;                // why deferred
    // ... rest of existing fields
  }
}

// Add new method to JobQueueManager
/**
 * Check if job should be deferred due to quota
 * @param {string} jobId
 * @returns {Object} - { shouldDefer: bool, deferredUntil?: number, message?: string }
 */
shouldDeferJob(jobId) {
  const quota = quotaTracker.getStatus();

  // If quota at 90%+ or paused, defer
  if (quota.percentUsed >= 90 || quota.isPaused) {
    const deferUntil = quota.pauseUntil || (Date.now() + 65000);
    const waitSeconds = Math.ceil((deferUntil - Date.now()) / 1000);

    return {
      shouldDefer: true,
      deferredUntil: deferUntil,
      reason: 'quota_cooldown',
      message: `Quota limit reached (${quota.callCount}/${quota.limit}). Your request will start in ~${waitSeconds}s.`,
    };
  }

  return { shouldDefer: false };
}

// Modify existing createJob method
createJob(params) {
  const jobId = uuidv4();
  const deferCheck = this.shouldDeferJob(jobId);

  const job = {
    jobId,
    status: deferCheck.shouldDefer ? 'deferred' : 'processing',
    deferredUntil: deferCheck.deferredUntil,
    reason: deferCheck.reason,
    // ... rest of existing fields
  };

  this.jobs.set(jobId, job);

  if (deferCheck.shouldDefer) {
    console.log(`[JobQueue] Job ${jobId} deferred: ${deferCheck.message}`);
    // Schedule processing when defer period expires
    setTimeout(() => this.processDeferred(jobId), deferCheck.deferredUntil - Date.now());
  }

  return {
    jobId,
    statusUrl: `/api/ebook/generate/${jobId}/status`,
    resultUrl: `/api/ebook/${jobId}`,
    deferred: deferCheck.shouldDefer,
    message: deferCheck.message,
  };
}

// Add method to process deferred jobs
processDeferred(jobId) {
  const job = this.jobs.get(jobId);
  if (!job || job.status !== 'deferred') return;

  const deferCheck = this.shouldDeferJob(jobId);
  if (!deferCheck.shouldDefer) {
    job.status = 'processing';
    job.deferredUntil = null;
    job.reason = null;
    console.log(`[JobQueue] Job ${jobId} resumed from deferral`);
    // Background generation will pick it up
  } else {
    // Still paused; reschedule
    setTimeout(() => this.processDeferred(jobId), 5000);
  }
}
```

---

### 3. Backend Endpoint (index.js)

**Add new endpoint for quota status**

```javascript
/**
 * GET /api/quota-status
 * Returns current Gemini API quota status
 */
app.get("/api/quota-status", (req, res) => {
  const quotaTracker = require("./geminiClient");
  const status = quotaTracker.getStatus();

  res.json({
    quota: status,
    queue: {
      length: Array.from(jobQueueManager.jobs.values()).filter(
        (j) => j.status === "deferred"
      ).length,
      maxSize: 50,
    },
    timestamp: new Date().toISOString(),
  });
});
```

---

### 4. Frontend Integration (ebookApi.js)

**Modify polling to show quota status**

```javascript
/**
 * Enhanced checkEbookStatus with quota tracking
 */
export async function checkEbookStatus(jobId) {
  const response = await fetchWithTimeout(
    `/api/ebook/generate/${jobId}/status`,
    { method: "GET" },
    10000
  );

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.status}`);
  }

  const data = await response.json();

  // Log quota info if provided
  if (data.quotaInfo) {
    console.log(
      `[API] Quota: ${data.quotaInfo.callCount}/${data.quotaInfo.limit} (${data.quotaInfo.percentUsed}%)`
    );
  }

  return data;
}

/**
 * Get current quota status
 */
export async function getQuotaStatus() {
  const response = await fetchWithTimeout(
    "/api/quota-status",
    { method: "GET" },
    5000
  );

  if (!response.ok) {
    throw new Error(`Quota status failed: ${response.status}`);
  }

  return response.json();
}
```

---

## Implementation Steps

### Step 1: Create QuotaTracker (30 min)

- [ ] Create `server/geminiClient.js` with QuotaTracker class
- [ ] Test quota rotation logic
- [ ] Test pause/resume logic
- [ ] Verify singleton pattern

### Step 2: Integrate into genieService (45 min)

- [ ] Import quotaTracker in genieService.js
- [ ] Call `recordCall()` before each Gemini API call
- [ ] Handle quota exhaustion gracefully
- [ ] Implement exponential backoff for retry

### Step 3: Modify JobQueueManager (1 hour)

- [ ] Add deferral status to Job object
- [ ] Implement `shouldDeferJob()` logic
- [ ] Implement `processDeferred()` scheduling
- [ ] Update `getStatus()` to return defer info

### Step 4: Add Backend Endpoint (15 min)

- [ ] Create `/api/quota-status` endpoint in index.js
- [ ] Return quota + queue metrics

### Step 5: Update Frontend (45 min)

- [ ] Add quota display to generation UI
- [ ] Show deferred message if job queued
- [ ] Display "waiting for quota reset..." during pause
- [ ] Call quota status endpoint periodically

### Step 6: Testing (1.5 hours)

- [ ] Unit tests for QuotaTracker
- [ ] Integration tests with mocked Gemini API
- [ ] Load test with multiple rapid requests
- [ ] Manual testing with real Gemini API

### Step 7: Deployment & Monitoring (30 min)

- [ ] Stage on dev server
- [ ] Monitor quota tracking logs
- [ ] Verify no API leaks during pause
- [ ] Push to production

**Total estimated time**: 5-6 hours development

---

## Testing Strategy

### Unit Tests

```javascript
// test/geminiClient.test.js
describe("QuotaTracker", () => {
  let tracker;

  beforeEach(() => {
    tracker = new QuotaTracker(20, 60000);
  });

  it("increments call count on recordCall()", () => {
    const result = tracker.recordCall();
    expect(result.success).toBe(true);
    expect(tracker.callCount).toBe(1);
  });

  it("rejects calls when quota exhausted", () => {
    for (let i = 0; i < 20; i++) tracker.recordCall();
    const result = tracker.recordCall();
    expect(result.success).toBe(false);
    expect(result.reason).toBe("quota_exhausted");
  });

  it("pauses on quota exhaustion", () => {
    for (let i = 0; i < 20; i++) tracker.recordCall();
    expect(tracker.isPaused()).toBe(true);
  });

  it("resets window after 60 seconds", (done) => {
    tracker.recordCall();
    tracker.windowStart = Date.now() - 65000; // Simulate 65s ago
    tracker.rotateWindow();
    expect(tracker.callCount).toBe(0);
    done();
  });
});
```

### Integration Tests

```javascript
// test/jobQueueManager.quota.test.js
describe("JobQueueManager with Quota", () => {
  it("defers job when quota approaching", () => {
    // Mock quotaTracker to return 90% usage
    quotaTracker.getStatus = () => ({ percentUsed: 90, isPaused: false });

    const { jobId, deferred, message } = jobQueueManager.createJob(params);
    expect(deferred).toBe(true);
    expect(message).toContain("Quota");
  });

  it("processes deferred jobs after pause expires", (done) => {
    // Create deferred job
    const { jobId } = jobQueueManager.createJob(params);
    const job = jobQueueManager.jobs.get(jobId);
    expect(job.status).toBe("deferred");

    // Advance time and trigger processing
    jest.useFakeTimers();
    jest.advanceTimersByTime(70000);
    jobQueueManager.processDeferred(jobId);

    expect(job.status).toBe("processing");
    done();
  });
});
```

### Load Test

```javascript
// scripts/load-test-quota.js
async function loadTest() {
  const requests = [];

  // Fire 5 rapid requests (should exceed quota after 2-3)
  for (let i = 0; i < 5; i++) {
    const promise = fetch("/api/ebook/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "...", pageCount: 10 }),
    });
    requests.push(promise);
  }

  const results = await Promise.all(requests);
  const deferred = results.filter((r) => r.deferred === true).length;

  console.log(`Results: ${results.length} requests, ${deferred} deferred`);
  // Expected: ~3 processed, ~2 deferred
}
```

---

## Monitoring & Debugging

### Logging

Add structured logs to track quota state:

```javascript
// In QuotaTracker
recordCall() {
  this.callCount++;
  if (this.callCount >= 15) {  // Alert at 75%
    console.warn(`[QuotaTracker] WARNING: ${this.callCount}/20 calls used (75% threshold)`);
  }
  if (this.callCount >= 20) {  // Alert at exhaustion
    console.error(`[QuotaTracker] QUOTA EXHAUSTED. Pausing 65s. Next reset: ${new Date(this.pauseUntil).toISOString()}`);
  }
}
```

### Metrics to Track

- `quota.callCount` - Current window calls
- `quota.percentUsed` - Percentage (0-100)
- `quota.isPaused` - Boolean
- `queue.deferredJobs` - Count of jobs in deferral
- `queue.avgWaitTime` - Average deferral wait

### Common Issues & Solutions

| Issue                       | Symptom                               | Solution                                               |
| --------------------------- | ------------------------------------- | ------------------------------------------------------ |
| Quota tracker not resetting | Same quota even after 60s             | Check `rotateWindow()` is called before each access    |
| Jobs not resuming           | Deferred jobs stay deferred           | Verify `processDeferred()` reschedules if still paused |
| Memory leak                 | Queue grows unbounded                 | Check max queue size enforcement                       |
| Silent failures             | User gets 202 but job never completes | Log all deferral decisions; check status endpoint      |

---

## Deployment Checklist

- [ ] Code review complete
- [ ] All tests passing (unit + integration + load)
- [ ] No console.log left (use Logger instead)
- [ ] Error handling comprehensive (no unhandled rejections)
- [ ] Monitoring metrics enabled
- [ ] Frontend quota display working
- [ ] Staging deployment successful
- [ ] Production deployment scheduled
- [ ] Monitoring alerts configured
- [ ] Runbook updated for quota issues
- [ ] Team trained on new quota features

---

## Rollback Plan

**If quota management causes issues**:

1. **Disable deferral**: Set `shouldDeferJob()` to always return `{ shouldDefer: false }`
2. **Revert quota tracking**: Comment out `recordCall()` in genieService
3. **Clear deferred queue**: Manually reset job status to 'processing'
4. **Restart server**: Clear in-memory quota state

```bash
# Quick rollback script
git revert <commit-hash>
npm restart
```

---

## Success Metrics

After deployment, verify:

- ✅ 2+ sequential ebooks generate without quota errors
- ✅ Deferred jobs complete after pause expires
- ✅ Frontend shows quota percentage
- ✅ Server logs show deferral decisions
- ✅ No memory growth over 1 hour
- ✅ Response times stable (no hanging requests)
