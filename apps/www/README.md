# @inftkr/www

Next.js frontend for the [inft-auth](https://github.com/InfiniteTeam/auth)
identity platform. Portal-style and frontend-only: it renders the login,
consent, signup and management screens against the backend API
(`apps/backend`) and shares types with `packages/auth-core`.

## Pages

- `/login` — LDAP and social (GitHub, Discord) sign-in
- `/consent` — OIDC consent prompt (per-client scopes)
- session management / account settings

The UI is built from `@inftkr/auth-core` React hooks (`useSession`,
`useSignIn`, `useSignOut`) and follows the InfiniteTeam portal design
(deep-navy `#151824` background, mint accent, Pretendard).

## Development

```bash
pnpm dev        # next dev
pnpm build      # next build
pnpm typecheck  # tsc --noEmit
pnpm start      # next start
```