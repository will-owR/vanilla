Title: Skip Puppeteer (gate with SKIP_PUPPETEER / DEV_MINIMAL)

Purpose

Suggested change (example snippet for `server/index.js`)

````markdown
# Skip Puppeteer (gate with SKIP_PUPPETEER / DEV_MINIMAL)

Purpose

- Provide a minimal, reversible change that prevents Puppeteer from starting in devolved branches while preserving the preview API surface and minimal side-effects (for example `samples/latest_prompt.txt`).

Results from the repository scan (summary)

- `server/index.js` is the primary edit surface: it contains `startPuppeteer()`, the `serviceState`/`puppeteerReady` logic, readiness middleware, and the `/preview`, `/api/preview` and `/export` endpoints that rely on Puppeteer or `browserInstance`.
- `server/sampleService.js` writes `samples/latest_prompt.txt` and must continue to do so under the gated flow.
- Client code already uses `/preview` and `/api/preview` as fallbacks (see `client/src/lib/api.js` and `client/src/components/PreviewWindow.svelte`), so server-side stubbing that returns HTML preserves the frontend preview.
- Several helper scripts and tests exercise `/preview` (`server/__tests__`, `server/scripts/ci-smoke-test.sh`, `server/scripts/e2e-smoke.js`), so add a small smoke harness to the devolved branch for verification.

Suggested minimal change (example snippet for `server/index.js`)

```js
async function startPuppeteer() {
  if (process.env.SKIP_PUPPETEER === "1" || process.env.DEV_MINIMAL === "1") {
    console.log("SKIP_PUPPETEER enabled — not starting Puppeteer");
    // Indicate that Puppeteer is intentionally unavailable but the server
    // should still treat preview endpoints as operational.
    serviceState.puppeteerReady = true;
    // Keep browserInstance null; consumers must guard against it.
    browserInstance = null;
    return null;
  }
  // ...existing launch logic...
}
```
````

Actionable options (pick one for this devolved branch)

- Option A — Safe gate (recommended):

  - Short-circuit `startPuppeteer()` as shown above. Set `serviceState.puppeteerReady = true` so readiness middleware doesn't block preview endpoints.
  - Leave `previewTemplate` and `/api/preview`/`/preview` intact so they return server-rendered HTML from in-memory content or `samples/latest_prompt.txt`.
  - Guard all `browserInstance` usages (exports, PDF generation) with a check and return 503/501 with an explanatory JSON payload when SKIP_PUPPETEER is set.

- Option B — Local stub renderer (slightly more invasive):

  - In addition to Option A, implement an in-process stub for export endpoints that returns a small, deterministic HTML or PDF placeholder. Useful if CI or other scripts expect a PDF binary. Keep the stub obvious and documented.

- Option C — Feature-flagged export removal (conservative but higher friction):
  - Only implement the gate; mark export endpoints as unsupported in devolved branch and document how to re-enable. This is clean but may require skipping tests that expect exports.

Smoke script (draft) — place in `server/scripts/devolve-01-smoke.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Start server with the gate and deterministic AI off
SKIP_PUPPETEER=1 USE_REAL_AI=false npm --prefix .. run start:dev &
PID=$!
trap "kill $PID" EXIT

# Wait for server to start (simple polling)
for i in {1..20}; do
  if curl -sS http://localhost:3000/preview >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# POST a small prompt
CONTENT='{"title":"Smoke Test","body":"<p>hello</p>"}'
RES=$(curl -sS -X POST http://localhost:3000/prompt -H 'Content-Type: application/json' -d "$CONTENT" || true)
echo "POST /prompt => $RES"

# Check that samples/latest_prompt.txt exists and contains the title
if ! grep -q "Smoke Test" ../samples/latest_prompt.txt; then
  echo "samples/latest_prompt.txt missing or not updated" >&2
  exit 2
fi

# GET preview by content fallback
PREVIEW_HTML=$(curl -sS -G "http://localhost:3000/preview" --data-urlencode "content=$CONTENT" || true)
if [[ "$PREVIEW_HTML" != *"Smoke Test"* ]]; then
  echo "preview HTML did not contain expected text" >&2
  echo "$PREVIEW_HTML" > /tmp/preview-debug.html
  exit 3
fi

echo "DEVO-01 smoke: PASS"
```

Verification checklist

- Server starts within ~10s when launched with SKIP_PUPPETEER=1
- POST `/prompt` returns success and `samples/latest_prompt.txt` is updated
- GET `/preview?content=<json>` or POST `/api/preview` returns HTML containing the title/body
- Export endpoints (if called) return a clear 503/501 message under the gate

Notes and next steps

- Implement Option A for the `AE-devolve/01-skip-puppeteer` branch to be minimally invasive and reversible.
- Add the smoke script and a short `README.md` in the branch describing how to run the verification.
- Run the smoke script in the devcontainer and iterate (maximum 3 quick fixes) until it passes; capture `preview-debug.html` if failures occur.
- After verification, open a PR from `AE-devolve/01-skip-puppeteer` to the backup branch and include smoke output.

Why this approach

- It preserves the preview API contract the frontend expects while removing the heavy Puppeteer dependency during debugging and iterative repair. The change is minimal, reversible, and clearly documented.

```

Notes

- Keep the API compatible: when `startPuppeteer()` returns `null`, ensure any consumer checks for `null` and uses a stubbed renderer function that returns a minimal HTML or text payload.
- Prefer gating over deleting code so the full implementation remains available for restoration.
```
