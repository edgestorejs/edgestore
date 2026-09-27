import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

async function markdownFiles(directory) {
  const files = await readdir(new URL(directory, import.meta.url), {
    recursive: true,
  });
  return files
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => `${directory}/${file}`);
}

test('all v1 package-install and shell instructions explicitly select next during the RC handoff', async () => {
  for (const path of await markdownFiles('../content/docs')) {
    const content = await read(path);
    for (const [fence] of content.matchAll(
      /```(?:package-install|sh|bash|shell)[^\n]*\n[\s\S]*?```/g,
    )) {
      for (const [specifier] of fence.matchAll(
        /@edgestore\/[\w-]+(?:@[\w.^-]+)?/g,
      )) {
        assert.ok(specifier.endsWith('@next'), `${path}: ${specifier}`);
      }
    }
  }
});

test('v0 archive keeps documentation and registry links on the archived version', async () => {
  for (const path of await markdownFiles('../content/v0')) {
    const content = await read(path);
    assert.doesNotMatch(content, /\]\(\/docs\//, path);
    assert.doesNotMatch(content, /https:\/\/edgestore.dev\/r\//, path);
    assert.doesNotMatch(content, /@edgestore\/[\w-]+@(?:rc|next|latest)/, path);
    assert.doesNotMatch(content, /https:\/\/vercel\.com\/v0\//, path);
    assert.doesNotMatch(content, /\]\(\/llms(?:-full)?\.txt\)/, path);
    assert.doesNotMatch(content, /(?:shadcn|vibestack)@0\.8\.0/, path);
    assert.doesNotMatch(
      content,
      /github\.com\/edgestorejs\/edgestore\/(?:tree|blob)\/(?:main|next|dev)\//,
      path,
    );
  }
});

test('RC and archived registries install matching package versions', async () => {
  for (const [directory, tag] of [
    ['../public/r', '@next'],
    ['../public/v0/r', '@0.8.0'],
  ]) {
    for (const name of await readdir(new URL(directory, import.meta.url))) {
      if (!name.endsWith('.json')) continue;
      const item = JSON.parse(await read(`${directory}/${name}`));
      for (const entry of [item, ...(item.items ?? [])]) {
        for (const dependency of entry.dependencies ?? []) {
          if (dependency.startsWith('@edgestore/'))
            assert.ok(dependency.endsWith(tag), `${name}: ${dependency}`);
        }
      }
    }
  }
});

test('archived setup assets pin EdgeStore installs to v0', async () => {
  for (const path of await markdownFiles('../public/v0/r/vibestack')) {
    const content = await read(path);
    for (const [fence] of content.matchAll(
      /```(?:bash|sh|package-install)[^\n]*\n[\s\S]*?```/g,
    )) {
      for (const [specifier] of fence.matchAll(
        /@edgestore\/[\w-]+(?:@[\w.^-]+)?/g,
      )) {
        assert.ok(specifier.endsWith('@0.8.0'), `${path}: ${specifier}`);
      }
    }
  }
});
