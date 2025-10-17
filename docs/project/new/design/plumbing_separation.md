# Draft: plumbing_separation

Date: 2025-10-17 @10:00 AM
Branch: aether_V0-1

Status: DRAFT

## Objective

Define a clear, incremental plan to separate plumbing (transport, persistence, orchestration, auth, retries, telemetry) from application logic (business rules: generate preview from prompt, render templates) across frontend and backend. The goal is minimal disruption, clear interfaces, and testability.

## Principles

- Single Responsibility: plumbing modules handle cross-cutting concerns only.
- Explicit Interfaces: app logic interacts with plumbing via small, well-documented interfaces.
- Testability: app logic remains easily unit-testable without plumbing.
- Incremental migration: make small refactors and add adapters rather than big rewrites.

## Suggested Folder Layout

- `server/` — application & API controllers
  - `server/app/` — pure application logic (generate, render)
  - `server/plumbing/` — transport adapters, store adapters, job queue glue
  - `server/worker/` — background worker process
- `client/` — UI
  - `client/app/` — components, templates, business UI logic
  - `client/plumbing/` — PreviewService, network adapters, reconnection & retry logic

## Core Interfaces (examples)

- Store (plumbing) — server

  - setPreview(sessionId, model)
  - getPreview(sessionId)
  - subscribe(sessionId, handler) // optional: for in-process events

- JobQueue (plumbing) — server

  - enqueueJob(type, payload) -> jobId
  - getJobStatus(jobId)
  - worker consumes jobs and calls app.generate

- PreviewService (plumbing) — client
  - requestGenerate(prompt) -> { jobId? | payload }
  - subscribe(sessionId, handler) -> unsubscribe
  - getLatest(sessionId)

## Migration plan (incremental)

1. Extract pure functions from server controllers into `server/app/` (no network/db). Unit test these.
2. Introduce `server/plumbing/store.js` with in-memory API and replace direct store accesses with the store interface.
3. Replace direct file/DB writes with store.setPreview calls in controllers.
4. Add `server/worker/` that can call `app.generate` using the same interface; wire it to JobQueue once job pattern is needed.
5. Client: introduce `client/plumbing/PreviewService` (initially wraps fetch); refactor components to use this interface.
6. Replace direct fetch in UI with PreviewService.subscribe for real-time updates (SSE/WebSocket adapter added in plumbing).

## Checklist / Acceptance

- App logic has unit tests and no network dependencies.
- Plumbing adapters have integration tests covering reconnection/backoff.
- Switching store implementation (in-memory -> Redis) requires only changing plumbing config.
- Frontend components use PreviewService and accept mock implementation in tests.

## Open decisions

- Transport for real-time updates: SSE (one-way) vs WebSocket (two-way). Recommendation: SSE first.
- Job semantics: synchronous for demo; implement job queue when generation becomes slow.

## Next steps

1. Review & accept draft.
2. Create a PR that extracts `server/app/generate.js` from existing handler as a pure function.
3. Add `client/plumbing/PreviewService` mock and live adapter.
