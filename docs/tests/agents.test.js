import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { z } from 'zod';
import { getDocsDeployment } from '../src/lib/docsDeployment.ts';

process.env.SKIP_ENV_VALIDATION = '1';
const { default: config } = await import('../next.config.mjs');
const docsRoot = new URL('../content/docs/', import.meta.url);

await test('legacy agent URLs permanently redirect to existing replacements', async () => {
  const redirects = await config.redirects();
  for (const suffix of ['', '.md']) {
    assert.deepEqual(
      redirects.find(
        (entry) => entry.source === `/docs/llms-vibe-coding${suffix}`,
      ),
      {
        source: `/docs/llms-vibe-coding${suffix}`,
        destination: `/docs/agents${suffix}`,
        permanent: true,
      },
    );
  }
  await access(new URL('(getting-started)/agents.mdx', docsRoot));
  const meta = z
    .object({ pages: z.array(z.string()) })
    .parse(JSON.parse(await readFile(new URL('meta.json', docsRoot), 'utf8')));
  assert.ok(meta.pages.includes('(getting-started)/agents'));
  assert.ok(!meta.pages.includes('(getting-started)/llms-vibe-coding'));
});

await test('agents page links resolve to authored docs and legacy assets are removed', async () => {
  const content = await readFile(
    new URL('(getting-started)/agents.mdx', docsRoot),
    'utf8',
  );
  for (const [, slug] of content.matchAll(
    /\]\(\/docs\/([^\s)#]+)(?:#[^)]*)?\)/g,
  )) {
    const path = slug.replace(/\.md$/, '');
    await access(
      new URL(
        `${path.includes('/') ? path : `(getting-started)/${path}`}.mdx`,
        docsRoot,
      ),
    );
  }
  for (const name of [
    'cheat-sheet',
    'components',
    'nextjs-setup',
    'start-setup',
  ]) {
    await assert.rejects(
      access(new URL(`../public/r/vibestack/${name}.md`, import.meta.url)),
      { code: 'ENOENT' },
    );
  }
});

await test('docs default to production even on a preview branch', () => {
  const stable = { origin: 'https://edgestore.dev', gitRef: 'main' };
  assert.deepEqual(getDocsDeployment(), stable);
  assert.deepEqual(getDocsDeployment({ branch: 'next' }), stable);
  assert.deepEqual(
    getDocsDeployment({ channel: 'stable', branch: 'main' }),
    stable,
  );
});

await test('preview docs require an explicit channel', () => {
  assert.deepEqual(getDocsDeployment({ channel: 'next', branch: 'next' }), {
    origin: 'https://next.edgestore.dev',
    gitRef: 'next',
  });
});

await test('main rejects preview configuration and invalid channels fail', () => {
  assert.throws(
    () => getDocsDeployment({ channel: 'next', branch: 'main' }),
    /main branch/,
  );
  assert.throws(
    () => getDocsDeployment({ channel: 'preview' }),
    /DOCS_RELEASE_CHANNEL/,
  );
});

await test('agent instructions do not hardcode the preview website or source branch', async () => {
  const content = await readFile(
    new URL('(getting-started)/agents.mdx', docsRoot),
    'utf8',
  );
  assert.ok(!content.includes('https://next.edgestore.dev'));
  assert.ok(!content.includes('github.com/edgestorejs/edgestore/tree/next'));
});

await test('distributed skill and plugin do not point users at the preview website', async () => {
  for (const path of [
    'skills/edgestore-setup/SKILL.md',
    '.codex-plugin/plugin.json',
  ]) {
    const content = await readFile(
      new URL(`../../${path}`, import.meta.url),
      'utf8',
    );
    assert.ok(!content.includes('https://next.edgestore.dev'), path);
  }
});
