#!/usr/bin/env bash
set -euo pipefail

# Devolve smoke script: ensure server responds when Puppeteer is skipped.
# Usage: SKIP_PUPPETEER=1 USE_REAL_AI=false ./devolve-01-smoke.sh

BASE_URL=${BASE_URL:-http://localhost:3000}

# Post a small prompt
echo "POSTing /prompt to $BASE_URL"
CONTENT='{"prompt":"Smoke Test from script"}'

# Send prompt to normal /prompt endpoint so the demo service writes samples/latest_prompt.txt
echo "POSTing /prompt to $BASE_URL"
RES=$(curl -sS -X POST "$BASE_URL/prompt" -H 'Content-Type: application/json' -d "$CONTENT" || true)
echo "Response: $RES"

# Try to extract promptId from the JSON response so we can fetch preview by promptId
PROMPT_ID=$(echo "$RES" | sed -n 's/.*"promptId"\s*:\s*\([0-9]*\).*/\1/p' || true)
if [ -n "$PROMPT_ID" ]; then
  echo "Found promptId=$PROMPT_ID; will GET /preview?promptId=$PROMPT_ID"
  PREVIEW_HTML=$(curl -sS "$BASE_URL/preview?promptId=$PROMPT_ID" --max-time 10 || true)
else
  # Fallback: attempt to use the preview endpoint with the latest saved samples file
  echo "No promptId returned; falling back to GET /preview via content param"
  PREVIEW_HTML=$(curl -sS -G "$BASE_URL/preview" --data-urlencode "content=${CONTENT}" --max-time 10 || true)
fi

# Wait a short bit for server to write samples/latest_prompt.txt
sleep 1

SAMPLES_PATH="$(cd "$(dirname "$0")/../.." && pwd)/samples/latest_prompt.txt"
if [ ! -f "$SAMPLES_PATH" ]; then
  echo "samples/latest_prompt.txt not found at $SAMPLES_PATH" >&2
  exit 2
fi

if ! grep -q "Smoke Test" "$SAMPLES_PATH"; then
  echo "samples/latest_prompt.txt missing expected text" >&2
  echo "Contents:"; cat "$SAMPLES_PATH"
  exit 3
fi

echo "samples/latest_prompt.txt contains Smoke Test"

# Try preview endpoint via GET with content param
PREVIEW_HTML=$(curl -sS -G "$BASE_URL/preview" --data-urlencode "content=${CONTENT}" --max-time 10 || true)
if [[ "$PREVIEW_HTML" == \{* ]]; then
  # Service returned JSON (likely a validation error). Try the /genie HTML endpoint
  echo "Preview returned JSON; falling back to /genie which reads samples/latest_prompt.txt"
  PREVIEW_HTML=$(curl -sS "$BASE_URL/genie" --max-time 10 || true)
fi

if [[ "$PREVIEW_HTML" != *"Smoke Test"* ]]; then
  echo "preview HTML did not contain expected text" >&2
  echo "$PREVIEW_HTML" > /tmp/preview-debug.html
  echo "Saved preview to /tmp/preview-debug.html"
  exit 4
fi

echo "Preview contains Smoke Test. DEVO-01 smoke: PASS"
