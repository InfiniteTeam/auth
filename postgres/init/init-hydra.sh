#!/bin/bash
set -e

# Create the dedicated Ory Hydra user and database.
# postgres base image already created POSTGRES_USER/POSTGRES_DB (kratos).
# Executed once on first volume initialization only.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE USER hydra WITH PASSWORD '${POSTGRES_PASSWORD}';
    CREATE DATABASE hydra OWNER hydra;
EOSQL
