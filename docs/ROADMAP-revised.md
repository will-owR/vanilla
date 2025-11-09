# AetherPress — ROADMAP (revised)

Last updated: 2025-11-01

Purpose: provide a compact, actionable roadmap that locks scope for a 2‑week V0 timebox, enforces traceability (ISSUES → NEXT_STEPS → MVP → ROADMAP), and fixes developer friction (CI/lint/tests) so iteration is fast.

## High-level constraint (mandatory)

- V0 timebox: 2 weeks (14 calendar days). During this window we will only implement the 3 must-have features below + essential infra (CI, tests, lint). All other work is blocked or deferred.

## V0 (2‑week) locked scope — 3 must-have features

1. Content Preview (backend + frontend)

   - Deliverable: `GET /preview` that returns an HTML preview matching on-screen layout.
   - Acceptance: A simple preview renders the canonical envelope; frontend shows preview and updates on edits.
   - Owner: (assign) — small scope: server controller + frontend preview component.

2. PDF Export (server side, prototype quality)

   - Deliverable: `POST /export` that accepts either `{ resultId }` or normalized `{ content }` and returns a PDF buffer (mock or Puppeteer in CI-friendly mode).
   - Acceptance: Export returns application/pdf with non-empty buffer and a validation result object in tests. A regression test for legacy `{ title, body }` must pass.
   - Owner: (assign)

3. Override Persistence (basic edit/save)
   - Deliverable: `POST /override` (or `POST /prompt` edit path) that saves edits with light versioning and returns the persisted id/version.
   - Acceptance: Saved edits are returned by `GET /preview` and included in export; basic conflict detection via version number.
   - Owner: (assign)

## Essential infra & hygiene (must be in the first 3–4 days)

- Devcontainer Postgres (or docker-compose.test.yml): provide a reproducible local Postgres for CI-like runs. (Day 1–2)
- Ensure Prisma client is generated in CI: run `npx prisma generate` and migrations before tests. Export `USE_PRISMA_IN_TEST=true` where DATABASE_URL exists. (Day 1)
- Puppeteer smoke: provide `PDF_GENERATOR_IMPL=mock` for CI and a devcontainer Puppeteer check for local smoke runs. (Day 1–2)
- ESLint & vitest config: centralize `config/eslintrc.json` with test overrides (or `eslint-plugin-vitest`) and ensure `server/` lint passes. Add `npm run lint` script. (Day 1)
- Pre-commit hooks: add Husky + lint-staged to prevent regressions (Day 2)

## Tests & CI policy (enforced)

- Required CI checks for merging V0 branches: `lint`, `server:tests` (unit + critical integration), `export-smoke` (mock PDF), and `prisma-generate/migrate` when DB is used.
- All PRs implementing V0 items must include: `NEXT_STEPS: <issue-number> — MVP_CHECKLIST: <section> — ROADMAP: V0` in the PR description.
- Add one small CI job that runs the three critical flows (preview, export mock, override) and must pass before merge.

## Traceability & process

- Strict process for V0: work must be planned in an ISSUE, assigned to NEXT_STEPS, linked to MVP_CHECKLIST, implemented in a branch `v0.1/<short-name>`, and submitted as a PR that references the ISSUE.
- Each PR must include a smoke-test checklist and the status of `npm --prefix server run test:run` run locally (paste last lines in PR body).

## Post-V0 backlog (deferred)

- Full Prisma Postgres migration and data migration tooling (post-V0)
- Advanced PDF fidelity (complex CSS/templating) using Puppeteer (post-V0)
- Access control, multi-user, and templates marketplace (future phases)

## Minimal V0 timeline (example)

- Day 0 (kickoff): lock scope, create issues, assign owners, set up CI checks.
- Day 1: Devcontainer Postgres + Prisma generate in CI, ESLint test override, create mock PDF path for CI.
- Day 2–4: Implement Preview + basic frontend preview component + tests.
- Day 4–7: Implement Export + mock PDF + regression test for legacy `{ title, body }`.
- Day 7–10: Implement Override Persistence (save/edit) + basic conflict/version handling.
- Day 11–13: Stabilize, fix lint warnings, add pre-commit hooks, final smoke tests.
- Day 14: Freeze, create V0 branch, merge and release a dev snapshot.

## Acceptance gate for V0

- The 3 must-have features completed and tested.
- `lint` and critical `server` tests pass in CI.
- Devcontainer Postgres smoke runs successful and PR traceability enforced.

---

Notes

- This roadmap is intentionally minimal and strict. It prioritizes making the prototype actually shippable as a V0 release candidate in a bounded time. After V0 is achieved the team can expand features from the backlog with the same gating process.

---

(End of `ROADMAP-revised.md`)
