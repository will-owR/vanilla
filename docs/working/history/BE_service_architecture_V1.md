# Backend Service Architecture — V1 (Implemented / Present)

Report Date: 2025-10-15
Branch: aether-rewrite/client-phase2-AAA-sol1-95

This document captures the parts of the proposed backend service architecture that are already present or have been implemented in the repository. It is intended as the canonical V1 snapshot linking backend plumbing (see `PATH_FORWARD_Plumbing_Separation_V1.md`) to the frontend (see `CURRENT_FE_v01_V1.md`).

## Summary

- The codebase already follows an adapter + orchestrator pattern: a `serviceAdapter` and a central `genieService` orchestrator exist and are used by the HTTP plumbing.
- Server-side preview rendering/sanitization and request-correlation (requestId) plumbing have been implemented and validated (see `server/previewRenderer.js` and request-id middleware referenced in `PATH_FORWARD_Plumbing_Separation_V1.md`).
- A persistence executor with safe path validation and atomic write semantics, plus integration tests, exists and is exercised by the server (see `server/persistence.js` and related tests).
- Test scaffolding for deterministic responses (a `testService` style stub) and Playwright E2E scaffolds are present in the repo; an end-to-end preview-update test was added (the test harness and environment setup are present though tests required hardening in some cases).

## What this V1 snapshot includes (where to look)

- `server/index.js` — HTTP plumbing and handlers (current `/prompt`/legacy endpoints and any V1 endpoints that have been added).
- `server/genieService.js` — orchestrator implementation used by plumbing.
- `server/serviceAdapter.js` — runtime service selection wiring.
- `server/previewRenderer.js` — centralized rendering and sanitization used by preview and export flows.
- `server/persistence.js` — persistence executor and safety tests.
- `server/utils/errorHandler.js` — centralized error middleware and consistent error shapes.
- `server/__tests__` & `playwright/` — test harnesses including deterministic service stubs and E2E scaffolding.

## How this links to the frontend (canonical expectations)

- The frontend (via `storeAdapter` / `promptStore`) should POST normalized payloads and receive a normalized envelope containing `preview`, `data.content`, `metadata.requestId`, and optionally `persistInstructions`/ids for persisted artifacts.
- The server guarantees sanitized, display-ready HTML for preview endpoints (`/preview`, `/api/preview`) and provides a requestId header (`X-Request-Id`) plus metadata.requestId in JSON responses so clients can correlate results.
- For testing, `serviceHint` is supported so test harnesses can select deterministic services without relying on `?dev=true` plumbing.

## Notes

This V1 file intentionally documents only what is present and validated in the repository today. Remaining migration steps and recommended staged rollout items are captured in `BE_service_architecture_dv02.md`.
