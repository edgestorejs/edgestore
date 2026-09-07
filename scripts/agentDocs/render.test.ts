import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildReferences, packageReferences, repoRoot } from './build';
import { renderReference } from './render';
import { docsOrigin } from './selection';

const sourceUrl = 'https://next.edgestore.dev/docs/quick-start';
const frontmatter = '---\ntitle: Example\n---\n\n';

test('preserves code, tab labels, links, tables and admonitions without executing MDX', () => {
  const output = renderReference(
    frontmatter +
      `
<Callout type="warning">
Keep keys on the server. <br /> Never expose them.
</Callout>

<Tabs items={['app']}>

\`\`\`ts tab="app" title="route.ts"
const value = { path: '/docs/no-rewrite', template: '<Callout>' };
\`\`\`

</Tabs>

[Configuration](/docs/configuration#context)

| Name | Required |
| --- | --- |
| key | yes |
`,
    { sourceUrl },
  );
  assert.match(output, /> WARNING/);
  assert.match(output, /Keep keys on the server/);
  assert.match(output, /Never expose them/);
  assert.match(output, /Example: tab="app" title="route.ts"/);
  assert.match(
    output,
    /const value = \{ path: '\/docs\/no-rewrite', template: '<Callout>' \};/,
  );
  assert.match(
    output,
    /https:\/\/next.edgestore.dev\/docs\/configuration#context/,
  );
  assert.match(output, /\| Name/);
  assert.doesNotMatch(output, /<Tabs|items=/);
});

test('renders install widgets without selecting or executing a package manager', () => {
  const output = renderReference(
    frontmatter + '\n```package-install\n@edgestore/react\n```',
    { sourceUrl },
  );
  assert.match(output, /Packages to install/);
  assert.match(output, /```text\n@edgestore\/react/);
});

test('selects exact heading subtrees and rejects missing or ambiguous sections', () => {
  const source =
    frontmatter +
    '## Server\nsecret config\n### Nested\nkeep\n## Client\nclient config\n';
  const output = renderReference(source, { sourceUrl, sections: ['Client'] });
  assert.match(output, /client config/);
  assert.doesNotMatch(output, /secret config|Nested/);
  assert.throws(
    () => renderReference(source, { sourceUrl, sections: ['Missing'] }),
    /Expected one section/,
  );
  assert.throws(
    () =>
      renderReference(source + '\n## Client\n', {
        sourceUrl,
        sections: ['Client'],
      }),
    /found 2/,
  );
});

test('fails loudly for unknown components, expressions, imports and missing metadata', () => {
  for (const mdx of [
    '<Unknown>Important</Unknown>',
    '{process.env.SECRET}',
    "import data from './data';",
    '<Callout type={getType()}>note</Callout>',
    '<Callout title="Important">note</Callout>',
    '<Tabs items={getLabels()}>note</Tabs>',
    '<Tabs {...props}>note</Tabs>',
  ]) {
    assert.throws(
      () => renderReference(frontmatter + mdx, { sourceUrl }),
      /Unsupported|Executable|must be static/,
    );
  }
  assert.throws(
    () => renderReference('## No metadata', { sourceUrl }),
    /Missing documentation title/,
  );
});

test('all curated references render deterministically and indexes identify their package version', async () => {
  for (const name of ['server', 'react', 'sdk']) {
    const first = await packageReferences(name);
    assert.deepEqual(first, await packageReferences(name));
    const manifest = JSON.parse(
      await readFile(
        path.join(repoRoot, 'packages', name, 'package.json'),
        'utf8',
      ),
    ) as { version: string };
    assert.ok(
      first
        .get('README.md')!
        .includes(`@edgestore/${name} ${manifest.version}`),
    );
    for (const [, file] of first.get('README.md')!.matchAll(/\]\(([^)]+)\)/g)) {
      assert.ok(first.has(file!));
    }
  }
});

test('checks detect missing, changed and obsolete generated artifacts', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'edgestore-agent-docs-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'packages/sdk'), { recursive: true });
  await mkdir(path.join(root, 'docs/content/docs/(getting-started)'), {
    recursive: true,
  });
  await writeFile(
    path.join(root, 'packages/sdk/package.json'),
    JSON.stringify({ name: '@edgestore/sdk', version: '1.2.3' }),
  );
  const source = path.join(root, 'docs/content/docs/(getting-started)/sdk.mdx');
  await writeFile(source, frontmatter + 'SDK docs');
  await assert.rejects(buildReferences('sdk', true, root));
  await buildReferences('sdk', false, root);
  await buildReferences('sdk', true, root);
  assert.match(
    await readFile(
      path.join(root, 'packages/sdk/agent-docs/README.md'),
      'utf8',
    ),
    /1\.2\.3/,
  );
  await writeFile(source, frontmatter + 'Changed SDK docs');
  await assert.rejects(buildReferences('sdk', true, root), /Stale reference/);
  await buildReferences('sdk', false, root);
  await writeFile(
    path.join(root, 'packages/sdk/agent-docs/old.md'),
    'obsolete',
  );
  await assert.rejects(
    buildReferences('sdk', true, root),
    /Unexpected generated reference/,
  );
  await buildReferences('sdk', false, root);
  await buildReferences('sdk', true, root);
});

test('online fallbacks use the package release lane', () => {
  assert.equal(docsOrigin('1.0.0-next.3'), 'https://next.edgestore.dev');
  assert.equal(docsOrigin('1.0.0'), 'https://edgestore.dev');
});
