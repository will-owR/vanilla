# AI Service Implementation Guide: Option A Deep Dive

**Date**: November 24, 2025  
**Status**: Ready for Implementation  
**Branch**: `feat/B_Frontend_option2`  
**Scope**: Tactical details for enabling and managing Option A (USE_REAL_AI=1)

---

## Table of Contents

1. [Quick Start: Enable Option A](#1-quick-start-enable-option-a)
2. [Understanding the Code Architecture](#2-understanding-the-code-architecture)
3. [Environment Setup](#3-environment-setup)
4. [Running with Real Gemini](#4-running-with-real-gemini)
5. [Testing Strategies](#5-testing-strategies)
6. [Cost Tracking & Monitoring](#6-cost-tracking--monitoring)
7. [Debugging & Troubleshooting](#7-debugging--troubleshooting)
8. [Transition Phases Detail](#8-transition-phases-detail)
9. [Future: Option C Implementation Checklist](#9-future-option-c-implementation-checklist)
10. [FAQ & Common Issues](#10-faq--common-issues)

---

## 1. Quick Start: Enable Option A

### Step 1: Verify Gemini Credentials

```bash
# Check if credentials exist in environment
env | grep GEMINI

# Output should show:
# GEMINI_API_KEY=AIza...
# GEMINI_API_URL=https://...
# GEMINI_VISION_API_URL=https://...
```

**If not present**: Contact DevOps or check `.env.local` file in project root.

---

### Step 2: Enable Real AI

**Option A: Session-level (for current terminal)**

```bash
export USE_REAL_AI=1

# Verify
echo "USE_REAL_AI=${USE_REAL_AI:-not set}"
# Should output: USE_REAL_AI=1
```

**Option B: In `.env.local` (persistent, recommended for development)**

```bash
# Create or edit project root .env.local
echo "USE_REAL_AI=1" >> .env.local

# Verify
cat .env.local | grep USE_REAL_AI
```

**Option C: In `.env` file (project-wide, if exists)**

```bash
# Edit /workspaces/vanilla/.env (if file exists)
USE_REAL_AI=1
```

---

### Step 3: Start Server or Run Tests

```bash
# With session export (Step 2 Option A):
export USE_REAL_AI=1
npm --prefix server run test:run

# OR with .env.local (Step 2 Option B):
npm --prefix server run test:run  # Automatically loads .env.local
```

---

### Step 4: Verify Real AI is Active

**In logs, you should see**:

```
AI service: RealAIService enabled (Gemini)
```

**Instead of (mock)**:

```
AI service: MockAIService enabled (USE_REAL_AI not set)
```

---

### Step 5: Validate ebookService Output

**Real content**:

```javascript
// Image concept (REAL)
concept: "A serene forest clearing at dawn with soft golden light filtering through tall pines";

// vs MOCK
concept: "Concept 1";
```

**Structured data**:

```javascript
// Real output includes semantic content
{
  title: "The Mystery of Whisperwood Forest",
  chapters: [
    {
      title: "Chapter 1: The First Clue",
      content: "Inspector Morgan stepped out of her car...",
      image: {
        concept: "A misty forest with faint footprints in the snow",
        style: "gothic",
        tone: "mysterious"
      }
    }
  ]
}
```

---

## 2. Understanding the Code Architecture

### File Structure

```
server/
  ├── aiService.js                    # Entry point: toggles mock vs real
  ├── geminiClient.js                 # Gemini API wrapper (TEXT, IMAGE, IMAGERY)
  ├── ebookService.js                 # Content generation (uses aiService)
  ├── genieService.js                 # Composition + orchestration
  └── __tests__/
      ├── ebookService.unit.test.js   # Unit tests (inject mock)
      ├── genieService.compose.test.js
      └── genieService.integration.test.js
```

### Call Chain

```
1. Frontend (user clicks "Generate")
   ↓
2. genieService.process(payload, mode="ebook")
   ↓
3. ebookService.handle(payload)
   ↓
4. aiService.createAIService()  ← USE_REAL_AI checked here
   ├─ If true  → RealAIService (calls geminiClient.callGemini)
   └─ If false → MockAIService (returns "Mock: ...")
   ↓
5. geminiClient.callGemini(prompt, modality="TEXT")
   ├─ Calls GEMINI_API_URL
   ├─ Uses GEMINI_API_KEY for authentication
   └─ Returns structured JSON response
   ↓
6. ebookService parses response
   ├─ Extracts title, chapters, image concepts
   ├─ Applies theme styling
   └─ Returns structured data
   ↓
7. genieService.compose(structuredData)
   ├─ Generates HTML
   ├─ Resolves images (SVG library → Gemini)
   └─ Returns final PDF
   ↓
8. Frontend renders PDF preview
```

---

### Key Files & Their Roles

#### `aiService.js` (Router)

**Current** (commit `70257e8`):

```javascript
function createAIService() {
  const useReal =
    process.env.USE_REAL_AI === "1" || process.env.USE_REAL_AI === "true";
  if (useReal) {
    return new RealAIService();
  }
  console.log("AI service: MockAIService enabled (USE_REAL_AI not set)");
  return new MockAIService();
}
```

**Effect**: Environment variable `USE_REAL_AI` controls which service is used.

---

#### `geminiClient.js` (API Wrapper)

**Responsibilities**:

- Handles authentication (API key + URL)
- Sends requests to Gemini API
- Parses responses
- Handles errors gracefully

**Modalities Supported**:

- `TEXT`: Prompt → text response
- `IMAGE`: Prompt → image generation
- `IMAGERY`: Image + prompt → understanding

**Usage in RealAIService**:

```javascript
const resp = await callGemini({
  prompt: String(prompt),
  modality: "TEXT",
  generationConfig: {},
});
```

---

#### `ebookService.js` (Content Generation)

**What it does**:

1. Validates input (prompt, pageCount, theme)
2. Creates aiService instance
3. Conversation 1: Ask for structure (outline, chapters)
4. Conversation 2+: Sequential per-chapter generation (content + image concepts)
5. Returns structured data

**With Option A (Real)**:

- `aiService` is `RealAIService`
- Calls Gemini for each conversation
- Content is semantic and meaningful

**With Option B (Mock)**:

- `aiService` is `MockAIService`
- Returns deterministic responses instantly
- Content is placeholders ("Mock:", "Concept 1")

---

## 3. Environment Setup

### Local Development

**Step 1: Create `.env.local` (if not exists)**

```bash
cd /workspaces/vanilla
touch .env.local
```

**Step 2: Add configuration**

```bash
# .env.local
USE_REAL_AI=1
GEMINI_API_KEY=AIza...  # If not already in shell env
GEMINI_API_URL=https://...  # If not already in shell env
```

**Step 3: Verify**

```bash
# Load and check
source .env.local
echo "USE_REAL_AI=${USE_REAL_AI}"
echo "GEMINI_API_KEY=${GEMINI_API_KEY:0:10}..."  # Show first 10 chars
```

---

### Docker / Container Setup

**Dockerfile or container script**:

```dockerfile
# Set environment variable for container
ENV USE_REAL_AI=1
ENV GEMINI_API_KEY=${GEMINI_API_KEY}
ENV GEMINI_API_URL=${GEMINI_API_URL}
```

**Or via docker run**:

```bash
docker run \
  -e USE_REAL_AI=1 \
  -e GEMINI_API_KEY="AIza..." \
  -e GEMINI_API_URL="https://..." \
  vanilla-app
```

---

### CI/CD Pipeline

**GitHub Actions (or similar)**:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      USE_REAL_AI: "0" # Keep mock in CI for speed
      GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }} # Available if needed
    steps:
      - uses: actions/checkout@v3
      - run: npm --prefix server run test:run
```

**Decision**: Keep CI on mock (fast, cheap) for now. Can switch to Option C later for hybrid.

---

## 4. Running with Real Gemini

### Local Testing

**Terminal Session**:

```bash
# 1. Enable Option A
export USE_REAL_AI=1

# 2. Run tests
npm --prefix server run test:run

# Expected output:
# AI service: RealAIService enabled (Gemini)
# Tests will run slower (~10-15s each ebookService test)
# But output will be real, semantic content
```

**Server Mode**:

```bash
# 1. Enable Option A
export USE_REAL_AI=1

# 2. Start server
node server/index.js

# 3. In separate terminal, test endpoint
curl -X POST http://localhost:3000/api/ebook/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A mysterious detective story",
    "metadata": {
      "theme": "dark",
      "pageCount": 8,
      "colorPalette": "standard",
      "fontSizeScale": 1.0
    }
  }'
```

---

### Expected Behavior Differences (Real vs Mock)

| Aspect             | Mock             | Real                     |
| ------------------ | ---------------- | ------------------------ |
| **Response Time**  | <100ms           | 2-5s per conversation    |
| **Content**        | "Mock: [prompt]" | Semantic, contextual     |
| **Image Concepts** | "Concept N"      | "A misty forest with..." |
| **Structure**      | Deterministic    | Variable (creative)      |
| **Error Handling** | Always succeeds  | May fail (network, API)  |
| **Cost**           | $0               | ~$0.001-$0.01 per call   |

---

### Monitoring Requests

**Enable logging** (if available):

```javascript
// In server/index.js or ebookService.js
console.log(
  `[ebookService] Calling Gemini with prompt: "${prompt.slice(0, 50)}..."`
);
console.log(`[geminiClient] API response time: ${Date.now() - startTime}ms`);
```

**Or use Gemini API monitoring**:

1. Go to: https://console.cloud.google.com/
2. Navigate to: APIs & Services → Google Generative Language API
3. View quotas and usage

---

## 5. Testing Strategies

### Unit Tests (with Mock)

**Current behavior**: Unit tests inject mock automatically (via `vi.doMock()`):

```javascript
// server/__tests__/ebookService.unit.test.js
async function mockAI(mockImpl) {
  vi.resetModules();
  vi.doMock("../aiService", () => ({ createAIService: () => mockImpl }));
}

// Tests use mock regardless of USE_REAL_AI
await mockAI(mockGen);
const mod = await import("../ebookService");
// Test against mockGen, not real Gemini
```

**Recommendation**: Keep unit tests with mock (fast, deterministic).

---

### Integration Tests (with Real)

**To test with real Gemini**:

```javascript
// server/__tests__/genieService.integration.test.js
// Add test that uses real ebookService:

describe("Integration: ebookService with Real AI", () => {
  it("generates real structured data from prompt", async () => {
    // Don't mock aiService, let it use real Gemini
    vi.resetModules(); // Clear mocks

    const ebookService = (await import("../ebookService")).default;

    const payload = {
      prompt: "A detective mystery story",
      metadata: {
        theme: "dark",
        pageCount: 5,
        colorPalette: "standard",
        fontSizeScale: 1.0,
      },
    };

    const result = await ebookService.handle(payload);

    // Real expectations
    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.pages[0].image.concept).not.toMatch(/^Concept \d+$/);
    expect(result.pages[0].content.length).toBeGreaterThan(100);
  });
});
```

**Run**:

```bash
export USE_REAL_AI=1
npm --prefix server run test:run -- --grep "Integration.*Real AI"
```

---

### E2E Tests (with Real)

**Full flow: Frontend → Backend → Real Gemini → PDF**:

```bash
# 1. Enable Option A
export USE_REAL_AI=1

# 2. Start server
node server/index.js &

# 3. Run E2E tests (Playwright/Cypress/etc)
npm --prefix client run test:e2e

# Stop server
pkill -f "node server/index.js"
```

---

### Cost-Efficient Testing

**Strategy**:

- **Unit tests**: Mock (fast, free)
- **Integration tests**: Real, but limited (e.g., 2-3 per service)
- **E2E tests**: Real, but realistic scenarios (actual user workflows)
- **CI/CD**: Mock by default (cheap), real on-demand (tag `@integration`)

**Estimated costs**:

- 100 unit tests with mock: $0
- 10 integration tests with real: ~$0.10
- 5 E2E tests with real: ~$0.05
- Monthly dev spend: $20-30 (for 100+ test ebook generations)

---

## 6. Cost Tracking & Monitoring

### Daily Cost Estimate

```bash
# During development phase

# Scenario 1: 10 test runs with 5 ebookService calls each
API Calls: 10 × 5 = 50 calls
Cost: 50 × $0.001 (text) = $0.05/day

# Scenario 2: 100 test ebooks/month
API Calls: ~1,200 calls/month
Cost: 1,200 × $0.001 = $1.20/month (text only, no images)

# Scenario 3: 100 test ebooks + image generation (50% SVG cache hit)
Text: 1,200 × $0.001 = $1.20
Images: 400 × $0.05 = $20.00
Total: ~$21/month
```

---

### Monitoring Gemini Usage

**Option 1: Google Cloud Console**

1. Navigate to: https://console.cloud.google.com/
2. Select your project
3. Go to: APIs & Services → Google Generative Language API
4. View quotas, usage, costs

**Option 2: Logging in Code**

```javascript
// In geminiClient.js or ebookService.js
let totalCalls = 0;
let totalCost = 0;

async function callGemini(params) {
  const startTime = Date.now();
  const resp = await fetch(...);
  const duration = Date.now() - startTime;

  totalCalls += 1;
  // Estimate: $0.0001 per text call
  totalCost += 0.0001;

  console.log(`[Gemini] Call #${totalCalls}, Duration: ${duration}ms, Estimated cost: $${totalCost.toFixed(4)}`);

  return resp;
}
```

**Option 3: Budget Alerts**

In Google Cloud Console:

1. Go to: Billing → Budgets and alerts
2. Set budget: $50/month
3. Alert threshold: 50%
4. Receive notifications when spending exceeds threshold

---

### Cost Optimization (Future)

**Short-term** (Nov-Dec):

- SVG library caches 50-60% of image concepts
- Cost: ~$20-30/month for dev

**Medium-term** (Jan-Feb):

- SVG library caches 70-80% as library grows
- Cost: ~$10-15/month for dev

**Long-term** (Q2+):

- Production SVG library with 80%+ hit rate
- Cost: ~$5-10/month per 100 users
- Revenue justifies cost easily

---

## 7. Debugging & Troubleshooting

### Symptom: "USE_REAL_AI not set" (Still Using Mock)

**Causes**:

1. Environment variable not exported
2. Wrong terminal session
3. `.env` file not loaded

**Solutions**:

```bash
# 1. Verify export worked
echo $USE_REAL_AI  # Should print: 1

# 2. If empty, export again
export USE_REAL_AI=1
echo $USE_REAL_AI  # Should print: 1

# 3. Check if .env.local exists
cat /workspaces/vanilla/.env.local | grep USE_REAL_AI

# 4. Force start fresh shell
bash --noprofile --norc
export USE_REAL_AI=1
npm --prefix server run test:run
```

---

### Symptom: "Gemini API Error: Missing API Key"

**Causes**:

1. `GEMINI_API_KEY` not set
2. `GEMINI_API_URL` not set
3. Keys expired or revoked

**Solutions**:

```bash
# 1. Check keys exist
env | grep GEMINI

# 2. If missing, set them
export GEMINI_API_KEY="AIza..."
export GEMINI_API_URL="https://..."

# 3. Verify keys are valid
curl -X POST "$GEMINI_API_URL" \
  -H "X-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "test"}]}]}'

# 4. If error, keys may be expired—contact DevOps
```

---

### Symptom: "API Request Timeout" or "Too Many Requests"

**Causes**:

1. Gemini API rate limit reached
2. Network latency
3. API service degradation

**Solutions**:

```bash
# 1. Check Gemini status
curl https://status.cloud.google.com/ 2>/dev/null | grep -i generative

# 2. Add retry logic (in geminiClient.js)
async function callGemini(params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(apiUrl, { ...options, timeout: 10000 });
      return resp;
    } catch (err) {
      if (i < retries - 1) {
        console.log(`Retry ${i + 1}/${retries} after 2s...`);
        await sleep(2000);
      } else {
        throw err;
      }
    }
  }
}

// 3. Reduce concurrent requests
// Run tests sequentially instead of parallel
npm --prefix server run test:run -- --reporter=verbose
```

---

### Symptom: "Tests Passing with Mock but Failing with Real"

**Causes**:

1. Mock returns different structure than real Gemini
2. Real Gemini generates edge cases (empty content, long text)
3. JSON parsing failures

**Solutions**:

```javascript
// 1. Add logging to see actual Gemini response
console.log("Raw Gemini response:", JSON.stringify(resp, null, 2));

// 2. Add assertions for robustness
expect(result.chapters).toBeDefined();
expect(result.chapters.length).toBeGreaterThan(0);
expect(result.chapters[0].content).toBeTruthy();
expect(result.chapters[0].image?.concept).toBeTruthy();

// 3. Check ebookService error handling
if (!result.pages || result.pages.length === 0) {
  console.error("ebookService returned empty pages array");
  // This means Gemini response wasn't parsed correctly
}

// 4. Review geminiClient.callGemini response structure
console.log("Response structure:", {
  ok: resp.ok,
  status: resp.status,
  text: resp.text?.slice(0, 100),
  json: resp.json,
});
```

---

## 8. Transition Phases Detail

### Phase 1: Enable & Validate (NOW - Dec 8)

**Week 1 (Nov 24-30)**:

- [ ] Export `USE_REAL_AI=1` in local dev environment
- [ ] Run full test suite with real Gemini
- [ ] Verify ebookService generates semantic content
- [ ] Track costs (expected: ~$2-5)
- [ ] Confirm Option 2 frontend works with real data

**Week 2 (Dec 1-8)**:

- [ ] Complete ebookService enhancement (if not done)
- [ ] Wire genieService.compose()
- [ ] Manual browser testing: generate → preview → override
- [ ] Mark Option 2 "production ready"
- [ ] Cost review: total spending should be ~$5-10

---

### Phase 2: Scale with Options 2/3 (Dec 9 - Jan 26)

**Continuing with Option A enabled**:

- [ ] Implement Option 3 frontend (routing, dashboard)
- [ ] Build project management (save/load/delete)
- [ ] Version history + auto-save
- [ ] Batch generation support
- [ ] Test all new features with real AI

**Cost expectation**: ~$20-30/month (increased from Phase 1)

**Success criteria**:

- [ ] Option 3 stable with real AI
- [ ] All features tested end-to-end
- [ ] Zero regressions from Option 2

---

### Phase 3: Enterprise with Option 5 (Feb 1 - Q2 2026)

**Continuing with Option A enabled**:

- [ ] Implement schema-driven UI architecture
- [ ] Build A/B testing framework
- [ ] Enterprise features (multi-user, org management)
- [ ] Advanced analytics

**Cost expectation**: ~$30-50/month (higher testing volume)

**Success criteria**:

- [ ] Option 5 enterprise-ready
- [ ] Production alpha customers validating
- [ ] SVG library hit rate >80%

---

### Phase 4: Optimize with Option C (Q2 2026)

**Post-Option 5, implement context-aware AI selection**:

- [ ] Tests default to mock (fast, free)
- [ ] Server defaults to real (meaningful)
- [ ] CI/prod configurable

**Expected benefit**:

- [ ] Test suite 5x faster (back to mock speed)
- [ ] Same feature completeness
- [ ] Cost same or lower

---

## 9. Future: Option C Implementation Checklist

### Prerequisites (Must be Complete Before Option C)

- [x] All 3 frontend options (2, 3, 5) proven with Option A
- [x] SVG library mature (80%+ cache hit rate)
- [x] Production customers validating
- [x] No blocking issues with real AI

---

### Code Changes Required for Option C

**File**: `server/aiService.js`

```javascript
// Current (Option A)
function createAIService() {
  const useReal =
    process.env.USE_REAL_AI === "1" || process.env.USE_REAL_AI === "true";
  if (useReal) {
    return new RealAIService();
  }
  return new MockAIService();
}

// Becomes (Option C)
function createAIService() {
  // 1. Explicit override takes precedence
  if (process.env.USE_REAL_AI === "1") return new RealAIService();
  if (process.env.USE_MOCK_AI === "1") return new MockAIService();

  // 2. Context-aware default
  const inTest = process.env.NODE_ENV === "test" || global.vitest;

  if (inTest) {
    // Tests default to mock for speed
    console.log("AI service: MockAIService enabled (test context)");
    return new MockAIService();
  }

  // 3. Server context: use real if credentials available
  const apiUrl = process.env.GEMINI_API_URL || process.env.GEMINI_API_URL_TEXT;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_TEXT;

  if (apiUrl && apiKey) {
    console.log("AI service: RealAIService enabled (Gemini)");
    return new RealAIService();
  }

  // 4. Fallback
  console.log("AI service: MockAIService enabled (credentials missing)");
  return new MockAIService();
}
```

---

### Testing Option C

**Unit tests** (should use mock by default):

```bash
npm --prefix server run test:run

# Expected: Tests run fast (~2-3s each)
# Logs: "MockAIService enabled (test context)"
```

**Integration tests** (can override to real):

```bash
export USE_REAL_AI=1
npm --prefix server run test:run -- --grep "Integration"

# Expected: Tests run slower (~10-15s each)
# Logs: "RealAIService enabled (Gemini)"
```

**Server** (should use real by default):

```bash
unset USE_REAL_AI  # Clear override
node server/index.js

# Expected: Logs "RealAIService enabled (Gemini)"
# If credentials missing: "MockAIService enabled (credentials missing)"
```

---

### Deployment Considerations

**GitHub Actions CI**:

```yaml
# Keep mock in CI by default (fast, cheap)
env:
  NODE_ENV: test
  # Credentials available but not used (mock default in tests)
```

**Production Server**:

```yaml
# Real AI enabled automatically
env:
  NODE_ENV: production
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  GEMINI_API_URL: ${{ secrets.GEMINI_API_URL }}
  # USE_REAL_AI not set (but real enabled by default)
```

---

## 10. FAQ & Common Issues

### Q: Why use Option A now instead of jumping to Option C?

**A**: Option C requires more complexity (context detection), and we don't need it yet. Option A is simpler (zero code changes) and all features can be built while it's active. Once everything's proven (post-Option 5), Option C becomes a nice optimization but not urgent.

---

### Q: Will mock testing go away?

**A**: No. With Option C, tests default to mock (fast). Real AI testing is reserved for integration tests. This gives us both speed (dev feedback) and accuracy (production validation).

---

### Q: How much will this cost?

**A**: ~$20-30/month during development (Nov-Feb), ~$5-10/month in production (after SVG library matures). SVG library hits pay for themselves within 2 months.

---

### Q: What if Gemini API goes down?

**A**: Graceful fallback. `RealAIService` catches errors and returns 500-level HTTP errors, which genieService routes to user-friendly messages. No data loss, just slower response times until API recovers.

---

### Q: Can I switch between Option A and mock quickly?

**A**: Yes, just toggle environment variable:

```bash
# Switch to real
export USE_REAL_AI=1

# Switch back to mock
unset USE_REAL_AI
```

No code changes, no restarts needed (if you restart the server/tests).

---

### Q: Will Option C be backwards compatible?

**A**: Yes. Option C auto-detects context but respects overrides. Existing `USE_REAL_AI=1` continues working. CI stays fast (mock default). No breaking changes.

---

### Q: What if a team member doesn't want to use real AI?

**A**: They can:

```bash
export USE_MOCK_AI=1  # Force mock, even in server context
npm --prefix server run test:run
```

Or just not set `USE_REAL_AI=1` (mock is default now, will be test-default in Option C).

---

### Q: How do I profile/debug Gemini API costs?

**A**: See **Section 6: Cost Tracking & Monitoring** for detailed strategies (Google Cloud Console, logging in code, budget alerts).

---

### Q: When do I implement Option C?

**A**: After Option 5 is complete and proven (Q2 2026). Not urgent, just an optimization.

---

## Document Control

| Version | Date         | Status     | Changes                                    |
| ------- | ------------ | ---------- | ------------------------------------------ |
| 1.0     | Nov 24, 2025 | 🎯 CURRENT | Tactical implementation guide for Option A |

---

## Conclusion

**Option A is simple**: Export `USE_REAL_AI=1` and everything works. Real Gemini provides semantic content for meaningful testing and validation.

**Option C is future**: After all features proven, implement context-aware selection for optimized developer experience (fast tests, real server).

**Next Step**: Follow Quick Start (Section 1) to enable Option A today.

---

**Implementation Status**: 🟢 Ready to execute  
**Last Updated**: November 24, 2025  
**Previous Document**: AI_SERVICE_STRATEGY.md (strategic overview)
