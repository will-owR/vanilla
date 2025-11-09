#!/usr/bin/env bash
# server/scripts/seed-dev.sh
# Safe wrapper to run the Node seeder. Dry-run by default. Requires explicit approval to write.
# Usage:
#   ./server/scripts/seed-dev.sh            # runs dry-run
#   ./server/scripts/seed-dev.sh --apply    # runs with apply (no interactive prompt)
#   SEED_DEV=true ./server/scripts/seed-dev.sh   # environment override

set -euo pipefail

SEED_SCRIPT="server/scripts/seed-dev.js"
APPLY_FLAG="--apply"
BACKUP_BEFORE_APPLY=true

# parse args
FORCE_APPLY=false
SKIP_BACKUP=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) FORCE_APPLY=true; shift;;
    --no-backup) SKIP_BACKUP=true; shift;;
    --yes|-y) FORCE_APPLY=true; shift;;
    --help) echo "Usage: $0 [--apply] [--no-backup]"; exit 0;;
    *) shift;;
  esac
done

# If SEED_DEV env is explicitly set to true, treat as apply
if [[ "${SEED_DEV:-}" == "true" ]]; then
  FORCE_APPLY=true
fi

# Safety: don't run against production-like DB or production node env
if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Refusing to run seed in NODE_ENV=production"
  exit 2
fi

# If DATABASE_URL not set, try to read from .env at repo root if present (optional)
if [[ -z "${DATABASE_URL:-}" && -f ".env" ]]; then
  # attempt to source .env (simple parsing)
  export $(grep -v '^#' .env | xargs) || true
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Warning: DATABASE_URL is not set. Prisma will try its default lookup."
else
  # simple production-host heuristic: fail if host contains "prod" or domain looks external
  host=$(echo "$DATABASE_URL" | sed -E 's/^.*@([^/:]+).*$/\1/' || true)
  if [[ "${host:-}" =~ prod ]] || [[ "${host:-}" =~ amazonaws ]] || [[ "${host:-}" =~ \.db\..* ]]; then
    echo "Refusing to run seed: DATABASE_URL host looks like production (${host})"
    exit 3
  fi
fi

echo "Seed script wrapper"
echo "  Seed script: ${SEED_SCRIPT}"
echo "  Apply mode: ${FORCE_APPLY}"
echo "  Database host: ${host:-<not-detected>}"

if [[ "${FORCE_APPLY}" != "true" ]]; then
  echo
  echo "DRY-RUN (no writes). To apply, re-run with --apply or set SEED_DEV=true."
  echo "Running Node seeder in dry-run mode..."
  node "${SEED_SCRIPT}" || { echo "Node seeder failed (dry-run)"; exit 4; }
  echo
  echo "Dry-run complete. Rerun with --apply to persist changes."
  exit 0
fi

# If we reach here, user wants to apply
if [[ "${SKIP_BACKUP}" == "false" && "${BACKUP_BEFORE_APPLY}" == "true" ]]; then
  if command -v pg_dump >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
  ts=$(date -u +"%Y%m%dT%H%M%SZ")
  BACKUP_DIR="shared/tmp"
  BACKUP_FILE="${BACKUP_DIR}/seed-backup-${ts}.sql"
  mkdir -p "${BACKUP_DIR}"
    echo "Creating a pg_dump backup to ${BACKUP_FILE}..."
    pg_dump "$DATABASE_URL" -f "${BACKUP_FILE}" || { echo "pg_dump failed, aborting"; exit 5; }
    echo "Backup complete."
  else
    echo "pg_dump not available or DATABASE_URL missing; skipping backup."
  fi
fi

echo "Applying seed (this will write to DB)..."
node "${SEED_SCRIPT}" ${APPLY_FLAG} || { echo "Seeder failed during apply"; exit 6; }

echo "Seed apply complete."
exit 0
