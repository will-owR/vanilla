# Bug Report: `genieService` Routing for `testService`

**Date:** 2025-10-16
**Branch:** `aether-rewrite/client-phase2-P1`

## 1. Summary

The `genieService` orchestrator fails to correctly route requests with the prompt `"test-preview"` to the `testService`. Instead of using the deterministic test service as documented, it falls through to the default `aiService`, leading to unexpected behavior during testing.

## 2. Expected Behavior

As documented in `testService_profile.md`, when a user submits a request where `prompt === "test-preview"` and the UI selections are the defaults, the `genieService` should select and execute `testService`.

The user should see a preview window with the following content:

- **Title:** "Test Service Response"
- **Body:** "Test Service Active"

## 3. Actual Behavior

The routing logic in `genieService.js` is flawed. The condition to check for the "test-preview" prompt is incorrectly placed within the service selection logic, causing it to be skipped. The request is instead handled by the default `aiService` (currently `MockAIService`).

The user sees a preview window with the generic mock content:

- **Title:** "Mock: test-preview"
- **Body:** "This is a mock response for prompt: test-preview."

## 4. Analysis

The issue lies in the service selection block within `server/genieService.js`. The logic for the `testService` trigger is nested inside an `else` block that is not reached when it should be. The current implementation incorrectly prioritizes other heuristics over the specific "test-preview" trigger.

**Problematic Code:**

```javascript
// in genieService.js

// ...
// If a valid serviceHint is provided, use the specified service.
if (serviceHint && serviceMap[serviceHint]) {
  const selectedService = serviceMap[serviceHint];
  svcRes = await selectedService.generateFromPrompt(input);
} else {
  // Legacy/default routing to testService: match exact prompt and defaults
  const selections = input.selections || input.options || input.settings;
  if (promptText === "test-preview" && isTestDefaults(selections)) {
    svcRes = await testService.generateFromPrompt(input);
  } else {
    // --- Existing Heuristic-based Selection Logic ---
    const promptHasHello = /\bhello\b/i.test(promptText);
    // ... this logic is executed instead
  }
}
// ...
```

The check for `promptText === "test-preview"` is correct, but its placement causes the fall-through to the `aiService`.

## 5. Proposed Fix

The logic should be restructured to prioritize the `testService` trigger correctly, alongside the explicit `serviceHint` check. The legacy trigger for `testService` should be evaluated before the more general heuristics.

**Corrected Code for `server/genieService.js`:**

```javascript
// ... inside async function generate(payload)

// --- Service Selection ---
// Decide which application service to call based on the prompt.
let svcRes;
const { prompt: promptText = "", serviceHint } = input;
const selections = input.selections || input.options || input.settings;

// Legacy/default trigger expectations for testService.
const TEST_DEFAULTS = { "content-type": 0, "media-type": 0, page: 1 };
function isTestDefaults(sel) {
  if (!sel) return true; // missing selections treated as defaults in tests
  try {
    return (
      String(sel["content-type"]) === String(TEST_DEFAULTS["content-type"]) &&
      String(sel["media-type"]) === String(TEST_DEFAULTS["media-type"]) &&
      String(sel.page) === String(TEST_DEFAULTS.page)
    );
  } catch (e) {
    return false;
  }
}

// 1. Prioritize explicit serviceHint for testing.
if (serviceHint && serviceMap[serviceHint]) {
  const selectedService = serviceMap[serviceHint];
  svcRes = await selectedService.generateFromPrompt(input);
  // 2. Check for the legacy "test-preview" trigger.
} else if (promptText === "test-preview" && isTestDefaults(selections)) {
  svcRes = await testService.generateFromPrompt(input);
} else {
  // 3. Fall back to heuristic-based selection.
  const promptHasHello = /\bhello\b/i.test(promptText);
  const useHelloWorld = promptHasHello && isDefaultSelections(selections);

  if (useHelloWorld) {
    svcRes = await helloWorldService.generateFromPrompt(input);
  } else {
    // 4. Default to the main AI service.
    try {
      const aiFactory = require("./aiService").createAIService;
      const ai = aiFactory();
      const aiResult = await ai.generateContent(promptText);
      svcRes = { success: true, data: { ...aiResult, persistIntents: [] } };
    } catch (e) {
      if (e && e.code === "MODULE_NOT_FOUND") {
        svcRes = await sampleService.generateFromPrompt(input);
      } else {
        throw e;
      }
    }
  }
}

// ... rest of the function
```

## 6. Verification

To verify the fix:

1. Apply the code changes to `server/genieService.js`.
2. Restart the server.
3. In the client UI, enter "test-preview" as the prompt and click 'Generate'.
4. **Confirm** that the preview window updates with the content from `testService` ("Test Service Active").
5. **Confirm** that sending a different prompt (e.g., "a regular prompt") still correctly routes to the `aiService` and shows the mock AI response.
