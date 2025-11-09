# Server tests

This directory contains Vitest tests for the server. A few notes to avoid
confusion when editing or adding tests:

- Tests in this repo often use ESM (`.mjs`) modules and dynamic import so they
  can inject mocks (for example, a mock Prisma client) without having to run
  `prisma generate` or start a Postgres instance. Prefer `.mjs` for new tests.
- A handful of legacy CJS-style test files may still exist; avoid requiring
  Vitest with `require('vitest')` inside those files — Vitest cannot be
  imported from CommonJS in this repository's test runner configuration.
- If a test needs to exercise real Prisma migrations/clients, use the CI job
  that runs `prisma generate` and optionally runs the integration tests with
  a real Postgres instance.

Running tests locally

When running commands from the repository root use the `--prefix server` form.
When running from a CI job or a shell where your current directory is already
the `server` folder, omit `--prefix` to avoid accidentally creating paths
like `server/server`.

```bash
# From the repository root
npm --prefix server run test

# From inside the server/ directory (preferred in CI jobs that set working-directory)
cd server
npm run test

# Run a single test file from repo root
npm --prefix server run test -- __tests__/some.test.mjs
```

Test helpers

- If a test needs to avoid calling the generated Prisma client, prefer
  using the `server/utils/dbUtils.js` test helpers (`_setPrisma` / `_resetPrisma`)
  or the injection helpers exposed by `server/genieService.js`.

If you are unsure how to mock Prisma for a unit test, ask for an example and
we'll add one here.
