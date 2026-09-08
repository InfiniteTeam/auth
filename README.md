# inft-auth

Self-hosted authentication platform for the InfiniteTeam ecosystem: OAuth 2.0 /
OpenID Connect, LDAP identity, WebFinger and social login (GitHub, Discord).
The first consuming service is **Tailscale** (custom OIDC client).

| | |
| --- | --- |
| License | [Apache-2.0](./LICENSE) |
| Code of Conduct | [Contributor Covenant v2.1](./.github/CODE_OF_CONDUCT.md) |
| Contributing | [CONTRIBUTING](./.github/CONTRIBUTING.md) |

## Features

- **OIDC / OAuth 2.0** provider built on [oidc-provider](https://github.com/panva/node-oidc-provider)
  with a Nest.js backend
- **LDAP identity** managed by [lldap](https://github.com/lldap/lldap) (PostgreSQL-backed,
  single source of truth)
- **Social login** via GitHub and Discord, with a strict no-auto-merge policy for
  matching emails
- **WebFinger** (`inft.kr/.well-known/webfinger`) for Tailscale custom OIDC
- **Session API** with an `inft_session` cookie (`HttpOnly; Secure; SameSite=Lax`)
- **Next.js frontend** — login, consent, signup and settings UI

## Architecture

- Single domain: `auth.inft.kr` hosts the OIDC issuer, the frontend UI and the
  internal API. WebFinger lives on the root domain (`inft.kr`).
- One identity database: PostgreSQL holds two schemas, `auth` (managed by the
  backend through Prisma) and `lldap` (managed by lldap itself).
- Nest.js is backend-only; Next.js (`apps/www`) is frontend-only (portal style).

```
apps/
  backend/   # Nest.js + oidc-provider — OIDC/OAuth2 server, session API
  www/       # Next.js — frontend UI only (login, consent, management)
packages/
  shared/    # @inft/shared   — shared constants & domain types
  auth-core/ # @inft/auth-core — shared auth core: types, client, guards, react hooks
  auth-sdk/  # @inft/auth-sdk  — OIDC SDK for external consumer services
  scripts/   # @inft/scripts   — internal tooling (private, docs generation)
deploy/      # Docker Compose (backend, www, lldap, PostgreSQL, reverse proxy)
```

See [AGENTS.md](./AGENTS.md) for the full development guide (architecture
decisions, non-negotiables, documentation pipeline).

## Getting started

Node.js >= 22 and pnpm 12 (corepack) are required.

```bash
pnpm install   # install workspace deps
pnpm dev       # turbo run dev (watch mode)
pnpm build     # turbo run build (tsup for packages)
pnpm typecheck # turbo run typecheck (tsc --noEmit)
pnpm lint      # turbo run lint
pnpm test      # turbo run test
pnpm run docs  # turbo run docs (API docs generation)
```

## Documentation

Each package generates per-member API documentation in Markdown into its
`docs/` directory via a TypeDoc-free pipeline:

1. `build:docs` — emit declarations to `dist-docs/`
2. `api-extractor run --local` — produce `api-report.api.md` + `docs.api.json`
3. `generate-split-documentation` — split the doc model into per-member files

## Related

- Tracked issue with the full roadmap: https://github.com/InfiniteTeam/auth/issues/4