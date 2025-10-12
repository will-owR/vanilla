# PATH_FORWARD Checklist — client rewrite

Document Version: dv00
Datetime: 2025-09-30 10:15 UTC
Branch: aether-rewrite/client

Guiding Principle

- At all times and continuously, the new frontend `client-v2` must be visually tested and verified to work. Visual verification (automated + manual) is mandatory before advancing phases.

How to use this checklist

- Work top→down. Each item must be implemented, tested, and the checkbox checked with a one-line verification note and commit/PR reference.
- For each PR that migrates a page, include this checklist in the PR description and attach visual snapshots.

Phase 0 — Preparation

- [ ] Create `client-v2/` skeleton (Vite + Svelte)
  - Verification: commit `_____________` — `client-v2` dev server starts on port 5174 and serves a default page.
- [ ] Add feature-flag routing and single-route toggle
  - Verification: commit `_____________` — toggle route to `client-v2` and verify in browser.
- [ ] Update `.devcontainer` and Docker Compose if required
  - Verification: commit `_____________` — devcontainer rebuild succeeds and ports are forwarded.

Phase 1 — Preview pipeline (store + preview)

- [ ] Implement store adapter / shared types in `client-v2`
  - Verification: commit `_____________` — unit tests for adapter pass.
- [ ] Migrate preview page UI to `client-v2` using same template
  - Verification: commit `_____________` — visual snapshot matches baseline for sample poem.
- [ ] Add Vitest unit tests for store and preview
  - Verification: commit `_____________` — `npm --prefix client-v2 test` passes locally.
- [ ] Add snapshot visual tests and integrate into CI PR checks
  - Verification: PR `_____________` — snapshot job passes in CI.

Phase 2 — Content input & AI integration

- [ ] Migrate content input UI (form and validation)
  - Verification: commit `_____________` — manual input → preview updates.
- [ ] Wire `POST /prompt` with stubbed AI responses (USE_REAL_AI=false)
  - Verification: commit `_____________` — integration tests with stubs pass.
- [ ] Add visual tests for generated preview and theme background
  - Verification: PR `_____________` — visual snapshots accepted.

Phase 3 — Export & PDF quality

- [ ] Migrate export controls to `client-v2`
  - Verification: commit `_____________` — export UI triggers server export.
- [ ] Add in-process smoke-export harness for `client-v2` flows
  - Verification: PR `_____________` — `run_export_test_inproc.js` produces artifacts and CI archives them.
- [ ] Ensure `server/pdfQuality.mjs` is executed and reports (no fatal errors)
  - Verification: commit `_____________` — exported test PDF passes non-fatal validation.

Phase 4 — Progressive migration & cutover

- [ ] Migrate dashboard and secondary pages incrementally
  - Verification: commit `_____________` — each page has unit + visual tests and PR passes.
- [ ] Implement canary rollout via feature flag
  - Verification: deployment `_____________` — canary run passes monitoring thresholds.
- [ ] Perform cutover and retire legacy `client/`
  - Verification: commit `_____________` — legacy client archived and CI deploys `client-v2` only.

Phase 5 — Cleanup & optimization

- [ ] Remove legacy dependencies and unused assets
  - Verification: commit `_____________` — build artifact size reviewed.
- [ ] Consolidate `shared/` usage and remove duplicates
  - Verification: commit `_____________` — shared imports used by migrated pages.

PR checklist for each page migration

- [ ] Unit tests added and passing
- [ ] Snapshot visual tests added/updated and reviewed
- [ ] Integration smoke for route passes locally
- [ ] CI builds and integration smoke pass on PR
- [ ] Manual visual verification by reviewer (attach screenshot)
- [ ] Export smoke if export affected: artifacts validated

Cutover runbook (short)

- Pre-cutover:
  - Ensure all PRs merged and CI green.
  - Confirm smoke-export artifacts reproducible on staging.
- Cutover steps:
  - Toggle feature flag to route to `client-v2` for target users.
  - Monitor errors and export metrics for 24–48 hours.
- Rollback:
  - Toggle feature flag off.
  - Redeploy last-known-good artifacts if needed.

Metrics to monitor

- Preview rendering errors
- Export job failures & durations
- PDF quality warnings frequency
- Canary user error rate

Notes

- Keep `USE_REAL_AI=false` as default in CI. Real AI smoke jobs should be gated and run manually or on a schedule.
- Enforce snapshot review in PRs to catch visual regressions early.

End of PATH_FORWARD_CHECKLIST dv00
