# @inftkr/scripts

Internal tooling for the [inft-auth](https://github.com/InfiniteTeam/auth)
monorepo. Private (not published to npm).

## Commands

`generate-split-documentation` — splits an api-extractor doc model into
per-member Markdown files under each package's `docs/` directory, driven by the
`docs` script in every package.

## Development

```bash
pnpm build      # tsup
pnpm typecheck  # tsc --noEmit
```