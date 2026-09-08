#!/usr/bin/env bash
# Health check for all services
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

set -a
source "$PROJECT_DIR/.env" 2>/dev/null || true
set +a

echo "==> Checking service health..."

check() {
  local name="$1"
  local url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "  [OK]   $name (HTTP $code)"
  else
    echo "  [FAIL] $name (HTTP $code)"
  fi
}

check "Portal" "http://localhost:3000/health"

check "Kratos" "http://localhost:4434/health/ready" 2>/dev/null || echo "  [SKIP] Kratos (admin not exposed)"

check "Hydra" "http://localhost:4445/health/ready" 2>/dev/null || echo "  [SKIP] Hydra (admin not exposed)"

echo ""
echo "==> Checking external endpoints..."
check "id.inft.kr" "https://id.inft.kr/health"
check "auth.inft.kr" "https://auth.inft.kr/.well-known/openid-configuration"

echo "==> Done."
