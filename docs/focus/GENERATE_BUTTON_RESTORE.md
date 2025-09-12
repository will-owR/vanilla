# Generate Button Restoration Guide

Purpose: provide a safe, minimal set of steps to make the GUI "Generate" button operational as quickly as possible. These are documentation-only instructions — no code changes are included here. Follow the steps in order: verify connectivity, enable an emergency mode toggle, and then (if approved) apply small code changes.

## Key idea

Keep only the minimal pieces required to accept a prompt and send it to the server. Avoid changing core logic unless you must; prefer a small, opt-in EMERGENCY_MODE toggle (environment variable or compile-time flag) that short-circuits non-essential behavior.

## Minimal dependencies

- Prompt input component (DOM access or `promptStore` read)
- A single POST endpoint that accepts { prompt }
- A tiny success/failure UI (loading, success, error)

## Minimal client flow (suggested)

This pseudocode shows a safe minimal client-side function to call from the UI when EMERGENCY_MODE=true. It includes a small timeout and optional dev-auth header for local debugging.

```javascript
// docs: minimal, safe client-side example (documentation-only)
async function generateOnly(prompt, { timeoutMs = 8000, devAuth } = {}) {
  if (!prompt || !prompt.trim()) {
    return { ok: false, reason: "empty" };
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { "Content-Type": "application/json" };
    if (devAuth) headers["x-dev-auth"] = devAuth;

    const res = await fetch("/prompt", {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    clearTimeout(id);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    clearTimeout(id);
    return {
      ok: false,
      reason: err?.name === "AbortError" ? "timeout" : "network",
    };
  }
}
```

Notes:

- Use a short timeout (6–10s) to keep the UI responsive.
- Preserve headers like `x-dev-auth` for local debugging if your environment sets `DEV_AUTH_TOKEN`.

## Suggested EMERGENCY_MODE flag

Prefer an explicit toggle instead of scattering boolean literals through code. Example options:

- Environment variable: EMERGENCY_MODE=true
- Build-time flag: define in a small config file

In `PromptInput.svelte` (or equivalent) prefer a single conditional branch:

```javascript
// ... pseudocode for doc only
const EMERGENCY_MODE = Boolean(
  import.meta.env?.VITE_EMERGENCY_MODE || process.env.EMERGENCY_MODE
);

async function onGenerateClick(prompt) {
  setLoading(true);
  if (EMERGENCY_MODE) {
    const result = await generateOnly(prompt, {
      timeoutMs: 8000,
      devAuth: import.meta.env.VITE_DEV_AUTH,
    });
    setLoading(false);
    setStatus(result.ok ? "success" : "error");
    return;
  }

  // ...existing generateAndPreview flow when not in emergency mode
}
```

## API connection checks (quick)

Use the local dev auth header when your server requires it. These commands are examples to run from the machine hosting the client or CI runner.

```bash
# Basic local check (no auth)
curl -v -X POST http://localhost:3000/prompt \
   -H "Content-Type: application/json" \
   -d '{"prompt":"test"}'

# If DEV_AUTH_TOKEN is set on the server, include it:
curl -v -X POST http://localhost:3000/prompt \
   -H "Content-Type: application/json" \
   -H "x-dev-auth: $DEV_AUTH_TOKEN" \
   -d '{"prompt":"test"}'
```

If the server supports a deterministic dev stub at `/prompt?dev=true`, try that for reliable fast testing:

```bash
curl -v -X POST "http://localhost:3000/prompt?dev=true" \
   -H "Content-Type: application/json" \
   -d '{"prompt":"test"}'
```

## Verification checklist (operate-first)

- [ ] Button reacts to clicks (event handler bound)
- [ ] Client sends POST to `/prompt` (or `/prompt?dev=true` for dev)
- [ ] Request completes within timeout (6–10s)
- [ ] UI shows basic success or error state
- [ ] Logs show the server received the request (server logs or request inspector)

Optional checks (if you plan to re-enable preview later):

- [ ] preview endpoint responds
- [ ] contentStore updated

## Error cases to watch for

- Timeout (client aborts after configured timeout)
- Network/connectivity errors
- Server returns 4xx/5xx

## Minimal testing snippet (browser console)

Paste into the browser console on the page with the prompt input (adjust selectors to match your app):

```javascript
(async function testGenerateOnce() {
  const ta =
    document.querySelector('[data-testid="prompt-textarea"]') ||
    document.querySelector("textarea");
  const btn =
    document.querySelector('[data-testid="generate-button"]') ||
    document.querySelector("button");
  if (!ta || !btn) {
    console.error("selectors did not match");
    return;
  }
  ta.value = "emergency test";
  btn.click();
  // observe network tab or UI changes for success
})();
```

## Rollback instructions (safer)

If a quick emergency change is not acceptable, revert to the previous branch/commit and redeploy the prior build.

```bash
# switch back to the stable docs/code branch
git fetch origin
git checkout main
git reset --hard origin/main

# OR if you committed to proto/aether-rst and want to remove that commit locally:
# (replace <commit-id> with the commit you want to return to)
git checkout proto/aether-rst
git reset --hard <last-working-commit>
```

Restore environment variables from a saved minimal config if needed:

```bash
cp config/minimal.env .env
# then rebuild / restart as your project requires
npm run build && npm run start
```

## Next steps (after docs)

1. If you approve, I can implement the tiny `generateOnly` wrapper and wire `PromptInput.svelte` to use it when `EMERGENCY_MODE=true` on branch `proto/aether-rst`. That change will be minimal and targeted; I will open a single commit with the code change and include a brief smoke script.

2. Optionally add a small banner in the UI to indicate EMERGENCY_MODE is active so operators don't mistake it for normal behavior.

Remember: these are operational/temporary measures to get the Generate button responsive; plan to revert EMERGENCY_MODE after the root cause is resolved.
