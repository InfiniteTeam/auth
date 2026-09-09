# inft-auth deployment package

Self-hostable deployment package for the inft-auth identity platform.
It provides OAuth 2.0 / OpenID Connect, LDAP (user), WebFinger and social login.

## Services

| Service | Image | Role |
|---------|-------|------|
| `postgres` | postgres:17-alpine | Single database (auth + lldap schemas) |
| `lldap` | lldap/lldap | User identity management (LDAP) |
| `backend` | local build | Nest.js OIDC/OAuth2 server, API, WebFinger |
| `www` | local build | Next.js frontend portal |
| `cloudflared` | cloudflare/cloudflared | Cloudflare Tunnel (optional) |

## Requirements

- **Docker Engine** 24+ and **Docker Compose** v2
  - https://docs.docker.com/get-docker/
- Two domains (auth domain + root domain)
  - `auth.example.com` — OIDC issuer, frontend, API
  - `example.com` — WebFinger (`/.well-known/webfinger`)

## Quick start (interactive setup)

```bash
cd deploy
./setup.sh
docker compose logs -f
```

Follow the prompts for domain, admin password and Cloudflare Tunnel.
A `.env` file is generated and `docker compose up -d --build` is run.

## Manual install

```bash
cd deploy
cp .env.example .env
# Fill in the .env values, especially passwords and secrets
docker compose up -d --build
```

## Environment variables

Managed in `deploy/.env`. See [.env.example](./.env.example) for details.

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTH_DOMAIN` | Auth server domain (OIDC issuer) | `auth.example.com` |
| `ROOT_DOMAIN` | WebFinger domain | `example.com` |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password | - |
| `AUTH_DB_PASSWORD` | auth DB password | - |
| `LLDAP_DB_PASSWORD` | lldap DB password | - |
| `LLDAP_ADMIN_PASSWORD` | lldap admin password | - |
| `LLDAP_ADMIN_EMAIL` | lldap admin email (set on bootstrap; backend login resolves users by email) | `admin@example.com` |
| `SESSION_SECRET` | Session/cookie signing secret | - |
| `TAILSCALE_CLIENT_SECRET` | Tailscale OIDC client secret | - |
| `TUNNEL_TOKEN` | Cloudflare Tunnel token (optional) | - |

## Domain routing

```
auth.example.com
├── /oauth2/*, /.well-known/*, /api/*  → backend :3000
├── /*                                 → www     :3001
example.com
└── /.well-known/webfinger             → backend :3000
```

When using `cloudflared`, the ingress map is defined locally in
`cloudflared/config.yml` (locally-managed mode). The tunnel token
(`TUNNEL_TOKEN`) is not needed at runtime — cloudflared reads the tunnel
credentials from `cloudflared/credentials.json`, which is derived from the
token at setup time.

## Cloudflare Tunnel setup (optional)

It works without `cloudflared`, but configure a tunnel to expose the domains.

### 1. Create the tunnel

In the [Cloudflare dashboard](https://dash.cloudflare.com/), go to
**Networking → Tunnels → Create a tunnel**, pick a name, and note the
generated tunnel **ID** (UUID).

### 2. Get the tunnel token

The token (`eyJ...`) can be obtained one of these ways:

- **Dashboard** — open the tunnel, click **Add a replica** on the Overview
  tab, copy the install command and extract the `eyJ...` value.
- **API** — `GET /accounts/{ACCOUNT_ID}/cfd_tunnel/{TUNNEL_ID}/token`
  (requires a Cloudflare API token with `Cloudflare Tunnel` edit permission).
- **Creation response** — the API response of the Create tunnel call
  includes both `id` and `token`.

### 3. Configure routing

Routing is defined in `cloudflared/config.yml.example` (template, tracked in
git). `setup.sh` generates the runtime `cloudflared/config.yml` from it by
replacing `__TUNNEL_ID__`, `__AUTH_DOMAIN__` and `__ROOT_DOMAIN__` (both
`config.yml` and `credentials.json` are gitignored). Order matters —
cloudflared uses the first matching rule:

```yaml
ingress:
  - hostname: auth.example.com
    path: /oauth2*
    service: http://backend:3000
  - hostname: auth.example.com
    path: /.well-known*
    service: http://backend:3000
  - hostname: auth.example.com
    path: /api*
    service: http://backend:3000
  - hostname: example.com
    path: /.well-known/webfinger
    service: http://backend:3000
  - hostname: auth.example.com
    service: http://www:3001
  - service: http_status:404
```

### 4. Configure DNS (dashboard)

Create two proxied CNAME records pointing at the tunnel:

```
auth.example.com  CNAME  <tunnel-id>.cfargotunnel.com
example.com       CNAME  <tunnel-id>.cfargotunnel.com
```

### 5. Generate credentials & config

`setup.sh` derives both runtime files from `.env` values:

- `cloudflared/credentials.json` — decoded from `TUNNEL_TOKEN`. The token is
  `.`-less base64 JSON: `{"a":<account tag>,"t":<tunnel id>,"s":<secret>}`.
- `cloudflared/config.yml` — rendered from `config.yml.example`.

To regenerate just these files from an existing `.env` without re-running the
whole setup, run:

```bash
cd deploy
python3 - <<'EOF'
import base64, json, os, re
env = {}
for line in open('.env'):
    m = re.match(r'^(\w+)=(.*)$', line.strip())
    if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
data = json.loads(base64.urlsafe_b64decode(env['TUNNEL_TOKEN']))
open('cloudflared/credentials.json', 'w').write(json.dumps({
    "AccountTag": data["a"], "TunnelSecret": data["s"], "TunnelID": data["t"],
}, indent=2))
conf = open('cloudflared/config.yml.example').read()
for k, v in {'__TUNNEL_ID__': data["t"], '__AUTH_DOMAIN__': env['AUTH_DOMAIN'],
             '__ROOT_DOMAIN__': env['ROOT_DOMAIN']}.items():
    conf = conf.replace(k, v)
open('cloudflared/config.yml', 'w').write(conf)
EOF
```

Then start the tunnel with `docker compose up -d cloudflared`, or restart
the whole stack after populating `.env`.

## Integrate an external service (auth-sdk)

Example for an OIDC/SDK consumer service:

```ts
import { AuthClient } from '@inftkr/auth-sdk';

const auth = new AuthClient({
  issuer: 'https://auth.example.com',
  clientId: 'my-service',
  clientSecret: '...',
  redirectUri: 'https://myapp.example.com/callback',
});
```

## Operations

### Logs / status

```bash
docker compose ps            # status
docker compose logs -f       # all logs
docker compose logs -f backend
```

### Update

```bash
git pull                      # pull latest code
docker compose build          # rebuild images
docker compose up -d          # restart
```

### Backup

Back up the `postgres_data` volume.

```bash
docker run --rm -v inft-auth-postgres-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/postgres-$(date +%F).tar.gz -C /data .
```

### Reset (full reinstall)

```bash
docker compose down -v        # remove everything, including volumes
./setup.sh                    # re-run setup
```

## Troubleshooting

- **backend health check failing**: run `docker compose logs backend`
  - Possibly a Prisma migration failure. Check `docker compose ps` that
    postgres is healthy.
- **lldap login failing**: the initial admin password is `LLDAP_ADMIN_PASSWORD`.
  - The admin account must have an email (`LLDAP_ADMIN_EMAIL`, set on first
    bootstrap); the backend resolves users by email. If a server was started
    without it, set the email via the lldap admin UI or GraphQL
    `updateUser`.
- **Domain not reachable**: without cloudflared the stack is only reachable
  on `localhost`.
