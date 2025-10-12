# Incremental Rewrite /PATH FORWARD

Document Version: dv01
Last Updated: 2025-10-03
Initial Datetime: 2025-09-30 10:15 UTC
Branch: aether-rewrite/client-phase1

Current Status:

- Phase 0 (Preparation): ✅ Completed
  - Client-v2 skeleton created (commits: 2bce478, c23d43d)
  - Feature flag routing implemented (commit: 015fcfe, PR #2)
  - Devcontainer configured with port 5174
- Phase 1 (Preview Pipeline): 🟩 In Progress
  - Store implementation and preview components under development
  - Visual testing infrastructure being established

Guiding Principle

- At all times and continuously, the new frontend `client-v2` must be visually tested and verified to work. `client-v2` is the predominant basis for determining phase success. Visual parity and live verification of the preview and export flows are required before advancing phases.

Overview

This document converts the incremental rewrite guidance into a prioritized, testable plan mapped to `ROADMAP_dv01` and `MVP_CHECKLIST_dv01`. It preserves the incremental rewrite approach (run old `client/` in production while developing `client-v2/`) but adds concrete acceptance criteria, QA gates, CI considerations, runbooks, and risk mitigations so each phase is verifiable and low-risk.

Priority summary

- Highest priority: Preview pipeline (store + preview display) — this is the single most critical piece for V0.1 and the first target to migrate to `client-v2`.
- High: Content input + AI integration (Gemini / image generation) — must work with feature-flagged real AI and deterministic stubs in CI.
- High: Export & PDF quality — smoke export must reproduce artifacts locally and in CI; non-fatal warnings allowed.
- Medium: Secondary pages (dashboard, settings, overrides) — migrate after core flows are verified.
- Low: Full cutover and cleanup.

Phased, testable plan (mapped to ROADMAP / MVP)

Phase 0 — Preparation (1 day)

- Goals:
  - Create `client-v2/` repo skeleton (Vite + Svelte) in monorepo layout.
  - Add a single feature-flag mechanism and simple routing toggle to switch individual routes to `client-v2`.
  - Ensure devcontainer/docker-compose reflects any new ports and healthchecks for `client-v2`.
- Tasks (testable):
  - `client-v2` builds locally (`npm run dev`/`npm run build`).
  - A single route can be toggled to `client-v2` in local dev without downtime.
- Acceptance criteria:
  - `client-v2` dev server starts and serves the toggled route.
  - Developer can toggle route and observe a working page in browser.
- ROADMAP mapping: Phase 1 setup; MVP: Preview Pipeline prep.

Phase 1 — Preview pipeline first (2–3 days)

- Goals:
  - Migrate store contract and preview page UI to `client-v2` (prioritize the preview component). This implements "Always-Working Frontend First" from ROADMAP.
  - Ensure preview rendering is visually identical (or acceptable enhancement) and continuously testable.
- Tasks (testable):
  - Implement adapter layer or shared types so `client-v2` subscribes to the same preview API shape.
  - Recreate the preview page in `client-v2` using the same HTML/CSS templates consumed by Puppeteer for export.
  - Add Vitest unit tests for store logic and preview component.
  - Add snapshot visual tests (dom snapshot + optional image snapshot) for preview output using existing test harness.
  - Add automated local smoke: `GET /preview` → assert HTML contains expected poem and background metadata.
- Acceptance criteria (required before Phase 2):
  - Unit tests for store and preview pass.
  - Snapshot diffs are reviewed and accepted.
  - Manual visual verification: developer confirms preview content rendered correctly for sample poem payloads.
  - Deterministic local smoke test passes.
- ROADMAP mapping: Core Preview Pipeline; MVP Checklist: Basic Store, Preview Display.

Phase 2 — Content input & AI integration (3 days)

- Goals:
  - Migrate content input UI and wire to `POST /prompt` and image generation logic.
  - Ensure deterministic behavior in CI by default (`USE_REAL_AI=false`) while enabling gateable real-AI smoke runs.
- Tasks (testable):
  - Implement input form in `client-v2` with same validation as old client.
  - Wire content flow: input → POST /prompt → preview update.
  - Add offline AI stubs (text + image) for local dev and CI that mirror real response shape.
  - Add integration tests verifying full loop using stubs.
  - Visual tests: snapshot preview after content generation and after background image applied.
- Acceptance criteria (required before Phase 3):
  - Integration tests for prompt→preview pass with stubs.
  - Manual visual verification with at least 3 representative poems demonstrating theme/background mapping.
- ROADMAP mapping: Content Management, AI Integration.

Phase 3 — Export & PDF quality (2–3 days)

- Goals:
  - Migrate export controls and verify HTML-to-PDF rendering remains faithful.
  - Ensure `server/pdfQuality.mjs` runs and emits non-fatal warnings; artifacts reproducible locally and in CI.
- Tasks (testable):
  - Implement export UI in `client-v2` (basic controls: page size, orientation, generate PDF).
  - Add in-process smoke-export test that runs `node server/scripts/run_export_test_inproc.js` against `client-v2` flows.
  - Validate that `server/pdfQuality.mjs` is executed during export and returns a summary (warnings allowed).
  - Add tests to assert generated PDF has expected page count and contains sample poem text (via `extract-pdf-text.js`).
- Acceptance criteria:
  - Smoke-export artifacts created in `/tmp` and `server/test-artifacts/` reproducibly.
  - PDF validation summary contains no fatal errors for test artifacts.
  - Manual visual verification of exported PDF (spot-check pages) by reviewer.
- ROADMAP mapping: Simple Export, Export Improvements; MVP: PDF Generation.

Phase 4 — Progressive migration & cutover (2–4 days)

- Goals:
  - Migrate remaining pages and complete cutover once gates are green.
  - Ensure rollback capability via feature flag.
- Tasks (testable):
  - Migrate dashboard, overrides, settings incrementally.
  - For each migrated page: unit tests, integration smoke, and visual snapshot.
  - Update CI to include `client-v2` unit tests and build; add integration job for smoke-export.
  - Perform canary rollout using feature flag for a subset of users or routes.
- Acceptance criteria (cutover):
  - All critical flows have passing tests and smoke results.
  - Canary runs for 24–48 hours with monitored errors below threshold (define threshold in runbook).
  - Rollback flag tested and documented.
- ROADMAP mapping: Phase 3 System Hardening, Feature Completion.

Phase 5 — Cleanup & optimization (1–2 days)

- Goals:
  - Remove legacy client, consolidate `shared/`, optimize build.
- Tasks (testable):
  - Remove unused dependencies from legacy client.
  - Consolidate shared utilities into `shared/` and remove duplication.
  - Run CI builds to ensure final deployment artifact is correct.
- Acceptance criteria:
  - CI artifacts are smaller or equal in size compared to baseline.
  - No runtime regressions observed in smoke tests.

Parallel development tracks

- Track A — Frontend (Preview, Content, Export): focuses on `client-v2` implementation, visual tests, and unit tests.
- Track B — Backend (AI integration, Export, Jobs): supports API stability, stubs, and PDF quality checks.
- Track C — QA & CI: expands test coverage, adds smoke-export orchestrations and visual regression pipelines.

Testable quality gates (must pass to advance)

1. Unit test gate (fast)

- `client-v2` unit tests + server unit tests (Vitest) must pass locally.

2. Visual parity gate (local + PR)

- Snapshot tests for preview component pass and snapshot diffs are approved.
- Optional image snapshot checks run in CI if feasible.

3. Integration smoke gate (CI)

- `USE_REAL_AI=false` + `JOBS_DB=/tmp/tmp-jobs.db` run of `run_export_test_inproc.js` must succeed and produce artifacts.

4. Export validation gate (CI with tolerances)

- `server/pdfQuality.mjs` reports non-fatal warnings only for artifacts produced by smoke runs; fatal errors block cutover.

5. Canary run gate (post-deploy)

- Canary metrics (errors, export failures, PDF quality alerts) must be below defined thresholds for a tolerable period (24–48 hours).

CI and Devcontainer considerations

- Keep `USE_REAL_AI=false` as default in CI to avoid flaky external calls.
- Add dedicated CI job(s):
  - `client-v2:unit` — run Vitest for the new front-end.
  - `integration:smoke-export` — run server in CI, execute in-process export, archive artifacts.
  - `visual:snapshots` — optional job to run image snapshot comparisons.
- Update `.devcontainer/devcontainer.json` and Docker Compose if `client-v2` requires specific ports or tooling (not mandatory for local dev if `client-v2` runs on a different port).

Shared code & API compatibility

- Enforce stable API contracts. If shape changes are needed, version the endpoints (e.g., `/api/v1/preview`) and add compatibility adapters in `client-v2`.
- Prefer adapter layer in `client-v2` over wholesale changes to server endpoints to keep migration low-risk.
- Keep `shared/` as the single source of truth for types/validation where possible; migrate small adapters when immediate reuse is not possible.

Data & DB considerations

- UI migration alone does not require DB schema changes. If new UI introduces additional fields, use JSONB fields and add migration scripts.
- For persistent changes, add DB migrations with tests, and run migrations in a controlled environment prior to cutover.

Risk register & mitigations

- Risk: Duplicate effort and drift between old and new clients.
  - Mitigation: Extract common logic early, create small adapters, and keep shared tests for core flows.
- Risk: Visual regressions.
  - Mitigation: Snapshot tests, manual verification checklist, and targeted image snapshots for preview.
- Risk: Export failures after migration.
  - Mitigation: Run export smoke tests on every PR that touches export code or the preview template.
- Risk: AI external service flakiness.
  - Mitigation: CI uses stubs; add gated real-AI smoke jobs and timeouts/retries around AI calls.

PR checklist for page migration (apply to every PR that migrates a page to `client-v2`)

- [ ] Unit tests for migrated components added and passing
- [ ] Preview snapshot added/updated and diff reviewed
- [ ] Integration smoke test covering the page route passes locally
- [ ] CI builds and integration smoke pass on PR
- [ ] Manual visual verification by reviewer (screenshots or live check)
- [ ] If export affected: smoke-export run and artifact validated

Cutover & rollback runbook (short)

- Cutover steps:

  1. Merge `client-v2` pages to `feature` branch and deploy to staging.
  2. Run integration smoke (export + preview) on staging.
  3. Enable feature flag for a small percentage (or specific routes/users).
  4. Monitor logs, errors, and PDF quality metrics for 24–48 hours.
  5. If stable, increase rollout percentage; repeat until 100%.

- Immediate rollback steps:
  1. Toggle feature flag off to serve legacy `client/` for affected routes.
  2. If toggle fails, redeploy last-known-good artifact of server and client.
  3. Open a hotfix PR, patch failing pieces in `client-v2` on a short-lived branch, test locally, then redeploy.

Monitoring & metrics (suggested)

- Track:

  - Preview rendering errors per route
  - Export job failures and durations
  - PDF quality warnings (from `server/pdfQuality.mjs`) frequency
  - Canary user error rate and rollback triggers

- Alerts:
  - Alert on export failure spikes or repeated fatal PDF quality errors.
  - Alert if preview snapshot diffs exceed tolerated variance on nightly runs.

Acceptance Criteria summary (one-line per phase)

- Phase 0: `client-v2` dev server builds and a single route toggle works.
- Phase 1: Preview store + page migrated to `client-v2`, unit tests & visual snapshots pass.
- Phase 2: Content input → prompt → preview loop works with stubs; integration tests pass.
- Phase 3: Export from `client-v2` produces reproducible PDFs and `server/pdfQuality.mjs` reports no fatal errors.
- Phase 4: All critical flows migrated and canary run meets reliability thresholds.

Refined Timeline (with QA buffer)

- Phase 0 (Prep): 0.5-1 day ✅ Completed
- Phase 1: 2–3 days 🟩 In Progress
- Phase 2: 2.5–3.5 days
- Phase 3: 2–3 days
- Phase 4: 2–4 days
- Phase 5: 1–2 days

Total: ~10–17.5 days (includes QA gates and testing buffer)

Note: Timeline adjusted based on Phase 0 completion experience and additional testing requirements

Next steps (suggested immediate actions)

1. Create `client-v2` skeleton and commit to `feature/client-v2-init`.
2. Implement preview page skeleton and shared adapter (small PR) and run the visual snapshot harness.
3. Create CI job stub for `integration:smoke-export` (textual plan) and wire `USE_REAL_AI=false` in CI configs.
4. Draft `PATH_FORWARD_CHECKLIST.md` with the above phase gates converted to checkboxes for your team.

Notes

- This document intentionally focuses on testable gates and visible verification steps because the product's core loop is preview-first and export-critical. The guiding principle — continuous visual verification of `client-v2` — must be enforced through both automated snapshot tests and a short manual verification step in the PR checklist.

---

End of PATH_FORWARD dv01
