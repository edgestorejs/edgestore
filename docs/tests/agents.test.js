import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { DOCS_GIT_REF, DOCS_ORIGIN } from '../src/lib/constants.ts';

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
  const meta = /** @type {{ pages: string[] }} */ (
    JSON.parse(await readFile(new URL('meta.json', docsRoot), 'utf8'))
  );
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

await test('prerelease machine-readable docs stay on the next release lane', () => {
  assert.equal(DOCS_ORIGIN, 'https://next.edgestore.dev');
  assert.equal(DOCS_GIT_REF, 'next');
});
