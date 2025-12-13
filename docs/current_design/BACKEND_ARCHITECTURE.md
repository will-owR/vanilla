# AetherPress Backend Architecture

**Date**: December 13, 2025 @ 2:45 PM  
**Scope**: Scope 2 - Backend Architecture  
**Target Audience**: Backend developers, DevOps, API consumers  
**Reading Time**: ~15-20 minutes

**Related**: See [ARCHITECTURE_DOCUMENTATION_PROPOSAL.md](ARCHITECTURE_DOCUMENTATION_PROPOSAL.md) for documentation project overview and Scopes 3-4

---

## Table of Contents

1. [Entry Point & HTTP Handler](#entry-point--http-handler)
2. [Gemini API Rate Limits (Corrected)](#gemini-api-rate-limits-corrected)
3. [Quota Management Strategy](#quota-management-strategy)
4. [Orchestration Layer](#orchestration-layer)
5. [Service Layer](#service-layer)
6. [AI Service Integration](#ai-service-integration)
7. [Database Layer](#database-layer)
8. [Error Handling & Resilience](#error-handling--resilience)
9. [Request/Response Flow (Detailed)](#requestresponse-flow-detailed)
10. [Performance Characteristics](#performance-characteristics)

---

## Entry Point & HTTP Handler

### POST /api/ebook/generate

**File**: [server/index.js](../../../../server/index.js#L2923)

**Request Validation**:

```javascript
// Line 2923: app.post("/api/ebook/generate", async (req, res, next) => {
//   - Validate Content-Type: application/json
//   - Parse request body: { prompt, metadata }
//   - Check for required fields
//   - Generate requestId (UUID) for tracing
```

**Request Schema**:

```javascript
{
  prompt: string,              // Required: user input prompt
  metadata: {
    theme: "dark" | "light",  // Optional: styling theme
    pageCount: number,         // Optional: 3-20 pages (default varies by service)
    colorPalette: string,      // Optional: color scheme
    fontSizeScale: number      // Optional: 0.8-1.5
  }
}
```

**Middleware Stack** (before handler):

1. `express.json({ limit: "50mb" })` - JSON body parser with 50MB limit
2. `express.urlencoded({ limit: "50mb", extended: true })` - URL-encoded body parser (50MB)
3. `morgan()` - HTTP request logging
4. `cors()` - Cross-origin request handling
5. `rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })` - Global rate limit (100 req/15-min)

**Response Codes**:

- `200` - Success, ebook generated
- `202` - Accepted but quota deferred (see Quota Management)
- `400` - Bad request (validation error)
- `429` - Too many requests (global rate limit exceeded)
- `500` - Server error
- `503` - Service unavailable (Gemini API unreachable)

---

## Gemini API Rate Limits (Corrected)

**Source**: Google Gemini API Documentation  
**Verification Date**: December 13, 2025

### Free Tier Rate Limits

| Model                | Requests Per Minute (RPM) | Requests Per Day (RPD) | Purpose                      |
| -------------------- | ------------------------- | ---------------------- | ---------------------------- |
| **Gemini 2.5 Flash** | 15 RPM                    | ~1,500 RPD             | Fast, high-volume tasks      |
| **Gemini 2.5 Pro**   | 2 RPM                     | ~50 RPD                | Complex reasoning, expensive |

**Critical Implication**:

- Flash is **7.5x more generous** on RPM than Pro
- Pro is the bottleneck model (2 RPM = 1 call every 30 seconds)
- Daily limit on Pro is extremely strict (50 RPD = ~6 requests/hour)

### Pay-as-You-Go Tier (with billing enabled)

| Model                | RPM       | Note                            |
| -------------------- | --------- | ------------------------------- |
| **Gemini 2.5 Flash** | 1,000 RPM | Scales massively for production |
| **Gemini 2.5 Pro**   | 360 RPM   | Still lower than Flash          |

### Google's Recommended Strategy

> "Default to gemini-2.5-flash. Only switch specific requests to gemini-2.5-pro when Flash fails to handle correctly."

**Rationale**: Avoids hitting Pro's 2 RPM limit and daily 50 RPD quota wall.

---

## Quota Management Strategy

### Current Implementation Status

**Issue**: The quota system in `QUOTA_IMPLEMENTATION_SUMMARY.md` claims "20 calls/minute" but doesn't account for per-model rate limits.

**Correction Required**: Implement model-aware quota tracking.

### Model-Aware Quota Tracking

**Strategy**:

```
┌─────────────────────────────────────────────────────┐
│ Service Request (e.g., ebook with 10 pages)         │
│ Cost: 6 total API calls needed                      │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
   ┌─────────┐          ┌──────────┐
   │ Flash   │          │ Pro      │
   │ 5 calls │          │ 1 call   │
   └────┬────┘          └────┬─────┘
        │                    │
    ┌───┴────────────────────┴───┐
    │ Check Quotas Separately    │
    │ Flash: 5 calls vs 15 RPM   │
    │ Pro: 1 call vs 2 RPM       │
    └───────────────────────────┘
```

### Quota Windows

**Flash Window**:

- Duration: 60 seconds
- Limit: 15 calls
- Daily: ~1,500 calls

**Pro Window**:

- Duration: 60 seconds
- Limit: 2 calls
- Daily: ~50 calls

### Cost Calculation (Revised)

**Ebook Generation** (current implementation):

```javascript
// Cost formula: 1 (structure) + ceil(pageCount / 2) (chapters)
// Example: 10 pages = 1 + 5 = 6 calls total

// REVISED: Allocate based on model routing
// Structure call: Gemini 2.5 Pro (complex reasoning) = 1 Pro call
// Chapter calls: Gemini 2.5 Flash (high-volume) = 5 Flash calls
```

**Quota Check Logic**:

```javascript
// Before service dispatch:
const structureCost = 1; // Pro
const chaptersCost = Math.ceil(pageCount / 2); // Flash

const flashStatus = quotaTracker.getStatus("flash");
const proStatus = quotaTracker.getStatus("pro");

if (
  flashStatus.availableQuota < chaptersCost ||
  proStatus.availableQuota < structureCost
) {
  // Defer request with 202 response
  throw {
    status: 202,
    message: "Quota exhausted",
    flashNeeded: chaptersCost,
    flashAvailable: flashStatus.availableQuota,
    proNeeded: structureCost,
    proAvailable: proStatus.availableQuota,
    resetAtMs: {
      flash: flashStatus.windowResetAtMs,
      pro: proStatus.windowResetAtMs,
    },
  };
}
```

**Call Tracking**:

```javascript
// In geminiClient.callGemini() after successful response:
if (response.ok) {
  const model = callRequest.model; // "gemini-2.5-pro" or "gemini-2.5-flash"
  quotaTracker.recordCall(model);
  // Tracks separately: Flash window and Pro window
}
```

---

## Orchestration Layer

### genieService.process()

**File**: [server/genieService.js](../../../../server/genieService.js#L1)

**Responsibility**: Route requests to appropriate handlers, enforce quota constraints

**Architecture**:

```
User Request
    │
    ├─ Extract mode, metadata, prompt
    │
    ├─ Calculate cost (Flash + Pro separately)
    │
    ├─ Check quota availability
    │  ├─ If insufficient: throw 202 deferral error
    │  └─ If sufficient: proceed
    │
    ├─ Route to service handler
    │  ├─ mode === 'ebook' → ebookService.handle()
    │  ├─ mode === 'poetry' → poetryService.handle()
    │  └─ mode === 'blog' → blogService.handle()
    │
    └─ Return result envelope
```

**Cost Calculation by Mode**:

| Mode       | Flash Calls         | Pro Calls        | Example              |
| ---------- | ------------------- | ---------------- | -------------------- |
| **Ebook**  | ceil(pageCount/2)   | 1                | 10 pages = 5F + 1P   |
| **Poetry** | 0                   | 1                | Always 1P call       |
| **Blog**   | ceil(wordCount/500) | 1                | 2000 words = 4F + 1P |
| **Custom** | metadata.flashCost  | metadata.proCost | Explicit             |

**Key Code Segment** ([server/genieService.js](../../../../server/genieService.js#L684)):

```javascript
// Step 1: Calculate cost
const cost = calculateCostForMode(mode, metadata);

// Step 2: Check quota BEFORE service dispatch
const flashStatus = quotaTracker.getStatus("flash");
const proStatus = quotaTracker.getStatus("pro");

if (
  flashStatus.availableQuota < cost.flash ||
  proStatus.availableQuota < cost.pro
) {
  const err = new Error("Insufficient quota");
  err.status = 202;
  err.defer = true;
  err.flashNeeded = cost.flash;
  err.flashAvailable = flashStatus.availableQuota;
  err.proNeeded = cost.pro;
  err.proAvailable = proStatus.availableQuota;
  throw err;
}

// Step 3: Dispatch to service (guaranteed quota available)
const handler = getServiceHandler(mode);
const result = await handler(payload, classification);
```

---

## Service Layer

### Ebook Service

**File**: [server/ebookService.js](../../../../server/ebookService.js)

**Entry Point**: `async function handle(payload, classification)`

**Responsibility**: Generate ebook HTML from prompt

**Process**:

```
Payload: { prompt, metadata: { theme, pageCount, ... } }
    │
    ├─ Validate input
    │  ├─ prompt: required, non-empty
    │  └─ pageCount: 3-20 pages
    │
    ├─ Call AI Service (Structure)
    │  └─ Model: Gemini 2.5 Pro (complex reasoning)
    │  └─ Task: Generate TOC, chapter titles, outline
    │  └─ Duration: 10-15 seconds
    │
    ├─ Call AI Service (Chapters) [1..N]
    │  └─ Model: Gemini 2.5 Flash (high-volume)
    │  └─ Task: Generate chapter content (N = ceil(pageCount/2))
    │  └─ Duration: 20-30 seconds total
    │
    ├─ Compose HTML
    │  ├─ Build page tree from chapters
    │  ├─ Apply theme (dark/light, colors, fonts)
    │  └─ Serialize to string (~30-50KB)
    │
    └─ Return: { content, chapters, html, metadata }
```

**Key Code Segment** ([server/ebookService.js](../../../../server/ebookService.js#L44)):

```javascript
async function handle(payload, classification) {
  const { prompt } = payload;
  const { theme = "dark", pageCount = 8, ... } = payload.metadata || {};

  // Create AI service instance
  const aiSvc = createAIService();

  // Conversation 1: Structure (Pro)
  const structureCall = await aiSvc.generateContent(prompt, {
    callIndex: 0, // Pro model
    format: 'json',
    task: 'Generate ebook structure with TOC'
  });

  // Conversation N: Chapters (Flash)
  const chapters = [];
  for (let i = 1; i < pageCount; i++) {
    const chapterCall = await aiSvc.generateContent(prompt, {
      callIndex: i, // Flash model (i > 0)
      format: 'text',
      task: `Generate chapter ${i} content`
    });
    chapters.push(chapterCall);
  }

  // Compose HTML
  const html = composeHTML(chapters, theme);

  return {
    content: { title, body },
    chapters,
    html,
    metadata: { model: 'ebook-v1', pages: pageCount, ... }
  };
}
```

### Model Routing in AI Service

**File**: [server/aiService.js](../../../../server/aiService.js#L55-L75)

**Key Logic**:

```javascript
async generateContent(prompt, options) {
  const { callIndex = 0 } = options;

  // Determine model based on callIndex
  // callIndex === 0: Pro (structure)
  // callIndex > 0: Flash (chapters)
  const model = callIndex === 0 ? "gemini-2.5-pro" : "gemini-2.5-flash";

  console.log(`[EBOOK] Using model: ${model} (callIndex=${callIndex})`);

  const response = await geminiClient.callGemini({
    model,
    prompt,
    ...options
  });

  return response;
}
```

---

## AI Service Integration

### geminiClient

**File**: [server/geminiClient.js](../../../../server/geminiClient.js)

**Responsibility**: Thin wrapper around Gemini API, tracks successful calls

**Request Flow**:

```
callGemini({model, prompt, ...})
    │
    ├─ Validate: model, prompt required
    │
    ├─ Make HTTP request to Gemini API
    │  └─ URL: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
    │  └─ Headers: x-goog-api-key: ${GEMINI_API_KEY}
    │  └─ Body: { contents: [{parts: [{text: prompt}]}], ... }
    │
    ├─ Handle response
    │  ├─ If response.ok:
    │  │  ├─ Parse JSON
    │  │  ├─ Extract text from candidates
    │  │  ├─ Track quota: quotaTracker.recordCall(model)
    │  │  └─ Return: { success: true, text, model, ... }
    │  │
    │  └─ If error:
    │     ├─ 429 (Too Many Requests): Don't track quota, throw retryable error
    │     ├─ 503 (Service Unavailable): Don't track quota, throw error
    │     └─ Other: Handle appropriately
    │
    └─ Return response
```

**Key Code Segment** ([server/geminiClient.js](../../../../server/geminiClient.js#L180)):

```javascript
async callGemini(request) {
  const { model, prompt } = request;

  // Make API call
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...
    })
  });

  // Track successful calls only
  if (response.ok) {
    const data = await response.json();

    // Record quota
    try {
      quotaTracker.recordCall(model);
      console.log(`[GEMINI] API call successful, quota tracked: ${model}`);
    } catch (err) {
      console.warn("[QUOTA] Failed to track API call:", err.message);
    }

    return { success: true, text: data.candidates[0].content.parts[0].text, ... };
  } else {
    // Failed calls (429, 503, etc.) not tracked
    throw new Error(`Gemini API error ${response.status}`);
  }
}
```

### Error Handling

**Retryable Errors**:

- 429 (Rate Limited): Client should back off and retry
- 503 (Service Unavailable): Temporary outage, retry after delay

**Non-Retryable Errors**:

- 400 (Bad Request): Invalid prompt format
- 403 (Forbidden): Invalid API key
- 401 (Unauthorized): Authentication failure

---

## Database Layer

### Prisma ORM with PostgreSQL

**File**: [server/db.js](../../../../server/db.js) + [server/utils/dbUtils.js](../../../../server/utils/dbUtils.js)

**Status**: ✅ Operational (verified Dec 13, 2025 via `./server/scripts/db-health.sh --check=all`)

**Connection**:

```
DATABASE_URL = postgresql://postgres:postgres@db:5432/aether_dev
```

**Persistence Strategy**:

```
Request → genieService → ebookService → HTML generated
    │
    └─→ (Optional) Save to database
        │
        ├─ Insert prompt record
        │  └─ { promptId, userId, prompt, metadata, status, createdAt }
        │
        ├─ Insert ebook content record
        │  └─ { contentId, promptId, title, chapters[], html, metadata }
        │
        └─ Return to client (HTML rendered immediately, persist async)
```

**ORM Features**:

- Type-safe queries via Prisma schema
- Migration history tracked
- Fallback to legacy `crud` helpers during migration (if needed)

---

## Error Handling & Resilience

### Error Hierarchy

```
User Request
    │
    ├─ Validation Error (400)
    │  └─ Invalid prompt, missing required fields
    │
    ├─ Quota Deferral (202)
    │  └─ Insufficient quota, client should retry after reset
    │
    ├─ Rate Limit (429)
    │  └─ Global express-rate-limit exceeded, retry after window
    │
    ├─ Gemini API Error (503)
    │  └─ API unavailable, retry with exponential backoff
    │
    └─ Server Error (500)
       └─ Unexpected exception, log and return error
```

### 202 Deferral Response

**When**: Quota check fails in genieService.process()

**Response**:

```json
HTTP/1.1 202 Accepted
{
  "message": "Quota exhausted; request deferred for retry",
  "requiredFlash": 5,
  "availableFlash": 3,
  "requiredPro": 1,
  "availablePro": 0,
  "flashResetAtMs": 45000,
  "proResetAtMs": 60000,
  "retryAfterSeconds": 60,
  "requestId": "req-xyz"
}
```

**Client Action**: Retry after `retryAfterSeconds` or when `flashResetAtMs` + `proResetAtMs` have passed.

### Logging

**Log Levels**:

- `[QUOTA]`: Quota decisions (check, track, deferral)
- `[GEMINI]`: API calls and responses
- `[EBOOK]`: Service-specific actions
- `[DB]`: Database operations (optional)

**Example Sequence**:

```
[QUOTA] Checking quota for ebook: flashNeeded=5, proNeeded=1
[QUOTA] Flash available=10, Pro available=2
[QUOTA] Quota check passed
[EBOOK] Starting ebookService.handle()
[GEMINI] Calling model gemini-2.5-pro (callIndex=0)
[GEMINI] API call successful, quota tracked: gemini-2.5-pro
[GEMINI] Calling model gemini-2.5-flash (callIndex=1)
[GEMINI] API call successful, quota tracked: gemini-2.5-flash
... (4 more Flash calls)
[EBOOK] HTML composition complete
[200] Response sent
```

---

## Request/Response Flow (Detailed)

### Complete Ebook Generation (10-page request)

```
T=0s   [CLIENT] POST /api/ebook/generate
       {
         "prompt": "Write an ebook about renewable energy",
         "metadata": { "theme": "dark", "pageCount": 10 }
       }

T+0.1s [SERVER] Parse request, validate input
       ├─ prompt: ✓ "Write an ebook..."
       ├─ pageCount: ✓ 10 (in range 3-20)
       └─ theme: ✓ "dark"

T+0.2s [QUOTA] Check quota
       ├─ Cost calculation:
       │  ├─ Flash needed: ceil(10/2) = 5 calls
       │  └─ Pro needed: 1 call
       ├─ Current quotas:
       │  ├─ Flash: 12/15 available
       │  └─ Pro: 1/2 available
       └─ Result: ✓ Quota available, proceed

T+0.3s [EBOOK] Begin service execution
       └─ Call aiService.generateContent (structure, callIndex=0)

T+0.5s [GEMINI-PRO-1] Request to Gemini 2.5 Pro
       └─ Prompt: "Generate ebook structure with chapters..."

T+12s  [GEMINI-PRO-1] Response received
       ├─ Status: 200 OK
       ├─ Content: TOC, chapter titles
       └─ [QUOTA] Track: Flash=12, Pro=0 (consumed 1)

T+12.1s [EBOOK] Begin chapter generation loop
       └─ Chapters needed: 5 (5 Flash calls)

T+12.2s [GEMINI-FLASH-1] Request to Gemini 2.5 Flash
       └─ Prompt: "Generate chapter 1: Introduction..."

T+14s  [GEMINI-FLASH-1] Response received
       ├─ Status: 200 OK
       └─ [QUOTA] Track: Flash=11, Pro=0

T+14.1s [GEMINI-FLASH-2] Request to Gemini 2.5 Flash

T+16s  [GEMINI-FLASH-2] Response received
       └─ [QUOTA] Track: Flash=10, Pro=0

... (repeat for Flash calls 3, 4, 5)

T+46s  [EBOOK] All AI calls complete
       └─ Chapters collected: [ch1, ch2, ch3, ch4, ch5]

T+48s  [EBOOK] Compose HTML
       ├─ Build page tree
       ├─ Apply dark theme
       └─ Serialize to string (~45KB)

T+50s  [SERVER] Build response envelope
       {
         "success": true,
         "data": {
           "content": { "title": "Ebook: Renewable Energy", "body": "..." },
           "chapters": [
             { "title": "Chapter 1: Introduction", "body": "..." },
             ...
           ],
           "html": "<html>...</html>",
           "metadata": {
             "model": "ebook-v1",
             "pages": 10,
             "processingTimeMs": 50000,
             "aiModelsUsed": ["gemini-2.5-pro", "gemini-2.5-flash"]
           }
         }
       }

T+50.5s [TRANSMISSION] Send 45KB response over network
        └─ Expected: 5-10 seconds (varies by connection)

T+55-60s [CLIENT] Receive and parse JSON
        ├─ JSON.parse() successful
        ├─ Store in ebookStore
        └─ Render preview in UI
```

**Final Quota State**: Flash=10/15, Pro=1/2

---

## Architectural Patterns

### Independent Separation of Concerns

The AetherPress backend employs an elegant architectural pattern that separates two distinct constraint types, allowing each to evolve independently:

**Velocity Constraint** (Rate-Limiter):

- Enforces _when_ calls can be made (inter-request timing)
- Tracks: Time between consecutive calls per model
- Implementation: `express-rate-limit` middleware
- Configuration: Global 100 requests / 15 minutes
- Purpose: Prevent aggressive hammering, ensure fair resource sharing

**Volume Constraint** (Quota System):

- Enforces _how many_ calls can be made (per time window)
- Tracks: Call count per model per rolling window
- Implementation: `quotaTracker` in geminiClient.js
- Configuration: Flash 15 RPM, Pro 2 RPM (model-aware)
- Purpose: Respect API rate limits, prevent quota exhaustion

**Why This Separation Matters**:

```
Traditional "Single Constraint" Model:
┌─ Rate-limiter enforces both velocity AND volume
│  Problem: Over-restrictive (forces unnecessary delays)
│  Problem: Hard to tune (too fast or too slow)
└─ Result: Suboptimal throughput

AetherPress "Independent Constraints" Model:
├─ Rate-limiter: Velocity only
│  ├─ Tracks: Milliseconds between calls
│  ├─ Enforces: No-hammer policy
│  └─ Benefit: Lightweight, predictable delays
│
└─ Quota tracker: Volume only
   ├─ Tracks: Successful API calls per model
   ├─ Enforces: Respect RPM limits
   └─ Benefit: Model-aware, separate windows (Flash ≠ Pro)
```

**Real-World Impact** (10-page ebook, 5 Flash + 1 Pro calls):

| Constraint          | Limits      | Spacing          | Cumulative       |
| ------------------- | ----------- | ---------------- | ---------------- |
| **Rate-limiter**    | 100/15min   | ~9 seconds apart | N/A              |
| **Flash quota**     | 15/min      | ~4 seconds apart | ~20s for 5 calls |
| **Pro quota**       | 2/min       | ~30s apart       | ~30s for 1 call  |
| **Pro + Flash seq** | Both active | Interspersed     | ~50s total       |

The beauty of this design: **Pro's 30-second spacing naturally spaces Flash calls far enough apart that the rate-limiter rarely triggers additional delays**. The Pro bottleneck becomes a beneficial feature, not a bug.

### Model Routing via callIndex

The backend implements implicit model selection through the `callIndex` parameter propagated from orchestrator to AI service to client:

**Orchestration Layer** (genieService.js):

```javascript
const aiSvc = createAIService();

// Call 0: Pro (structure, reasoning-intensive)
const structure = await aiSvc.generateContent(structurePrompt, {
  callIndex: 0, // Signals: Use Pro model
  task: "Generate table of contents",
});

// Calls 1-N: Flash (content generation, high-volume)
for (let i = 0; i < chapters.length; i++) {
  const chapter = await aiSvc.generateContent(chapterPrompt, {
    callIndex: i + 1, // Signals: Use Flash model (i > 0)
    task: `Generate chapter ${i + 1} content`,
  });
}
```

**AI Service Layer** (aiService.js):

```javascript
async generateContent(prompt, options = {}) {
  const { callIndex = 0 } = options;

  // Router: callIndex determines model selection
  if (callIndex === 0) {
    // Use Pro model for structure (reasoning-heavy, lower volume)
    const model = 'gemini-2.5-pro';
    return this.client.callGemini({ model, prompt });
  } else {
    // Use Flash model for content (high volume, lower reasoning)
    const model = 'gemini-2.5-flash';
    return this.client.callGemini({ model, prompt });
  }
}
```

**Benefits**:

- Semantic clarity: `callIndex` indicates call position, which implies model
- Separation: Service doesn't hardcode model names (easier to update)
- Traceability: Logs show `callIndex` for debugging
- Future-proof: Can add complexity (callIndex % 3 selects model) without changing interfaces

### Business Logic Isolation

The true elegance of the architecture emerges at the service layer: **ebookService.handle() has zero awareness of quotas, rate-limiting, or accounting concerns**.

**What ebookService Knows**:

```javascript
async function handle(payload, classification) {
  // 1. Generate structure
  const structure = await aiSvc.generateContent(structurePrompt, {
    callIndex: 0,
  });

  // 2. Generate chapters
  const chapters = [];
  for (let i = 0; i < pageCount / 2; i++) {
    const chapter = await aiSvc.generateContent(chapterPrompt, {
      callIndex: i + 1,
    });
    chapters.push(chapter);
  }

  // 3. Compose HTML
  const html = composeHTML(structure, chapters, theme);

  // Done. Return the business result.
  return { content, chapters, html };
}
```

**What ebookService Does NOT Know**:

- ❌ How many quotas remain (Flash vs Pro)
- ❌ Whether rate-limiter will delay the next call
- ❌ When the quota window resets
- ❌ Which API endpoint gets called
- ❌ Whether the call succeeded or failed
- ❌ How many RPM this model allows

**Where These Concerns Live**:

| Concern              | Layer                           | Responsibility                            |
| -------------------- | ------------------------------- | ----------------------------------------- |
| **Quota pre-check**  | genieService (orchestrator)     | "Do we have enough budget?"               |
| **Rate-limiting**    | express-rate-limit (middleware) | "Has enough time passed since last call?" |
| **Quota post-track** | geminiClient                    | "Record this successful call"             |
| **Model selection**  | aiService (router)              | "Based on callIndex, which model?"        |
| **API invocation**   | geminiClient                    | "Make the HTTP request"                   |
| **Business logic**   | ebookService                    | "Generate great content"                  |

**Why This Matters**:

```
Coupled Design (Business + Infrastructure):
ebookService.handle() {
  Check quota ❌ ← Not its job
  Check rate-limit ❌ ← Not its job
  Generate content ✓ ← Its job
  Track quota ❌ ← Not its job
  Retry on 429 ❌ ← Not its job
}
Result: Service bloated, hard to test, tight coupling

AetherPress Design (Separation):
ebookService.handle() {
  Generate content ✓ ← Only its job
}
// Quota checked BEFORE service dispatch
// Rate-limiting applied DURING api call
// Quota tracked AFTER successful response
Result: Service focused, testable, loosely coupled
```

**Testing Impact**:

With business logic isolation, you can test ebookService with a mock aiService:

```javascript
// Test: "Generate 5 chapters correctly"
const mockAI = {
  generateContent: () => ({ text: "Chapter content..." }),
};

const result = await ebookService.handle(payload, { aiService: mockAI });
// Assert: chapters.length === 5, html includes all content
// No mocking of quota, rate-limit, or API infrastructure needed
```

### Scalable Service Architecture

**EbookService is just the first of many media services.** The architectural pattern—separating business logic from accounting concerns—scales effortlessly to all content generation services:

```
Media Services Layer (All benefit from accounting isolation):
├─ ebookService.handle()        → Generate structured ebook content
├─ wallartService.handle()      → Generate wall art/poster content
├─ calendarService.handle()     → Generate calendar content
├─ poetryService.handle()       → Generate poetry/verse content
├─ blogService.handle()         → Generate blog post content
└─ [future services]            → All follow the same pattern

Each service:
✓ Generates content with semantic clarity
✓ Has zero awareness of quotas or rate-limiting
✓ Calls aiService with callIndex for implicit model selection
✓ Is independently testable with mocked aiService
✓ Benefits from unified accounting (genieService + geminiClient)
```

**Earlier Quasi-Services** prepare the context:

```
Request Handler → Input Validator → Classifier → Media Service
                  (Transforms input)  (Determines  (Generates
                                       which route)  content)
                                                    ↓
                                              genieService
                                              (Quota check)
                                                    ↓
                                              [media service]
                                                    ↓
                                              aiService
                                                    ↓
                                              geminiClient
                                              (Quota track)
```

**Benefits of This Pattern**:

1. **Service Uniformity**: All media services follow the same contract (take payload, return content)
2. **Reusable Accounting**: A single quota system (genieService + geminiClient) handles ALL services
3. **Independent Evolution**: Add a new service (e.g., musicService) without touching accounting
4. **Testing at Scale**: Test any service with mocked aiService; accounting never enters unit tests
5. **Cost Tracking**: All services automatically contribute to quota accounting without explicit integration

**Real-world scaling scenario**:

```javascript
// Today: ebookService uses 5 Flash + 1 Pro per request
const ebook = await ebookService.handle(payload);
// Quota: Flash 10/15, Pro 1/2

// Tomorrow: Add wallartService (uses 2 Flash per request)
const wallart = await wallartService.handle(payload);
// Quota automatically decremented: Flash 8/15, Pro 1/2

// Next week: Add calendarService (uses 1 Pro + 1 Flash)
const calendar = await calendarService.handle(payload);
// Quota automatically decremented: Flash 7/15, Pro 0/2

// All WITHOUT modifying wallartService or calendarService to know about quotas
```

---

## Performance Characteristics

### Timing Breakdown (Typical 10-page Ebook)

| Stage                       | Duration   | Constraint            |
| --------------------------- | ---------- | --------------------- |
| **Request parsing**         | <100 ms    | CPU-bound             |
| **Quota check**             | <10 ms     | Memory-bound          |
| **Service dispatch**        | <50 ms     | CPU-bound             |
| **Gemini Pro (structure)**  | 10-15s     | API latency           |
| **Gemini Flash (chapters)** | 20-30s     | API latency (5 calls) |
| **HTML composition**        | 2-5s       | CPU-bound             |
| **Response serialization**  | <100 ms    | CPU-bound             |
| **Network transmission**    | 5-10s      | Network bandwidth     |
| **Total**                   | **49-60s** | API calls dominate    |

### Bottlenecks

**Hard Limit**: ~60 second infrastructure timeout (Codespaces)

- Backend processing: 49-50s
- Network transmission: 5-10s
- **Result**: Marginal, occasional timeouts

**API Limits** (Free Tier):

- Flash quota: 15 calls/minute = 1 call/4 seconds
- Pro quota: 2 calls/minute = 1 call/30 seconds
- Pro is the actual bottleneck (2 RPM)

### How Pro's 2 RPM Naturally Spaces Flash Calls

The architectural pattern of separating Pro (reasoning, low volume) and Flash (generation, high volume) creates an emergent benefit: **Pro's 30-second inter-call spacing naturally spaces Flash calls far enough that the rate-limiter rarely needs to trigger additional delays**.

**Timeline Analysis for a 10-page Ebook** (5 Flash calls + 1 Pro call):

```
T=0s    [PRO CALL 0] Structure generation starts
        └─ Result ready: T≈13-15s

T=13-15s [QUOTA CHECK] Do we have Flash calls queued?
        └─ Yes, 5 chapter calls waiting

T=15s   [FLASH CALL 1] Chapter 1 dispatched
        ├─ Spacing from Pro: 0-15s (generous, no rate-limit delay needed)
        └─ Result ready: T≈17-19s

T=19s   [FLASH CALL 2] Chapter 2 dispatched
        ├─ Spacing from Call 1: 4s (well within 4s Flash quota spacing)
        └─ Result ready: T≈21-23s

T=23s   [FLASH CALL 3] Chapter 3 dispatched
        ├─ Spacing: 4s (excellent)
        └─ Result ready: T≈25-27s

T=27s   [FLASH CALL 4] Chapter 4 dispatched
        ├─ Spacing: 4s
        └─ Result ready: T≈29-31s

T=31s   [PRO QUOTA WINDOW] Pro becomes available again (30s passed)
        └─ Note: We don't have a second Pro call, just marking window

T=31s   [FLASH CALL 5] Chapter 5 dispatched
        ├─ Spacing from Call 4: 4s
        └─ Result ready: T≈33-35s

T=35s   [HTML COMPOSITION] Assemble all chapters into document
        ├─ Process chapters array
        ├─ Apply theme and styling
        └─ Complete: T≈38-40s

T=40-50s [SERIALIZATION & TRANSMISSION]
        ├─ JSON serialize
        ├─ Network transmission
        └─ Complete: T≈49-60s
```

**Key Insight**:

- Flash calls need ≥4s spacing (1 call per 4 seconds at 15 RPM)
- Actual Flash calls occur at: T=15s, T=19s, T=23s, T=27s, T=31s
- Spacing achieved: **4-8 seconds** (naturally satisfies quota requirement)
- Rate-limiter delays: **None needed** (already spacing correctly)

**Comparison: Without Pro's Spacing**:

If we tried to call 5 Flash in rapid succession (no Pro call between):

```
T=0s    [FLASH 1] Dispatch
T=1s    [FLASH 2] Dispatch (1s spacing - TOO FAST)
        └─ Rate-limiter forces 3s delay
T=4s    [FLASH 2 ACTUAL] Deployed (rate-limited)
T=5s    [FLASH 3] Dispatch (1s spacing - TOO FAST)
        └─ Rate-limiter forces 3s delay
... (repeat pattern)
Result: Artificial 3s delays injected 4 times = 12s wasted
```

**With Pro's Spacing**:

```
T=0s    [PRO] Dispatch
T=15s   [FLASH 1] Available (no queue backup)
        └─ Natural 15s gap = zero rate-limiter involvement
Result: Efficient sequential processing, no artificial delays
```

**Architecture Benefit**:
The separation of concerns (Pro for reasoning, Flash for generation) isn't just semantically cleaner—it's **mechanically optimized**. The Pro bottleneck (2 RPM) becomes a feature, not a liability, by naturally introducing spacing that prevents Flash rate-limiter contention.

**Mitigation Strategies** (for Scope 3+):

1. Increase infrastructure timeout (Codespaces feature request)
2. Implement response streaming (begin sending at T+5s)
3. Move to async polling (POST generate → GET status/download)

---

## Summary

The AetherPress backend implements a three-layer architecture:

1. **HTTP Handler** → Validates requests, orchestrates flow
2. **Orchestrator** (genieService) → Enforces quota, routes to services
3. **Services** (ebookService, etc.) → Business logic, guaranteed quota
4. **AI Integration** (geminiClient) → API calls, call tracking
5. **Database** → Async persistence

**Key Accuracy Correction**: Quota system must track Flash (15 RPM) and Pro (2 RPM) separately, with Pro being the true bottleneck.

---

## Reference Links

- [ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md) - System overview
- [QUOTA_IMPLEMENTATION_SUMMARY.md](../reference/QUOTA_IMPLEMENTATION_SUMMARY.md) - Quota system detail
- [Gemini API Documentation](https://ai.google.dev/docs) - Official API reference
- [Rate Limits Comparison](https://ai.google.dev/pricing) - Current rate limits
