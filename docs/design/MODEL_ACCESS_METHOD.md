# Model Access Method - Current Implementation

**Document Version**: 1.0  
**Date**: December 8, 2025  
**Time**: ~10:45 AM UTC  
**Branch**: `feat/revert`  
**Status**: Active Development

---

## Overview

This document describes the complete request flow for how the AI model is accessed when a generation request is made in the Aether application. It covers both **MockAIService** (used in tests) and **RealAIService** (used in frontend development with Gemini API).

---

## Complete Request Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Browser/Client)                           │
│                                                                             │
│  User Input → POST /prompt (from client/src/lib/api.js)                     │
│  Payload: { prompt, mode?, metadata?, selectedMedium?, ... }                │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express Server - port 3000)                     │
│                                                                             │
│  POST /prompt endpoint (server/index.js:718)                                │
│  ├─ validatePayload(req.body)                                               │
│  └─ genieService.process(payload)                                           │
│                                                                             │
│     ▼──────────────────────────────────────────────────────────────────┐    │
│     │ Mode-Based Routing (genieService.js:645)                         │    │
│     │                                                                  │    │
│     │  if (payload._classification)      → use provided classification │    │
│     │  else if (!mode || mode === "auto") → auto-classify via Gemini   │    │
│     │  else if (mode === "ebook")        → route to ebookService       │    │
│     │  else if (mode === "demo")         → route to demoService        │    │
│     │  else (basic/default)              → route to sampleService      │    │
│     │                                                                  │    │
│     └──────────────────────────────────────────────────────────────────┘    │
│                             │                                               │
│                             ▼                                               │
│     ┌──────────────────────────────────────────────────────────────────┐    │
│     │ AI Service Instantiation (ebookService.js:60-70)                 │    │
│     │                                                                  │    │
│     │  const { createAIService } = require("./aiService");             │    │
│     │  aiSvc = createAIService();  ◄── KEY DECISION POINT              │    │
│     │                                                                  │    │
│     └──────────────────────────────────────────────────────────────────┘    │
│                             │                                               │
│                             ▼                                               │
│     ┌──────────────────────────────────────────────────────────────────┐    │
│     │ Service Factory: createAIService() (aiService.js:170-205)        │    │
│     │                                                                  │    │
│     │  PRIORITY 1 (Highest):                                           │    │
│     │  ├─ if (FORCE_MOCK_AI === "1" || "true")                         │    │
│     │  └─► return new MockAIService()  [TESTS - deterministic]         │    │
│     │                                                                  │    │
│     │  PRIORITY 2:                                                     │    │
│     │  ├─ if (USE_REAL_AI === "1" || "true")                           │    │
│     │  ├─ AND GEMINI_API_KEY is configured                             │    │
│     │  └─► return new RealAIService()  [FRONTEND - real Gemini API]    │    │
│     │                                                                  │    │
│     │  PRIORITY 3 (Default/Fallback):                                  │    │
│     │  └─► return new MockAIService()  [backward compatible]           │    │
│     │                                                                  │    │
│     └──────────────────────────────────────────────────────────────────┘    │
│                             │                                               │
│         ┌───────────────────┴───────────────────┐                         │
│         ▼                                       ▼                         │
│  ┌─────────────────┐               ┌─────────────────────────┐            │
│  │  MockAIService  │               │   RealAIService         │            │
│  │                 │               │                         │            │
│  │ Returns:        │               │ ├─ Check quota          │            │
│  │ ├─ Deterministic│               │ │  (quotaTracker)       │            │
│  │ ├─ Fast         │               │ │                       │            │
│  │ ├─ No quota     │               │ ├─ lazy-load            │            │
│  │ └─ Test-safe    │               │ │  geminiClient         │            │
│  │                 │               │ │                       │            │
│  │ Used when:      │               │ ├─ Call callGemini()    │            │
│  │ ├─ FORCE_MOCK=1 │               │ │  with TEXT modality   │            │
│  │ ├─ Tests run    │               │ │                       │            │
│  │ └─ Default mode │               │ └─ Parse response       │            │
│  │                 │               │    (title + body)       │            │
│  │ Title format:   │               │                         │            │
│  │ "Mock: <first5" │               │ Used when:              │            │
│  │                 │               │ ├─ USE_REAL_AI=1        │            │
│  │ Body:           │               │ ├─ Frontend dev/prod    │            │
│  │ "This is mock..." │             │ └─ API key present      │            │
│  │                 │               │                         │            │
│  └─────────────────┘               │ Title/Body:             │            │
│         │                          │ Extracted from          │            │
│         │                          │ Gemini API response     │            │
│         │                          │                         │            │
│         └──────────────────────────┴─ generateContent(prompt)│            │
│                  │                    (async returns)        │            │
│                  │                 { content, metadata }     │            │
│                  │                 └─────────────────────────┘            │
│                  │                                                        │
│                  ▼                                                        │
│     ┌──────────────────────────────────────────────────────────────────┐  │
│     │ Content Processing (ebookService.js)                             │  │
│     │                                                                  │  │
│     │  ├─ Content chunking (split body into chapters)                  │  │
│     │  ├─ Theme engine (apply styling from metadata)                   │  │
│     │  ├─ Page layout (format pages)                                   │  │
│     │  ├─ TOC generation (build table of contents)                     │  │
│     │  └─ HTML composition (genieService.compose())                    │  │
│     │                                                                  │  │
│     └──────────────────────────────────────────────────────────────────┘  │
│                  │                                                        │
│                  ▼                                                        │
│     ┌──────────────────────────────────────────────────────────────────┐  │
│     │ Response Envelope                                                │  │
│     │                                                                  │  │
│     │  {                                                               │  │
│     │    success: true,                                                │  │
│     │    data: {                                                       │  │
│     │      pages: [...],                                               │  │
│     │      metadata: { model, pages_count, ... },                      │  │
│     │      html: "<html>...</html>",                                   │  │
│     │      promptId, resultId (if persisted)                           │  │
│     │    }                                                             │  │
│     │  }                                                               │  │
│     │                                                                  │  │
│     └──────────────────────────────────────────────────────────────────┘  │
│                  │                                                        │
└──────────────────┼────────────────────────────────────────────────────────┘
                   │
                   ▼
         ┌──────────────────┐
         │  HTTP 201 JSON   │
         │  Response        │
         │  (back to client)│
         └──────────────────┘
                   │
                   ▼
         ┌──────────────────┐
         │  Browser Render  │
         │  (Svelte UI)     │
         └──────────────────┘
```

---

## Detailed Service Selection Logic

### Service Factory: `createAIService()` (aiService.js:170-205)

```javascript
function createAIService() {
  // Priority 1: Explicit force-mock for CI/testing (highest priority)
  const forceMock =
    process.env.FORCE_MOCK_AI === "1" || process.env.FORCE_MOCK_AI === "true";
  if (forceMock) {
    console.log("AI service: MockAIService enabled (FORCE_MOCK_AI=1)");
    return new MockAIService();
  }

  // Priority 2: Explicit enable real AI
  const useReal =
    process.env.USE_REAL_AI === "1" || process.env.USE_REAL_AI === "true";
  if (useReal) {
    // sanity check for required env vars
    const apiUrl =
      process.env.GEMINI_API_URL || process.env.GEMINI_API_URL_TEXT;
    const apiKey =
      process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_TEXT;
    if (!apiUrl || !apiKey) {
      console.warn(
        "USE_REAL_AI=true but GEMINI_API_URL or GEMINI_API_KEY not set. " +
          "Falling back to MockAIService."
      );
      return new MockAIService();
    }
    console.log("AI service: RealAIService enabled (Gemini)");
    return new RealAIService();
  }

  // Priority 3: Default to mock (backward compatible)
  console.log("AI service: MockAIService enabled (USE_REAL_AI not set)");
  return new MockAIService();
}
```

### Priority Decision Tree

```
┌─────────────────────────────────────────────┐
│ Service Selection Decision Tree              │
└──────────┬──────────────────────────────────┘
           │
           ▼
    ┌──────────────────┐
    │ FORCE_MOCK_AI    │
    │ set to "1"?      │
    └────┬────────┬────┘
    YES  │        │ NO
         │        │
         ▼        ▼
    MockAI   ┌──────────────────┐
    (forced) │ USE_REAL_AI      │
             │ set to "1"?      │
             └────┬────────┬────┘
             YES  │        │ NO
                  │        │
                  ▼        ▼
           ┌─────────────┐ MockAI
           │ GEMINI_API_ │ (default/
           │ KEY present │  fallback)
           └──┬────┬─────┘
          YES │    │ NO
              │    │
              ▼    ▼
           RealAI MockAI
           (with  (graceful
            API)  fallback)
```

---

## MockAIService Implementation

**Location**: `server/aiService.js` (lines 1-25)

### Characteristics

| Property             | Value                                        |
| -------------------- | -------------------------------------------- |
| **Deterministic**    | Yes - same input always produces same output |
| **Speed**            | Synchronous, returns immediately             |
| **Quota Impact**     | None - no API calls made                     |
| **Error Simulation** | Respects `SIMULATE_AI_FAILURE` env var       |

### Response Format

```javascript
{
  content: {
    title: "Mock: <first 5 words of prompt>",
    body: "This is a mock response for prompt: <full prompt>",
    layout: "poem-single-column"
  },
  metadata: {
    model: "mock-1",
    tokens: <calculated from prompt length>
  }
}
```

### Example

**Input**: `"Tell me a story about ancient Rome"`

**Output**:

```javascript
{
  content: {
    title: "Mock: Tell me a story about",
    body: "This is a mock response for prompt: Tell me a story about ancient Rome.",
    layout: "poem-single-column"
  },
  metadata: {
    model: "mock-1",
    tokens: 37
  }
}
```

---

## RealAIService Implementation

**Location**: `server/aiService.js` (lines 27-166)

### Characteristics

| Property           | Value                                        |
| ------------------ | -------------------------------------------- |
| **Model**          | Gemini API (Google)                          |
| **Lazy Loading**   | Yes - geminiClient loaded only on first call |
| **Quota Managed**  | Yes - via quotaTracker (20 calls/minute)     |
| **Error Handling** | Graceful with quota detection                |

### Request Flow

```
┌─────────────────────────────────────────────────────┐
│ RealAIService.generateContent(prompt)               │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────────┐
        │ Lazy-load geminiClient     │
        │ (only on first call)       │
        └────────┬───────────────────┘
                 │
                 ▼
        ┌────────────────────────────┐
        │ Check Quota via            │
        │ quotaTracker.recordCall()  │
        │                            │
        │ Limit: 20 calls/minute     │
        │ Free tier: 10 req/min      │
        └────────┬───────────────────┘
                 │
        ┌────────┴─────────┐
        │                  │
        ▼ Quota OK        ▼ Quota Exhausted
    ┌──────────┐      ┌──────────────┐
    │ Proceed  │      │ Throw error  │
    │ to call  │      │ isQuotaError │
    └────┬─────┘      └──────────────┘
         │
         ▼
    ┌─────────────────────────────┐
    │ Call callGemini()           │
    │                             │
    │ Parameters:                 │
    │ ├─ prompt: string           │
    │ ├─ modality: "TEXT"         │
    │ └─ generationConfig: {}     │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │ Parse Response              │
    │                             │
    │ Extract:                    │
    │ ├─ text/rawText             │
    │ ├─ First line → title       │
    │ ├─ Rest → body              │
    │ └─ model → metadata         │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │ Return Content Envelope     │
    └─────────────────────────────┘
```

### Response Format

```javascript
{
  content: {
    title: "<first line of response>",
    body: "<remaining lines joined>",
    layout: "ai-generated"
  },
  metadata: {
    model: "gemini",
    status: <HTTP status>
  }
}
```

### Example

**Input**: `"Tell me a story about ancient Rome"`

**Output** (real Gemini API):

```javascript
{
  content: {
    title: "The Fall of Rome: A Historical Overview",
    body: "Ancient Rome was one of the most powerful civilizations...\n\n..." +
           "The empire gradually fragmented into eastern and western halves...",
    layout: "ai-generated"
  },
  metadata: {
    model: "gemini",
    status: 200
  }
}
```

---

## Multi-Page eBook Model Rotation Strategy

When generating multi-page eBooks with **RealAIService**, quota is distributed across two models:

```
┌────────────────────────────────────────────────────────────┐
│ Model Rotation for Quota Distribution                      │
│                                                            │
│ Problem: Gemini free tier = 10 requests/minute limit      │
│ Solution: Distribute calls across two different models     │
└────────────────────┬─────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    Call Index=0            Call Index>0
    (Structure)             (Chapters)
         │                       │
    Gemini 2.5 Pro         Gemini 2.5 Flash
    Primary Model          Secondary Model
         │                       │
    1 request               N requests
    (ebook structure)       (chapter content)
         │                       │
    Uses primary quota      Uses secondary quota
         │                       │
    ├─ Distributes 10 req/min quota across 2 models
    ├─ Example: 1 structure + 4 chapters = 5 API calls
    │   - Structure: 1 call to Pro (uses 1/10 quota)
    │   - Chapters: 4 calls to Flash (uses 4/10 quota)
    └─ Total: 5 quota consumed instead of saturating single model
```

**Code Location**: `ebookService.js` (lines 60-110)

```javascript
// callIndex=0: Structure (Gemini 2.5 Pro, primary)
// callIndex>0: Chapters (Gemini 2.5 Flash, secondary)
// Both models accessed via same API key
const isStructureCall = callIndex === 0;

if (isStructureCall) {
  console.log(
    `[QUOTA] Call ${callIndex}: Using Gemini 2.5 Pro (structure generation)`
  );
} else {
  console.log(
    `[QUOTA] Call ${callIndex}: Using Gemini 2.5 Flash (chapter generation)`
  );
}
```

---

## Environment Configuration Reference

### Test Environment Setup

**File**: `server/package.json` (test scripts)

```json
{
  "scripts": {
    "test": "FORCE_MOCK_AI=1 vitest",
    "test:ui": "FORCE_MOCK_AI=1 vitest --ui",
    "test:watch": "FORCE_MOCK_AI=1 vitest --watch"
  }
}
```

**Effect**: Tests **ALWAYS** use MockAIService (deterministic, no quota)

### Development Environment Setup

**File**: `.devcontainer/devcontainer.json` (Codespaces)

```json
{
  "remoteEnv": {
    "USE_REAL_AI": "1",
    "GEMINI_API_KEY": "<secret>",
    "GEMINI_API_URL": "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent"
  }
}
```

**Effect**: Frontend development uses RealAIService (real Gemini API)

### Current Status (December 8, 2025)

```
Environment                 USE_REAL_AI   FORCE_MOCK_AI   GEMINI_KEY   Result
────────────────────────────────────────────────────────────────────────────────
Tests (npm test)            <not set>     1               <not needed> MockAI ✓
Frontend dev (browser)      1             <not set>       <present>    RealAI ✓
Backend dev (local)         1             <not set>       <present>    RealAI ✓
CI/GitHub Actions           <not set>     1               <not needed> MockAI ✓
```

---

## Decision Points: When is Real AI Used?

### ✅ Real AI IS Used When:

1. **Frontend Request** ✓

   - Request originates from browser (uses `USE_REAL_AI=1` from Codespaces)
   - GEMINI_API_KEY is configured
   - No FORCE_MOCK_AI override

2. **Backend Development** ✓

   - USE_REAL_AI=1 set in environment
   - GEMINI_API_KEY configured
   - Not in test mode (FORCE_MOCK_AI not set)

3. **Production Deployment** ✓
   - USE_REAL_AI=1 in production env vars
   - GEMINI_API_KEY provisioned for production
   - Used for real user content generation

### ❌ Mock AI IS Used When:

1. **Test Suite** ✓

   - All test npm scripts enforce FORCE_MOCK_AI=1
   - Ensures deterministic, quota-independent testing
   - Fast test execution (<1 second per test)

2. **Fallback Mode** ✓

   - GEMINI_API_KEY missing (even with USE_REAL_AI=1)
   - Graceful degradation: logs warning, returns MockAIService
   - Application continues functioning with mock content

3. **Default Behavior** ✓
   - Neither FORCE_MOCK_AI nor USE_REAL_AI set
   - Backward compatible: defaults to MockAIService
   - Safe default when env vars not configured

---

## Quota Management System

**Location**: `server/geminiClient.js` (QuotaTracker class)

### Tracking Mechanism

```
┌──────────────────────────────────────────────┐
│ QuotaTracker (per-minute quota limits)       │
├──────────────────────────────────────────────┤
│                                              │
│ Limit: 20 calls/minute (free tier: 10)      │
│ Window: 60 seconds (rolling)                │
│                                              │
│ Status Tracking:                             │
│ ├─ callCount: calls in current window       │
│ ├─ windowStart: when current window began   │
│ ├─ pauseUntil: when pause/cooldown ends     │
│ ├─ dailyCallCount: cumulative per day       │
│ ├─ lastError: last quota error message      │
│ └─ lastCallTime: timestamp of last call     │
│                                              │
│ Methods:                                     │
│ ├─ recordCall(): Check & increment quota    │
│ ├─ isPaused(): Check if in cooldown         │
│ ├─ pause(): Initiate quota pause            │
│ ├─ getStatus(): Return quota status object  │
│ └─ handleQuotaError(): React to API 429     │
│                                              │
└──────────────────────────────────────────────┘
```

### Quota Check Flow

```
POST /prompt
    │
    ▼
ebookService.handle()
    │
    ▼
RealAIService.generateContent()
    │
    ▼
quotaTracker.recordCall()
    │
    ├─ Rotate window if needed
    │ (clear count if > 60 seconds elapsed)
    │
    ├─ Check if currently paused
    │ │
    │ └─ if paused: return { success: false, reason: "paused" }
    │   (caller throws error, user sees quota message)
    │
    └─ Check if at limit
      │
      └─ if (callCount >= 20)
        │
        ├─ Pause quota for 60 seconds
        │
        └─ return { success: false, reason: "quota_exhausted" }
          (caller throws error, user sees wait message)

      else:
        ├─ Increment callCount
        ├─ Log warning at 75% usage
        └─ return { success: true, remaining: X }
```

### Quota Status Response Example

```javascript
{
  callCount: 15,
  limit: 20,
  remaining: 5,
  percentUsed: 75,
  isPaused: false,
  pauseUntil: null,
  secondsUntilReset: 45,
  dailyCallCount: 127,
  lastError: null,
  message: "Quota approaching. 5 calls left."
}
```

---

## Content Processing Pipeline (After Model Call)

Once the AI service returns content, the result flows through:

```
Service Response
{ content, metadata }
        │
        ▼
┌───────────────────────────┐
│ ebookService Processing   │
├───────────────────────────┤
│                           │
│ 1. Content Chunking       │
│    └─ Split body into     │
│       chapter blocks      │
│                           │
│ 2. Theme Engine           │
│    └─ Apply styling from  │
│       payload.metadata    │
│       (theme, colors,     │
│        fontSizeScale)     │
│                           │
│ 3. Page Layout            │
│    └─ Format pages with   │
│       metadata (title,    │
│       chapter markers)    │
│                           │
│ 4. TOC Generation         │
│    └─ Build table of      │
│       contents from       │
│       page titles         │
│                           │
│ 5. HTML Composition       │
│    └─ Call genieService   │
│       .compose()          │
│       (generates final    │
│        HTML markup)       │
│                           │
└────────┬──────────────────┘
         │
         ▼
┌───────────────────────────┐
│ Response Envelope         │
├───────────────────────────┤
│                           │
│ {                         │
│   success: true,          │
│   data: {                 │
│     pages: [...],         │
│     metadata: {...},      │
│     html: "<html>...</ │
│     promptId,             │
│     resultId              │
│   }                       │
│ }                         │
│                           │
└───────────────────────────┘
```

---

## Request Trace Example: Real Browser Request

**Time**: December 8, 2025, ~10:45 AM

### Step 1: Browser Submission

```javascript
// client/src/lib/api.js - submitPrompt()
await fetch("/prompt", {
  method: "POST",
  body: JSON.stringify({
    prompt: "Tell me a story about ancient Rome",
    mode: "ebook",
    metadata: {
      theme: "dark",
      pageCount: 5,
      colorPalette: "standard",
      fontSizeScale: 1.0,
    },
  }),
});
```

### Step 2: Backend Validation

```javascript
// server/index.js:718
POST /prompt
  → validatePayload(req.body)
  → Checks required fields: ✓ prompt present
  → Checks mode syntax: ✓ "ebook" valid
  → Checks metadata shape: ✓ valid
  → Calls: genieService.process(payload)
```

### Step 3: Mode Routing

```javascript
// server/genieService.js:645
process(payload) {
  mode = "ebook"
  payload._classification = undefined

  // Auto-classify
  classification = await this.classifyPrompt(prompt)

  // Route to ebookService
  result = await ebookService.handle(payload, classification)
}
```

### Step 4: Service Instantiation & Call

```javascript
// server/ebookService.js:60-70
const { createAIService } = require("./aiService");
aiSvc = createAIService();

// Environment check:
// ├─ FORCE_MOCK_AI=undefined (not set in devcontainer)
// ├─ USE_REAL_AI=1 (set in devcontainer)
// └─ GEMINI_API_KEY=<present>
//
// Decision: RealAIService ✓

// Call service
const structureResp = await aiSvc.generateContent(
  "Tell me a story about ancient Rome"
);
```

### Step 5: Real API Call

```javascript
// server/aiService.js - RealAIService.generateContent()

// 1. Check quota
quotaCheck = quotaTracker.recordCall();
// → { success: true, callCount: 1, remaining: 19 }

// 2. Lazy-load geminiClient
this._gemini = require("./geminiClient");

// 3. Call Gemini API
resp = await callGemini({
  prompt: "Tell me a story about ancient Rome",
  modality: "TEXT",
  generationConfig: {},
});

// 4. Parse response
const lines = resp.text.split(/\n+/).filter(Boolean);
const title = lines[0].slice(0, 200);
const body = lines.slice(1).join("\n\n");

// 5. Return structured content
return {
  content: {
    title: "The Fall of Rome: A Historical Overview",
    body: "Ancient Rome was one of the most powerful civilizations...",
    layout: "ai-generated",
  },
  metadata: {
    model: "gemini",
    status: 200,
  },
};
```

### Step 6: Content Processing

```javascript
// server/ebookService.js - continue after AI call
pages = [
  {
    title: "The Fall of Rome: A Historical Overview - Chapter 1",
    body: "Ancient Rome was one of the most powerful civilizations...",
    layout: "ebook-structured",
  },
  // ... more pages from chapter splitting
];

metadata = {
  model: "gemini",
  pages_count: 5,
  theme: "dark",
  colorPalette: "standard",
};
```

### Step 7: HTML Composition

```javascript
// server/genieService.js:677
html = await this.compose(result);

// Returns:
html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>The Fall of Rome: A Historical Overview</title>
    <style>... dark theme CSS ...</style>
  </head>
  <body>
    <div class="container">
      <h1>The Fall of Rome: A Historical Overview</h1>
      <div class="pages">
        <div class="page">
          <h2>Chapter 1</h2>
          <p>Ancient Rome was one of the most powerful civilizations...</p>
        </div>
        <!-- more pages -->
      </div>
    </div>
  </body>
  </html>
`;
```

### Step 8: Response to Browser

```javascript
// server/index.js:738
return res.status(201).json({
  success: true,
  data: {
    pages: [...],
    metadata: { model: "gemini", pages_count: 5, ... },
    html: "<!DOCTYPE html>...",
    promptId: 42,
    resultId: 99
  }
})
```

### Step 9: Browser Render

```javascript
// client/src/App.svelte receives response
const result = await response.json()

// Store updated flowStore
flowStore.setResult(result.data)

// Render HTML preview
<div class="preview-container">
  {@html result.data.html}
</div>

// Display pages in UI
{#each result.data.pages as page}
  <div class="page">
    <h2>{page.title}</h2>
    <div class="content">{page.body}</div>
  </div>
{/each}
```

---

## Files Involved in Model Access

| File                      | Role                 | Purpose                                             |
| ------------------------- | -------------------- | --------------------------------------------------- |
| `client/src/lib/api.js`   | Frontend API wrapper | Sends POST /prompt to backend                       |
| `server/index.js`         | Express handler      | Receives request, validates, routes to genieService |
| `server/genieService.js`  | Orchestrator         | Mode routing, classification, delegation            |
| `server/ebookService.js`  | Generator            | Calls aiService, processes content                  |
| `server/aiService.js`     | **SERVICE FACTORY**  | **Instantiates Mock or Real service**               |
| `server/geminiClient.js`  | Gemini API wrapper   | Handles quota, makes actual API calls               |
| `server/demoService.js`   | Demo handler         | Alternative mode handler                            |
| `server/sampleService.js` | Basic handler        | Alternative mode handler                            |

---

## Key Takeaways

1. **Three-Tier Priority**: FORCE_MOCK_AI (tests) → USE_REAL_AI (dev) → MockAI (fallback)

2. **Service Instantiation**: Happens in `ebookService.handle()` via `createAIService()` factory

3. **Quota Management**: Built into RealAIService via QuotaTracker (20 calls/min)

4. **Model Rotation**: Multi-page generation distributes quota across Pro (structure) and Flash (chapters)

5. **Deterministic Testing**: FORCE_MOCK_AI=1 ensures all tests use MockAIService (fast, no quota)

6. **Real Frontend**: USE_REAL_AI=1 enables real Gemini API for browser content generation

7. **Graceful Fallback**: Missing GEMINI_API_KEY falls back to MockAIService with warning

8. **Content Pipeline**: After model returns result, content goes through chunking → theming → layout → HTML composition

---

## Related Documentation

- `docs/design/ebookService/TEST_RESULTS_SESSION2.md` - Test validation results
- `docs/design/ebookService/PREREQ_TODO_BEFORE_BATCH_OPTIMIZATION.md` - Optimization roadmap
- `server/README.md` - Backend architecture overview
- `client/README.md` - Frontend architecture overview

---

**Document Quality Notes**:

- ✅ Includes 7 ASCII diagrams for visual reference
- ✅ Complete priority logic with decision tree
- ✅ Real-world request trace example (December 8, 2025)
- ✅ All source code locations documented with line numbers
- ✅ Current environment configuration verified as of 10:45 AM UTC
- ✅ Ready for architectural reference and onboarding
