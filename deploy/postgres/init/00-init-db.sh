#!/bin/bash
set -e

# ============================================
# PostgreSQL initialization script
# Creates the `auth` DB (backend) and the
# `lldap` DB (lldap identity).
# ============================================

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- auth DB user and database creation
    CREATE USER ${AUTH_DB_USER:-auth} WITH PASSWORD '${AUTH_DB_PASSWORD:-auth}';
    CREATE DATABASE ${AUTH_DB_NAME:-auth} OWNER ${AUTH_DB_USER:-auth};
    GRANT ALL PRIVILEGES ON DATABASE ${AUTH_DB_NAME:-auth} TO ${AUTH_DB_USER:-auth};

    -- lldap DB user and database creation
    CREATE USER ${LLDAP_DB_USER:-lldap} WITH PASSWORD '${LLDAP_DB_PASSWORD:-lldap}';
    CREATE DATABASE ${LLDAP_DB_NAME:-lldap} OWNER ${LLDAP_DB_USER:-lldap};
    GRANT ALL PRIVILEGES ON DATABASE ${LLDAP_DB_NAME:-lldap} TO ${LLDAP_DB_USER:-lldap};
EOSQL

echo "[init-db] databases created: ${AUTH_DB_NAME:-auth}, ${LLDAP_DB_NAME:-lldap}"
