2025-10-11T00:00:00Z
Branch: aether-rewrite/client-phase2-AAA-sol1

# Plumbing vs Application Services — Reference

Purpose

This reference captures the intent behind separating "plumbing" (transport/IO) from "application services" (business logic/orchestration), and records what has been implemented so the team has a quick authoritative source to refer to.

Link to the full assessment: ../PATH_FORWARD_Plumbing_Separation.md

Definitions

- Plumbing (transport/IO): the code that handles HTTP transport, middleware, request/response lifecycle, persistence wiring, and other I/O concerns. This layer should be thin, handle cross-cutting concerns (rate-limiting, CORS, request-id, logging), and delegate business work to application services.

- Application Services (business logic/orchestration): the modules that implement domain-specific orchestration, AI-provider interaction, content shaping, and decision-making. These modules should be pure‑logic where practical, returning standardized envelopes (content, metadata, persistInstructions) and avoid handling transport or presentation concerns.

Goals of the separation

- Swapability: allow replacing or mocking application services without changing plumbing or UI wiring.
- Testability: application services are easier to unit test; plumbing can be tested with integration tests focusing on transport, middleware, and persistence safety.
- Security surface reduction: centralize sanitization and output shaping so presentation is consistent and auditable.
- Single source of truth for presentation used by preview/render/export flows.

What has been implemented (summary)

- Service adapter: `server/serviceAdapter.js` resolves which concrete application service to use (defaults to `genieService`). This centralizes implementation selection.

- Application services:

  - `server/genieService.js` orchestrates generation flows, sanitizes content via `server/sanitizer.js`, converts `persistIntents` → `persistInstructions`, and preserves `requestId` in its returned metadata.
  - `server/aiService.js` provides provider abstraction (mock and real provider wrappers).
  - `server/sampleService.js` and `server/helloWorldService.js` provide dev/deterministic behavior for testing.

- Plumbing / transport:

  - `server/index.js` contains Express routes, middleware (including request-id middleware that sets `X-Request-Id`), Puppeteer lifecycle hooks for export, and endpoint wiring (e.g., `/prompt`, `/genie`, `/preview`, `/api/export`).
  - Presentation templating moved to `server/previewRenderer.js` which calls the server-side sanitizer.

- Persistence:

  - `server/persistence.js` implements atomic writes (tmp + rename), safe path resolution, and filename sanitization; it exposes `setBaseExportDir` to allow tests to isolate writes.

- Sanitization and error handling:

  - `server/sanitizer.js` uses jsdom + DOMPurify for server-side HTML sanitization.
  - A centralized error middleware (`server/utils/errorHandler.js`) produces structured JSON errors including `requestId` and writes compact error lines to `logs/errors.log` for lookup.

- Tests and CI hygiene:
  - Integration and negative tests exist for persistence and requestId behavior (`server/__tests__/*`), asserting atomic writes, lack of `.tmp-` leftovers, and header/body requestId parity.
  - Cleanup scripts and CI pretest hooks help avoid committing generated artifacts.

Where to look for working examples

- `server/previewRenderer.js` — rendering + sanitization example used by both preview endpoints and export flows.
- `server/persistence.js` + `server/__tests__/persistence.integration.test.js` — persistence + integration test showing atomic writes and artifact DB linkage.
- `server/index.js` + `server/genieService.js` — demonstration of plumbing delegating to application services while preserving `requestId` and relying on the service adapter.

Notes

- The streaming/incremental preview capability (chunked response, SSE, or websocket) is still not implemented. See the checklist in `../PATH_FORWARD_Plumbing_Separation.md` for details and rationale.

- This reference is intended to be updated after any future changes that materially alter the separation (for example, adding streaming endpoints or changing the sanitization policy).
