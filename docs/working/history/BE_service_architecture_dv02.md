# Backend Service Architecture — dv02 (Pending / Migration)

Report Date: 2025-10-15
Branch: aether-rewrite/client-phase2-AAA-sol1-95

This dv02 document lists the remaining changes, migration plan steps, and acceptance criteria required to complete the staged rollout to the V1 backend architecture and to align the frontend expectations with backend behavior.

## Key pending items (dv02)

1. Staged rollout endpoints and client wiring

   - Ensure the new `/api/generate` V1 endpoint exists and is deployed in parallel with legacy endpoints (`/prompt`, `/genie`) during Stage 1 of the rollout.
   - Make `storeAdapter.js` dual-aware: route to `/api/generate` when new payload (e.g., `formDefaults`) is present; otherwise use legacy endpoints.

2. Formalize the `genieService` Primacy of Defaults

   - Implement and test the `genieService` routing logic that prefers `formDefaults` driven default services, supports `serviceHint`, and falls back correctly to `defaultService`.

3. Migration testing and traffic shift

   - Add `architecture-v1-flow.spec.mjs` tests and validate they run through the new `/api/generate` path; incrementally migrate other tests to the new format.

4. Contract and compatibility checks

   - Decide and enforce canonical naming for persistence contracts (`persistIntents` vs `persistInstructions`) and update `genieService`, plumbing, and docs.
   - Stabilize the requestId contract (header and JSON metadata) across all generation and export endpoints.

5. Deprecation plan

   - After validation, schedule Stage 3: remove legacy endpoints and simplify client adapter.

6. Operational hardening

   - Add CI checks that ensure new endpoint behavior, sanitizer tests, and persistence tests run as part of the pipeline.

7. Acceptance criteria
   - New `/api/generate` endpoint responds to V1 payloads and returns the normalized envelope.
   - `storeAdapter` correctly routes V1 traffic and legacy traffic during staged rollout.
   - Tests that use `serviceHint` select deterministic services; `?dev=true` is deprecated/removed.

## Suggested next steps (practical)

1. Implement `/api/generate` endpoint as a thin wrapper that delegates to `genieService.generate(req.body)` and returns its normalized envelope.
2. Update `client-v2/src/lib/storeAdapter.js` to route based on payload shape and add feature-flag gating if needed.
3. Write `architecture-v1-flow.spec.mjs` to validate the end-to-end flow through `/api/generate` and run it in CI before deprecating legacy endpoints.
4. Update docs (`PATH_FORWARD_Plumbing_Separation_V1.md`, `CURRENT_FE_v01_V1.md`) to reference the new endpoint and migration plan.

---

This dv02 file captures the migration-focused work required to finalize the new backend service architecture and align the frontend to the canonical V1 behavior.
