# DRAFT: Backend Service Architecture v1.0

**Report Date:** October 14, 2025 [byGemini]
**Branch:** aether-rewrite/client-phase2-AAA-sol1-99
**Implementation:** [Pending]

## 1. Overview

This document outlines a proposed backend architecture designed to be robust, scalable, and easily testable. It addresses the architectural flaws identified during the analysis of the E2E test failure, where fragmented business logic across multiple endpoints led to incorrect request routing.

The core goal is to establish a clear and predictable flow for all prompt-based requests, adhering to the Single Responsibility Principle at each layer.

## 2. Implementation Strategy: Staged Rollout (Expand and Contract)

To ensure zero downtime and prevent breaking changes, the new architecture will be implemented in stages. This "Expand and Contract" pattern allows the new system to run in parallel with the old one, with a gradual migration.

### Stage 1: Expand (Introduce the New Architecture)

We will add the new V1 architecture without removing or altering the existing V0 endpoints.

1.  **Backend:** The new `/api/generate` endpoint and the refactored `genieService` will be deployed. The legacy `/prompt` and `/genie` endpoints will remain active to handle existing traffic.
2.  **Frontend:** The `storeAdapter.js` will be made "dual-aware." It will inspect the payload of any outgoing request and act as a client-side router:
    - If the payload contains the new `formDefaults` object, it will route the request to the new `/api/generate` endpoint.
    - Otherwise, it will send the request to the legacy `/genie` endpoint, preserving all existing functionality.

### Stage 2: Migrate (Test and Update)

With both systems running, we can safely test the new flow and begin migrating clients.

1.  **Validate New Flow:** The `architecture-v1-flow.spec.mjs` test, which sends the new payload format, will be automatically routed through the V1 architecture and is expected to pass.
2.  **Incremental Updates:** Other tests and application components can be updated one by one to use the new payload format, migrating them to the V1 architecture at a controlled pace.

### Stage 3: Contract (Remove Legacy Code)

This stage occurs only after all traffic has been migrated to the new system.

1.  **Deprecate Endpoints:** The legacy `/prompt` and `/genie` endpoints will be removed from `server/index.js`.
2.  **Simplify Client:** The "dual-aware" logic in `storeAdapter.js` will be removed, leaving only the direct call to `/api/generate`.

## 3. Architectural Layers (V1)

### 3.1. Layer 1: The Endpoint (Gatekeeper)

The new V1 Express endpoint runs in parallel with legacy endpoints. Its only job is to receive V1 requests and pass them to the orchestrator.

**File:** `server/index.js`

```javascript
// The new V1 endpoint runs in parallel with legacy endpoints.
const genieService = require("./genieService");

app.post("/api/generate", async (req, res, next) => {
  try {
    // ... (cache check stub) ...
    const result = await genieService.generate(req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Legacy endpoints remain for backward compatibility during transition
// app.post('/prompt', ...);
// app.post('/genie', ...);
```

### 3.2. Layer 2: The Orchestrator (`genieService`)

The `genieService` is the central traffic controller for V1 requests. Its routing logic is governed by the "Primacy of Defaults."

**File:** `server/genieService.js`

```javascript
const testService = require("./testService");
const sampleService = require("./sampleService");
const defaultService = require("./defaultService");

async function generate(payload) {
  const { prompt, serviceHint, formDefaults } = payload;

  // 1. Primacy of Defaults: If defaults are changed, use the general-purpose service.
  if (
    formDefaults &&
    (formDefaults.contentType !== 0 || formDefaults.mediaType !== 0)
  ) {
    return defaultService.generateFromPrompt(payload);
  }

  // 2. If defaults are unchanged, proceed to specialized routing.
  if (serviceHint === "testService" || prompt === "test-preview") {
    return testService.generateFromPrompt(payload);
  }
  if (isPoemRequest(prompt)) {
    return sampleService.generateFromPrompt(payload);
  }

  // 3. Fallback to the default service.
  return defaultService.generateFromPrompt(payload);
}
// ...
```

### 3.3. Client-Side Router (`storeAdapter.js`)

The client-side adapter becomes the intelligent router that enables the staged rollout.

**File:** `client-v2/src/lib/storeAdapter.js`

```javascript
// In submitPrompt(payload) function:

let endpoint = "/genie"; // Default to the legacy endpoint
const body = { ...payload };

// If the new payload structure is detected, switch to the V1 endpoint.
if (body.formDefaults) {
  endpoint = "/api/generate";
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
// ...
```

### 3.4. Layer 3 & 4: Primary and Supporting Services

The logic for Primary Services (like `sampleService`) and Supporting Services (like `aiService`) remains the same as previously defined. They own the core business and utility logic, respectively.

## 4. Time Estimates

This section outlines the estimated time for the initial implementation and validation (Stages 1 and 2). It does not include time for code reviews or project management overhead.

- **Backend Implementation (Stage 1):**

  - Add `/api/generate` Endpoint: **0.5 hours**
  - Create Placeholder `defaultService.js`: **0.25 hours**
  - Refactor `genieService.js` with Core Logic: **1.0 hour**
  - _Subtotal: ~1.75 hours_

- **Frontend Implementation (Stage 1):**

  - Implement "Dual-Aware" `storeAdapter.js`: **0.5 hours**
  - _Subtotal: ~0.5 hours_

- **Validation and Debugging (Stage 2):**

  - Run New Playwright Test & Debug: **1.0 - 2.0 hours**
  - _Subtotal: ~1.0 - 2.0 hours_

- **Pull Request and Documentation:**
  - Code cleanup and PR preparation.
  - \*Estimate: **0.5 hours\***

### Total Estimated Time (Stages 1 & 2)

- **Total:** Approximately **4-6 hours** of focused developer work.
- _Note: Stage 3 (Contract) will be estimated separately after the migration is complete._
