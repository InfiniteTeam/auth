#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Grant platform admin to a user by adding them to the admin group.
#
# Platform permissions come from lldap group membership: members of
# $ADMIN_GROUP_NAME receive every permission on their next login
# (permissions are snapshotted into the session at creation, so the
# user must sign out and back in afterwards).
#
# On this platform the lldap uid IS the email address, so:
#
#   ./grant-admin.sh filename@inft.kr
#
# Environment (flags override env/.env):
#   LLDAP_URL            lldap HTTP base URL (default: http://localhost:17170)
#   LLDAP_ADMIN_DN       service-account username (default from .env)
#   LLDAP_ADMIN_PASSWORD service-account password (default from .env)
#   ADMIN_GROUP_NAME     platform admin group (default: admins)
#
# Requires: curl, python3.
#
# NOTE: lldap's HTTP port is not published by docker-compose, so run this
# from a host that can reach it (e.g. with an SSH tunnel forwarding 17170),
# or override LLDAP_URL accordingly.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

fail() { printf "${RED}  ✗${NC} %s\n" "$1" >&2; exit 1; }
ok()   { printf "${GREEN}  ✓${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}  !${NC} %s\n" "$1"; }

usage() {
  cat >&2 <<'EOF'
Usage: ./grant-admin.sh [options] <user-email>

Options:
  --url URL        lldap HTTP base URL
  --group NAME     platform admin group (default: admins)
  --revoke         remove admin instead of granting
  -h, --help       show this help
EOF
  exit "${1:-0}"
}

REVOKE=0
URL=""
GROUP=""
EMAIL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --group) GROUP="$2"; shift 2 ;;
    --revoke) REVOKE=1; shift ;;
    -h|--help) usage 0 ;;
    -*) fail "Unknown option: $1" ;;
    *) EMAIL="$1"; shift ;;
  esac
done

[ -n "$EMAIL" ] || { usage 1; }

# Load deploy/.env defaults (same directory) without executing arbitrary code.
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi

LLDAP_URL="${URL:-${LLDAP_URL:-http://localhost:17170}}"
ADMIN_GROUP="${GROUP:-${ADMIN_GROUP_NAME:-admins}}"
ADMIN_DN="${LLDAP_ADMIN_DN:-${LLDAP_ADMIN_USERNAME:-admin}}"
ADMIN_PW="${LLDAP_ADMIN_PASSWORD:-}"

[ -n "$ADMIN_PW" ] || fail "LLDAP_ADMIN_PASSWORD is not set (env or deploy/.env)."
command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v python3 >/dev/null 2>&1 || fail "python3 is required."

export LLDAP_URL ADMIN_GROUP ADMIN_DN ADMIN_PW EMAIL REVOKE

python3 - <<'EOF'
import json
import os
import sys
import urllib.request

BASE = os.environ["LLDAP_URL"].rstrip("/")
GROUP = os.environ["ADMIN_GROUP"]
EMAIL = os.environ["EMAIL"]
REVOKE = os.environ["REVOKE"] == "1"


def fail(msg):
    print(f"  \u2717 {msg}", file=sys.stderr)
    sys.exit(1)


def ok(msg):
    print(f"  \u2713 {msg}")


def warn(msg):
    print(f"  ! {msg}")


def post(path, payload, token=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        fail(f"HTTP request to {path} failed: {e}")


def gql(token, query, variables=None):
    body = post("/api/graphql", {"query": query, "variables": variables or {}}, token)
    if body.get("errors"):
        fail(f"GraphQL error: {body['errors'][0].get('message', body['errors'][0])}")
    return body["data"]


print(f'Logging in to lldap as "{os.environ["ADMIN_DN"]}" ...')
login = post(
    "/auth/simple/login",
    {"username": os.environ["ADMIN_DN"], "password": os.environ["ADMIN_PW"]},
)
token = login.get("token")
if not token:
    fail("Login failed (check LLDAP_URL and admin credentials).")
ok("Authenticated.")

print(f'Resolving group "{GROUP}" ...')
groups = gql(token, "query { groups { id displayName } }")["groups"]
match = next((g for g in groups if g["displayName"] == GROUP), None)
if not match:
    print(f'Group "{GROUP}" does not exist yet, creating it ...')
    created = gql(
        token,
        "mutation($name: String!) { createGroup(name: $name) { id displayName } }",
        {"name": GROUP},
    )["createGroup"]
    match = {"id": created["id"], "displayName": created["displayName"]}
group_id = match["id"]
ok(f"Group id: {group_id}")

print(f'Checking user "{EMAIL}" ...')
users = gql(token, "query { users { id } }")["users"]
if not any(u["id"] == EMAIL for u in users):
    fail(f'User "{EMAIL}" does not exist in lldap (sign up / create the user first).')
ok("User exists.")

members = gql(
    token,
    "query($id: Int!) { group(groupId: $id) { users { id } } }",
    {"id": group_id},
)["group"]["users"]
member_ids = [m["id"] for m in members]
is_member = EMAIL in member_ids

if REVOKE:
    if not is_member:
        fail(f'"{EMAIL}" is not an admin.')
    if len(member_ids) <= 1:
        fail("Refusing to remove the last platform admin.")
    gql(
        token,
        "mutation($u: String!, $g: Int!) { removeUserFromGroup(userId: $u, groupId: $g) { ok } }",
        {"u": EMAIL, "g": group_id},
    )
    ok(f'Admin revoked for "{EMAIL}". Existing sessions keep old permissions until re-login.')
else:
    if is_member:
        warn(f'"{EMAIL}" is already an admin. Nothing to do.')
        sys.exit(0)
    gql(
        token,
        "mutation($u: String!, $g: Int!) { addUserToGroup(userId: $u, groupId: $g) { ok } }",
        {"u": EMAIL, "g": group_id},
    )
    ok(f'Admin granted to "{EMAIL}".')
    print("The user must sign out and back in for the new permissions to take effect.")
EOF
