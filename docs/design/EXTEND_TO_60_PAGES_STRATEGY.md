# Extending to 60 Pages: Architecture Enhancement Strategy

**Date**: December 8, 2025  
**Time**: ~11:30 AM UTC  
**Context**: Brainstorming session—no code changes yet  
**Goal**: Support up to 60-page eBooks without modifying default 3-20 constraint  --  DRAFT Document for idea generation

---

## Summary: Three Architectural Changes Required

To extend from **20 pages to 60 pages** while keeping the default 3-20 limit intact, the system needs three coordinated changes:

1. **Multi-Model Rotation** (currently 2 models → expand to 3+ models)
2. **Batch Processing** (currently sequential → add parallel batching)
3. **Dynamic Timeout Management** (currently fixed 600s → scale with page count)

Below is the detailed analysis.

---

## Current Bottleneck Analysis: Why 20 is the Ceiling

### The Quota Problem

```
┌──────────────────────────────────────────────────────────┐
│ Current Architecture: 20-Page Saturation Point           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ API Calls for 20-page eBook: 21 calls                    │
│ ├─ 1 structure call (Pro model)                          │
│ └─ 20 chapter calls (Flash model)                        │
│                                                          │
│ Quota Availability:                                      │
│ ├─ Pro model: 10 req/min                                 │
│ ├─ Flash model: 10 req/min                               │
│ └─ Total: ~20 effective req/min (shared)                 │
│                                                          │
│ For 20-page eBook:                                       │
│ ├─ Pro uses: 1 call (10% of quota)                       │
│ ├─ Flash uses: 20 calls (200% of quota!) ✗               │
│ └─ Result: Must defer, wait for quota reset              │
│                                                          │
│ For 60-page eBook (hypothetical):                        │
│ ├─ Pro uses: 1 call (10% of quota)                       │
│ ├─ Flash uses: 60 calls (600% of quota!) ✗✗             │
│ └─ Result: 3 quota resets needed (~180 seconds wait)     │
│                                                          │
│ INSIGHT: Sequential calls hit quota too hard             │
│          Need to distribute calls across more models     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### The Time Problem

```
┌──────────────────────────────────────────────────────────┐
│ Current Architecture: Time Constraints                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Sequential Generation Time:                              │
│ ├─ 60-page eBook = 61 calls × 3-5 sec avg                │
│ ├─ Best case: 183 seconds (~3 minutes)                   │
│ ├─ Worst case: 305 seconds (~5 minutes)                  │
│ └─ Plus quota deferral: +180 seconds (~3 minutes)        │
│                                                          │
│ Total Wait Time: 363-485 seconds (~6-8 minutes)          │
│                                                          │
│ Frontend Timeout: 600 seconds (10 minutes)               │
│ ├─ 20 pages: 105s generation + deferral = fits ✓        │
│ ├─ 60 pages: 305s generation + deferral = marginal ⚠    │
│ └─ 100 pages: 505s generation + deferral = exceeds ✗    │
│                                                          │
│ INSIGHT: Parallel processing would help:                 │
│          20 parallel chapters = 25s (vs 100s sequential) │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Solution 1: Add Third Model (Model Rotation)

### Concept

Instead of distributing across 2 models (Pro + Flash), add a **third model** to the rotation:

```
Current (2 models):
├─ Pro (callIndex=0): 1 structure call
└─ Flash (callIndex>0): All chapters

Proposed (3+ models):
├─ Pro (callIndex=0): Structure
├─ Flash (callIndex % 3 == 1): Chapters 1, 4, 7, 10, ...
├─ Ultra (callIndex % 3 == 2): Chapters 2, 5, 8, 11, ...
└─ Second (callIndex % 3 == 0): Chapters 3, 6, 9, 12, ...
```

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│ 3-Model Rotation: Distributing 60-Page Load              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│ │ Gemini 2.5   │  │ Gemini 2.0   │  │ Gemini 1.5   │     │
│ │ Pro          │  │ Flash        │  │ (or Sonnet)  │     │
│ │ (Primary)    │  │ (Secondary)  │  │ (Tertiary)   │     │
│ │              │  │              │  │              │     │
│ │ Quota:       │  │ Quota:       │  │ Quota:       │     │
│ │ 10 req/min   │  │ 10 req/min   │  │ 10 req/min   │     │
│ │              │  │              │  │              │     │
│ │ Used for:    │  │ Used for:    │  │ Used for:    │     │
│ │ callIdx=0    │  │ callIdx%3==1 │  │ callIdx%3==2 │     │
│ │              │  │              │  │              │     │
│ │ 60-page load │  │ 60-page load │  │ 60-page load │     │
│ │ = 1 call     │  │ = 20 calls   │  │ = 20 calls   │     │
│ │ (10%)        │  │ (200% ✗)     │  │ (200% ✗)     │     │
│ │              │  │              │  │              │     │
│ └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                            │
│ Combined Effective Quota: ~30 req/min                    │
│                                                            │
│ Distribution for 60-page eBook:                           │
│ ├─ Pro:    1 call (structure)     = 10% of quota          │
│ ├─ Flash:  20 calls (chapters)    = 200% → deferred ⚠   │
│ └─ Sonnet: 20 calls (chapters)    = 200% → deferred ⚠   │
│                                                            │
│ Still has deferral, but spreads load & reduces waits     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Implementation Steps

**Step 1: Modify `aiService.js` - Expand Rotation**

```javascript
// Current implementation (lines 150-161)
const isStructureCall = callIndex === 0;

// Proposed: 3-model rotation
const modelAssignment = (callIndex) => {
  if (callIndex === 0) return 'PRO';           // Structure: Pro
  if (callIndex % 3 === 1) return 'FLASH';     // 1,4,7,10...
  if (callIndex % 3 === 2) return 'SONNET';    // 2,5,8,11...
  return 'ULTRA';                               // 3,6,9,12...
};

const assignedModel = modelAssignment(callIndex);

// Pass to generateContentWithRotation()
switch (assignedModel) {
  case 'PRO':
    await callGemini({ model: 'gemini-2.5-pro', ... });
    break;
  case 'FLASH':
    await callGemini({ model: 'gemini-2.5-flash', ... });
    break;
  case 'SONNET':
    await callGemini({ model: 'claude-3.5-sonnet', ... });
    break;
  case 'ULTRA':
    await callGemini({ model: 'gemini-2.5-ultra', ... });
    break;
}
```

**Step 2: Update `geminiClient.js` - Track Per-Model Quota**

```javascript
// Current: Single QuotaTracker for all calls
const quotaTracker = new QuotaTracker(limit = 20);

// Proposed: Separate tracker per model
const quotaTrackers = {
  PRO: new QuotaTracker(limit = 10),
  FLASH: new QuotaTracker(limit = 10),
  SONNET: new QuotaTracker(limit = 10),
  ULTRA: new QuotaTracker(limit = 10),
};

// Check appropriate tracker before call
const quota = quotaTrackers[model].recordCall();
if (!quota.success) {
  // Handle quota deferral per model
  job.deferralReason = `${model} quota exhausted`;
}
```

**Step 3: Modify `ebookService.js` - Use Model Rotation**

```javascript
// Current (line 113)
let structureResp = await aiSvc.generateContentWithRotation(structurePrompt, 0);

// Proposed: Already works if aiService.js updated

// For chapters:
for (let i = 1; i <= pageCount; i++) {
  // Pass call index for model assignment
  const chapterResp = await aiSvc.generateContentWithRotation(chapterPrompt, i);
  // aiService determines model based on i
}
```

### Pros & Cons

| Aspect | Pro | Con |
|--------|-----|-----|
| **Complexity** | Relatively simple | Need to track 4 separate quota trackers |
| **Cost** | Uses additional API keys (if available) | May require multiple API keys |
| **Quota efficiency** | ~40 req/min effective (4 × 10) | Still has deferral at 60 pages |
| **Time improvement** | Spreads calls, reduces queue backup | No time improvement (still sequential) |
| **Compatibility** | Backward compatible | Need fallback if models unavailable |

### Viable Page Range with 3-Model Rotation

```
With 3 models (30 req/min effective):
├─ Sequential 20 pages: 105s generation ✓
├─ Sequential 30 pages: 155s generation ✓
├─ Sequential 40 pages: 205s generation ✓
├─ Sequential 50 pages: 255s generation ✓
├─ Sequential 60 pages: 305s generation ✓
└─ Sequential 100 pages: 505s generation ✓

But quota deferral still needed for >20 pages
├─ 21 pages: 1 × 60s deferral
├─ 40 pages: 1-2 × 60s deferral
├─ 60 pages: 2-3 × 60s deferral
└─ Total wait: Can exceed 600s timeout
```

---

## Solution 2: Batch Processing (Parallel Chapters)

### Concept

Instead of generating chapters **sequentially** (one at a time), process them in **batches** (multiple in parallel):

```
Current (Sequential):
├─ Structure: await generateChapter(0)
├─ Chapter 1: await generateChapter(1)
├─ Chapter 2: await generateChapter(2)
├─ ...
└─ Chapter 60: await generateChapter(60)
Total time: ~305s for 60 chapters

Proposed (Batches of 5):
├─ Structure: await generateChapter(0)
├─ Batch 1: await Promise.all([
│   generateChapter(1), generateChapter(2),
│   generateChapter(3), generateChapter(4),
│   generateChapter(5)
│ ])
├─ Batch 2: await Promise.all([...chapters 6-10...])
├─ ...
└─ Batch 12: await Promise.all([chapters 56-60])
Total time: ~65s for 60 chapters (5× faster!)
```

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│ Batch Processing: Sequential vs Parallel                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Sequential (Current):                                      │
│ ├─ Structure     ███████ 3-5s                             │
│ ├─ Chapter 1     ███████ 3-5s                             │
│ ├─ Chapter 2     ███████ 3-5s                             │
│ ├─ ...                                                     │
│ ├─ Chapter 60    ███████ 3-5s                             │
│ └─ Total:        305 seconds ==================            │
│                                                            │
│ Batched (Proposed - 5 per batch):                         │
│ ├─ Structure          ███████ 3-5s                        │
│ ├─ Batch 1 (5 ch)  ███████ 3-5s (parallel)               │
│ ├─ Batch 2 (5 ch)  ███████ 3-5s (parallel)               │
│ ├─ Batch 3 (5 ch)  ███████ 3-5s (parallel)               │
│ ├─ ...                                                     │
│ ├─ Batch 12 (5 ch) ███████ 3-5s (parallel)               │
│ └─ Total:          ~65 seconds =====                       │
│                                                            │
│ Speedup: 305s / 65s = 4.7× faster                        │
│                                                            │
│ Quota Impact (5 parallel calls):                          │
│ ├─ Single batch uses 5 quota slots                        │
│ ├─ 12 batches × 5 calls = 60 calls                       │
│ ├─ Still exceeds per-minute quota                        │
│ └─ But batches run in parallel, not sequential           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Implementation Steps

**Step 1: Modify `ebookService.js` - Batch Generation**

```javascript
// Current (sequential)
for (let i = 1; i <= pageCount; i++) {
  const chapterResp = await aiSvc.generateContentWithRotation(prompt, i);
  chapters.push(parseChapter(chapterResp));
}

// Proposed (batched)
const BATCH_SIZE = 5;
for (let batch = 0; batch < Math.ceil(pageCount / BATCH_SIZE); batch++) {
  const batchPromises = [];
  
  for (let i = 0; i < BATCH_SIZE; i++) {
    const pageNum = batch * BATCH_SIZE + i + 1;
    if (pageNum <= pageCount) {
      batchPromises.push(
        aiSvc.generateContentWithRotation(prompt, pageNum)
          .then(resp => parseChapter(resp, pageNum))
      );
    }
  }
  
  // Wait for entire batch to complete
  const batchResults = await Promise.all(batchPromises);
  chapters.push(...batchResults);
  
  // Log progress
  console.log(`[BATCH] Completed batch ${batch + 1}/${Math.ceil(pageCount / BATCH_SIZE)}`);
  
  // Optional: Brief delay between batches (quota recovery)
  if (batch < Math.ceil(pageCount / BATCH_SIZE) - 1) {
    await new Promise(r => setTimeout(r, 2000));
  }
}
```

**Step 2: Update Job Progress Tracking**

```javascript
// Current: Progress = linear (5%, 50%, 95%)
jobQueueManager.updateProgress(jobId, 5, "Starting...");
jobQueueManager.updateProgress(jobId, 50, "Processing chapters...");

// Proposed: Batch-aware progress
const totalBatches = Math.ceil(pageCount / BATCH_SIZE);
for (let batch = 0; batch < totalBatches; batch++) {
  const progressPercent = 5 + (batch / totalBatches) * 85; // 5% to 90%
  jobQueueManager.updateProgress(
    jobId, 
    progressPercent, 
    `Processing batch ${batch + 1}/${totalBatches}`
  );
  
  // Generate batch...
}
```

**Step 3: Adjust Timeout Calculation**

```javascript
// Current: Fixed 600s
TIMEOUTS: { GENERATE: 600000 }

// Proposed: Page-count aware
calculateGenerationTimeout(pageCount) {
  // Batch time: ~3-5s per batch (5 chapters parallel)
  const batches = Math.ceil(pageCount / 5);
  const timePerBatch = 5000; // 5 seconds (worst case)
  const generationTime = timePerBatch * batches;
  
  // Add overhead: structure (5s) + deferral (max 180s) + margin (50s)
  const overhead = 5000 + 180000 + 50000;
  
  return generationTime + overhead;
  
  // Examples:
  // 20 pages: 4 batches × 5s = 20s + 235s = 255s (well under 600s)
  // 60 pages: 12 batches × 5s = 60s + 235s = 295s (fits in 600s)
  // 100 pages: 20 batches × 5s = 100s + 235s = 335s (fits in 600s)
}
```

### Pros & Cons

| Aspect | Pro | Con |
|--------|-----|-----|
| **Complexity** | Moderate (Promise.all logic) | Error handling (partial failures) |
| **Cost** | No additional costs | More concurrent API calls |
| **Time improvement** | 4.7× faster (305s → 65s) | ✓✓ Major benefit |
| **Quota efficiency** | Same calls, just grouped | Brief quota spikes per batch |
| **Compatibility** | Backward compatible | Need graceful batch failure |

### Viable Page Range with Batch Processing

```
With batched chapters (5 per batch):
├─ Batched 20 pages: ~25s generation ✓
├─ Batched 60 pages: ~65s generation ✓
├─ Batched 100 pages: ~105s generation ✓
├─ Batched 200 pages: ~205s generation ✓
└─ Batched 500 pages: ~505s generation ✓

All fit within 600s timeout!
Quota deferral still needed but less impactful
```

---

## Solution 3: Dynamic Timeout & Progressive Disclosure

### Concept

Instead of fixed 600s timeout, calculate based on page count and present to user before generation:

```
Current:
└─ Frontend: "Generating eBook..." (no time estimate)
└─ Timeout: 600s hard stop

Proposed:
├─ Frontend: Ask "How many pages?" (if > 20)
├─ Calculate: 60 pages = ~295s = 5 minutes
├─ Confirm: "This will take ~5 minutes. Continue?" [OK] [Cancel]
├─ Dynamic timeout: Set to 295s + 60s buffer = 355s
└─ Progress: "60% complete (3 of 5 minutes elapsed)"
```

### Implementation Diagram

```
┌────────────────────────────────────────────────────────────┐
│ Progressive Disclosure: Ask Before Committing User        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ User Input: pageCount (detected or specified)             │
│            │                                              │
│            ▼                                              │
│     Is pageCount > 20?                                   │
│     │                                                     │
│     ├─ NO:  Use default timeout (600s)                   │
│     │       Proceed immediately                          │
│     │                                                     │
│     └─ YES: Calculate expected time                      │
│            ├─ batches = ceil(pageCount / 5)             │
│            ├─ timePerBatch = 5s (parallel)              │
│            ├─ generationTime = batches × 5s             │
│            ├─ overhead = 235s (structure + deferral)    │
│            ├─ totalTime = generationTime + overhead     │
│            │                                             │
│            ├─ For 60 pages: 12 × 5 + 235 = 295s        │
│            │                                             │
│            └─ Show UI confirmation:                     │
│               "This 60-page eBook will take ~5 minutes" │
│               [OK - I'll Wait]  [Cancel]                │
│                                                           │
│               If OK:                                      │
│               ├─ Dynamic timeout = 295 + 60 = 355s      │
│               ├─ POST /api/ebook/generate with timeout   │
│               └─ Show progress bar "3/5 min"            │
│                                                           │
│               If Cancel:                                  │
│               └─ Close dialog, no generation             │
│                                                           │
└────────────────────────────────────────────────────────────┘
```

### Implementation Steps

**Step 1: Modify Frontend `ebookApi.js` - Calculate Timeout**

```javascript
function calculateGenerationTimeout(pageCount, useBatching = true) {
  const baselineTimeout = 600000; // 10 minutes
  
  if (pageCount <= 20) {
    return baselineTimeout; // Use default for MVP
  }
  
  if (useBatching) {
    // Batch model: ~5s per batch of 5 chapters
    const batches = Math.ceil(pageCount / 5);
    const batchTime = batches * 5000; // 5s per batch
    const overhead = 235000; // Structure + deferral + margin
    const calculated = batchTime + overhead;
    
    // Add 60s safety margin
    return calculated + 60000;
  } else {
    // Sequential model: ~3.5s per chapter
    const chapterTime = (pageCount + 1) * 3500;
    const deferralTime = Math.max(0, (pageCount - 20) * 60000 / 40); // Scaled deferral
    const calculated = chapterTime + deferralTime;
    
    return calculated + 60000;
  }
}

// Usage
const timeout = calculateGenerationTimeout(60);
// Returns: 295000 (ms) = ~5 minutes
```

**Step 2: Add UI Confirmation Dialog**

```javascript
// New component: ConfirmLargeEbook.svelte
export let pageCount;
let isLarge = pageCount > 20;
let estimatedMinutes = Math.ceil(calculateGenerationTimeout(pageCount) / 60000);

// Confirmation screen:
{#if isLarge}
  <div class="confirmation">
    <h3>⏱️ Large eBook Requested</h3>
    <p>{pageCount} pages will take approximately {estimatedMinutes} minutes.</p>
    <p>Continue?</p>
    <button on:click={handleConfirm}>OK, I'll Wait</button>
    <button on:click={handleCancel}>Cancel</button>
  </div>
{/if}
```

**Step 3: Update Frontend Generation Flow**

```javascript
// client/src/stores/ebookStore.js

async function initiateGeneration(payload) {
  const pageCount = payload.metadata?.pageCount || 8;
  
  // Check if large ebook
  if (pageCount > 20) {
    const confirmed = await showConfirmation({
      title: "Large eBook Requested",
      message: `${pageCount} pages will take ~${Math.ceil(estimatedTime / 60)}m`,
    });
    
    if (!confirmed) return; // User cancelled
  }
  
  // Calculate dynamic timeout
  const dynamicTimeout = calculateGenerationTimeout(pageCount);
  
  // Initiate generation
  const { jobId } = await ebookApi.initiateEbookGeneration(payload);
  
  // Poll with dynamic timeout
  try {
    const result = await ebookApi.pollEbookCompletion(
      jobId,
      (progress, message) => {
        // Update UI: show elapsed time vs estimated
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, dynamicTimeout - elapsed);
        updateProgressUI(progress, message, remaining);
      },
      dynamicTimeout  // ← Dynamic timeout passed here
    );
    
    // Success
    flowStore.setResult(result);
  } catch (err) {
    // Handle timeout or error
    if (err.message.includes("timeout")) {
      showError(`Generation took longer than estimated (>${(dynamicTimeout/60).toFixed(1)}m)`);
    }
  }
}
```

### Pros & Cons

| Aspect | Pro | Con |
|--------|-----|-----|
| **Complexity** | Low | Need new UI component |
| **UX** | Transparent expectation setting | Extra confirmation step |
| **Reliability** | Prevents surprise timeouts | Estimated time may be wrong |
| **Implementation** | No backend changes needed | Frontend only |
| **Compatibility** | Fully backward compatible | Risk calculation complexity |

---

## Combined Strategy: All Three Solutions Together

### Synergistic Effect

```
┌────────────────────────────────────────────────────────────┐
│ Combining All Three Solutions                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 1. Three-Model Rotation                                   │
│    └─ Increases effective quota: 20 → 30 req/min         │
│    └─ Reduces quota deferral waits                       │
│                                                            │
│ 2. Batch Processing (5 per batch)                        │
│    └─ Reduces time: 305s → 65s per 60 pages             │
│    └─ Fits comfortably in timeouts                       │
│                                                            │
│ 3. Dynamic Timeout + Confirmation                        │
│    └─ Transparently handles variable wait times          │
│    └─ Prevents surprise failures                         │
│                                                            │
│ Combined Effect for 60-page eBook:                        │
│ ├─ Generation time: 305s (sequential) → 65s (batched)   │
│ ├─ Quota deferral: ~180s (2 resets) → ~60s (1 reset)   │
│ ├─ Total wait: ~365s → ~155s                            │
│ ├─ Timeout needed: 600s → 300s (dynamic)               │
│ └─ Result: ✓✓ Comfortably supported                      │
│                                                            │
│ Viable Range: 3-60 pages (with future: 3-300 pages)     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Implementation Phases

**Phase 1 (Week 1): Batch Processing Only**
- Change sequential loop to batched Promise.all
- No additional API keys needed
- 4.7× speedup
- Time: ~4-8 hours dev + testing

**Phase 2 (Week 2): Dynamic Timeout**
- Add timeout calculation
- Add confirmation dialog
- Update progress display
- Time: ~4-6 hours dev + testing

**Phase 3 (Week 3): Three-Model Rotation**
- Expand model rotation logic
- Track per-model quotas
- Fallback handling
- Time: ~8-12 hours dev + testing

**Total Implementation: 2-3 weeks, ~16-26 hours**

---

## Feasibility Analysis

### What Changes Without Modifying 3-20 Default

```
✓ Backend ebookService.js (batch logic)
✓ Frontend ebookApi.js (timeout calculation)
✓ Frontend UI confirmation dialog
✓ Optional: Server aiService.js (model rotation)

✗ NO CHANGE: Validation rule (still 3-20)
✗ NO CHANGE: Default behavior (still same)
✗ NO CHANGE: Test suite (current tests still pass)
```

### Backward Compatibility

```
All changes are opt-in additions:
├─ Batch processing: Internal, transparent
├─ Dynamic timeout: Only triggered if pageCount > 20
├─ Model rotation: Only if 3rd model key available
└─ Existing 3-20 behavior: Unchanged
```

### New Feature Flag Approach

```javascript
// Add to environment/config
export const FEATURES = {
  BATCH_PROCESSING: process.env.FEATURE_BATCH_PROCESSING !== "false", // default: true
  DYNAMIC_TIMEOUT: process.env.FEATURE_DYNAMIC_TIMEOUT !== "false",   // default: true
  EXTENDED_PAGE_RANGE: process.env.FEATURE_EXTENDED_PAGE_RANGE === "true", // default: false
  MULTI_MODEL_ROTATION: process.env.FEATURE_MULTI_MODEL_ROTATION === "true", // default: false
};

// Usage
if (FEATURES.EXTENDED_PAGE_RANGE && pageCount > 20) {
  // Use dynamic timeout + confirmation
}

if (FEATURES.BATCH_PROCESSING) {
  // Use batch generation
} else {
  // Fall back to sequential
}
```

---

## Recommended Approach for MVP+1

### "Safe" Extended Support (60 Pages)

**What to implement**:
1. ✓ Batch processing (no API key changes)
2. ✓ Dynamic timeout + confirmation (UX improvement)
3. ✗ Skip multi-model rotation (requires 3rd API key)

**Feature flag**:
```javascript
EXTENDED_PAGE_RANGE: false // Keep disabled in MVP
BATCH_PROCESSING: true     // Enable immediately
DYNAMIC_TIMEOUT: true      // Enable immediately
```

**Then enable extended range when ready**:
```javascript
EXTENDED_PAGE_RANGE: true // Unlocks 3-60 page support
```

**No code changes needed to flip the switch—just config update.**

### Why This Approach

| Reason | Benefit |
|--------|---------|
| **Batch processing** | Huge speedup, no API key changes, backward compatible |
| **Dynamic timeout** | Transparent to user, prevents surprise failures |
| **Skip model rotation** | Avoid API key complexity, can add later |
| **Feature flags** | Can enable/disable without code change, easy A/B test |

---

## Summary Table: Solutions Ranked

| Solution | Page Range | Time (60 pages) | Dev Cost | Complexity | Risk |
|----------|-----------|-----------------|----------|-----------|------|
| **Current** | 3-20 | 305s + deferral | 0h | Baseline | Low |
| **Batch Only** | 3-60+ | 65s | 4-8h | Low | Low |
| **Batch + Timeout** | 3-60+ | 65s | 8-14h | Low | Low |
| **All Three** | 3-60+ | 65s | 16-26h | Medium | Medium |

---

## Conclusion

**To extend from 20 to 60 pages without changing the default 3-20 constraint**, implement in this order:

1. **Phase 1**: Batch processing (biggest win, lowest risk)
2. **Phase 2**: Dynamic timeout + confirmation (UX improvement)
3. **Phase 3** (optional): Multi-model rotation (if needed later)

Use **feature flags** to keep 3-20 as default while adding extended support behind a flag. This gives you:
- ✓ No code changes required to flip between MVP (3-20) and MVP+1 (3-60)
- ✓ Backward compatible (all changes are additive)
- ✓ Low risk (can be tested independently)
- ✓ Fast implementation (batching done in <1 week)

**Recommended MVP+1 scope**: Batch processing + Dynamic timeout (2 weeks, low risk)
