---
title: API Payload Implementation (frontend + backend)
date: 2025-11-09
status: active
---

## Purpose

Prescribe the exact, minimal implementation steps to switch the system to the canonical prompt payload. This document intentionally omits any legacy shims — the server will enforce the new contract.

## Canonical payload

POST /prompt

Request JSON:

```json
{
  "mode": "basic" | "demo" | "ebook",
  "prompt": "...",
  "metadata": { "title"?: "...", "author"?: "...", "pages"?: 123 },
  "options"?: { /* future flags */ }
}
```

## Frontend changes (exact files & example)

- File: `client/src/lib/api.js`
- Replace existing `submitPrompt` behaviour so it:
  1. Reads `promptStore` and `modeStore` (Svelte stores).
  2. Assembles the canonical payload (mode, prompt, metadata, options).
  3. POSTs JSON to `/prompt` and returns/parses JSON response.

Example (drop-in function):

```javascript
import { get } from "svelte/store";
import { promptStore } from "../stores/promptStore.js";
import { modeStore } from "../stores/modeStore.js";

export async function submitPrompt() {
  const ps = get(promptStore);
  const ms = get(modeStore);

  const payload = {
    mode: ms.current || ps.mode || "basic",
    prompt: ps.prompt || "",
    metadata: ps.metadata || {},
    options: ps.options || {},
  };

  // client-side validation: demo requires title/author/pages
  if (payload.mode === "demo") {
    const md = payload.metadata || {};
    if (!md.title || !md.author || !md.pages) {
      throw new Error("Missing demo metadata: title, author, pages");
    }
  }

  const res = await fetch("/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || `HTTP ${res.status}`);
  }

  return res.json();
}
```

## Backend changes (exact files & example)

- File: `server/index.js` (or the existing prompt handler location)
- File: `server/genieService.js`

Requirements for `/prompt` handler:

1. Accept only the canonical payload. If `mode` or `prompt` missing => return 400 with JSON error.
2. Validate per-mode requirements server-side (demo: metadata.title, author, pages).
3. Call `genieService.process(payload)` and return its result as JSON.

Example handler (pseudocode to paste into `server/index.js`):

```javascript
app.post("/prompt", async (req, res) => {
  const body = req.body || {};
  if (!body.mode || typeof body.prompt !== "string") {
    return res.status(400).json({
      error: "INVALID_PAYLOAD",
      message: "payload must include mode and prompt",
    });
  }

  if (body.mode === "demo") {
    const md = body.metadata || {};
    if (!md.title || !md.author || !md.pages) {
      return res.status(400).json({
        error: "MISSING_METADATA",
        fields: ["title", "author", "pages"],
      });
    }
  }

  const result = await genieService.process(body);
  return res.json(result);
});
```

GenieService routing (replace or update `server/genieService.js`):

```javascript
import sampleService from "./sampleService.js";
import demoService from "./demoService.js"; // may be stub
import ebookService from "./ebookService.js"; // may be stub

// NOTE: sampleService is updated to accept the full payload (mode,prompt,metadata,options).
export async function process(payload) {
  switch (payload.mode) {
    case "demo":
      return demoService.handle(payload);
    case "ebook":
      return ebookService.handle(payload);
    case "basic":
    default:
      // sampleService now accepts the canonical payload
      return sampleService.handle(payload);
  }
}
```

Update `sampleService` signature

The existing `sampleService` currently operates on a prompt string. Update it to accept the canonical payload object and extract the prompt internally. This keeps routing uniform and future-proofs the code.

Example change (in `server/sampleService.js`):

```javascript
// Before: export async function handle(prompt) { ... }

export async function handle(payload) {
  // payload: { mode, prompt, metadata, options }
  const prompt = typeof payload === "string" ? payload : payload.prompt;
  // existing logic continues using `prompt` variable
  // if needed, use payload.metadata/options for enhanced flows
}
```

Notes: demoService and ebookService may be simple stubs that mirror sampleService return shape until implemented.

## Tests to add (exact targets)

- `server/__tests__/prompt.handler.test.mjs`: send canonical payloads for `basic` and `demo`; assert HTTP 200 and correct call into genieService (use sinon/jest spies or mock).
- `server/__tests__/genie.process.test.mjs`: call `genieService.process` with each mode and assert it calls the expected service handler.
- `client/__tests__/api.submitPrompt.test.js`: mock fetch; ensure submitPrompt sends assembled payload and rejects on missing demo metadata.

## Deployment order (strict)

1. Push frontend change to branch and run client unit tests. Do not enable demo/ebook in UI unless services exist.
2. Push backend changes (prompt handler + genieService). Run server unit tests.
3. Deploy backend, then frontend (backend must accept canonical payload before frontend sends it in production).

## Acceptance criteria

- Pressing Generate in `basic` mode results in `sampleService.handle` being invoked and a valid response rendered.
- Server rejects malformed requests (missing mode or prompt) with 400.
- Demo/ebook flows route to the correct services once those services are implemented.

## Notes

- No legacy mapping or gating is performed in this plan; clients and server move directly to the canonical contract.
- Keep client-side validation to prevent user errors before request reaches server.

Last updated: 2025-11-09
