```markdown
# PATH_FORWARD: Plumbing vs Application Service Separation — V1

Date: 2025-10-06
Branch: aether-rewrite/client-phase2-AAA

This V1 document captures what has already been implemented and validated from the original PATH_FORWARD review: inventory of key modules, the progress update, and completed addendum items.

---

## Inventory (what exists)

- Service adapter / implementation selection

  - `server/serviceAdapter.js` resolves the concrete generator implementation (default: `genieService`). Good single-point swap for different generator implementations.

- Application-level generator implementations

  - `server/genieService.js` — demo application service that orchestrates generation (delegates to `sampleService`) and normalizes the output shape (content + metadata).
  - `server/aiService.js` — provider abstraction with `MockAIService` (dev/test) and `RealAIService` (Gemini wrapper). Encapsulates provider parsing and heuristics.

- Transport / plumbing (HTTP, middleware, Puppeteer)

  - `server/index.js` — Express routes, middleware (CORS, rate-limit, request-id), Puppeteer lifecycle, preview/export endpoints, and route handlers (e.g., POST `/prompt`, POST `/genie`, `/preview`, `/api/preview`, `/api/export`).

- Persistence and utilities

  - `server/crud.js`, `server/db.js` for storing prompts and AI results (index.js attempts non-fatal persistence after generation).
  - `utils/imageRewrite`, `pdfGenerator`, and `rewriteImagesForExportAsync` for export-related plumbing.

- Demo / deterministic stubs
  - `server/sampleService.js` used by `genieService` to provide deterministic content for local/dev/testing flows.

Overall: the repo embodies an adapter + application-service pattern: plumbing is centralized in `index.js`, application services live in service modules (`genieService`, `aiService`), and `serviceAdapter` wires implementations together.

---

## Progress update (as of 2025-10-08) — implemented items

- Created `server/previewRenderer.js` and removed inline HTML templating from the main handler; preview rendering is centralized and uses a server-side sanitizer. Files touched: `server/previewRenderer.js`, `server/index.js`, and related tests.
- Added request-correlation plumbing: request-id middleware that normalizes and exposes `req.requestId`, sets the `X-Request-Id` response header, and propagates `requestId` into service metadata where appropriate. Files touched: `server/index.js`, `server/genieService.js`.
- Centralized and hardened error handling: introduced typed error helpers and a single error middleware that produces consistent JSON error shapes and writes structured error lines to logs. File: `server/utils/errorHandler.js` (unit tests added).
- Adjusted application services for testability: `genieService` preserves incoming `requestId`, converts `persistIntents` → `persistInstructions`, and delegates to application services that only return intents. Files touched: `server/genieService.js`, `server/sampleService.js`.
- Implemented persistence executor and tests: `server/persistence.js` performs safe path validation and atomic writes (tmp + rename), and the new integration test (`server/__tests__/persistence.integration.test.js`) verifies atomic writes, absence of leftover tmp files, and that artifact DB rows are recorded and correlated with `requestId`.
- Test hardening: made prompt-related tests deterministic by using unique prompts per run to avoid cache collisions; added cleanup steps so tests do not leave DB rows or exported files behind.
- CI / branch hygiene: accidental test artifacts written during early development were removed from the repo; commits and PRs include these test and persistence changes.

---

## ADDENDUM — Completed items (2025-10-09)

- Request correlation: `requestId` is generated and returned consistently. The server sets the `X-Request-Id` response header and also populates `metadata.requestId` on generation endpoints (e.g., `POST /prompt`). Unit tests now assert header/header-body parity for `POST /prompt` and preview endpoints.

- Persistence executor: Implemented `server/persistence.js` that performs safe path validation, atomic writes (tmp + rename), and sanitizes filename hints. An integration test (`server/__tests__/persistence.integration.test.js`) verifies files are written atomically, artifact DB rows are created and correlated with `requestId`, and no `.tmp` leftovers remain.

- Negative safety tests: Added focused negative tests (`server/__tests__/persistence.negative.test.js`) that assert attempts to traverse outside the configured base export directory via `folderHint` or `filenameHint` are rejected or sanitized.

- Test and CI hygiene: Added `server/scripts/clean_exports.js`, added a `pretest` lifecycle hook in `server/package.json` to call the cleaner locally prior to tests, and updated CI workflows to run the same cleanup script before invoking server tests. The repository `.gitignore` now includes `data/exports/` so generated artifacts are not committed.

- Documentation & README updates: `README.md` now documents that `data/exports/` is ignored, the `clean_exports` utility exists, and CI runs the cleaner step before tests to maintain deterministic test runs.

These items were implemented and validated through unit/integration tests and CI hygiene updates.

---

## Where to look (files touched)

- `server/previewRenderer.js` — centralized preview rendering and sanitization
- `server/index.js` — request-id middleware wiring and handler updates
- `server/genieService.js`, `server/sampleService.js` — service testability adjustments
- `server/persistence.js` — atomic writes and path validation
- `server/__tests__/persistence.integration.test.js`, `server/__tests__/persistence.negative.test.js` — persistence tests
- `server/utils/errorHandler.js` — centralized error middleware
- `server/scripts/clean_exports.js` — test cleanup utility

---

_Generated from `docs/working/PATH_FORWARD_Plumbing_Separation.md` — contents focused on implemented work for quick reference._
```
