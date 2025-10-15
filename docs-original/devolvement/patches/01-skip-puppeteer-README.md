# DEVO-01: Skip Puppeteer — README
[MON 22 Sep 2025 @ 11:45AM]

## Purpose

This short README documents the minimal, reversible "Skip Puppeteer" gate used in the `AE-devolve/01-skip-puppeteer` branch.

## What the gate does

- When `SKIP_PUPPETEER=1` or `DEV_MINIMAL=1` the server will NOT start a headless browser.
- The server marks the Puppeteer subsystem as intentionally "skipped" but keeps the HTTP readiness middleware permissive so preview endpoints remain responsive.
- `browserInstance` will be null. Any request that attempts to generate a PDF will receive a clear `PUPPETEER_DISABLED` service-unavailable error.

## Where to find the smoke script

- `server/scripts/devolve-01-smoke.sh`

## How to run the smoke verification (recommended)

1. Open the repository in the devcontainer (recommended) so Chrome/Postgres are available.
2. From the repo root run:

```bash
SKIP_PUPPETEER=1 USE_REAL_AI=false ./server/scripts/devolve-01-smoke.sh
```

## What the smoke script verifies

- POSTs a prompt to `POST /prompt` (normal flow) so the demo `sampleService` writes `samples/latest_prompt.txt`.
- Confirms `samples/latest_prompt.txt` contains the prompt.
- Fetches a preview (tries `GET /preview?promptId=<id>`, falls back to `GET /genie`) and checks the returned HTML for the prompt text.

## Expected results

- The script should print `DEVO-01 smoke: PASS` when successful.
- If it fails, the script writes the last preview output to `/tmp/preview-debug.html` and exits non-zero. Check `samples/latest_prompt.txt` and `/tmp/preview-debug.html` for diagnostics.

## How to revert

- To restore normal behavior simply unset `SKIP_PUPPETEER` (or remove `DEV_MINIMAL`) when starting the server. The full Puppeteer startup will resume.

## Notes

- This change is intentionally non-destructive and reversible. It keeps the preview API contract intact while disabling heavy Chromium usage for faster local debugging and CI-friendly workflows.

If you'd like, I can add a one-line entry in the branch commit message and open a PR.
