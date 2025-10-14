# Bug Report: Architectural Flaw in Backend Routing Causes E2E Failure

**Report Date:** October 14, 2025 [byGemini]
**Branch:** aether-rewrite/client-phase2-AAA-sol1-99
**Resolution:** [Pending]

## Replication

To replicate this issue, run:

```bash
npm --prefix client-v2 run test:playwright
```

**One-Sentence Explanation:** The end-to-end test fails because a fundamental architectural flaw in the backend routing logic prevents the `genieService` orchestrator from correctly processing the request based on its `serviceHint`.

**Capsule Summary:**
The core business logic dictates a simple, two-step process for incoming requests: check for a cached response, and if none exists, delegate all further processing to the `genieService` orchestrator. The current implementation violates this principle by exposing multiple, conflicting endpoints (`/prompt` and `/genie`) with fragmented business logic.

The test fails because the client sends a request containing `serviceHint: "testService"` to the `/genie` endpoint. This endpoint incorrectly bypasses the `genieService` and sends the request directly to the default AI service, ignoring the hint. The logic to correctly handle the `serviceHint` exists but is isolated on a separate `/prompt` endpoint. This architectural defect makes the system brittle, as the client must correctly guess which endpoint to use, leading to predictable integration failures. The root cause is not a client-side error but a backend that fails to adhere to its own core business logic.

**Fix Options (Goal: Align Backend with Core Business Logic):**

1.  **Consolidate Endpoints (Recommended):** Refactor `server/index.js` to use a single, primary endpoint for prompt processing (e.g., `/api/generate`). This endpoint should strictly follow the specified logic: check for a cache, and if not found, unconditionally pass the entire request payload to `genieService`. All logic for interpreting `serviceHint` or other parameters must be moved into `genieService`.
2.  **Make `genieService` the Universal Handler:** A less disruptive but still effective fix would be to modify the existing `/genie` endpoint. Instead of calling the default service (`serviceImpl`), it should be changed to call `genieService.generate(req.body)` directly. This would make `genieService` the universal handler for this route, while the `/prompt` endpoint could be deprecated.
3.  **Redirect Logic (Not Recommended):** A temporary patch could involve adding logic to the `/genie` endpoint to inspect the request body. If a `serviceHint` is present, it could internally forward the request to the `/prompt` handler's logic. This is not a true fix, as it adds more complexity and technical debt, but it would resolve the immediate test failure without a larger refactor.
