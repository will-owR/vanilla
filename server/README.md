# AetherPress Server

Backend service for AetherPress content generation and management.

## Overview

This server powers the backend for AetherPress, handling:

- Content and image generation (AI orchestrator)
- HTML preview and PDF export (via Puppeteer)
- API endpoints for prompt, preview, override, and export

See the [project root README](../README.md) for full architecture, development philosophy, and project structure.

## Development

The `scripts/` directory contains utility scripts for development, testing, and health checks:

- `health-checks.js`: Server-side health monitoring (Puppeteer, preview endpoint)
- `clean_samples.js`: Maintenance of sample outputs
- `run_export_test_inproc.js`: In-process export testing
- `run_smoke_export.sh`: Smoke tests for export functionality

Start the development server with auto-reload:

```bash
cd server
npm install
npm run dev
```

Start the production server:

```bash
cd server
npm start
```

## Testing

All commands must be run from within the `server/` directory. Each component (server, client) maintains its own independent `node_modules` and scripts.

Test commands:

- `npm test` - Interactive development with watch mode
- `npm run test:run` - Run all tests once and exit (CI/CD or quick checks)
- `npm run test:watch` - Explicit watch mode (same as test)
- `npm run test:ci` - CI/CD with coverage reports

Test coverage is tracked in `docs/ISSUES.md`.

## API Endpoints (Core Loop)

1. **POST /prompt** — Accepts a `prompt` and returns generated content
2. **GET /preview** — Returns an HTML preview for given content
3. **POST /override** — Accepts `content` and `override`, returns updated content
4. **GET /export** — Returns a PDF file for given content

## PDF Export Note

**Important:**

When sending binary data (like PDFs) from Express, use `res.end(pdf)` instead of `res.send(pdf)` to avoid file corruption. See [`docs/archive/ISSUES_recommend.md`](../docs/archive/ISSUES_recommend.md) for the full debugging history and resolution.

---

## Puppeteer smoke test

From within the `server/` directory you can run a small Puppeteer smoke test which uses the Chrome binary provided by the devcontainer or system `CHROME_PATH`.

1. Ensure server deps are installed in `server/node_modules`:

```bash
cd server
npm ci
```

2. Run the smoke test (this resolves `puppeteer-core` from `server/node_modules` and uses the top-level smoke script):

```bash
npm run smoke:export
```

The script will write `samples/puppeteer_smoke_test.pdf` at the workspace root `samples/` directory. If Chrome is not found, set `CHROME_PATH` to the system binary before running.

## How you can run these locally (verification)

From the repo root you can run a full smoke + verification flow which:

- posts the sample poems to the server export endpoint
- saves the returned PDF to `samples/ebook.pdf`
- extracts text from the PDF to assert expected content

1. Ensure server dependencies are installed and the server is running (or let the test start the server programmatically):

```bash
cd server
npm install
npm run dev    # or run the tests which start the server in-process
```

2. Run the smoke export and extraction verification (writes PDF and prints extracted text):

```bash
cd /workspaces/vanilla
npm --prefix server run verify-export
```

3. Run the automated export test (Vitest) which asserts the PDF magic bytes and that the extracted text contains a sample poem title:

```bash
npx vitest run server/__tests__/export_text.test.mjs --run
# or
npm --prefix server run test:export
```

Notes:

- The extraction script `server/scripts/extract-pdf-text.js` uses a lightweight PDF parser to extract text for assertions.
- The Vitest export test runs the server programmatically (does not bind to a network port) and closes the Puppeteer browser on teardown.
