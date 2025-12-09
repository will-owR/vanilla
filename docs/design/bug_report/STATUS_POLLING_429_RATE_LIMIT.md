# Bug Report: Frontend Polling Returns 429 Rate Limit During Large Ebook Generation

**Date**: December 9, 2025  
**Status**: 🟡 CRITICAL - User-facing error on 10+ page requests  
**Severity**: HIGH  
**Component**: Frontend → Backend Status Polling / Rate Limiting  
**Solution**: [SOLUTION_STATUS_POLLING_RATE_LIMIT.md](./SOLUTION_STATUS_POLLING_RATE_LIMIT.md)  
**Implementation**: [IMPLEMENTATION_STATUS_POLLING_RATE_LIMIT.md](./IMPLEMENTATION_STATUS_POLLING_RATE_LIMIT.md)

---

## Summary

When generating large ebooks (10+ pages), the frontend receives **`Error: API error 429`** during status polling, preventing users from seeing successful completion even though the **backend successfully completes the entire generation**.

This is a **frontend resilience issue**: the status polling endpoint hits rate limits while the server is actively generating content, returning 429 responses to the client. The job actually finishes successfully server-side, but the frontend never receives confirmation due to unhandled rate-limiting.

**Critical Discovery**: The job completes in 174.9 seconds with all 10 chapters and HTML generated (56.8KB), but the frontend error fires because the `/status` endpoint returned 429 during polling.

---

## Reproduction Steps

### Preconditions

- ✅ Server running with `USE_REAL_AI=1`
- ✅ Frontend running (Vite dev server)
- ✅ Gemini API credentials active
- ✅ Recent requests consumed some quota (within same window)

### Steps

1. Open browser: `http://localhost:5173`
2. Navigate to eBook generation UI
3. Enter test prompt: "An epic fantasy quest with ten distinct adventures, challenges, and triumphs, each more intense than the last."
4. Select theme: "light"
5. Set pageCount: **10** (or higher)
6. Click "Generate"

### Expected Behavior

- Request sent to backend (202 Accepted)
- Backend generates all 10 chapters (~175 seconds)
- Frontend polls `/status` endpoint while waiting
- Upon completion, frontend displays generated ebook

### Actual Behavior

- Request sent (202 Accepted received) ✓
- Backend successfully generates all chapters ✓
- Frontend polls `/status` endpoint ✓
- **During chapter 8 generation, `/status` returns HTTP 429** ✗
- Frontend throws error: `Error: API error 429`
- User sees error page, generation actually completes server-side

### Server Log Evidence

```
[1] GET /api/ebook/generate/0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1/status 429 0.492 ms - 42
[1] [EBOOK] Chapter 8/10: AI response received in 20206ms
[1] [EBOOK] Chapter 9/10: Starting generation...
[1] [EBOOK] Chapter 10/10: Starting generation...
[1] [EBOOK] Chapter generation complete, total chapters: 10
[1] [COMPOSE] HTML generation complete, length: 56851
[1] [JobQueue] 0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1 completed in 174947ms
```

---

## Root Cause Analysis

### **Why It Happens**

1. **Quota Window Exhaustion**: Large requests consume quota across multiple windows

   - Window 1: Calls 0-3 (4 used)
   - Window 2: Calls 4-7 (4 used)
   - Window 3: Calls 8-10 (3 used) ← Status polling hits limit here

2. **Aggressive Polling**: Frontend polls `/status` frequently while backend is still generating

   - No exponential backoff
   - No rate-limit header awareness
   - No circuit breaker pattern

3. **No Pre-check Before Polling**: Frontend doesn't query quota before attempting status check

4. **Rate Limit Applied to Status Endpoint**: The quota limiter is applied broadly, affecting both generation and status queries

### **Request Scope**

- Topic: Epic fantasy quest (10 chapters)
- Duration: 174.9 seconds
- Total API calls: 11 (1 structure + 10 chapters)
- HTML output: 56,851 bytes
- Title mismatch detected (Prompt vs. "The Sundered Realm: A Quest for Unity")

---

## Frontend Error Stack

```javascript
Error: API error 429:
    at fetchWithTimeout (ebookApi.js:52:13)
    at async checkEbookStatus (ebookApi.js:131:18)
    at async Module.pollEbookCompletion (ebookApi.js:191:22)
    at async Object.generate (ebookStore.js:146:26)

[EBOOK] Generation error: Error: API error 429:
```

---

## Impact

- **User Experience**: Users see error message on successful requests
- **Trust**: Confusing UX where "error" was actually a success
- **Large Requests**: Affects any 10+ page ebook generation
- **Data Loss**: No persistence of job state after error; user must retry

---

## Temporary Workarounds

1. **Check job status manually**: Direct URL to `/api/ebook/generate/{jobId}`
2. **Generate smaller ebooks**: 3-5 pages less likely to hit quota limits
3. **Wait longer between requests**: Allow quota window to reset

---

## Required Fixes

### **Priority 1: Frontend Resilience**

- [ ] Implement exponential backoff in polling
- [ ] Parse `Retry-After` headers from 429 responses
- [ ] Add circuit breaker pattern (stop polling after N failures)
- [ ] Store job ID in localStorage for recovery

### **Priority 2: Rate Limit Strategy**

- [ ] Exclude `/status` endpoint from quota counting
- [ ] Or: Implement separate rate limiter for status checks
- [ ] Add rate-limit headers (X-RateLimit-Remaining, Retry-After)

### **Priority 3: Better Error Handling**

- [ ] Detect 429 responses in polling and retry with backoff
- [ ] Show "Processing..." instead of error on 429
- [ ] Poll at longer intervals during active generation

---

## Reference Data

See: `/docs/design/ebookService/DATA/Light_10-page.md` for full server logs and detailed analysis.

**Key Metrics from Test Case:**

- Chapters: 10
- Generation Time: 174.9s
- HTML Size: 56,851 bytes
- Theme: light, Density: medium
- Status Error Point: During chapter 8 (at ~120s mark)
