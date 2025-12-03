# Bug Report: 504 Gateway Timeout on Long Ebook Generation

**Date**: December 3, 2025  
**Status**: 🔴 OPEN - High Priority  
**Severity**: HIGH  
**Component**: Client-Server Response Pipeline  
**Browser**: Codespaces Web Client  
**Branch**: `feat/B_Frontend_option2`

---

## Executive Summary

When requesting a 20-page ebook with batch optimization enabled, the server successfully generates the complete response (63,684 bytes) in 139.5 seconds, but the browser receives a **504 Gateway Timeout** with zero content after ~101 seconds of waiting.

**Impact**: Users cannot generate ebooks requiring >100 seconds. Expected 20-page latency: ~60-70 seconds (with batch optimization). Current reality: timeout before completion.

---

## Problem Description

### What Happens

**Request Timeline**:

| Time                 | Component | Event                                    |
| -------------------- | --------- | ---------------------------------------- |
| 10:11:11.604         | Browser   | Fetch initiated to `/api/ebook/generate` |
| 10:12:52.244         | Browser   | Response received with **Status: 504**   |
| ~101 seconds elapsed | Network   | Connection terminated by proxy/gateway   |
| 0 bytes              | Response  | Content-Length header shows 0.00KB       |

**Server Timeline** (from logs):

| Time          | Event                                             |
| ------------- | ------------------------------------------------- |
| 15:11:12.047Z | POST /api/ebook/generate started                  |
| 15:11:12.047Z | Calling genieService.process() with pageCount=20  |
| 15:13:31.565Z | genieService.process() completed in **139,518ms** |
| 15:13:31.566Z | Response serialized: **63,684 bytes**             |
| 15:13:31.567Z | Sending response to client                        |

**The Gap**: Server sends 200 OK with full response after 139.5 seconds, but proxy/gateway times out after ~101 seconds and returns 504 to client.

### Browser Console Error

```
10:11:11.604 [API] Starting fetch to /ebook/generate ebookApi.js:28:13
10:12:52.244 [API] Response received - Status: 504, Content-Type: null ebookApi.js:36:13
10:12:52.245 [API] Content-Length header: 0.00KB ebookApi.js:43:15
10:12:52.251 [API] Error: Error: API error 504:
    fetchWithTimeout ebookApi.js:52
ebookApi.js:97:13
    fetchWithTimeout ebookApi.js:97
10:12:52.262 Uncaught (in promise) Error: API error 504
```

---

## Reproduction Steps

1. Open browser and navigate to `/generate` page
2. Enter prompt: "A children's magical tale about the Spoon Who Wanted a Hug"
3. Set pageCount: **20**
4. Set theme: light
5. Click "Generate"
6. Wait ~101 seconds
7. Observe: Error message "API error 504:"
8. Check browser Network tab: Status 504, no response body

**Expected Result**: Ebook generates in 60-70 seconds with batch optimization active  
**Actual Result**: 504 error after 101 seconds of waiting

---

## Root Cause Analysis

### Timeout Mechanism

The 504 error indicates a **gateway/proxy timeout**, not a server error. Codespaces (or the proxy layer between browser and server) has a timeout limit of approximately **100-120 seconds**.

```
Browser Request
    ↓
[Codespaces/Proxy Layer - Timeout ~100-120s]
    ↓
Server (takes 139.5s to respond)
    ↓
Proxy: "Request still pending after 101s. Timeout."
Proxy: "Close connection. Return 504 to client."
    ↓
Browser: Receives 504 with empty body
```

### Why This Is Happening Now

1. **Batch optimization enabled**: Request now triggers full generation pipeline
2. **20-page ebook**: Large enough to require substantial processing
3. **Rate limiting**: 6-second minimum between API calls (Gemini constraint)
4. **Total latency**: Structure (1 call) + Page 1 (1 call) + Batches (multiple calls) + HTML compose = 139.5 seconds
5. **Proxy timeout**: Codespaces proxy kills connection at ~101 seconds
6. **No fallback**: Client expects response but gets nothing

### Why Server Logs Show 200 OK

The server logs show a 200 response code, but that's from the server's perspective. The proxy intercepts the response after the server sends it and blocks it from reaching the client, returning 504 instead.

---

## Impact Assessment

### User Experience

- ✅ Server generates correct content (verified in logs)
- ✅ Batch optimization working (verified: "Using Stage 1 optimization")
- ❌ User sees error instead of result
- ❌ No retry mechanism
- ❌ No indication that generation succeeded server-side

### Scope of Affected Users

- **Affected**: Ebook requests requiring >100 seconds of processing
  - 15+ page ebooks with batch optimization
  - 20+ page ebooks (tested case)
  - Complex prompts requiring longer generation
- **Not Affected**: Ebooks generating in <100 seconds

### Business Impact

- Cannot generate long-form ebooks
- Batch optimization feature appears broken to users despite working server-side
- User perceives high latency as system failure, not expected behavior

---

## Evidence

### Server Logs (20-Page Ebook, December 3, 2025)

```
[1] [2025-12-03T15:11:12.047Z] [84e7a850-b1e2-4d6d-bcdc-6612fa4293ad] POST /api/ebook/generate started
[1] [EBOOK] Using model rotation: Pro for structure, Flash for chapters
[1] [EBOOK] Starting ebookService.handle()
[1] [EBOOK] pageCount: 20
...
[1] [BatchOptimization] Eligible ebook (7 chapters). Using Stage 1 optimization.
[1] [BatchOptimization] Starting generation for "A children's magical tale..." (7 pages)
...
[1] [EBOOK] Chapter generation completed via batch optimization
[1] [EBOOK] Chapter generation complete, total chapters: 7
[1] [COMPOSE] HTML generation complete, length: 36249
[1] [2025-12-03T15:13:31.565Z] [84e7a850-b1e2-4d6d-bcdc-6612fa4293ad] genieService.process() completed in 139518ms, result keys: out_envelope, resultId
[1] [ENDPOINT] Building response:
[1] [2025-12-03T15:13:31.566Z] [84e7a850-b1e2-4d6d-bcdc-6612fa4293ad] Serialized response: 63684 bytes
[1] [2025-12-03T15:13:31.566Z] [84e7a850-b1e2-4d6d-bcdc-6612fa4293ad] Sending response to client
[1] POST /api/ebook/generate 200 139521.296 ms - 63784
```

### Browser Network Tab

```
Request URL: /api/ebook/generate
Request Method: POST
Status: 504
Content-Type: null
Content-Length: 0.00KB
Time: 101 seconds (started 10:11:11, received 10:12:52)
```

### Browser Console

```
10:11:11.604 [API] Starting fetch to /ebook/generate
10:12:52.244 [API] Response received - Status: 504, Content-Type: null
10:12:52.245 [API] Content-Length header: 0.00KB
10:12:52.251 [API] Error: Error: API error 504:
Uncaught (in promise) Error: API error 504:
```

---

## Technical Details

### Request/Response Flow

```
1. Browser initiates fetch()
   └─ Destination: /api/ebook/generate
   └─ Method: POST
   └─ Payload: {prompt, pageCount: 20, theme}

2. Codespaces proxy receives request
   └─ Routes to server
   └─ Starts internal timeout clock (~100-120s)

3. Server processes request
   └─ Duration: 139.5 seconds
   └─ Completes successfully: 200 status, 63,684 bytes
   └─ Attempts to send response

4. Proxy timeout fires
   └─ Time elapsed: ~101 seconds
   └─ Proxy decision: "Connection too long, terminate"
   └─ Action: Close connection, return 504 to browser
   └─ Result: Browser receives 504 with empty body

5. Browser error handling
   └─ Status 504 triggers error callback
   └─ No response body to parse
   └─ User sees: "API error 504:"
```

### Why Batch Optimization Didn't Fix Latency Enough

- **Expected**: 60-70 seconds (44-57% improvement over sequential)
- **Actual**: 139.5 seconds
- **Gap**: ~70 seconds unexplained

Possible contributors:

- Rate limiting overhead (6s between sequential API calls)
- HTML composition time
- I/O and serialization overhead
- Potential inefficiencies in batch processing or context management

---

## Affected Code

### Client-Side

- **File**: `/workspaces/AetherPress/client/src/services/ebookApi.js`
- **Issue**: Fetch timeout configuration likely too low for long-running requests
- **Line**: ~28 (need to verify)

### Server-Side

- **File**: `/workspaces/AetherPress/server/index.js` or similar
- **Issue**: No explicit timeout handling for long responses
- **Gap**: Proxy timeout occurs before server completes response

### Infrastructure

- **Proxy**: Codespaces gateway or equivalent
- **Timeout**: Appears to be ~100-120 seconds
- **Configuration**: Likely non-adjustable by application code

---

## Related Issues

- **Previous Issue**: BUG_BATCH_OPT_MODULE_PATH_ERROR (FIXED)
  - That fix enabled batch optimization
  - Now reveals this downstream timeout issue
- **Performance Issue**: Batch optimization latency (139.5s vs expected 60-70s)
  - Related but separate from timeout
  - Should be investigated after timeout is resolved

---

## Timeline

| Date        | Event                                                  |
| ----------- | ------------------------------------------------------ |
| Dec 2, 2025 | Stage 1 batch optimization implementation complete     |
| Dec 2, 2025 | BUG_BATCH_OPT_MODULE_PATH_ERROR reported               |
| Dec 3, 2025 | Module path error fixed (one-line change)              |
| Dec 3, 2025 | Batch optimization activated for first time in browser |
| Dec 3, 2025 | 20-page ebook test → 504 timeout error                 |
| Dec 3, 2025 | Root cause identified: Proxy timeout at ~101s          |
| Dec 3, 2025 | This bug report created                                |

---

## Next Steps

See companion document: **BUG_FIX_TIMEOUT_504_SOLUTION.md**

This bug report identifies the problem. The fix document outlines three solution approaches:

- **Option A**: Increase client timeout (quick, temporary)
- **Option B**: Implement polling/streaming (recommended, addresses symptom)
- **Option C**: Optimize server latency (recommended, addresses root cause)

---

## Summary

A proxy timeout (likely Codespaces gateway) terminates the connection after ~101 seconds, returning a 504 error to the browser. The server successfully generates the complete response (63,684 bytes) in 139.5 seconds, but the proxy blocks it from reaching the client. This becomes visible now that batch optimization is working—previously, requests completed faster or failed earlier.

**Current State**: ❌ Timeout blocks long ebook generation  
**Expected State**: ✅ Ebook returns successfully (or transitions to polling model)  
**Root Cause**: Proxy timeout < Server latency  
**Solution Path**: Option B (polling) for immediate stability + Option C (latency optimization) for long-term

---

**Status**: 🔴 OPEN  
**Priority**: HIGH  
**Blocking**: Ebook generation >100 seconds  
**Solution Document**: BUG_FIX_TIMEOUT_504_SOLUTION.md
