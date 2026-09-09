#!/bin/sh
set -e

# ============================================================
# inft-auth backend entrypoint
#
# 1. Wait for PostgreSQL to accept connections.
# 2. Apply Prisma migrations (with retries, idempotent).
# 3. Start the Nest.js server.
# ============================================================

MAX_RETRIES="${DB_WAIT_RETRIES:-60}"
RETRY_DELAY_SEC="${DB_WAIT_DELAY_SEC:-2}"
MIGRATE_MAX_RETRIES="${MIGRATE_MAX_RETRIES:-10}"

log()  { echo "[entrypoint] $1"; }
error() { echo "[entrypoint][ERROR] $1" >&2; }

wait_for_db() {
  local retries="$MAX_RETRIES"
  # Redact credentials: DATABASE_URL may embed user:password@.
  local redacted
  redacted="$(node -e '
    try {
      const u = new URL(process.env.DATABASE_URL);
      console.log("db://" + (u.hostname ? u.hostname + ":" + (u.port || 5432) : "<unset>"));
    } catch { console.log("<invalid>"); }
  ' 2>/dev/null || echo "<invalid>")"
  log "Waiting for PostgreSQL at ${redacted} ..."
  # Busybox wget supports --spider; use it for HTTP-style checks is NOT
  # applicable here, so probe with a lightweight TCP check via node.
  until node -e '
      const u = new URL(process.env.DATABASE_URL);
      const net = require("net");
      const s = net.connect(Number(u.port || 5432), u.hostname);
      s.setTimeout(1000, () => { s.destroy(); const err = new Error("timeout"); console.error(err.message); process.exit(1); });
      s.on("connect", () => { console.log("db reachable"); process.exit(0); });
      s.on("error", (e) => { console.error(e.message); process.exit(1); });
    ' 2>/dev/null; do
    retries=$((retries - 1))
    if [ "$retries" -le 0 ]; then
      error "PostgreSQL did not become reachable in time."
      exit 1
    fi
    log "PostgreSQL not ready, retrying in ${RETRY_DELAY_SEC}s ... (${retries} left)"
    sleep "$RETRY_DELAY_SEC"
  done
}

apply_migrations() {
  local attempt=1
  cd /app/apps/backend
  log "Applying Prisma migrations (attempt ${attempt}/${MIGRATE_MAX_RETRIES})..."
  while ! npx --no-install prisma migrate deploy; do
    attempt=$((attempt + 1))
    if [ "$attempt" -gt "$MIGRATE_MAX_RETRIES" ]; then
      error "Prisma migrate failed after ${MIGRATE_MAX_RETRIES} retries."
      exit 1
    fi
    log "Migration failed, retrying in ${RETRY_DELAY_SEC}s ... (attempt ${attempt}/${MIGRATE_MAX_RETRIES})"
    sleep "$RETRY_DELAY_SEC"
  done
  cd /app
}

wait_for_db
apply_migrations

log "Starting Nest.js server..."
exec node apps/backend/dist/main.js
