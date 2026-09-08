#!/usr/bin/env bash
# Start the full stack: bring up postgres, run DB migrations (unless skipped),
# then start all services.
# With --staging, compose.staging.yaml is layered on top of compose.yaml.
#
# Usage:
#   ./scripts/start.sh                  # start + run migrations
#   ./scripts/start.sh --skip-migrate   # start only, skip migrations
#   ./scripts/start.sh --staging        # start staging stack + migrations
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

SKIP_MIGRATE=0
STAGING=0
for arg in "$@"; do
  case "$arg" in
    --skip-migrate)
      SKIP_MIGRATE=1
      ;;
    --staging)
      STAGING=1
      ;;
    *)
      echo "ERROR: unknown option: $arg" >&2
      echo "Usage: $0 [--skip-migrate] [--staging]" >&2
      exit 1
      ;;
  esac
done

COMPOSE_FILES=(-f "$PROJECT_DIR/compose.yaml")
if [ "$STAGING" -eq 1 ]; then
  COMPOSE_FILES+=(-f "$PROJECT_DIR/compose.staging.yaml")
fi

compose() {
  docker compose "${COMPOSE_FILES[@]}" "$@"
}

if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

cd "$PROJECT_DIR"

echo "==> Starting postgres..."
compose up -d postgres

echo "==> Waiting for postgres to be ready..."
for i in $(seq 1 30); do
  if compose exec -T postgres pg_isready -U kratos -d kratos >/dev/null 2>&1; then
    break
  fi
  sleep 2
  [ "$i" -eq 30 ] && { echo "ERROR: postgres did not become ready." >&2; exit 1; }
done
echo "    postgres ready."

if [ "$SKIP_MIGRATE" -eq 1 ]; then
  echo "==> Skipping migrations (--skip-migrate)."
else
  echo "==> Running Kratos migrations..."
  compose run --rm --no-deps -T kratos \
    -c /etc/config/kratos/kratos.yml migrate sql -e --yes

  echo "==> Running Hydra migrations..."
  compose run --rm --no-deps -T hydra \
    -c /etc/config/hydra/hydra.yml migrate sql -e --yes

  echo "==> Migrations complete."
fi

echo "==> Starting full stack..."
compose up -d --build

echo "==> Done. Check status with: docker compose ps"