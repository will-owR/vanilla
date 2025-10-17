# aether-dev — technical reference (exercise_1 integration)

## Purpose

This document records the technical design and developer instructions for the minimalist exercise app (prompt → generate → preview) used to validate backend-driven preview updates. It complements `docs/project/new/exercise_1.md` with implementation details, run commands, and extension notes for real-world integration.

## Architecture (concise)

- Frontend: static single-file client at `client/index.html`. UI contains a single `prompt` input, a `Generate` button and a `preview` region. It issues a POST to `/api/generate` and renders the returned `payload.html` into the preview container.
- Backend: lightweight Express app in `server-v2/` that:
  - Serves the static `client/` directory
  - Implements `POST /api/generate` which selects a sample file from `data/content/`, composes an HTML preview, and returns a JSON payload { sessionId, version, html, meta }
  - Selection strategy is intentionally ad hoc (random) to keep the demo simple; production will require deterministic selection or job orchestration.

## Data shapes

- Request (frontend -> backend):
  - POST /api/generate
    - body: { prompt: string, sessionId?: string }
- Response (backend -> frontend):
  - 200 OK
    - body: {
      sessionId: string,
      version: number, // monotonically increasing (Date.now() used here)
      html: string, // small trusted snippet for demo
      meta: { sourceFile: string, generatedAt: string }
      }

## Why this shape

- Returning `html` keeps the client minimal for the demo. For production, prefer structured payloads + client templating and sanitize any HTML from untrusted sources.

## Run and verify locally

1. Start the server:

```bash
cd server-v2
npm install
npm start
# server listens on http://localhost:3001 by default
```

2. Open the client (served by the server):

- Visit http://localhost:3001/ in your browser, enter a prompt and click Generate.

3. Manual smoke test (curl):

```bash
curl -X POST -H "Content-Type: application/json" -d '{"prompt":"hello"}' http://localhost:3001/api/generate
```

## Testing

- Unit: add tests for the selection helper and payload composition (example: ensure version increments and `meta.sourceFile` is set).
- Integration: start the server in a test harness and POST to `/api/generate`, asserting the returned JSON shape and that `meta.sourceFile` exists in `data/content/`.

## Extension notes (next steps)

- Async generation: if generation becomes long-running, change POST /api/generate to return 202 + jobId and emit updates via SSE (/api/stream?sessionId=...) or WebSocket. SSE is recommended for one-way preview pushes.
- Persistence / scaling: use Redis/DB to store last preview per session and to coordinate across instances.
- Security: add authentication, CSRF protections, and sanitize HTML. Use content-signing or templates to avoid XSS.
- Acceptance tests: automate a headless browser test that clicks Generate and asserts the preview DOM updates within a time budget.

## Repository touchpoints

- `client/index.html` — demo frontend
- `server-v2/index.js` — demo backend implementation
- `data/content/` — sample content files used by the demo
- `docs/project/new/exercise_1.md` — short exercise specification

## Ownership and next actions

1. Review and accept this technical reference.
2. Decide whether to keep synchronous responses (current demo) or implement async jobs + SSE.
3. If accepted, I can implement tests and optionally convert to async flow with SSE and job persistence.
