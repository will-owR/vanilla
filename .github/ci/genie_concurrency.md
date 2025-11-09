## Genie concurrency CI notes

Purpose

- Run the HTTP concurrency integration test for the Genie orchestration against an ephemeral Postgres instance and fail the CI job if the concurrency invariant is violated.

Required environment variables (CI job should set these)

- `DATABASE_URL` — Postgres connection string used by Prisma (eg. `postgres://postgres:postgres@localhost:5432/poema_test`).
- `USE_PRISMA_IN_TEST=1` — opt-in flag to force the in-process server to use Prisma-backed persistence during tests.
- `SKIP_PUPPETEER=true` — speeds tests and avoids Chromium in CI for this job.
- `GENIE_PERSISTENCE_AWAIT=1` — (optional) enable persistence await helpers if the job needs them.

Recommended CI flow

1. Start a Postgres service (official Docker image, e.g. `postgres:16`) and wait for readiness.
2. Run `npm --prefix server ci:prisma-setup` or equivalent commands to `npx prisma generate` and apply migrations if needed (CI only).
3. Run the single concurrency test with Prisma forced:

```bash
DATABASE_URL="$DATABASE_URL" USE_PRISMA_IN_TEST=1 SKIP_PUPPETEER=true npm --prefix server run test:run -- ./__tests__/concurrency.http.integration.test.mjs
```

Artifact collection on failure

- If the test fails, collect `server/test-artifacts/`, server logs (`server/logs/`), and any Prisma query logs to help debugging. Upload them as CI artifacts.

Tuning notes

- The concurrency test spawns N parallel requests. If CI runners are noisy or slow, reduce N or increase timeouts to avoid flakiness.
- Make sure the Postgres instance has enough ephemeral connections for the parallel load (increase `max_connections` if you encounter connection exhaustion).

Security

- Use dedicated ephemeral DB instances for CI. Do not point CI at production or long-lived staging databases.

Troubleshooting

- If you see zero rows in Prisma but log messages show `crud.createPrompt` being called, the running server used legacy storage. Verify `USE_PRISMA_IN_TEST=1` was exported in the job environment before the test runs.

Contact

- For help, mention the `feat/genie/ci-concurrency` branch and include the failing artifacts in the CI run.
