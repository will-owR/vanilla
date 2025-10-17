# exercise_1 — Simple prompt → generate → preview

## Goal

Build a minimal, testable flow that demonstrates how a frontend prompt triggers a backend generation process which selects content from `data/content/` and the frontend preview updates without manual reload.

## High-level actors

- Frontend: single-page form with a `prompt` input, `Generate` button, and `preview` area.
- Backend: receives prompt, chooses one content file from `data/content/` (ad hoc selection for the exercise), and returns a preview payload.
- Data: `data/content/` contains sample content files; backend reads and forwards one as the generated preview.

## Big-picture flow

1. User enters text in `prompt` and clicks `Generate`.
2. Frontend POSTs JSON { prompt } to POST /api/generate (sessionId optional).
3. Backend receives request, picks a file from `data/content/` (e.g., random or round-robin), reads its contents, and composes a preview payload:
   {
   sessionId, // optional
   version: number,
   html: "<div>...rendered content...</div>",
   meta: { sourceFile, generatedAt }
   }
4. Backend returns 200 with the preview payload. Optionally, backend also emits the payload on an SSE stream for subscribed clients.
5. Frontend receives payload and renders `preview.innerHTML = payload.html` (or uses a safe renderer / sanitization step).

## Design choices

- Update mechanism: synchronous response + optional SSE stream. For exercise_1, the synchronous response is sufficient (frontend immediately shows returned preview). SSE can be added later if generation is async.
- Data selection: ad hoc backend selection (random or simple rotation) from `data/content/` — keep it simple for demonstrability.
- Preview format: backend returns HTML (small, trusted snippets) for direct rendering. For safety, in production use sanitized HTML or send structured data and client-side templates.

## API contract (exercise)

- POST /api/generate

  - Body: { prompt: string, sessionId?: string }
  - Response: 200 { sessionId, version, html, meta }

- GET /api/content-list (optional)
  - Response: 200 [ { name, path } ]

## Acceptance criteria

1. A user types into `prompt`, clicks `Generate`, and the preview area updates with content selected from `data/content/` without a page reload.
2. The returned payload includes a `meta.sourceFile` pointing to which file was used.
3. Implementation is small, readable, and easy to run (dev: node server; static client file or served by server).

## Actionables (short)

1. Create a minimal frontend: `client/index.html` with a prompt input, Generate button, and preview container.
2. Create backend endpoints under `server-v2/` or `server/preview-exercise/`:
   - POST /api/generate -> reads random file from `data/content/`, returns preview payload.
3. Add a small README at `docs/project/new/exercise_1.md` (this file).
4. Test manually: run backend, open client, submit prompt, verify preview updates and meta.sourceFile matches a file in `data/content/`.

## Notes

- This is intentionally simple: synchronous request-response will illustrate the essential round-trip. If the generation step becomes expensive or asynchronous, we switch to an async job pattern + SSE/WS for updates.
- Don't render untrusted HTML in production without sanitization. For demo content (local files in `data/content/`) it's acceptable.
