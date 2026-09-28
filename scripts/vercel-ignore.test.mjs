import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const projects = [
  'docs',
  'examples/components',
  'examples/basic-access-control',
];

function fixture(t, changed = 'examples/components/upload.ts') {
  const temp = mkdtempSync(join(tmpdir(), 'vercel-ignore-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const source = join(temp, 'source');
  const checkout = join(temp, 'checkout');
  mkdirSync(source);
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: source,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    }).trim();
  function change(path, content = 'changed') {
    mkdirSync(dirname(join(source, path)), { recursive: true });
    writeFileSync(join(source, path), content);
    git('add', path);
    git('commit', '-m', path);
    return git('rev-parse', 'HEAD');
  }
  git('init', '-b', 'main');
  for (const path of [
    'scripts/vercel-ignore.mjs',
    ...projects.map((p) => `${p}/vercel.json`),
  ]) {
    mkdirSync(dirname(join(source, path)), { recursive: true });
    copyFileSync(join(root, path), join(source, path));
  }
  git('add', '.');
  git('commit', '-m', 'initial');
  const initial = git('rev-parse', 'HEAD');
  git('switch', '-c', 'next');
  git('switch', '-c', 'feature');
  change(
    changed,
    changed === 'scripts/vercel-ignore.mjs'
      ? readFileSync(join(root, changed), 'utf8') + '\n// policy update\n'
      : 'changed',
  );
  git('switch', 'next');
  const target = change('docs/guide.mdx');
  git('switch', 'feature');
  // Reproduce #273: project changes precede a merge that only updates docs.
  git('merge', '--no-ff', 'next', '-m', 'Merge next');
  const head = git('rev-parse', 'HEAD');
  function mergeRef(prHead = head) {
    const merge = git(
      'commit-tree',
      `${prHead}^{tree}`,
      '-p',
      target,
      '-p',
      prHead,
      '-m',
      'Test merge',
    );
    git('update-ref', 'refs/pull/273/merge', merge);
  }
  mergeRef();
  git(
    'clone',
    '--quiet',
    '--depth=1',
    '--branch=feature',
    pathToFileURL(source).href,
    checkout,
  );

  function run(project = 'examples/components', env = {}) {
    const { ignoreCommand } = JSON.parse(
      readFileSync(join(checkout, project, 'vercel.json'), 'utf8'),
    );
    const result = spawnSync('sh', ['-c', ignoreCommand], {
      cwd: join(checkout, project),
      encoding: 'utf8',
      env: {
        ...process.env,
        VERCEL_GIT_PREVIOUS_SHA: '',
        VERCEL_GIT_COMMIT_SHA: head,
        VERCEL_GIT_PULL_REQUEST_ID: '273',
        ...env,
      },
    });
    assert.ok(result.status === 0 || result.status === 1, result.stderr);
    return { status: result.status, output: result.stdout };
  }
  return { git, change, mergeRef, run, head, initial, checkout };
}

test('first PR deployment includes changes before the latest merge, even in a shallow clone', (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 1);
  assert.equal(f.run('examples/basic-access-control').status, 0);
  // Docs changed on the target branch, not on the PR branch.
  assert.equal(f.run('docs').status, 0);
});

test('first deployment of an unrelated PR is ignored', (t) => {
  assert.equal(fixture(t, 'README.md').run().status, 0);
});

test('previous deployment takes priority over all PR changes', (t) => {
  const f = fixture(t);
  assert.equal(
    f.run('examples/components', { VERCEL_GIT_PREVIOUS_SHA: f.head }).status,
    0,
  );
});

test('previous deployment outside shallow history is fetched', (t) => {
  const f = fixture(t);
  const result = f.run('examples/components', {
    VERCEL_GIT_PREVIOUS_SHA: f.initial,
  });
  assert.equal(result.status, 1);
  assert.match(result.output, new RegExp(`Comparing ${f.initial}`));
});

test('an unavailable previous deployment builds rather than substituting the PR base', (t) => {
  const f = fixture(t, 'README.md');
  assert.equal(
    f.run('examples/components', { VERCEL_GIT_PREVIOUS_SHA: '1'.repeat(40) })
      .status,
    1,
  );
});

test('no previous deployment and no PR builds', (t) => {
  assert.equal(
    fixture(t).run('examples/components', { VERCEL_GIT_PULL_REQUEST_ID: '' })
      .status,
    1,
  );
});

test('missing or stale GitHub merge refs build', (t) => {
  const f = fixture(t, 'README.md');
  f.mergeRef(f.change('another-file.md'));
  assert.match(f.run().output, /Building: Pull request merge ref is stale/);
  f.git('update-ref', '-d', 'refs/pull/273/merge');
  assert.equal(f.run().status, 1);
});

test('unresolvable current commit builds', (t) => {
  assert.equal(
    fixture(t).run('examples/components', { VERCEL_GIT_COMMIT_SHA: 'missing' })
      .status,
    1,
  );
});

test('a merge base beyond the fetch depth builds', (t) => {
  const f = fixture(t, 'README.md');
  for (let i = 0; i < 105; i++) {
    f.git('commit', '--allow-empty', '-m', `Follow-up ${i}`);
  }
  const head = f.git('rev-parse', 'HEAD');
  f.mergeRef(head);
  execFileSync('git', ['fetch', '--quiet', '--depth=1', 'origin', 'feature'], {
    cwd: f.checkout,
  });
  const result = f.run('examples/components', { VERCEL_GIT_COMMIT_SHA: head });
  assert.equal(result.status, 1);
  assert.match(result.output, /git merge-base failed/);
});

for (const path of [
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'package.json',
  'turbo.json',
  'scripts/vercel-ignore.mjs',
]) {
  test(`${path} changes rebuild every project`, (t) => {
    const f = fixture(t, path);
    for (const project of projects) assert.equal(f.run(project).status, 1);
  });
}

test('skills changes rebuild docs only', (t) => {
  const f = fixture(t, 'skills/edgestore-setup/SKILL.md');
  assert.equal(f.run('docs').status, 1);
  assert.equal(f.run('examples/components').status, 0);
  assert.equal(f.run('examples/basic-access-control').status, 0);
});

test('package-only changes remain ignored by the existing policy', (t) => {
  const f = fixture(t, 'packages/react/index.ts');
  for (const project of projects) assert.equal(f.run(project).status, 0);
});
