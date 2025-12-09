# 10-Page Light Theme

**Date**: December 9, 2025 @ 1:25PM
**Branch**: `feat/revert`  
**Bug Report**: [STATUS_POLLING_429_RATE_LIMIT.md](../bug_report/STATUS_POLLING_429_RATE_LIMIT.md) - Frontend receives 429 error during status polling on large ebook requests

---

## Server log

```
[1] GET /health 200 38.297 ms - 293
[1] [2025-12-09T18:17:00.670Z] [2fc69b03-0e45-4a85-8502-a0784783d94e] POST /api/ebook/generate started
[1] [QuotaTracker] Window rotated. Calls in previous window: 5/20
[1] [JobQueue] Created job 0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1, status: processing
[1] [2025-12-09T18:17:00.670Z] [2fc69b03-0e45-4a85-8502-a0784783d94e] Created job 0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1, returning 202 Accepted
[1] [2025-12-09T18:17:00.670Z] [2fc69b03-0e45-4a85-8502-a0784783d94e] Response sent in 0ms
[1] [JobQueue] 0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1 progress: 5% - Starting ebook generation...
[1] [2025-12-09T18:17:00.670Z] [2fc69b03-0e45-4a85-8502-a0784783d94e] [Job 0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1] Calling genieService.process() with pageCount=10
[1] [DIAGNOSTIC] USE_REAL_AI: 1
[1] [DIAGNOSTIC] FORCE_MOCK_AI: undefined
[1] [DIAGNOSTIC] GEMINI_API_URL exists?: true
[1] [DIAGNOSTIC] GEMINI_API_KEY exists?: true
[1] AI service: RealAIService enabled (Gemini)
[1] [DIAGNOSTIC] AI Service Type: RealAIService
[1] [DIAGNOSTIC] USE_REAL_AI: 1
[1] [DIAGNOSTIC] FORCE_MOCK_AI: undefined
[1] [EBOOK] Using model rotation: Pro for structure, Flash for chapters
[1] [EBOOK] Starting ebookService.handle()
[1] [EBOOK] pageCount: 10
[1] [EBOOK] theme: light
[1] [GEMINI] Conversation 1 - Requesting structure
[1] [GEMINI] Prompt topic: An epic fantasy quest with ten distinct adventures, challenges, and triumphs, each more intense than...
[1] [QUOTA] Call 0: Using Gemini 2.5 Pro (structure generation)
[1] POST /api/ebook/generate 202 0.499 ms - 247
[1] GET /api/ebook/generate/0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1/status 200 0.346 ms - 177
[1] GET /api/quota-status 200 0.373 ms - 342
[1] [GEMINI] Full structureResp: {...}
[1] [GEMINI] Conversation 1 - Response received:
[1] [DIAGNOSTIC] aiText extracted from structureResp
[1] [DIAGNOSTIC] Parse result: SUCCESS
[1] [DIAGNOSTIC] Structure keys: [ 'title', 'chapters', 'outline' ]
[1] [DIAGNOSTIC] Has title?: true
[1] [DIAGNOSTIC] Has outline?: true
[1] [DIAGNOSTIC] Outline length: 10
[1] [GEMINI] Structure title: The Sundered Realm: A Quest for Unity
[1] [GEMINI] Chapters outline: 10
[1] [GEMINI] Title-Prompt match: MISMATCH
[1] [EBOOK] Starting chapter generation loop, outline length: 10
[1] [EBOOK] Chapter 1/10: Starting generation for "The Whispers of Fate"
[1] [EBOOK] Chapter 1/10: Calling aiSvc.generateContentWithRotation() with callIndex=1
[1] [QUOTA] Call 1: Using Gemini 2.5 Flash (chapter generation)
[1] [EBOOK] Chapter 1/10: AI response received in 11835ms
[1] [EBOOK] Chapter 2/10: Starting generation for "The First Ember of Courage"
[1] [EBOOK] Chapter 2/10: Calling aiSvc.generateContentWithRotation() with callIndex=2
[1] [QUOTA] Call 2: Using Gemini 2.5 Flash (chapter generation)
[1] [EBOOK] Chapter 2/10: AI response received in 14746ms
[1] [EBOOK] Chapter 3/10: Starting generation for "Through the Blighted Mire"
[1] [EBOOK] Chapter 3/10: Calling aiSvc.generateContentWithRotation() with callIndex=3
[1] [QUOTA] Call 3: Using Gemini 2.5 Flash (chapter generation)
[1] [QuotaTracker] Window rotated. Calls in previous window: 4/20
[1] [EBOOK] Chapter 3/10: AI response received in 15745ms
[1] [EBOOK] Chapter 4/10: Starting generation for "Echoes in the Ruined Keep"
[1] [EBOOK] Chapter 4/10: Calling aiSvc.generateContentWithRotation() with callIndex=4
[1] [QUOTA] Call 4: Using Gemini 2.5 Flash (chapter generation)
[1] [EBOOK] Chapter 4/10: AI response received in 11860ms
[1] [EBOOK] Chapter 5/10: Starting generation for "The Trials of the Sky-Watchers"
[1] [EBOOK] Chapter 5/10: Calling aiSvc.generateContentWithRotation() with callIndex=5
[1] [QUOTA] Call 5: Using Gemini 2.5 Flash (chapter generation)
[1] [EBOOK] Chapter 5/10: AI response received in 14869ms
[1] [EBOOK] Chapter 6/10: Starting generation for "The Shadow's Snare"
[1] [EBOOK] Chapter 6/10: Calling aiSvc.generateContentWithRotation() with callIndex=6
[1] [QUOTA] Call 6: Using Gemini 2.5 Flash (chapter generation)
[1] [EBOOK] Chapter 6/10: AI response received in 22425ms
[1] [EBOOK] Chapter 7/10: Starting generation for "Forged in Alliance"
[1] [EBOOK] Chapter 7/10: Calling aiSvc.generateContentWithRotation() with callIndex=7
[1] [QUOTA] Call 7: Using Gemini 2.5 Flash (chapter generation)
[1] [QuotaTracker] Window rotated. Calls in previous window: 4/20
[1] [EBOOK] Chapter 7/10: AI response received in 13336ms
[1] [EBOOK] Chapter 8/10: Starting generation for "Infiltration of the Dark Citadel"
[1] [EBOOK] Chapter 8/10: Calling aiSvc.generateContentWithRotation() with callIndex=8
[1] [QUOTA] Call 8: Using Gemini 2.5 Flash (chapter generation)
[1] GET /api/ebook/generate/0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1/status 429 0.492 ms - 42
[1] [EBOOK] Chapter 8/10: AI response received in 20206ms
[1] [EBOOK] Chapter 9/10: Starting generation for "Confrontation at the Nexus"
[1] [EBOOK] Chapter 9/10: Calling aiSvc.generateContentWithRotation() with callIndex=9
[1] [QUOTA] Call 9: Using Gemini 2.5 Flash (chapter generation)
[1] [EBOOK] Chapter 9/10: AI response received in 18914ms
[1] [EBOOK] Chapter 10/10: Starting generation for "A Realm Reborn"
[1] [EBOOK] Chapter 10/10: Calling aiSvc.generateContentWithRotation() with callIndex=10
[1] [QUOTA] Call 10: Using Gemini 2.5 Flash (chapter generation)
[1] [EBOOK] Chapter 10/10: AI response received in 11115ms
[1] [EBOOK] Chapter generation complete, total chapters: 10
[1] [EBOOK] Returning structured envelope
[1] [COMPOSE] Starting compose() call for ebook mode
[1] [COMPOSE] Starting compose with 10 pages
[1] [COMPOSE] theme: light colorPalette: standard density: medium
[1] [COMPOSE] HTML generation complete, length: 56851
[1] [COMPOSE] Success! Generated HTML length: 56851
[1] [2025-12-09T18:19:55.617Z] [2fc69b03-0e45-4a85-8502-a0784783d94e] [Job 0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1] genieService.process() completed in 174947ms
[1] [JobQueue] 0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1 progress: 50% - Composing HTML...
[1] [JobQueue] 0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1 progress: 95% - Finalizing response...
[1] [JobQueue] 0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1 completed in 174947ms
[1] [2025-12-09T18:17:00.670Z] [2fc69b03-0e45-4a85-8502-a0784783d94e] [Job 0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1] Background generation complete
[1] GET /health 200 29.503 ms - 293
```

---

## Frontend Error

```
Error: API error 429:
    at fetchWithTimeout (ebookApi.js:52:13)
    at async checkEbookStatus (ebookApi.js:131:18)
    at async Module.pollEbookCompletion (ebookApi.js:191:22)
    at async Object.generate (ebookStore.js:146:26)

[EBOOK] Generation error: Error: API error 429:
```

---

## Analysis Summary

### **Root Cause: Rate Limiting (HTTP 429)**

The frontend encountered a **429 Too Many Requests** error during status polling. The critical line in the server log:

```
[1] GET /api/ebook/generate/0e9d74c1-ddd7-4a65-8b32-7ddc09790fd1/status 429 0.492 ms - 42
```

This occurred **during chapter 8 generation** while the frontend was polling for job status.

### **Key Observations**

**Request Scope:**

- Topic: "An epic fantasy quest with ten distinct adventures" (fantasy narrative)
- 10 chapters generated (vs. 4 for the 3-page request)
- Title mismatch detected: Prompt vs. "The Sundered Realm: A Quest for Unity"
- Total server processing: ~2 min 55 sec (174,947ms)

**Quota Window Issue:**

- Window 1: Started with 5/20 quota, rotated after call 3
- Window 2: Rotated again after call 7 (4/20 in previous window)
- Call 8 onwards: Operating in new quota window with only 3 remaining calls before hitting limit
- **No quota pre-check** before status polling caused the frontend to hit 429

**Chapter Generation Timings:**

- Ch 1: 11.8s | Ch 2: 14.7s | Ch 3: 15.7s | Ch 4: 11.9s | Ch 5: 14.9s
- Ch 6: 22.4s | Ch 7: 13.3s | Ch 8: 20.2s | Ch 9: 18.9s | Ch 10: 11.1s
- **Total: ~154 seconds** for all chapters

**HTML Generation:**

- Successfully composed 56,851 bytes (10-page output)
- Theme: light, density: medium (vs. light for 3-page)
- Job marked as complete before the 429 error was returned

### **Why the Error Occurred**

1. **Aggressive polling + large request**: Frontend was polling `/status` endpoint while server was still generating 10 chapters
2. **Rate limit applied to status checks**: The 429 error came from the `/status` endpoint, not the AI service
3. **Timing mismatch**: Frontend continued polling before implementing exponential backoff or rate-limit awareness
4. **Job already completed**: Despite the 429 error, the job actually finished successfully server-side (174.9s total)

### **Critical Insight**

The **job completed successfully** despite the 429 error being returned to the frontend. This is a **polling/frontend issue**, not a backend processing failure. The error was a transient rate-limit response to the status endpoint during active generation.
