import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  framework,
  frameworks,
  initialResults,
  inside,
  isolatedEnv,
  sanitize,
  sha256,
} from './policy.ts';

test('does not inherit credentials, client configuration, or Node preload hooks', () => {
  const env = isolatedEnv('/isolated/home', {
    PATH: '/bin',
    EDGESTORE_TOKEN: 'token',
    NODE_OPTIONS: '--import malicious',
    OPENAI_API_KEY: 'key',
    HOME: '/personal',
    CODEX_HOME: '/personal/client',
  });
  assert.equal(env.HOME, '/isolated/home');
  assert.equal(env.CODEX_HOME, '/isolated/home/.codex');
  assert.equal(env.EDGESTORE_TOKEN, undefined);
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
});

test('sanitizes known secrets, env assignments, authorization and URL queries', () => {
  const raw =
    'sentinel\nEDGE_STORE_SECRET_KEY=unknown\n"EDGESTORE_TOKEN": "other"\nAuthorization: Bearer x\nhttps://files.example/a?signature=secret';
  const clean = sanitize(raw, ['sentinel', '']);
  for (const word of ['sentinel', 'unknown', 'other', 'Bearer', 'signature='])
    assert.ok(!clean.includes(word));
  assert.equal(
    sanitize('package metadata and https://example.com/docs'),
    'package metadata and https://example.com/docs',
  );
});

test('bounds paths and rejects unknown frameworks', () => {
  assert.equal(inside('/tmp/run', '/tmp/run/app'), true);
  for (const target of ['/tmp/run', '/tmp/run-other', '/tmp/elsewhere'])
    assert.equal(inside('/tmp/run', target), false);
  assert.throws(() => framework('../next'));
  assert.equal(framework('start'), 'start');
  assert.equal(sha256('test').length, 64);
});

test('an artifact pass cannot imply agent or live success', () => {
  const results = initialResults();
  results.artifact.status = 'passed';
  assert.equal(results.baseline.status, 'not-run');
  assert.equal(results.skill.status, 'not-run');
  assert.equal(results.live.status, 'not-run');
});

test('fixtures have locks, no EdgeStore integration, no symlinks, and pinned dependency versions', async () => {
  for (const name of frameworks) {
    const root = new URL(`./fixtures/${name}/`, import.meta.url);
    assert.ok(
      (await readFile(new URL('pnpm-lock.yaml', root), 'utf8')).includes(
        'lockfileVersion:',
      ),
    );
    const visit = async (directory: URL): Promise<void> => {
      for (const file of await readdir(directory, { withFileTypes: true })) {
        assert.ok(!file.isSymbolicLink(), file.name);
        const child = new URL(
          `${file.name}${file.isDirectory() ? '/' : ''}`,
          directory,
        );
        if (file.isDirectory()) {
          await visit(child);
          continue;
        }
        assert.ok(!file.name.startsWith('.env'), file.name);
        const text = await readFile(child, 'utf8');
        assert.ok(!text.includes('@edgestore/'), child.pathname);
        if (path.basename(child.pathname) !== 'package.json') continue;
        const manifest = JSON.parse(text);
        for (const version of Object.values({
          ...manifest.dependencies,
          ...manifest.devDependencies,
        }) as string[]) {
          assert.match(
            version,
            /^(?:\d+\.\d+\.\d+(?:-[\w.-]+)?|workspace:\*|npm:[^@]+@\d+\.\d+\.\d+(?:-[\w.-]+)?)$/,
          );
        }
      }
    };
    await visit(root);
  }
});
