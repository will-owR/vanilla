```markdown
# Plumbing separation — Vision (user-provided)

Date: 2025-10-17 @10:00 AM
Branch: aether_V0-1

Status: VISION

This file captures the user's exact envisioned plumbing flow for the demo app. It is intentionally prescriptive and uses explicit actor names so implementation and tests can be mapped directly to the design.

I. Frontend capture and orchestration

1. A user places content (some text) in the prompt and hits 'Generate'.

2. Frontend plumbing captures the request immediately and forwards the contents to the frontend orchestrator (maestro_Service).

3. Roles and available frontend services:

   - frontend-service: { 'default_Service', 'display_Service' }

4. maestro_Service logic:

   - If the incoming package contains a frontend service recipient, forward to that recipient.
   - If no frontend recipient is provided, forward to default_Service.

5. default_Service behavior:

   - Optionally augments the package with additional instructions (or none: []).
   - Returns the new package to maestro_Service without a frontend service recipient.

6. If maestro_Service has no local frontend recipient to forward the new package to, it requests frontend plumbing to forward the package to backend plumbing.

---

II. Backend reception and orchestration

1. frontend plumbing delivers the new package to backend plumbing.

2. backend plumbing forwards the package to the backend orchestrator (genieService).

3. Backend roles:

   - backend-service: { 'sampleService' }
   - backend-utility-service: { 'fileService', 'cacheService', 'dbService', 'aiService' }

4. genieService logic:

   - If the incoming package contains a backend service recipient, forward to that recipient.
   - If none provided, forward to sampleService (default processor).

5. sampleService behavior:

   - Process package according to instructions (current processing).
   - Forward the response package back to genieService with the original frontend recipient in the package metadata (e.g., display_Service).

6. If genieService determines the response recipient is a frontend service (not a backend service), it requests backend plumbing to forward the response package to frontend plumbing.

---

III. Frontend display

1. backend plumbing delivers the response package to frontend plumbing (endpoint).

2. frontend plumbing forwards to the frontend orchestrator (maestro_Service).

3. maestro_Service forwards the response to the recipient service processor display_Service.

4. display_Service behavior:

   - Processes contents per instructions (if available).
   - Forwards contents to maestro_Service for preview display.

5. maestro_Service requests frontend plumbing to display contents (render into preview area).

---

Notes:

- The design assumes packages carry recipient metadata so that origin and desired display target travel with the package across plumbing boundaries.
- The design intentionally keeps processors small and deterministic so tests can be written for each actor.
- Error handling, retries, and timeouts should be specified in plumbing adapters (see reconciled doc).

[Task complete]
```
