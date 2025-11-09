# MVP Checklist (revised)

Last updated: 2025-11-01

Purpose: a compact, actionable acceptance checklist that maps directly to the 2‑week V0 roadmap and enforces CI/traceability requirements.

## V0 locked items (must complete to claim V0)

- Content Preview

  - Backend: `GET /preview` returns HTML for a canonical envelope.
  - Frontend: preview component renders edits and updates live.
  - Tests: unit test for normalizer + integration test for preview endpoint.
  - Done when: preview works end-to-end in devcontainer and CI smoke job.

- PDF Export (prototype)

  - Backend: `POST /export` accepts `{ resultId }` or normalized `{ content }` and returns `application/pdf` buffer.
  - Use `PDF_GENERATOR_IMPL=mock` for CI; allow Puppeteer smoke in devcontainer if available.
  - Tests: regression test for legacy `{ title, body }` and an export-smoke CI job.
  - Done when: export endpoint returns valid PDF buffer in CI mock job.

- Override Persistence (basic)
  - Backend: save edits with `id`/`version` and return persisted metadata.
  - Preview and export reflect stored edits.
  - Tests: persistence unit test and integration test that uses saved edits in export.
  - Done when: edits persist and manifest in preview/export flows in CI smoke job.

## Essential infra & checks (must be present before merging V0 PRs)

- Devcontainer/local reproducible Postgres stack or documented alternative.
- CI runs `npx prisma generate` and migrations when DB is present and sets `USE_PRISMA_IN_TEST=true`.
- `npx eslint` configured project-wide (central `config/eslintrc.json`) with test overrides; tests and lint must pass.
- `npm run lint` and `npm --prefix server run test:run` in CI on a required check.
- Pre-commit hooks (Husky + lint-staged) to block trivial regressions.

## Testing matrix (minimum)

- Unit tests: services (mocked plumbing), normalizer, persistence helper.
- Integration: preview endpoint, export endpoint (mock PDF), override flow.
- Smoke: one CI job that runs preview + export-mock + override end-to-end.

## Developer hygiene (rules)

- PRs must reference an ISSUE from `NEXT_STEPS` and include the line: `NEXT_STEPS: #<issue>` and `MVP_CHECKLIST: <section>` in the PR body.
- Branch naming: `v0.1/<short-task-name>` for V0 work.
- Required checks: `lint`, `server:tests`, `export-smoke` (mock). These must pass before merge.

## Definition of Done (for every item)

1. Issue created and assigned in the board (NEXT_STEPS).
2. Implementing PR references the ISSUE and MVP item in the PR body.
3. Unit + integration tests added/updated and pass locally.
4. CI smoke job passes (mock PDF where Puppeteer is not available).
5. Documentation updated (README or docs/ small note) explaining how to run the local dev stack and tests.

## Minimal set of next-step issues to create now (examples)

- `v0.1/preview-endpoint` — implement `GET /preview`, test + frontend preview integration.
- `v0.1/export-endpoint` — implement `POST /export`, add mock pdf generator and regression test for `{ title, body }`.
- `v0.1/override-persistence` — implement save/edit/version behavior and integration test.
- `v0.1/devcontainer-postgres` — provide devcontainer/docker-compose and docs to run local Postgres for tests.

## Timeline (suggested)

- Day 0: lock scope, create issues, assign owners, add CI checks for lint and server tests.
- Day 1: infra work (prisma generate in CI, devcontainer Postgres, ESLint centralization).
- Days 2–7: implement Preview and Export (including regression test), fix lint issues.
- Days 7–12: implement Override persistence and finalize tests.
- Day 13–14: stabilize, fix any remaining lint/test failures, create release branch and merge.

---

(End of `MVP_CHECKLIST-revised.md`)
