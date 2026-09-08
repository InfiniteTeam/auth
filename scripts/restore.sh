#!/usr/bin/env bash
# Restore PostgreSQL databases from backup
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <timestamp>"
  echo "Example: $0 20240101_120000"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP="$1"

set -a
source "$PROJECT_DIR/.env" 2>/dev/null || true
set +a

if [ ! -f "$BACKUP_DIR/kratos_${TIMESTAMP}.sql.gz" ]; then
  echo "ERROR: Backup file not found: kratos_${TIMESTAMP}.sql.gz"
  exit 1
fi

read -p "This will overwrite current databases. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 0
fi

echo "==> Stopping services..."
docker compose -f "$PROJECT_DIR/compose.yaml" stop kratos hydra portal

echo "==> Restoring Kratos database..."
gunzip -c "$BACKUP_DIR/kratos_${TIMESTAMP}.sql.gz" | docker compose -f "$PROJECT_DIR/compose.yaml" exec -T postgres \
  psql -U kratos kratos

echo "==> Restoring Hydra database..."
gunzip -c "$BACKUP_DIR/hydra_${TIMESTAMP}.sql.gz" | docker compose -f "$PROJECT_DIR/compose.yaml" exec -T postgres \
  psql -U kratos hydra

echo "==> Starting services..."
docker compose -f "$PROJECT_DIR/compose.yaml" start kratos hydra portal

echo "==> Restore complete."
