# Commit Convention

This repository follows the
[Angular commit message guidelines](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md),
which is the original preset of
[conventional-changelog-angular](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular).

The changelog pipeline maps commit types to fixed sections; keep the commit
header format strict so future `conventional-changelog -p angular` runs
produce meaningful releases.

## Message format

```
<type>(<scope>): <subject>
```

- The type and scope are always lowercase.
- The subject is a single, imperative sentence written in the present tense,
  with no trailing period.
- `<scope>` is optional but encouraged; it describes the area of the change.
- A body (blank line, then one or more lines explaining the why) may follow.
- A footer holds metadata such as `BREAKING CHANGE:` or issue references.

Good:

```
feat(packages): add shared/auth-core/auth-sdk workspaces
fix(backend): resolve session cookie path on login
docs: document the commit convention
```

Bad:

```
Added new stuff
Update README.md and fix AuthApiClient and add test for session (#12)
```

## Commit types

`conventional-changelog-angular` recognizes a fixed set of types:

| Type | Section (changelog) |
| --- | --- |
| `feat` | Features |
| `fix` | Bug Fixes |
| `perf` | Performance Improvements |
| `revert` | Reverts |
| `refactor` | Listed when breaking |
| `docs` | Listed when breaking |
| `style` | Listed when breaking |
| `test` | Listed when breaking |
| `build` | Listed when breaking |
| `ci` | Listed when breaking |
| `chore` | Omitted |

### Type guidelines

- `feat` — a new feature or user-facing behavior.
- `fix` — a bug fix.
- `perf` — a performance improvement.
- `refactor` — a code change that does not fix a bug nor add a feature.
- `docs` — documentation only (README, comments, this convention).
- `style` — formatting, whitespace, missing semicolons; no code behavior change.
- `test` — adding or correcting tests.
- `build` — build system or external dependency changes (tsup, turbo, CI images).
- `ci` — CI configuration and scripts.
- `chore` — routine tasks, dependency bumps, housekeeping.
- `revert` — reverting a previous commit.

## Scopes

A scope adds a package/app area. Prefer the workspace location unless another
scope is clearly more precise:

| Scope | Area |
| --- | --- |
| `root` | Root/monorepo setup (pnpm workspace, turbo, tsconfig, husky) |
| `packages` | Shared workspace packages (`packages/*`) |
| `shared` | `@inft/shared` |
| `auth-core` | `@inft/auth-core` |
| `auth-sdk` | `@inft/auth-sdk` |
| `scripts` | `@inft/scripts` |
| `backend` | `apps/backend` |
| `www` | `apps/www` |
| `deploy` | `deploy/` (Docker Compose, lldap, cloudflared) |

Examples:

```
fix(auth-core): keep session cookie on client redirects
feat(auth-sdk): add PKCE auth flow for external services
perf(backend): cache jwks response
```

## Breaking changes

Mark breaking changes with a `BREAKING CHANGE:` footer. This preset does **not**
recognize the `!` shorthand, so the footer is required:

```
feat(www): require password confirmation on signup

BREAKING CHANGE: the public signup endpoint now rejects mismatched passwords.
```

## One commit, one kind

A commit must contain changes of only one kind. Split unrelated changes into
separate commits even if they touch nearby files — see the example grouping in
[CONTRIBUTING](./CONTRIBUTING.md#commit-conventions).

## Commit steps

1. Stage exactly the files that belong to the kind being committed.
2. Write the header against the format above.
3. Ensure `pnpm typecheck` and `pnpm lint` pass for the change.