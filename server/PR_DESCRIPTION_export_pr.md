Title: Enable Prisma in Postgres CI and add regression test for legacy POST /export

Summary

- Set USE_PRISMA_IN_TEST in Postgres-backed CI workflows so tests exercise the Prisma-backed `dbUtils` paths when a real DATABASE_URL/Postgres is available.
- Add a small regression test `server/__tests__/export.legacy-title-body.test.js` to ensure legacy clients that POST { title, body } to `/export` continue to receive a PDF buffer.

Why

- This makes CI coverage exercise the Prisma migration path and surface any migration/Prisma-specific issues earlier.
- The regression test prevents accidental regressions that would break legacy clients.

Files changed

- `.github/workflows/ci-postgres.yml` — export `USE_PRISMA_IN_TEST: "true"` in Postgres job
- `.github/workflows/ci-postgres-concurrency.yml` — export `USE_PRISMA_IN_TEST: '1'` in Postgres job
- `server/__tests__/export.legacy-title-body.test.js` — new regression test

Base branch for PR: `aetherV0/anew-default-basic`

Notes

- I ran the full server test suite locally; all server tests passed (46 files, 74 tests).
- If you want, I can open the PR against `aetherV0/anew-default-basic` on your behalf. Otherwise you can create the PR locally/remote using this branch (`feat/genie/ci-concurrency`).
