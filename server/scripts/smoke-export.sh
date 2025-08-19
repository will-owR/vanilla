#!/usr/bin/env bash
# Smoke test: request multi-poem export and save to /tmp/ebook.pdf
set -euo pipefail

HOST=${HOST:-http://localhost:3000}
#OUT=${OUT:-/tmp/ebook.pdf}
OUT=${OUT:-/workspaces/vanilla/samples/ebook.pdf}
JSON_FILE="$(pwd)/server/samples/poems.json"

if [ ! -f "$JSON_FILE" ]; then
  echo "Missing sample JSON: $JSON_FILE"
  exit 1
fi

echo "Waiting 2s for server to settle..."
sleep 2

echo "Requesting export from $HOST/api/export/book"
RESP_CODE=$(curl -s -w "%{http_code}" -o "$OUT" -X POST "$HOST/api/export/book" -H "Content-Type: application/json" --data @"$JSON_FILE")

if [ "$RESP_CODE" = "200" ] || [ "$RESP_CODE" = "201" ]; then
  echo "Export saved to $OUT"
  ls -lh "$OUT" || true
  file "$OUT" || true
  exit 0
fi

echo "Export failed with HTTP $RESP_CODE"
exit 2
