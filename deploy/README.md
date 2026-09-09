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

When using `cloudflared`, tunnel routing is configured in the Cloudflare
dashboard (remote-managed mode) — `cloudflared/config.yml` is a local-management
reference only and is not used by this stack.

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

### 3. Configure routing (dashboard)

On the tunnel's **Public Hostname** tab, add:

```
auth.example.com  service: http://backend:3000
example.com       service: http://backend:3000
```

Both domains route to the backend (it serves the OIDC discovery, API,
WebFinger and the frontend proxy).

### 4. Configure DNS (dashboard)

Create two proxied CNAME records pointing at the tunnel:

```
auth.example.com  CNAME  <tunnel-id>.cfargotunnel.com
example.com       CNAME  <tunnel-id>.cfargotunnel.com
```

### 5. Put the values in `deploy/.env`

```ini
TUNNEL_TOKEN=<eyJ... token>
TUNNEL_ID=<uuid>
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
