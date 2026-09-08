#!/usr/bin/env bash
# Run Kratos and Hydra database migrations
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

set -a
source "$PROJECT_DIR/.env"
set +a

echo "==> Running Kratos migrations..."
docker compose -f "$PROJECT_DIR/compose.yaml" exec -T kratos \
  kratos migrate sql -e /etc/config/kratos/kratos.yml --yes

echo "==> Running Hydra migrations..."
docker compose -f "$PROJECT_DIR/compose.yaml" exec -T hydra \
  hydra migrate sql -e /etc/config/hydra/hydra.yml --yes

echo "==> Migrations complete."
