#!/usr/bin/env node
/**
 * Prepare content for the Fumadocs static site build.
 *
 * 1. Copies the root `docs/*.mdx` guide sources into `content/docs/` (the
 *    Next.js app cannot read MDX from outside its project root).
 * 2. Reads each package's `docs.api.json` (api-extractor doc model) and
 *    generates per-package API reference MDX pages into `content/api/`.
 *
 * Run before `next dev` / `next build` (wired via predev/prebuild).
 */
import { readFile, readdir, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ApiDocumentedItem,
  ApiParameterListMixin,
  ApiReturnTypeMixin,
  ApiStaticMixin,
  ApiReadonlyMixin,
  ApiModel,
} from '@microsoft/api-extractor-model';
import { DocNode, DocPlainText, DocCodeSpan, DocInlineTag } from '@microsoft/tsdoc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const contentRoot = path.join(appRoot, 'content');
const guidesSrc = path.join(repoRoot, 'docs');

const PACKAGES = [
  { dir: 'shared', name: '@inftkr/shared', label: 'Shared' },
  { dir: 'auth-core', name: '@inftkr/auth-core', label: 'Auth Core' },
  { dir: 'auth-sdk', name: '@inftkr/auth-sdk', label: 'Auth SDK' },
];

function renderNode(node) {
  if (node instanceof DocPlainText) return node.text;
  if (node instanceof DocCodeSpan) return `\`${node.code}\``;
  if (node instanceof DocInlineTag) return node.tagName.replace(/^@/, '');
  return (node.getChildNodes() ?? []).map(renderNode).join('');
}

function renderSummary(comment) {
  return comment ? renderNode(comment.summarySection).trim() : '';
}

function signatureOf(item) {
  if (!ApiParameterListMixin.isBaseClassOf(item)) return '';
  const params = item.parameters
    .map(
      (param) =>
        `${param.name}${param.isOptional ? '?' : ''}: ${param.parameterTypeExcerpt.text}`,
    )
    .join(', ');
  const typeParams = ApiReturnTypeMixin.isBaseClassOf(item)
    ? item.returnTypeExcerpt.text
    : '';
  return `(${params}${typeParams ? `): ${typeParams}` : ''}`;
}

function collectMembers(item) {
  const members = [];
  for (const member of item.members ?? []) {
    if (!(member instanceof ApiDocumentedItem)) continue;
    const parts = [member.kind];
    if (ApiStaticMixin.isBaseClassOf(member) && member.isStatic) parts.push('static');
    if (ApiReadonlyMixin.isBaseClassOf(member) && member.isReadonly) parts.push('readonly');
    members.push({
      name: member.displayName,
      kind: parts.join(' '),
      signature: signatureOf(member),
      summary: renderSummary(member.tsdocComment),
    });
    members.push(...collectMembers(member));
  }
  return members;
}

function toFileName(name) {
  return name.replace(/[^A-Za-z0-9_.-]/g, '-').replace(/-+/g, '-');
}

// Escape characters that MDX would otherwise interpret as JSX/expressions
// (`<T>`, array/generic `,`, `{ ... }`). Applied to free-form text; code
// spans are wrapped separately so their content is not mangled.
function escapeMdx(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

const escapeSummary = (text) => escapeMdx(text);
const escapeDescription = (text) =>
  escapeMdx(text).replace(/["]/g, '&quot;').replace(/[\r\n]+/g, ' ');

async function copyGuides() {
  const dest = path.join(contentRoot, 'guides');
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });

  const entries = await readdir(guidesSrc);
  for (const entry of entries) {
    if (!/\.mdx?$/.test(entry)) continue;
    await copyFile(
      path.join(guidesSrc, entry),
      path.join(dest, entry.replace(/\.md$/, '.mdx')),
    );
    console.log(`  guide: docs/${entry}`);
  }

  await writeFile(
    path.join(dest, 'meta.json'),
    JSON.stringify({ title: 'Guides', pages: ['README', 'deployment', 'development', 'oidc', 'security'] }, null, 2),
    'utf8',
  );
}

async function generateApiReferences() {
  // Nested under `api/` so every API page lives at `/docs/api/<pkg>/...`,
  // keeping guides and reference apart in the sidebar tree.
  const dest = path.join(contentRoot, 'api', 'api');
  await rm(path.join(contentRoot, 'api'), { recursive: true, force: true });
  await mkdir(dest, { recursive: true });

  const docs = [];

  for (const pkg of PACKAGES) {
    const apiJson = path.join(
      repoRoot,
      'packages',
      pkg.dir,
      'docs',
      'docs.api.json',
    );
    if (!(await exists(apiJson))) {
      console.warn(`  ! skipped ${pkg.name}: missing ${path.relative(repoRoot, apiJson)}`);
      continue;
    }

    const pkgDir = path.join(dest, pkg.dir);
    await mkdir(pkgDir, { recursive: true });

    const model = new ApiModel();
    const apiPackage = model.loadPackage(apiJson);
    const entryPoint = apiPackage.members[0];
    const topLevelMembers =
      (entryPoint?.members.length ? entryPoint.members : apiPackage.members) ?? [];

    const pageNames = [];
    for (const item of topLevelMembers) {
      const summary = item instanceof ApiDocumentedItem ? renderSummary(item.tsdocComment) : '';
      const members = collectMembers(item);

      const lines = [];
      const fsName = toFileName(item.displayName);

      lines.push('---');
      lines.push(
        `title: ${item.displayName}${item.kind ? ` (${item.kind})` : ''}`,
      );
      lines.push(
        `description: "${escapeDescription(summary || item.displayName)}"`,
      );
      lines.push('---');
      lines.push('');

      const kindLine = [`**${item.kind}**`];
      const sig = signatureOf(item);
      if (sig) kindLine.push('`' + sig + '`');
      lines.push(kindLine.join(' '), '');

      if (summary) lines.push(escapeSummary(summary), '');

      if (members.length > 0) {
        lines.push('## Members', '');
        for (const member of members) {
          lines.push(`### ${member.name}`, '');
          if (member.kind) {
            lines.push(
              `**${member.kind}**${
                member.signature ? ' `' + member.signature + '`' : ''
              }`,
              '',
            );
          }
          if (member.summary) lines.push(escapeSummary(member.summary), '');
        }
      }

      await writeFile(
        path.join(pkgDir, `${fsName}.mdx`),
        lines.join('\n').trimEnd() + '\n',
        'utf8',
      );
      pageNames.push(item.displayName);
    }

    // Per-package index page listing every member.
    await writeFile(
      path.join(pkgDir, 'index.mdx'),
      [
        '---',
        `title: ${pkg.label}`,
        `description: API reference for ${pkg.name}`,
        '---',
        '',
        `# ${pkg.label}`,
        '',
        `Package: \`${pkg.name}\``,
        '',
        ...pageNames.map(
          (name) => `- [\`${name}\`](./${toFileName(name)})`,
        ),
        '',
      ].join('\n'),
      'utf8',
    );

    await writeFile(
      path.join(pkgDir, 'meta.json'),
      JSON.stringify({ title: pkg.label, pages: ['index', ...pageNames.map(toFileName)] }, null, 2),
      'utf8',
    );

    docs.push({ pkg: pkg.dir, count: pageNames.length });
  }

  if (docs.length > 0) {
    await writeFile(
      path.join(dest, 'meta.json'),
      JSON.stringify({ title: 'API Reference', pages: docs.map((d) => d.pkg) }, null, 2),
      'utf8',
    );
  }
}

async function exists(p) {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('Preparing docs content...');
  console.log('[1/2] Copying root docs/ guides');
  await copyGuides();
  console.log('[2/2] Generating API reference from docs.api.json');
  await generateApiReferences();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});