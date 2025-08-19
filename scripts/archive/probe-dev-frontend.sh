#!/usr/bin/env bash
set -euo pipefail
# Probe the running dev environment: waits for backend health and frontend root, then POSTs proxied /prompt
BACKEND_HEALTH_URL="http://localhost:3000/health"
FRONTEND_ROOT_URL="http://localhost:5173/"
PROXIED_PROMPT_URL="http://localhost:5173/prompt"

echo "Waiting for backend health..."
for i in {1..60}; do
  if curl -sSf "$BACKEND_HEALTH_URL" | grep -q '"status": "ok"'; then
    echo "backend ready"
    break
  fi
  sleep 1
done

echo "Waiting for frontend root..."
for i in {1..30}; do
  if curl -sSf "$FRONTEND_ROOT_URL" >/dev/null 2>&1; then
    echo "frontend ready"
    break
  fi
  sleep 1
done

echo "Posting to proxied /prompt"
curl -i -s -X POST "$PROXIED_PROMPT_URL" -H "Content-Type: application/json" -d '{"prompt":"automated probe from script"}' -D /tmp/probe-headers.txt -o /tmp/probe-body.txt || true

echo "--- Response headers ---"
sed -n '1,200p' /tmp/probe-headers.txt || true

echo "--- Response body ---"
sed -n '1,200p' /tmp/probe-body.txt || true

echo "Done"
