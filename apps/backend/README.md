# @inftkr/backend

Nest.js API for the [inft-auth](https://github.com/InfiniteTeam/auth) identity
platform. Implements OAuth 2.0 / OpenID Connect directly on
[oidc-provider](https://github.com/panva/node-oidc-provider) and exposes the
session API consumed by the frontend (`apps/www`).

## Responsibilities

- **OIDC provider** — authorization endpoint, token introspection, JWKS, dynamic
  client registration via `oidc-provider`
- **LDAP authentication** — validates credentials against lldap over LDAP
- **Session management** — `inft_session` cookie
  (`HttpOnly; Secure; SameSite=Lax`), Prisma-backed persistence in the `auth`
  database schema
- **Social login** — GitHub / Discord OAuth, with a strict no-auto-merge policy

## API contract

Endpoints (source of truth: `@inftkr/auth-core` `AuthApiClient`):

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/session` | current session, `401` when unauthenticated |
| `POST` | `/api/v1/auth/ldap` | LDAP sign-in with `{ email, password }` |
| `POST` | `/api/v1/auth/social/:provider` | start social sign-in (`github` / `discord`) |
| `DELETE` | `/api/v1/session` | sign out (`204`) |

See `.env.example` for the full configuration surface.

## Development

```bash
pnpm dev        # nest start --watch
pnpm test       # vitest run
pnpm typecheck  # tsc --noEmit
pnpm build      # nest build
```