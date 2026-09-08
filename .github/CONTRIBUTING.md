# Contributing to inft-auth

Thanks for your interest in contributing! This is the internal authentication
platform for the InfiniteTeam ecosystem. Please take a moment to read this
guide before opening an issue or a pull request.

## Code of Conduct

By participating in this project you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Development setup

Requirements:

- Node.js >= 22 (currently v22.23.2)
- pnpm 12.3.4, pinned via `packageManager` (corepack)

```bash
corepack enable
pnpm install
pnpm build        # tsup builds for all workspace packages
pnpm typecheck    # tsc --noEmit
pnpm lint
pnpm test
pnpm dev          # turbo run dev (watch mode)
```

## Repository conventions

- **pnpm** workspace with **Turborepo**. Never use npm/yarn.
- **tsup** must be used to build every workspace package (no tsc-only builds).
- All documentation and code comments must be written in **English**.
- Every package must expose a `docs` command; every app must expose a `dev`
  command.
- Architecture decisions are fixed — verify against
  [AGENTS.md](../AGENTS.md) before proposing alternatives.

## Branching and workflow

- The active branch is `develop` (created from `origin/stable`).
- Create a feature branch from `develop`, then open a pull request into
  `develop` when done.
- Reference the tracked roadmap issue (https://github.com/InfiniteTeam/auth/issues/4)
  if your work relates to it.

## Commit conventions

This repository follows the Angular commit convention — see
[COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md) for the full reference (types,
scopes and examples).

Rules at a glance:

- Messages are concise, imperative, lowercase headers: `<type>(<scope>): <subject>`.
- **Each commit must contain changes of a single kind** — never mix unrelated
  changes in one commit. Split them even when they touch nearby files.
- Breaking changes are marked with a `BREAKING CHANGE:` footer.

Examples:

```
chore: remove legacy hydra/kratos configs
feat(packages): add shared/auth-core/auth-sdk workspaces
feat(backend): scaffold Nest.js app with oidc-provider
```

## Documentation

Each package generates per-member Markdown API docs into its `docs/` directory
via the API Extractor pipeline:

```bash
pnpm run docs
```

Note: the built-in `pnpm docs <package>` command conflicts with the repo task,
so always run it as `pnpm run docs`.

## Testing and review

- Run `pnpm typecheck` and `pnpm lint` before pushing.
- Keep pull requests focused; split large changes into reviewable commits.
- Update or add tests whenever you change behavior.

## Questions?

Open an issue at https://github.com/InfiniteTeam/auth/issues or reach the
maintainers through the InfiniteTeam community channels.