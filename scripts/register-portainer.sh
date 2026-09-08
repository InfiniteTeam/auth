#!/usr/bin/env bash
# Register Portainer as an OIDC client in Hydra
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

set -a
source "$PROJECT_DIR/.env" 2>/dev/null || true
set +a

PORTAINER_CLIENT_ID="${PORTAINER_CLIENT_ID:-portainer}"
PORTAINER_CLIENT_SECRET="${PORTAINER_CLIENT_SECRET:-$(openssl rand -base64 32 | tr -d '\n' | head -c 32)}"
PORTAINER_REDIRECT_URI="${PORTAINER_REDIRECT_URI:-http://localhost:9443/auth/callback}"

echo "==> Registering Portainer OIDC client..."

docker compose -f "$PROJECT_DIR/compose.yaml" exec -T hydra \
  hydra create client \
    --endpoint http://127.0.0.1:4445 \
    --grant-type authorization_code,refresh_token \
    --response-type code,id_token \
    --scope openid,offline,offline_access,email,profile \
    --callback-uri "$PORTAINER_REDIRECT_URI" \
    --token-endpoint-auth-method client_secret_post \
    --name "Portainer" \
    --id "$PORTAINER_CLIENT_ID" \
    --secret "$PORTAINER_CLIENT_SECRET" \
    --format json

echo ""
echo "==> Portainer OIDC Client registered."
echo "    Client ID:     $PORTAINER_CLIENT_ID"
echo "    Client Secret: $PORTAINER_CLIENT_SECRET"
echo "    Redirect URI:  $PORTAINER_REDIRECT_URI"
echo "    Issuer:        https://auth.inft.kr"
echo "    Auth URL:      https://auth.inft.kr/oauth2/auth"
echo "    Token URL:     https://auth.inft.kr/oauth2/token"
echo "    API URL:       https://auth.inft.kr/oauth2/userinfo"
echo ""
echo "    Portainer UI > Settings > Authentication > OAuth 에서"
echo "    위 값을 입력하세요."
echo "    SAVE THE CLIENT SECRET ABOVE. IT WILL NOT BE SHOWN AGAIN."
