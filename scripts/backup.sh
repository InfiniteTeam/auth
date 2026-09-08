#!/usr/bin/env bash
# Backup PostgreSQL databases
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

set -a
source "$PROJECT_DIR/.env" 2>/dev/null || true
set +a

mkdir -p "$BACKUP_DIR"

echo "==> Backing up Kratos database..."
docker compose -f "$PROJECT_DIR/compose.yaml" exec -T postgres \
  pg_dump -U kratos kratos | gzip > "$BACKUP_DIR/kratos_${TIMESTAMP}.sql.gz"

echo "==> Backing up Hydra database..."
docker compose -f "$PROJECT_DIR/compose.yaml" exec -T postgres \
  pg_dump -U kratos hydra | gzip > "$BACKUP_DIR/hydra_${TIMESTAMP}.sql.gz"

echo "==> Backup complete."
echo "    Files:"
ls -lh "$BACKUP_DIR"/*_${TIMESTAMP}.sql.gz
