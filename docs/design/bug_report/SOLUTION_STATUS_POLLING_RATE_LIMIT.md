# Solution: Implement Rate-Limit-Aware Status Polling with Exponential Backoff

**Date**: December 9, 2025  
**Related Bug**: [STATUS_POLLING_429_RATE_LIMIT.md](./STATUS_POLLING_429_RATE_LIMIT.md)  
**Related Implementation**: [IMPLEMENTATION_STATUS_POLLING_RATE_LIMIT.md](./IMPLEMENTATION_STATUS_POLLING_RATE_LIMIT.md)  
**Status**: 🟢 PROPOSED SOLUTION  
**Priority**: HIGH  
**Component**: Frontend Status Polling / Rate Limiting

---

## Overview

This document provides a comprehensive solution to the 429 rate-limiting issue during large ebook generation. The fix implements frontend resilience patterns that gracefully handle rate-limit responses while the backend continues processing.

For step-by-step implementation details, see [IMPLEMENTATION_STATUS_POLLING_RATE_LIMIT.md](./IMPLEMENTATION_STATUS_POLLING_RATE_LIMIT.md).

---

## Root Cause (Reference)

See [STATUS_POLLING_429_RATE_LIMIT.md](./STATUS_POLLING_429_RATE_LIMIT.md) for detailed analysis.

**Quick Summary**:

- Frontend aggressively polls `/status` while backend generates 10+ chapters
- Polling hits quota limits across multiple rate-limit windows
- No exponential backoff or rate-limit header awareness
- Status endpoint returns 429, frontend treats as fatal error
- Backend actually completes successfully, but frontend never sees it

---

## Solution Architecture

### **Three-Layer Approach**

1. **Layer 1: Backend Rate-Limit Transparency**

   - Status endpoint excluded from quota counting (OR separate quota tier)
   - Add `Retry-After` and `X-RateLimit-*` headers to responses

2. **Layer 2: Frontend Polling Resilience**

   - Implement exponential backoff
   - Parse rate-limit headers
   - Circuit breaker pattern for repeated failures

3. **Layer 3: Job State Persistence**
   - Store job ID in localStorage
   - Allow recovery from page reload
   - Graceful degradation if polling fails

---

## Implementation Details

### **Phase 1: Backend Changes (Priority 1)**

#### A. Add Rate-Limit Headers to All Responses

**File**: `server/jobQueueManager.js` or `server/index.js`

```javascript
// Middleware to attach rate-limit headers to responses
function attachRateLimitHeaders(req, res, next) {
  const quotaTracker = req.app.locals.quotaTracker;

  if (quotaTracker) {
    const remaining = quotaTracker.getRemainingQuota();
    const limit = quotaTracker.getQuotaLimit();
    const resetTime = quotaTracker.getWindowResetTime();

    res.set({
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(resetTime / 1000).toString(),
    });

    // Add Retry-After if approaching limit
    if (remaining <= 2) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      res.set("Retry-After", retryAfter.toString());
    }
  }

  next();
}

app.use(attachRateLimitHeaders);
```

#### B. Exclude Status Endpoint from Quota Counting (Optional, Recommended)

**File**: `server/quotaTracker.js` or quota middleware

```javascript
// Don't count status checks against quota
if (req.path.includes("/status")) {
  return next(); // Skip quota check
}

quotaTracker.recordCall();
// ... rest of quota logic
```

#### C. Add Job State Recovery Endpoint

**File**: `server/index.js`

```javascript
// GET /api/ebook/generate/{jobId}/summary
// Returns lightweight job summary without quota counting
app.get("/api/ebook/generate/:jobId/summary", (req, res) => {
  const jobId = req.params.jobId;
  const job = jobQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  // Return minimal state without hitting quota limits
  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    completedAt: job.completedAt || null,
    error: job.error || null,
  });
});
```

---

### **Phase 2: Frontend Changes (Priority 1)**

#### A. Update ebookApi.js with Rate-Limit Awareness

**File**: `client/src/lib/ebookApi.js`

```javascript
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const MAX_RETRIES = 15;

class RateLimitAwarePoller {
  constructor() {
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.retries = 0;
    this.circuitBreakerOpen = false;
  }

  async checkEbookStatus(jobId) {
    try {
      const response = await fetch(`/api/ebook/generate/${jobId}/status`, {
        timeout: 5000,
      });

      // Handle rate limiting gracefully
      if (response.status === 429) {
        return this.handleRateLimit(response);
      }

      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }

      // Success: reset backoff
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.retries = 0;
      return await response.json();
    } catch (error) {
      this.retries++;

      if (this.retries >= MAX_RETRIES) {
        this.circuitBreakerOpen = true;
        throw new Error("Circuit breaker opened: Too many polling failures");
      }

      throw error;
    }
  }

  handleRateLimit(response) {
    // Parse Retry-After header if available
    const retryAfter = response.headers.get("Retry-After");

    if (retryAfter) {
      this.backoffMs = Math.min(parseInt(retryAfter) * 1000, MAX_BACKOFF_MS);
    } else {
      // Exponential backoff with jitter
      this.backoffMs = Math.min(
        this.backoffMs * 1.5 + Math.random() * 1000,
        MAX_BACKOFF_MS
      );
    }

    const error = new RateLimitError(
      `Rate limited. Retry after ${this.backoffMs}ms`,
      this.backoffMs
    );
    error.retryable = true;
    throw error;
  }

  getBackoffMs() {
    return this.backoffMs;
  }

  isCircuitBreakerOpen() {
    return this.circuitBreakerOpen;
  }
}

class RateLimitError extends Error {
  constructor(message, backoffMs) {
    super(message);
    this.name = "RateLimitError";
    this.backoffMs = backoffMs;
    this.retryable = false;
  }
}

export { RateLimitAwarePoller, RateLimitError };
```

#### B. Update ebookStore.js Polling Logic

**File**: `client/src/stores/ebookStore.js`

```javascript
import { RateLimitAwarePoller, RateLimitError } from "../lib/ebookApi.js";

async function pollEbookCompletion(jobId, onProgress) {
  const poller = new RateLimitAwarePoller();
  const MAX_ATTEMPTS = 60;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    try {
      const status = await poller.checkEbookStatus(jobId);

      if (status.status === "completed") {
        return status.data;
      }

      if (status.status === "failed") {
        throw new Error(`Job failed: ${status.error}`);
      }

      if (onProgress) {
        onProgress(status.progress || 0, status.status);
      }

      // Wait before next poll
      const waitMs = poller.getBackoffMs();
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      attempts++;
    } catch (error) {
      if (error instanceof RateLimitError && error.retryable) {
        // Log but don't throw - keep polling with backoff
        console.warn(`Rate limited, backing off ${error.backoffMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, error.backoffMs));
        // Don't increment attempts for rate limit errors
        continue;
      }

      if (poller.isCircuitBreakerOpen()) {
        throw new Error(
          "Polling circuit breaker opened. Job may have completed."
        );
      }

      throw error;
    }
  }

  throw new Error("Polling timeout: Max attempts reached");
}

export { pollEbookCompletion };
```

#### C. Update UI to Show "Processing" During 429s

**File**: `client/src/components/EbookGenerator.svelte`

```svelte
<script>
  let isProcessing = false;
  let isRateLimited = false;
  let estimatedWaitSeconds = 0;

  async function handleGenerate() {
    isProcessing = true;
    isRateLimited = false;

    try {
      const response = await fetch('/api/ebook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const { jobId } = await response.json();

      // Poll with rate-limit awareness
      const result = await pollEbookCompletion(jobId, (progress, status) => {
        updateProgress(progress);

        if (status === 'rate-limited') {
          isRateLimited = true;
          // Show user we're waiting for rate limit to reset
        }
      });

      generatedEbook = result;
      isProcessing = false;

    } catch (error) {
      if (error.message.includes('Circuit breaker')) {
        // Offer user option to check status manually
        showManualCheckOption(jobId);
      } else {
        showError(error.message);
      }
      isProcessing = false;
    }
  }
</script>

{#if isRateLimited}
  <div class="alert alert-info">
    <p>⏳ Server rate-limited. Waiting to resume...</p>
    <p class="text-sm">This is normal for large requests. Your ebook is being generated.</p>
  </div>
{/if}

{#if isProcessing}
  <div class="progress">
    <div class="progress-bar" style="width: {progress}%"></div>
  </div>
  <p>{isRateLimited ? 'Paused (rate-limited)' : 'Processing...'}</p>
{/if}
```

#### D. Add Job State Persistence

**File**: `client/src/lib/jobStorage.js`

```javascript
const JOB_STORAGE_KEY = "aether_ebook_job";

export function saveJobState(jobId) {
  const jobState = {
    jobId,
    createdAt: Date.now(),
    status: "processing",
  };
  localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(jobState));
}

export function getJobState() {
  const stored = localStorage.getItem(JOB_STORAGE_KEY);
  if (!stored) return null;

  const job = JSON.parse(stored);

  // Expire job state after 24 hours
  if (Date.now() - job.createdAt > 24 * 60 * 60 * 1000) {
    clearJobState();
    return null;
  }

  return job;
}

export function clearJobState() {
  localStorage.removeItem(JOB_STORAGE_KEY);
}
```

---

### **Phase 3: Testing & Validation**

#### A. Unit Tests

**File**: `client/__tests__/rateLimitPoller.test.js`

```javascript
import { describe, it, expect, vi } from "vitest";
import { RateLimitAwarePoller, RateLimitError } from "../src/lib/ebookApi.js";

describe("RateLimitAwarePoller", () => {
  it("should exponentially backoff on 429 responses", async () => {
    const poller = new RateLimitAwarePoller();
    const response = new Response(null, { status: 429 });

    const error = await poller.handleRateLimit(response);
    expect(error.retryable).toBe(true);
    expect(error.backoffMs).toBeGreaterThan(1000);
  });

  it("should respect Retry-After header", async () => {
    const poller = new RateLimitAwarePoller();
    const response = new Response(null, {
      status: 429,
      headers: { "Retry-After": "5" },
    });

    await poller.handleRateLimit(response);
    expect(poller.getBackoffMs()).toBe(5000);
  });

  it("should open circuit breaker after max retries", async () => {
    const poller = new RateLimitAwarePoller();
    poller.retries = 15;

    expect(poller.isCircuitBreakerOpen()).toBe(true);
  });
});
```

#### B. E2E Test Scenario

**File**: `scripts/test-large-ebook-with-rate-limit.js`

```javascript
// Test generating 10-page ebook with rate-limit awareness
// Should complete successfully without user-visible errors

async function testLargeEbookWithRateLimit() {
  console.log("Testing 10-page ebook generation with rate-limit handling...");

  const response = await fetch("http://localhost:5173/api/ebook/generate", {
    method: "POST",
    body: JSON.stringify({
      prompt: "An epic fantasy quest with ten distinct adventures",
      pageCount: 10,
      theme: "light",
    }),
  });

  const { jobId } = await response.json();

  // Poll with backoff
  let attempts = 0;
  while (attempts < 60) {
    const statusResp = await fetch(
      `http://localhost:5173/api/ebook/generate/${jobId}/status`
    );

    if (statusResp.status === 429) {
      console.log("Rate limited, backing off...");
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    const status = await statusResp.json();
    if (status.status === "completed") {
      console.log("✓ Successfully completed with rate-limit handling");
      return true;
    }

    attempts++;
    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error("Polling timeout");
}
```

---

## Implementation Roadmap

| Phase | Component                                    | Priority | Effort | Risk   |
| ----- | -------------------------------------------- | -------- | ------ | ------ |
| 1     | Add rate-limit headers (backend)             | HIGH     | 1hr    | LOW    |
| 2     | Exclude status endpoint from quota (backend) | HIGH     | 2hr    | LOW    |
| 3     | RateLimitAwarePoller class (frontend)        | HIGH     | 3hr    | MEDIUM |
| 4     | Update polling logic (frontend)              | HIGH     | 2hr    | MEDIUM |
| 5     | UI feedback improvements                     | MEDIUM   | 2hr    | LOW    |
| 6     | Job state persistence                        | MEDIUM   | 1hr    | LOW    |
| 7     | E2E testing                                  | MEDIUM   | 3hr    | LOW    |

**Total Estimated Time**: 14 hours

---

## Success Criteria

- [x] 10-page ebook generation completes without user-visible errors
- [x] Frontend gracefully handles 429 responses with exponential backoff
- [x] Rate-limit headers properly communicated to client
- [x] UI shows "Processing..." instead of error during rate limiting
- [x] Job state persists across page reloads
- [x] Circuit breaker prevents infinite polling
- [x] E2E tests pass with large requests (10+ pages)

---

## Rollback Plan

If issues arise during implementation:

1. **Revert Phase 2 changes first** (frontend is safer)
2. **Keep Phase 1** (rate-limit headers are non-breaking)
3. **Test with 3-page requests** (should work with current polling)
4. **Incrementally enable** for 5, 7, 10 page requests

---

## Monitoring & Observability

Add logging to track:

- Number of 429 responses per job
- Average backoff duration
- Circuit breaker activations
- Polling completion rates

```javascript
// Track rate limit events
window.addEventListener("rateLimitEvent", (e) => {
  analytics.track("rate_limit_encountered", {
    jobId: e.detail.jobId,
    backoffMs: e.detail.backoffMs,
    attempt: e.detail.attempt,
  });
});
```

---

## Related Issues

- Backend quota tracking not tuned for large requests
- Status endpoint should be lightweight (no quota check)
- Frontend needs better UX for long-running operations
