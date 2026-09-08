#!/usr/bin/env bash
# Run Kratos and Hydra database migrations.
# Uses one-shot containers so it works even if the services are crash-looping.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

cd "$PROJECT_DIR"

echo "==> Ensuring postgres is up..."
docker compose up -d postgres
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U kratos -d kratos >/dev/null 2>&1; then
    break
  fi
  sleep 2
  [ "$i" -eq 30 ] && { echo "ERROR: postgres did not become ready." >&2; exit 1; }
done

echo "==> Running Kratos migrations..."
docker compose run --rm --no-deps -T kratos \
  kratos migrate sql -e /etc/config/kratos/kratos.yml --yes

echo "==> Running Hydra migrations..."
docker compose run --rm --no-deps -T hydra \
  hydra migrate sql -e /etc/config/hydra/hydra.yml --yes

echo "==> Migrations complete."