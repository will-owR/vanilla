# CORE_FLOW_SPEC — Essential Flow Implementation

[THU 18th Sep 2025 @ 10:35AM]

**IMPORTANT: All implementation described in this document should be done in the new branch `aetherV0/min_client_flow` branch.**

Reference: [MIN_CLIENT_SPEC.md](MIN_CLIENT_SPEC.md)

## Sample Demo Scope

```
+------------------+     (1) POST /prompt      +------------------+
|     Frontend     |----------------------->   |     Backend      |
|                  |    {"prompt": "..."}     |                  |
| +--------------+ |                          |                  |
| |Input Prompt  | |                          |    (2) Write    |
| |              | |                          |       |          |
| +--------------+ |                          |       v          |
|                  |                          | latest_prompt.txt|
| +--------------+ |    (4) Display           |                  |
| |Preview Pane  | |    <---------------     |    (3) Return    |
| |              | |    Tripled content      |    3x Content    |
| +--------------+ |                          |                  |
+------------------+                          +------------------+

Demo Interaction:
1. User types: "Hello"
2. Backend saves: "Hello" to latest_prompt.txt
3. Backend returns: "Hello\nHello\nHello"
4. Preview shows three "Hello" lines
```

## Core Flow

1. Frontend sends user's prompt to backend via `POST /prompt` with `{ "prompt": "..." }`.
2. Backend stores the prompt in the repository `./samples/latest_prompt.txt` (use a repo-root-relative path).
3. Backend responds with JSON: `{ "content": "<tripled-text>" }` (plain text with newline separators).
4. Frontend parses the JSON, sets the `previewStore` to `content`, and the preview component renders it into the element with `data-testid="preview-content"`.

Client UI behavior

- The Generate button must be disabled while the request is in-flight and a minimal loading indicator shown.
- On success, update the preview and re-enable the Generate button.
- On error (non-2xx), display a brief error message and re-enable the Generate button; do not clear the existing preview content.

## Required Files

### Frontend

- `client/src/stores/index.js`:

  ```js
  export const promptStore = writable(""); // User's input prompt
  export const previewStore = writable(""); // Content to display
  ```

- `client/src/lib/api.js`:

  ```js
  export const submitPrompt = async (prompt) => {
    const response = await fetch("/prompt", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
    return await response.text();
  };
  ```

- `client/src/components/PreviewWindow.svelte`:
  ```svelte
  <div data-testid="preview-content">
    {$previewStore}
  </div>
  ```

### Backend

- Endpoint: `POST /prompt`
  - Input: `{ "prompt": string }`
  - Actions:
    1. Write prompt to `./samples/latest_prompt.txt`
    2. Return prompt content repeated 3 times
  - Response: Text content

## Verification

1. Enter prompt
2. Click generate
3. Verify:
   - `latest_prompt.txt` contains prompt
   - Preview shows tripled content

## Implementation notes and examples

1. Example cURL (request + expected response)

```bash
curl -s -X POST http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt":"hello"}'

# Expected JSON response
#{ "content": "hello\nhello\nhello" }
```

2. Error envelope example

On failure the server should return a non-2xx response with JSON:

```json
{ "error": "<short message>" }
```

Client behavior should show the `error` message in the UI and re-enable controls.

3. Repo-root samples path snippet (Node.js example)

```js
// server-side example
import fs from "fs/promises";
import path from "path";

const samplesPath = path.join(__dirname, "..", "samples", "latest_prompt.txt");
await fs.writeFile(samplesPath, promptText, "utf8");
```

4. Devcontainer note

Ensure `./samples/` exists and is writeable in the devcontainer. Example (from repo root):

```bash
mkdir -p samples && chmod a+rw samples
```

5. PM verification checklist (manual steps)

- Start dev servers (client + server) via devcontainer or local commands
- Use the cURL example above and confirm: response shape, content, and `samples/latest_prompt.txt` content
- In the UI: enter a prompt, click Generate, confirm preview shows tripled text and controls behave as specified
