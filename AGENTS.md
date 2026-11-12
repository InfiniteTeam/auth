# AGENTS.md

Development guide for the **inft-auth** monorepo. This is the shared platform
for internal authentication: OAuth 2.0 / OpenID Connect, LDAP identity,
WebFinger and social login (GitHub, Discord). The first consuming service is
Tailscale (custom OIDC client).

## Repository structure

```
apps/
  backend/   # Nest.js + oidc-provider — OIDC/OAuth2 server, session API
  www/       # Next.js — frontend UI only (login, consent, management)
packages/
  shared/    # @inftkr/shared   — shared constants & domain types
  auth-core/ # @inftkr/auth-core — shared auth core: types, client, guards, react hooks
  auth-sdk/  # @inftkr/auth-sdk  — OIDC SDK for external consumer services
  scripts/   # @inftkr/scripts   — internal tooling (private, docs generation)
deploy/      # Docker Compose (backend, www, lldap, PostgreSQL, reverse proxy)
```

## Non-negotiables

- **pnpm** workspace with **Turborepo**. Do not use npm/yarn.
- **tsup** must be used to build every workspace package (no tsc-only builds).
- All documentation and code comments must be written in **English**.
- Every package must expose a `docs` command; every app must expose a `dev`
  command.
- Architecture decisions (see below) are fixed. Verify against this file
  before proposing alternatives.

## Architecture decisions

- The Nest.js backend implements OAuth 2.0 / OIDC directly using
  `oidc-provider`. Nest.js is backend-only; Next.js (www) is
  frontend-only (portal-style).
- **Single domain**: `auth.inft.kr`. It hosts the OIDC issuer, the frontend
  UI and the internal API. WebFinger lives on the root domain
  (`inft.kr/.well-known/webfinger`).
- **Identity storage**: lldap (LDAP server) backed by PostgreSQL. Exactly one
  identity database. PostgreSQL holds two schemas/DBs: `auth` (OAuth clients,
  interactions, sessions) and `lldap` (user identities).
- **ORM**: Prisma. The backend stores its `auth` database rows (OAuth clients,
  sessions, metadata) via Prisma. The `lldap` database is owned and managed by
  lldap itself; the backend never writes identities directly (it authenticates
  through the LDAP protocol / lldap API).
- **Social login policy**: same email from a social provider is **never** auto-
  merged into an existing LDAP account. Social login can only connect to the
  account while signed in, or create a new local account.
- **Session cookie**: name `inft_session`, `HttpOnly; Secure; SameSite=Lax`.
- **First integration**: Tailscale custom OIDC client — redirect URI
  `https://login.tailscale.com/a/oauth_response`, scopes `openid profile email`.

## Definitions (shared API contract)

Auth endpoints (single source of truth: `packages/auth-core/src/client.ts`):

- `GET /api/v1/session` — returns the current session or 401. (200 with `null`
  handling is done in the client; API returns 401 when unauthenticated.)
- `POST /api/v1/auth/ldap` — LDAP sign-in with `{ email, password }`.
- `POST /api/v1/auth/social/:provider` — start social sign-in (`github` / `discord`).
- `DELETE /api/v1/session` — sign out (204).

Shared constants live in `packages/shared/src/constants.ts`
(`DOMAIN_AUTH`, `OIDC_ISSUER`, `SESSION_COOKIE_NAME`, `WEBFINGER_PATH`, `API_PREFIX`).

## Documentation pipeline

Each workspace package generates its API docs via commands:

1. `build:docs` — `tsc -p tsconfig.docs.json` (emit declarations to `dist-docs/`).
2. `api-extractor run --local` — produces `docs/api-report.md` (uses the
   package-local `api-extractor.json`).
3. `generate-split-documentation` — `@inftkr/scripts` CLI that splits the report
   into per-member Markdown files under `docs/`.

Run for all packages: `pnpm docs` (turbo task `docs`, depends on `^build`).

## Development commands

```bash
pnpm install          # install workspace deps
pnpm dev              # turbo run dev (watch mode)
pnpm build            # turbo run build (tsup for packages)
pnpm typecheck        # turbo run typecheck (tsc --noEmit)
pnpm lint             # turbo run lint
pnpm test             # turbo run test
pnpm docs             # turbo run docs (API docs generation)
pnpm format           # prettier --write .
```

## Tooling / environment

- Node.js >= 22 (currently v22.23.2).
- pnpm 12.3.4 pinned via `packageManager` in the root `package.json` (corepack).
- Turbo 2.10.12 (managed at the root).
- Active branch: `develop` (created from `origin/stable`).

## Workflow notes

- Commit messages: concise, imperative, following the repo's existing style.
- Tracked task: InftAuth 메모 / 이슈 #4 — https://github.com/InfiniteTeam/auth/issues/4.
- `docs/`, `dist-docs/`, `dist/`, `.tmp/` are gitignored build/doc artifacts.