# Shared artifacts and test-results

This brief note explains where CI and local smoke scripts consolidate ephemeral test artifacts.

Why this exists

- Playwright and Puppeteer tests often generate results (traces, screenshots, small JSON files) under `test-results/` at the working directory. Different runners/scripts sometimes create `test-results/` at the repo root, `client/`, or `server/`.
- To make artifact collection predictable, CI workflows consolidate those into `shared/test-results/` at the end of runs.

What CI does

- Workflows that run Playwright/Puppeteer tests now:
  - Run the smoke script from the package directory (e.g., `client/`) so artifacts land under that package by default.
  - After the smoke step they run a consolidation step that moves any `test-results/` folders (root, client, server) into `shared/test-results/` for easier access and artifact uploads.

How to inspect locally

- If you run tests locally and see `test-results/` folders at the repo root, they are ephemeral and safe to remove. Use the following to clean up:

```bash
rm -rf test-results client/test-results server/test-results
```

Or keep them but add them to your local `.gitignore` (the repo already ignores `**/test-results/`).

If you'd like a different consolidation location, update the CI workflows under `.github/workflows/`.

# AetherPress Shared

Shared utilities, types, and constants for the AetherPress project.

## Purpose

This module contains code that is shared between the client and server components:

- Common TypeScript types
- Shared utility functions
- Constants and configurations

## Structure

- `types/`: TypeScript type definitions
- `utils/`: Shared utility functions
- `__tests__/`: Tests for shared code
- `scripts/`: (Future) Any shared development utilities

## Usage

This module is used as a local dependency by both the client and server.
When adding new shared functionality, ensure it's truly needed by both components
to maintain clear separation of concerns.

## CI/CD Workflows

For a detailed summary and assessment of the GitHub Actions workflows used in this project, please see the `WORKFLOWS.md` document located in the `.github/workflows/` directory of the root of this repository.
