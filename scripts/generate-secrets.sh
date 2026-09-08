#!/usr/bin/env bash
# Generate all required secrets and create .env from .env.example
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_DIR/.env" ]; then
  echo "ERROR: .env already exists. Remove it first or edit manually."
  exit 1
fi

generate_secret() {
  openssl rand -base64 32 | tr -d '\n' | head -c 32
}

echo "==> Generating secrets..."

POSTGRES_PASSWORD=$(generate_secret)
KRATOS_COOKIE_SECRET=$(generate_secret)
KRATOS_CIPHER_SECRET=$(generate_secret)
HYDRA_SYSTEM_SECRET=$(generate_secret)
PORTAL_COOKIE_SECRET=$(generate_secret)

cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"

sed -i "s|<REPLACE_WITH_32_CHAR_RANDOM>|${POSTGRES_PASSWORD}|1" "$PROJECT_DIR/.env"
sed -i "s|<REPLACE_WITH_32_CHAR_RANDOM>|${KRATOS_COOKIE_SECRET}|1" "$PROJECT_DIR/.env"
sed -i "s|<REPLACE_WITH_32_CHAR_RANDOM>|${KRATOS_CIPHER_SECRET}|1" "$PROJECT_DIR/.env"
sed -i "s|<REPLACE_WITH_32_CHAR_RANDOM>|${HYDRA_SYSTEM_SECRET}|1" "$PROJECT_DIR/.env"
sed -i "s|<REPLACE_WITH_32_CHAR_RANDOM>|${PORTAL_COOKIE_SECRET}|1" "$PROJECT_DIR/.env"

echo "==> .env created. Now fill in the following manually:"
echo "    - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET"
echo "    - DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET / DISCORD_BOT_TOKEN / DISCORD_GUILD_ID"
echo "    - SMTP_CONNECTION_URI"
echo ""
echo "    Edit: $PROJECT_DIR/.env"
