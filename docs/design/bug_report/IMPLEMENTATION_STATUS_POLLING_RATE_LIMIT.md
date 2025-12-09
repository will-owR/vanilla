# Implementation: Rate-Limit-Aware Status Polling with Exponential Backoff

**Date**: December 9, 2025  
**Related Bug**: [STATUS_POLLING_429_RATE_LIMIT.md](./STATUS_POLLING_429_RATE_LIMIT.md)  
**Related Solution**: [SOLUTION_STATUS_POLLING_RATE_LIMIT.md](./SOLUTION_STATUS_POLLING_RATE_LIMIT.md)  
**Status**: 🔵 IMPLEMENTATION IN PROGRESS  
**Target Branch**: `feat/fix-429-rate-limit-polling`  
**Audience**: Engineers

---

## Executive Summary

This document provides step-by-step implementation instructions for fixing the 429 rate-limit error that occurs during large ebook generation (10+ pages). The fix combines **backend rate-limit transparency** with **frontend resilience patterns** (exponential backoff + circuit breaker).

**Estimated Effort**: 14 hours  
**Complexity**: Medium  
**Risk Level**: Low (non-breaking changes)

---

## Implementation Strategy

### **Chosen Approach**

Based on the solution options, we're implementing:

1. **Backend**: Add rate-limit headers + exclude status endpoint from quota
2. **Frontend**: Exponential backoff poller + circuit breaker + persistent job state
3. **UX**: Show "Processing..." during rate-limiting, not errors

### **Why This Approach**

- ✅ Non-breaking changes to existing API
- ✅ Minimal backend modifications
- ✅ Significant UX improvement
- ✅ Testable in isolation
- ✅ Reversible if needed

---

## Pre-Implementation Checklist

- [ ] Create new branch: `git checkout -b feat/fix-429-rate-limit-polling main`
- [ ] Verify current tests pass: `npm test` (server + client)
- [ ] Document baseline performance metrics
- [ ] Set up test environment with 10+ page requests

---

## Phase 1: Backend Implementation

### Step 1.1: Identify Quota Tracker Implementation

**Action**: Locate the quota tracker to understand current implementation

```bash
grep -r "QuotaTracker" server/ --include="*.js"
grep -r "quotaTracker" server/ --include="*.js"
```

**Expected Files**:

- `server/quotaTracker.js` or similar
- Quota middleware or utility
- Reference in `server/index.js`

**Task**: Document current quota tracking mechanism:

- [ ] Find QuotaTracker class/function
- [ ] Understand `recordCall()` method
- [ ] Understand window rotation logic
- [ ] Locate where quota checks are enforced

### Step 1.2: Add Rate-Limit Headers Middleware

**File**: `server/index.js`

**Location**: Add after all route definitions but before `app.listen()`

```javascript
// Middleware to attach rate-limit headers to all responses
function attachRateLimitHeaders(req, res, next) {
  const quotaTracker = req.app.locals.quotaTracker;

  if (quotaTracker) {
    try {
      const remaining = quotaTracker.getRemainingQuota?.() ?? 0;
      const limit = quotaTracker.getQuotaLimit?.() ?? 20;
      const resetTime = quotaTracker.getWindowResetTime?.() ?? Date.now();

      res.set({
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": Math.max(0, remaining).toString(),
        "X-RateLimit-Reset": Math.ceil(resetTime / 1000).toString(),
      });

      // Add Retry-After if approaching limit
      if (remaining <= 2) {
        const retryAfter = Math.max(
          1,
          Math.ceil((resetTime - Date.now()) / 1000)
        );
        res.set("Retry-After", retryAfter.toString());
      }
    } catch (err) {
      console.warn(
        "[RATE-LIMIT-HEADERS] Error attaching headers:",
        err.message
      );
      // Continue without headers if quota tracker fails
    }
  }

  next();
}

// Apply BEFORE error handlers
app.use(attachRateLimitHeaders);
```

**Verification**:

```bash
# Test that headers are present
curl -i http://localhost:3000/api/ebook/generate/test-id/status | grep "X-RateLimit"
```

### Step 1.3: Exclude Status Endpoint from Quota Counting

**File**: `server/index.js` or `server/quotaTracker.js` (if separate middleware)

**Location**: Before the quota check middleware, add exemption logic

```javascript
// Middleware to skip quota checking for status endpoint
function skipQuotaForStatusEndpoint(req, res, next) {
  // Status checks should not consume quota
  if (req.path.includes("/status") && req.method === "GET") {
    req.skipQuotaCheck = true;
  }
  next();
}

app.use(skipQuotaForStatusEndpoint);

// In your existing quota middleware:
app.use((req, res, next) => {
  if (req.skipQuotaCheck) {
    return next(); // Skip quota check for status endpoint
  }

  // ... existing quota check logic
  quotaTracker.recordCall();
  // ... rest of quota logic
});
```

**Verification**:

- [ ] Status endpoint works without consuming quota
- [ ] Other endpoints still count against quota
- [ ] Test with 20+ rapid status checks (should not fail with 429)

### Step 1.4: Add Job Summary Endpoint (Optional but Recommended)

**File**: `server/index.js`

**Location**: Add new route for lightweight job summaries

```javascript
// GET /api/ebook/generate/:jobId/summary
// Lightweight endpoint for job status without quota counting
app.get("/api/ebook/generate/:jobId/summary", (req, res) => {
  const jobId = req.params.jobId;

  try {
    const job = jobQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: "Job not found",
        jobId,
      });
    }

    // Return minimal state
    res.json({
      jobId: job.id,
      status: job.status, // 'processing', 'completed', 'failed'
      progress: job.progress || 0,
      completedAt: job.completedAt || null,
      error: job.error || null,
      // Don't include full response data here
    });
  } catch (err) {
    console.error("[SUMMARY-ENDPOINT] Error:", err);
    res.status(500).json({ error: "Failed to fetch job summary" });
  }
});
```

**Note**: This endpoint should also skip quota counting (add to `skipQuotaForStatusEndpoint` middleware).

---

## Phase 2: Frontend Implementation

### Step 2.1: Create Rate-Limit-Aware Poller Class

**File**: `client/src/lib/rateLimitPoller.js` (NEW FILE)

```javascript
/**
 * RateLimitAwarePoller
 * Handles polling with exponential backoff and circuit breaker pattern
 * Gracefully recovers from rate-limit (429) responses
 */

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const MAX_RETRIES = 15;
const JITTER_FACTOR = 0.1; // 10% random jitter

export class RateLimitError extends Error {
  constructor(message, backoffMs = INITIAL_BACKOFF_MS) {
    super(message);
    this.name = "RateLimitError";
    this.backoffMs = backoffMs;
    this.retryable = true;
  }
}

export class RateLimitAwarePoller {
  constructor(jobId) {
    this.jobId = jobId;
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.consecutiveRateLimits = 0;
    this.totalAttempts = 0;
    this.circuitBreakerOpen = false;
    this.startTime = Date.now();
  }

  /**
   * Check job status with rate-limit awareness
   */
  async checkStatus() {
    this.totalAttempts++;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`/api/ebook/generate/${this.jobId}/status`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        this.consecutiveRateLimits++;
        return this._handleRateLimit(response);
      }

      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${response.statusText}`);
      }

      // Success: reset counters
      this.consecutiveRateLimits = 0;
      this.backoffMs = INITIAL_BACKOFF_MS;

      const data = await response.json();
      return {
        ok: true,
        data,
        headers: {
          rateLimit: response.headers.get("X-RateLimit-Remaining"),
          resetTime: response.headers.get("X-RateLimit-Reset"),
          retryAfter: response.headers.get("Retry-After"),
        },
      };
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Status check timeout");
      }
      throw error;
    }
  }

  /**
   * Handle 429 rate-limit response
   */
  _handleRateLimit(response) {
    const retryAfterHeader = response.headers.get("Retry-After");

    if (retryAfterHeader) {
      // Use server-provided retry delay
      this.backoffMs = Math.min(
        parseInt(retryAfterHeader) * 1000,
        MAX_BACKOFF_MS
      );
    } else {
      // Exponential backoff with jitter
      const jitter = Math.random() * JITTER_FACTOR * this.backoffMs;
      this.backoffMs = Math.min(this.backoffMs * 1.5 + jitter, MAX_BACKOFF_MS);
    }

    // Open circuit breaker if too many consecutive rate limits
    if (this.consecutiveRateLimits >= MAX_RETRIES) {
      this.circuitBreakerOpen = true;
      throw new Error(
        "Circuit breaker opened: Too many consecutive rate limits. " +
          "Job may have completed. Check manually."
      );
    }

    const error = new RateLimitError(
      `Rate limited (attempt ${this.consecutiveRateLimits}/${MAX_RETRIES}). ` +
        `Retrying in ${Math.round(this.backoffMs / 1000)}s`,
      this.backoffMs
    );

    throw error;
  }

  /**
   * Get current backoff duration in milliseconds
   */
  getBackoffMs() {
    return this.backoffMs;
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitBreakerOpen() {
    return this.circuitBreakerOpen;
  }

  /**
   * Get polling statistics
   */
  getStats() {
    return {
      jobId: this.jobId,
      totalAttempts: this.totalAttempts,
      consecutiveRateLimits: this.consecutiveRateLimits,
      elapsedMs: Date.now() - this.startTime,
      currentBackoffMs: this.backoffMs,
      circuitBreakerOpen: this.circuitBreakerOpen,
    };
  }
}
```

### Step 2.2: Create Job Storage Utility

**File**: `client/src/lib/jobStorage.js` (NEW FILE)

```javascript
/**
 * Job State Persistence
 * Allows recovery from page reloads or temporary disconnects
 */

const JOB_STORAGE_KEY = "aether_ebook_job";
const JOB_STORAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export class JobStorage {
  /**
   * Save job state to localStorage
   */
  static save(jobId, metadata = {}) {
    const jobState = {
      jobId,
      createdAt: Date.now(),
      status: "processing",
      ...metadata,
    };

    localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(jobState));
    console.log("[JobStorage] Saved job state:", jobId);
  }

  /**
   * Retrieve job state from localStorage
   */
  static get() {
    const stored = localStorage.getItem(JOB_STORAGE_KEY);
    if (!stored) return null;

    try {
      const job = JSON.parse(stored);

      // Check expiration
      if (Date.now() - job.createdAt > JOB_STORAGE_EXPIRY) {
        this.clear();
        console.log("[JobStorage] Job state expired, clearing");
        return null;
      }

      return job;
    } catch (err) {
      console.error("[JobStorage] Error parsing stored job:", err);
      this.clear();
      return null;
    }
  }

  /**
   * Clear job state from localStorage
   */
  static clear() {
    localStorage.removeItem(JOB_STORAGE_KEY);
    console.log("[JobStorage] Cleared job state");
  }

  /**
   * Update job state metadata
   */
  static update(metadata) {
    const job = this.get();
    if (job) {
      const updated = { ...job, ...metadata };
      localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(updated));
    }
  }
}

export default JobStorage;
```

### Step 2.3: Update Ebook API Module

**File**: `client/src/lib/ebookApi.js`

**Location**: Update the `checkEbookStatus` function and add polling logic

```javascript
import { RateLimitAwarePoller, RateLimitError } from "./rateLimitPoller.js";
import { JobStorage } from "./jobStorage.js";

// Add this constant at the top
const POLLING_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour max
const MAX_POLLING_ATTEMPTS = 600; // ~10 minutes at 1-second baseline

/**
 * Poll for ebook completion with rate-limit awareness
 * @param {string} jobId - Job ID to poll
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise} Resolved with job data when complete
 */
export async function pollEbookCompletion(jobId, onProgress) {
  const poller = new RateLimitAwarePoller(jobId);
  const startTime = Date.now();

  while (true) {
    try {
      // Check timeout
      if (Date.now() - startTime > POLLING_TIMEOUT_MS) {
        throw new Error("Polling timeout: 1 hour exceeded");
      }

      if (poller.totalAttempts > MAX_POLLING_ATTEMPTS) {
        throw new Error("Polling timeout: Max attempts exceeded");
      }

      // Attempt status check
      const result = await poller.checkStatus();

      if (result.ok) {
        const { status } = result.data;

        if (status === "completed") {
          console.log("[Polling] Job completed:", jobId);
          JobStorage.update({ status: "completed" });
          return result.data.data;
        }

        if (status === "failed") {
          throw new Error(`Job failed: ${result.data.error}`);
        }

        // Still processing - update progress
        if (onProgress) {
          onProgress(result.data.progress || 0, status, result.data);
        }
      }

      // Wait before next poll
      const waitMs = poller.getBackoffMs();
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    } catch (error) {
      if (error instanceof RateLimitError) {
        // Log rate limit but continue polling
        console.warn("[Polling] Rate limited:", error.message);

        if (onProgress) {
          onProgress(undefined, "rate_limited", {
            message: error.message,
            backoffMs: error.backoffMs,
          });
        }

        // Wait with backoff
        await new Promise((resolve) => setTimeout(resolve, error.backoffMs));
        continue; // Don't increment attempt counter for rate limits
      }

      if (poller.isCircuitBreakerOpen()) {
        console.error("[Polling] Circuit breaker opened:", error.message);
        throw new Error(
          "Polling circuit breaker opened. Check job status manually: " +
            `/api/ebook/generate/${jobId}/status`
        );
      }

      // Other errors are fatal
      throw error;
    }
  }
}

/**
 * Check current job status (single check, not polling)
 * @param {string} jobId - Job ID
 * @returns {Promise} Job status
 */
export async function checkEbookStatus(jobId) {
  try {
    const response = await fetch(`/api/ebook/generate/${jobId}/status`, {
      timeout: 5000,
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[API] Status check error:", error);
    throw error;
  }
}

// Export existing functions unchanged
export { fetchWithTimeout } from "./ebookApi.js";
```

### Step 2.4: Update Ebook Store

**File**: `client/src/stores/ebookStore.js`

**Location**: Update the generate function to use new polling

```javascript
// ... existing imports
import { pollEbookCompletion } from "../lib/ebookApi.js";
import { JobStorage } from "../lib/jobStorage.js";

// In your generate() or equivalent function:

export const ebookStore = writable({
  // ... existing state
  generationState: null, // 'idle', 'processing', 'rate_limited', 'completed', 'failed'
  pollingStats: null,
});

export const generate = async (prompt, options) => {
  try {
    ebookStore.set({
      generationState: "processing",
      error: null,
    });

    // Step 1: Request generation
    const response = await fetch("/api/ebook/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        theme: options.theme,
        pageCount: options.pageCount,
        colorPalette: options.colorPalette,
      }),
    });

    if (!response.ok) {
      throw new Error(`Generation request failed: ${response.status}`);
    }

    const { jobId } = await response.json();
    console.log("[Store] Job created:", jobId);

    // Save job state for recovery
    JobStorage.save(jobId, {
      prompt,
      options,
      requestedAt: new Date().toISOString(),
    });

    // Step 2: Poll for completion
    const result = await pollEbookCompletion(
      jobId,
      (progress, status, data) => {
        if (status === "rate_limited") {
          console.warn("[Store] Rate limited, waiting...");
          ebookStore.update((store) => ({
            ...store,
            generationState: "rate_limited",
            pollingMessage: data.message,
          }));
        } else {
          ebookStore.update((store) => ({
            ...store,
            generationState: "processing",
            progress: progress || 0,
          }));
        }
      }
    );

    // Step 3: Success
    ebookStore.update((store) => ({
      ...store,
      generationState: "completed",
      data: result,
      progress: 100,
    }));

    JobStorage.clear();
    return result;
  } catch (error) {
    console.error("[Store] Generation error:", error);
    ebookStore.update((store) => ({
      ...store,
      generationState: "failed",
      error: error.message,
    }));
    throw error;
  }
};
```

### Step 2.5: Update UI Components

**File**: `client/src/components/EbookGenerator.svelte` (or equivalent)

**Changes**: Add rate-limit awareness to progress display

```svelte
<script>
  import { ebookStore, generate } from '../stores/ebookStore.js';

  let isProcessing = false;
  let progress = 0;
  let statusMessage = '';

  async function handleGenerate() {
    isProcessing = true;
    statusMessage = 'Generating...';

    try {
      const result = await generate(prompt, {
        theme,
        pageCount,
        colorPalette
      });

      generatedEbook = result;
      statusMessage = 'Complete!';
      isProcessing = false;

    } catch (error) {
      statusMessage = `Error: ${error.message}`;
      isProcessing = false;
    }
  }

  $: {
    const store = $ebookStore;
    if (store) {
      isProcessing = store.generationState === 'processing' ||
                     store.generationState === 'rate_limited';
      progress = store.progress || 0;

      if (store.generationState === 'rate_limited') {
        statusMessage = '⏳ Rate-limited. Waiting to resume...';
      } else if (store.generationState === 'processing') {
        statusMessage = `Processing... ${Math.round(progress)}%`;
      } else if (store.generationState === 'completed') {
        statusMessage = 'Complete!';
      } else if (store.generationState === 'failed') {
        statusMessage = `Error: ${store.error}`;
      }
    }
  }
</script>

<div class="ebook-generator">
  <!-- ... existing form elements ... -->

  {#if isProcessing}
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
      <p class="status-message">
        {#if statusMessage.includes('Rate-limited')}
          <span class="icon">⏳</span>
        {:else if statusMessage.includes('Error')}
          <span class="icon">❌</span>
        {:else}
          <span class="icon spinner">⚙️</span>
        {/if}
        {statusMessage}
      </p>
    </div>
  {/if}

  {#if $ebookStore?.error && !isProcessing}
    <div class="error-banner">
      <p>{$ebookStore.error}</p>
      <p class="help-text">
        If the issue persists, you can check the job status manually using the job ID.
      </p>
    </div>
  {/if}
</div>

<style>
  .progress-container {
    margin: 2rem 0;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #eee;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4CAF50, #45a049);
    transition: width 0.3s ease;
  }

  .status-message {
    margin-top: 1rem;
    font-size: 0.95rem;
    color: #666;
  }

  .icon.spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-banner {
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    padding: 1rem;
    margin: 1rem 0;
  }

  .error-banner .help-text {
    font-size: 0.85rem;
    color: #c33;
    margin-top: 0.5rem;
  }
</style>
```

---

## Phase 3: Testing

### Step 3.1: Unit Tests

**File**: `client/__tests__/rateLimitPoller.test.js` (NEW FILE)

```javascript
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RateLimitAwarePoller,
  RateLimitError,
} from "../src/lib/rateLimitPoller.js";

describe("RateLimitAwarePoller", () => {
  let poller;

  beforeEach(() => {
    poller = new RateLimitAwarePoller("test-job-id");
  });

  describe("initialization", () => {
    it("should initialize with correct default values", () => {
      expect(poller.jobId).toBe("test-job-id");
      expect(poller.backoffMs).toBe(1000);
      expect(poller.consecutiveRateLimits).toBe(0);
      expect(poller.circuitBreakerOpen).toBe(false);
    });
  });

  describe("rate limit handling", () => {
    it("should throw RateLimitError on 429 response", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(
          new Response(null, {
            status: 429,
            headers: new Headers({
              "Retry-After": "2",
            }),
          })
        )
      );

      try {
        await poller.checkStatus();
        expect.fail("Should have thrown RateLimitError");
      } catch (error) {
        expect(error instanceof RateLimitError).toBe(true);
        expect(error.retryable).toBe(true);
      }
    });

    it("should respect Retry-After header", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(
          new Response(null, {
            status: 429,
            headers: new Headers({ "Retry-After": "5" }),
          })
        )
      );

      try {
        await poller.checkStatus();
      } catch (error) {
        expect(error.backoffMs).toBe(5000);
      }
    });

    it("should implement exponential backoff without header", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(new Response(null, { status: 429 }))
      );

      const initialBackoff = poller.backoffMs;

      try {
        await poller.checkStatus();
      } catch (error) {
        expect(error.backoffMs).toBeGreaterThan(initialBackoff);
        expect(error.backoffMs).toBeLessThanOrEqual(1500); // 1000 * 1.5
      }
    });
  });

  describe("circuit breaker", () => {
    it("should open circuit breaker after max retries", async () => {
      poller.consecutiveRateLimits = 15;

      global.fetch = vi.fn(() =>
        Promise.resolve(new Response(null, { status: 429 }))
      );

      try {
        await poller.checkStatus();
      } catch (error) {
        expect(error.message).toContain("Circuit breaker");
        expect(poller.isCircuitBreakerOpen()).toBe(true);
      }
    });
  });

  describe("successful responses", () => {
    it("should reset backoff on successful response", async () => {
      poller.backoffMs = 10000;
      poller.consecutiveRateLimits = 5;

      global.fetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ status: "processing", progress: 50 }), {
            status: 200,
          })
        )
      );

      const result = await poller.checkStatus();

      expect(result.ok).toBe(true);
      expect(poller.backoffMs).toBe(1000); // Reset
      expect(poller.consecutiveRateLimits).toBe(0); // Reset
    });
  });
});
```

### Step 3.2: Integration Tests

**File**: `scripts/test-rate-limit-polling.js` (NEW FILE)

```javascript
#!/usr/bin/env node

/**
 * Integration test for rate-limit-aware polling
 * Generates a 10-page ebook and verifies graceful handling of rate limits
 */

const http = require("http");

const TEST_CONFIG = {
  prompt: "An epic fantasy quest with ten distinct adventures",
  pageCount: 10,
  theme: "light",
  serverUrl: "http://localhost:3000",
  pollInterval: 2000,
  maxDuration: 5 * 60 * 1000, // 5 minutes
};

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(TEST_CONFIG.serverUrl + path);
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null,
        });
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log("=".repeat(60));
  console.log("RATE-LIMIT POLLING TEST");
  console.log("=".repeat(60));

  try {
    // Step 1: Request generation
    console.log("\n1. Requesting ebook generation...");
    const genResponse = await makeRequest("POST", "/api/ebook/generate", {
      prompt: TEST_CONFIG.prompt,
      pageCount: TEST_CONFIG.pageCount,
      theme: TEST_CONFIG.theme,
    });

    if (genResponse.status !== 202) {
      throw new Error(`Expected 202, got ${genResponse.status}`);
    }

    const { jobId } = genResponse.body;
    console.log(`   ✓ Job created: ${jobId}`);
    console.log(
      `   ✓ Rate-Limit headers: ${genResponse.headers["x-ratelimit-limit"]}`
    );

    // Step 2: Poll with rate-limit awareness
    console.log("\n2. Polling job status with rate-limit handling...");
    const startTime = Date.now();
    let rateLimitCount = 0;
    let lastStatus = null;

    while (Date.now() - startTime < TEST_CONFIG.maxDuration) {
      const statusResponse = await makeRequest(
        "GET",
        `/api/ebook/generate/${jobId}/status`
      );

      // Check for rate limit
      if (statusResponse.status === 429) {
        rateLimitCount++;
        const retryAfter = statusResponse.headers["retry-after"] || "2";
        console.log(
          `   ⏳ Rate limited (${rateLimitCount}). Retry after ${retryAfter}s`
        );
        await new Promise((r) => setTimeout(r, parseInt(retryAfter) * 1000));
        continue;
      }

      if (statusResponse.status !== 200) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      lastStatus = statusResponse.body;
      const { status, progress } = lastStatus;

      console.log(`   ✓ Status: ${status}, Progress: ${progress || 0}%`);

      if (status === "completed") {
        console.log(`\n3. Generation complete!`);
        console.log(`   ✓ Total rate limits encountered: ${rateLimitCount}`);
        console.log(
          `   ✓ Duration: ${Math.round((Date.now() - startTime) / 1000)}s`
        );
        console.log(
          `   ✓ HTML size: ${
            lastStatus.data ? lastStatus.data.length : "N/A"
          } bytes`
        );

        console.log("\n" + "=".repeat(60));
        console.log("TEST PASSED ✓");
        console.log("=".repeat(60));
        process.exit(0);
      }

      await new Promise((r) => setTimeout(r, TEST_CONFIG.pollInterval));
    }

    throw new Error("Test timeout: Job did not complete in time");
  } catch (error) {
    console.error("\n❌ TEST FAILED");
    console.error("Error:", error.message);
    console.error("=".repeat(60));
    process.exit(1);
  }
}

runTest();
```

**Run the test**:

```bash
node scripts/test-rate-limit-polling.js
```

---

## Phase 4: Validation & Merge

### Step 4.1: Pre-Merge Checklist

- [ ] All unit tests pass: `npm test` (client)
- [ ] All unit tests pass: `npm test` (server)
- [ ] Integration test passes: `node scripts/test-rate-limit-polling.js`
- [ ] Manual testing with 10+ page request successful
- [ ] No console errors or warnings
- [ ] Rate-limit headers present in responses
- [ ] Status endpoint excludes quota counting
- [ ] UI shows "Processing..." during 429s (not error)
- [ ] Job state persists to localStorage
- [ ] Circuit breaker activates after 15 consecutive 429s

### Step 4.2: Performance Metrics

Before merging, document:

```
Baseline (before fix):
- 10-page request: 429 error at ~120s mark
- User sees error, even though job completes
- No recovery mechanism

After fix:
- 10-page request: Completes successfully (~175s)
- User sees "Processing..." during rate limits
- Automatic recovery with exponential backoff
- Job state recoverable from localStorage
```

### Step 4.3: Merge to Main

```bash
# Ensure all tests pass
npm test

# Create pull request
git push origin feat/fix-429-rate-limit-polling

# On GitHub: Create PR with reference to bug report
# Title: "Fix: Handle 429 rate limits gracefully during large ebook generation"
# Description: See STATUS_POLLING_429_RATE_LIMIT.md
```

---

## Rollback Plan

If critical issues occur post-merge:

1. **Immediate**: Revert the commit

   ```bash
   git revert <commit-hash>
   ```

2. **Root cause analysis**: Check error logs for specific failures

3. **Targeted fix**: If minor issue, create hotfix PR

4. **Testing**: Re-run full test suite before attempting merge again

---

## Monitoring Post-Deployment

After deployment, monitor:

1. **Rate limit events**: Track frequency and duration
2. **Polling success rate**: Should be 99%+
3. **Circuit breaker activations**: Should be rare (<1%)
4. **User feedback**: Watch for continued 429 complaints

---

## References

- Bug Report: [STATUS_POLLING_429_RATE_LIMIT.md](./STATUS_POLLING_429_RATE_LIMIT.md)
- Solution Document: [SOLUTION_STATUS_POLLING_RATE_LIMIT.md](./SOLUTION_STATUS_POLLING_RATE_LIMIT.md)
- Related Files (to be modified):
  - `server/index.js`
  - `client/src/lib/ebookApi.js`
  - `client/src/stores/ebookStore.js`
  - `client/src/components/EbookGenerator.svelte`
