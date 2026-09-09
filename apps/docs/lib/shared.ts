export const appName = 'inft-auth docs';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'InfiniteTeam',
  repo: 'auth',
  branch: 'develop',
};

// Root `docs/` guide files are copied to `content/docs/` at build time by
// scripts/prepare-content.mjs, so the "source" path shown on GitHub matches
// the tracked guide location.
export const docsSourceDir = 'docs';