# Actionable Steps for `architecture-v1-flow.spec.mjs` (Staged Rollout)

**Objective:** To implement the V1 backend architecture in a safe, staged manner that guarantees zero regressions, as defined in `BE_service_architecture.md`. The successful completion of these tasks will result in the `architecture-v1-flow.spec.mjs` test passing.

---

## Stage 1: Expand (Introduce New Architecture in Parallel)

### Task 1.1: Add New `/api/generate` Endpoint

The goal is to add the new endpoint without removing the old ones.

- **Action:** In `server/index.js`, add the new `/api/generate` endpoint.
- **Action:** **DO NOT** remove the existing `/prompt` and `/genie` routes. They must remain active for backward compatibility.

```javascript
// In server/index.js

const genieService = require("./genieService");

// Add the new V1 endpoint.
app.post("/api/generate", async (req, res, next) => {
  try {
    const result = await genieService.generate(req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Legacy endpoints remain untouched for now.
// app.post('/prompt', ...);
// app.post('/genie', ...);
```

### Task 1.2: Create Placeholder `defaultService.js`

This service is required by the new `genieService` logic.

- **Action:** Create a new file at `server/defaultService.js`.
- **Action:** Add placeholder content that forwards to `sampleService` to ensure a valid response.

```javascript
// In server/defaultService.js

const sampleService = require("./sampleService");

async function generateFromPrompt(payload) {
  return sampleService.generateFromPrompt(payload);
}

module.exports = {
  generateFromPrompt,
};
```

### Task 1.3: Refactor `genieService.js` with Core Routing Logic

Update the orchestrator with the "Primacy of Defaults" logic.

- **Action:** Open `server/genieService.js`.
- **Action:** Replace the existing `generate` function with the new logic.

```javascript
// In server/genieService.js

const testService = require("./testService");
const sampleService = require("./sampleService");
const defaultService = require("./defaultService");

async function generate(payload) {
  const { prompt, serviceHint, formDefaults } = payload;

  if (
    formDefaults &&
    (formDefaults.contentType !== 0 || formDefaults.mediaType !== 0)
  ) {
    return defaultService.generateFromPrompt(payload);
  }

  if (serviceHint === "testService" || prompt === "test-preview") {
    return testService.generateFromPrompt(payload);
  }
  // ... other rules
  return defaultService.generateFromPrompt(payload);
}
// ...
```

### Task 1.4: Implement "Dual-Aware" Logic in `storeAdapter.js`

This is the critical client-side change that enables the staged rollout.

- **Action:** Open `client-v2/src/lib/storeAdapter.js`.
- **Action:** Locate the `submitPrompt` function.
- **Action:** Modify the function to dynamically choose the endpoint based on the payload.

```javascript
// In client-v2/src/lib/storeAdapter.js

// ... inside the submitPrompt function ...
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

---

## Stage 2: Migrate (Validate the New Flow)

### Task 2.1: Run the `architecture-v1-flow.spec.mjs` Test

This is the first step of the migration phase and validates all the work done in Stage 1.

- **Action:** From the terminal, execute the following command:
  ```bash
  npm --prefix client-v2 run test:playwright -- --spec playwright/e2e/architecture-v1-flow.spec.mjs
  ```
- **Expected Result:** The test should pass. This proves that a request with the new payload is correctly routed through the new V1 architecture, while all other application functionality remains unaffected.

---

## Preliminary "Dry Run" Verification

This section provides a step-by-step trace of the data flow to build confidence in the plan before implementation. This will be confirmed or updated with actual results post-implementation.

1.  **Entry Point: The Playwright Test**

    - **Action:** The `architecture-v1-flow.spec.mjs` test calls `window.promptStore.submitPrompt()` with a payload containing `{ "formDefaults": { "contentType": 0, "mediaType": 0 } }`.
    - **Verification:** **[PASS]** The payload contains the `formDefaults` object, which is the key to triggering the new V1 architecture.

2.  **Client-Side Routing: `storeAdapter.js`**

    - **Action:** The `submitPrompt` function receives the payload.
    - **Logic:** It checks `if (payload.formDefaults)`. The condition is `true`.
    - **Result:** The `endpoint` variable is set to `/api/generate`.
    - **Verification:** **[PASS]** The client-side router correctly selects the new V1 endpoint.

3.  **Backend Endpoint: `index.js`**

    - **Action:** The server receives a `POST` request at `/api/generate`.
    - **Logic:** The new `/api/generate` endpoint handler is executed. It calls `await genieService.generate(req.body)`.
    - **Verification:** **[PASS]** The request is correctly received by the new V1 endpoint and passed to the orchestrator.

4.  **Orchestrator Logic: `genieService.js`**

    - **Action:** The `generate` function receives the payload.
    - **Logic:** It first checks if `formDefaults` have changed (they haven't). It then checks if `prompt === "test-preview"`. The condition is `true`.
    - **Result:** The function executes `return testService.generateFromPrompt(payload)`.
    - **Verification:** **[PASS]** The orchestrator correctly routes the request to `testService`.

5.  **Exit Point: The Playwright Assertion**
    - **Action:** `testService` returns its hardcoded HTML. The response travels back to the client, the Svelte store is updated, and the component renders.
    - **Logic:** The test's assertion `await expect(previewContent).toContainText("Test Service Active")` checks the final rendered content.
    - **Verification:** **[PASS]** The expected text will be present in the DOM. The test will succeed.
