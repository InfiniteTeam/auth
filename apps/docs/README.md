# @inftkr/docs

Static documentation site for [inft-auth](https://github.com/InfiniteTeam/auth)
built with [Fumadocs](https://fumadocs.dev) on Next.js static export.

## Content

- **Guides** — operation docs sourced from the repository-root `docs/*.mdx`
- **API reference** — generated from each package's `docs.api.json`
  (api-extractor doc model) via `scripts/prepare-content.mjs`

The API reference is rendered automatically whenever package API docs are
regenerated with `pnpm run docs` at the repository root.

## Development

```bash
pnpm dev        # next dev (predev regenerates content)
pnpm build      # next build → static export into out/
pnpm start      # serve out/ locally
pnpm typecheck  # tsc --noEmit
```

## Layout

```
content/        # built locally (gitignored), never edited by hand
  guides/       # copies of docs/*.mdx
  api/          # generated from packages/*/docs/docs.api.json
scripts/
  prepare-content.mjs   # content preparation (predev/prebuild)
```