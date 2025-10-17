````markdown
# Plumbing separation — Reconciled design

Date: 2025-10-17 @10:00 AM
Branch: aether_V0-1

Status: RECONCILED

This document reconciles the draft `plumbing_separation.md` with the explicit actor flow captured in `plumbing_separation-2.md` (vision). It adds concrete suggestion fillers: a message envelope, a simple service registry, a routing sequence, and policy hooks for errors/retries.

1. Glossary

- frontend plumbing: client-side adapters that handle network transport, buffering, reconnection, and rendering commands.
- backend plumbing: server-side adapters that handle transport, persistence, job enqueueing, and forwarding to the frontend.
- maestro_Service: frontend orchestrator (routes packages to frontend processors or forwards to backend plumbing).
- default_Service: frontend default processor (adds instructions or acts as a preprocessor).
- display_Service: frontend processor that prepares preview-ready payloads.
- genieService: backend orchestrator (routes backend services or forwards to frontend plumbing when recipient is frontend).
- sampleService: backend default processor (performs generation work).

2. Message envelope (required)
   Define a small, consistent envelope that plumbing will carry across boundaries. Keep it JSON and minimal:

```json
{
  "envelope": {
    "sessionId": "<string>",
    "correlationId": "<uuid>",
    "origin": "frontend|backend",
    "recipientService": "display_Service|sampleService|...|null",
    "payload": {
      /* application data e.g. { prompt, instructions? } */
    },
    "meta": { "timestamp": "ISO-8601", "trace": [] }
  }
}
```
````

Notes:

- `recipientService` is optional. If absent, orchestrators use a local default processor.
- `correlationId` is used to link requests and responses across async hops.

3. Minimal service registry (static or config-driven)
   Plumbing and orchestrators should consult a simple registry to determine whether a recipient is local (frontend) or remote (backend). Example shape:

```js
const serviceRegistry = {
  frontend: ["default_Service", "display_Service"],
  backend: ["sampleService", "fileService", "cacheService", "aiService"],
};

function serviceLocation(serviceName) {
  if (serviceRegistry.frontend.includes(serviceName)) return "frontend";
  if (serviceRegistry.backend.includes(serviceName)) return "backend";
  return "unknown";
}
```

4. Routing sequence (mapping vision -> draft)

- Step A (capture): frontend plumbing receives user action and wraps it in the envelope. It forwards to `maestro_Service`.
- Step B (frontend orchestration): `maestro_Service` checks `recipientService`. If missing, calls `default_Service` locally to possibly augment the envelope. After that, if `recipientService` is present and local, forward to local processor; otherwise, request frontend plumbing to forward to backend plumbing.
- Step C (cross-boundary handoff): frontend plumbing performs a transport call to backend plumbing (HTTP POST or RPC). Plumbing must preserve envelope (correlationId + recipientService) and attach transport metadata.
- Step D (backend orchestration): backend plumbing hands the envelope to `genieService`. `genieService` uses `recipientService` or default (`sampleService`) to decide local processing. After processing, it sets the response envelope recipient to the original `recipientService` (which may be frontend) and returns the response package to backend plumbing.
- Step E (backend -> frontend return): If response recipient is frontend, `genieService` requests backend plumbing to transport the envelope to frontend plumbing. Backend plumbing calls frontend plumbing endpoint (HTTP POST or push channel) or uses a message bus if present.
- Step F (final display): frontend plumbing passes envelope to `maestro_Service`; `maestro_Service` forwards to `display_Service`; `display_Service` processes and returns to `maestro_Service` for rendering.

5. Transport adapters (suggestion fillers)

- Frontend plumbing adapters:
  - HTTP POST adapter (synchronous demo path)
  - Retry/backoff wrapper
  - SSE/WebSocket listener adapter to accept backend-initiated pushes
- Backend plumbing adapters:
  - HTTP POST receiver endpoint (e.g., `/plumbing/receive`) to accept envelopes from frontend plumbing
  - HTTP POST client to send responses back to frontend plumbing (or enqueue to message bus)
  - In-memory or Redis-backed JobQueue adapter

6. Error, timeout, and retry policy (minimal filler)

- Orchestrator-level policy:
  - If a processor times out (X ms), return an envelope with error status and enqueue a retry job if processing is idempotent.
  - If transport fails, plumbing retries with exponential backoff for N attempts (configurable), then returns an error envelope to the origin.
- Suggested defaults for demo:
  - processor timeout: 10s
  - transport retries: 3 attempts with base backoff 200ms

7. Telemetry & tracing

- Append `meta.trace` items at each handoff with { service, timestamp, status }.

8. Tests and acceptance criteria

- Unit test: `server/app/generate.js` pure function — given payload, returns canonical payload and version.
- Integration test: simulate envelope through frontend plumbing -> backend plumbing -> sampleService -> return path and assert the preview contains expected `meta.sourceFile` and correlationId preserved.

9. Implementation hints (small, non-breaking changes)

- Implement an `envelope.js` helper in `server/plumbing/` and `client/plumbing/` to compose/parse envelopes.
- Add a static `serviceRegistry.json` under `config/` or `server/plumbing/` used by both maestro_Service and genieService.
- Keep demo synchronous for now (HTTP), add SSE adapter for backend-to-frontend pushes next.

10. Example envelope (concrete)

```json
{
  "sessionId": "demo",
  "correlationId": "2c3f...",
  "origin": "frontend",
  "recipientService": "display_Service",
  "payload": { "prompt": "Write a short poem" },
  "meta": { "timestamp": "2025-10-17T10:05:00Z", "trace": [] }
}
```

Summary: the reconciled doc keeps the draft's incremental, adapter-first approach while explicitly mapping the vision's named actors to concrete envelope, registry, and routing patterns. The suggestion fillers are intentionally small so they can be implemented as plumbing adapters with minimal disruption to existing app logic.

Next step suggestion: I can add the `envelope.js` helper and a tiny `serviceRegistry.json` in `server/plumbing/` and `client/plumbing/` and wire a minimal demo path (HTTP transport) to prove the flow. Do you want me to implement that now?

```

```
