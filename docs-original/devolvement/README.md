# Devolvement Plan

> NOTE: general application flow and current preview failure
>
> - Frontend: user composes a prompt in the UI and submits it (client-side Svelte app).
> - Frontend → Backend: the client POSTs the prompt to `POST /prompt` (or the app's canonical prompt endpoint).
> - Backend processing: the server orchestrates AI (text + image) calls, assembles content, and may enqueue background jobs or generate assets synchronously.
> - Preview generation: the backend produces an HTML preview (or metadata/URL for a preview) and writes artifacts (for example `samples/latest_prompt.txt`, image assets, or a preview payload).
> - Frontend update: the client fetches the preview (GET `/preview` or via returned payload) and updates the live preview pane.
>
> Important: the final leg — the frontend updating its preview from backend-generated content — has been failing despite weeks of troubleshooting. Devolvement is proceeding so we can produce minimal, runnable branches and verify the core flow incrementally until the full preview update path is restored.

This folder documents the controlled devolution strategy used to simplify the `aether-dev` - prototype V0.1 - application into progressively-minimal, runnable branches. Follow this guide when producing or reviewing devolved branches.

Principles

- Prefer non-destructive, reversible changes.
- Use environment feature flags to gate heavy subsystems where possible.
- Make each devolved branch a single-purpose snapshot that is runnable and testable.
- Include a small smoke script and a README in each devolved branch.

Recommended workflow

1. Create a backup branch:
   ```bash
   git branch backup/devolve-<NN>-before-$(date +%F)
   git push origin backup/devolve-<NN>-before-$(date +%F)
   ```
2. Create a devolved branch (branch from latest devolved or `aether-dev`):
   ```bash
   git checkout -b AE-devolve/<NN>-<short-desc>
   ```
3. Implement only the gating/stub changes for the targeted subsystem and add a smoke script.
4. Commit, push, run the smoke script, and open a small PR for review.

Devolution order (Recommended/Updated, after 01-skip-puppeteer)
1. Puppeteer (skip/replace renderer) ✅ See `01-skip-puppeteer-README.md`
2. HMR / store instrumentation simplification
3. Envelope/response-shape simplification
4. Readiness/warmup gating
5. Background job workers
6. Dev auth / restrictive auth flows
7. Rate-limiting / throttling
8. Database (switch to in-memory or mock)
9. Competing handlers / route ambiguity
10. Optional features (PDF export, advanced previews)

Old (Original, reference only) ❎
1. Puppeteer (skip/replace renderer) ✅ See `01-skip-puppeteer-README.md`
2. Background job workers
3. Readiness/warmup gating
4. Rate-limiting / throttling
5. Dev auth / restrictive auth flows
6. Database (switch to in-memory or mock)
7. Envelope/response-shape simplification
8. Competing handlers / route ambiguity
9. HMR / store instrumentation simplification
10. Optional features (PDF export, advanced previews)

When to gate vs remove

- Gate (feature flags) when you want a reversible and minimal-diff change.
- Remove when preparing a clean snapshot for demo or release; prefer branches for removals.

Verification checklist (for each devolved branch)

- App starts within ~10s in normal dev machine.
- POST to `/prompt` (or the app's canonical flow) returns 200 and a normalized JSON body.
- `samples/latest_prompt.txt` is updated when applicable.
- `scripts/smoke-devolve-<NN>.sh` exits 0 locally.

Security & process notes

- Never enable `DISABLE_AUTH` or similar in production. Keep flags scoped to branches and development only.
- Keep changes small and well-documented in commit messages and PR descriptions.

Next steps

- Add per-step patch templates in `docs/devolvement/patches/` and smoke script templates in `docs/devolvement/templates/`.

---

Created on $(date)
