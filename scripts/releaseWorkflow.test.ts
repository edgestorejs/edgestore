import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const root = new URL('../', import.meta.url);
const workflow = parse(
  await readFile(new URL('.github/workflows/release.yml', root), 'utf8'),
);
const validation = workflow.jobs.release.steps.find(
  (step: { name?: string }) => step.name === 'Validate release mode',
).run;

test('only main automatically publishes normal releases', () => {
  assert.deepEqual(workflow.on.push.branches, ['main']);
});

for (const [branch, state, allowed] of [
  ['main', undefined, true],
  ['main', { mode: 'pre', tag: 'rc' }, true],
  ['main', { mode: 'pre', tag: 'next' }, false],
  ['main', { mode: 'exit', tag: 'rc' }, false],
  ['next', { mode: 'pre', tag: 'next' }, false],
  ['feature/test', undefined, false],
] as const) {
  test(`release validation: ${branch}, ${JSON.stringify(state)}`, async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'edgestore-release-'),
    );
    try {
      await mkdir(path.join(directory, '.changeset'));
      if (state)
        await writeFile(
          path.join(directory, '.changeset/pre.json'),
          JSON.stringify(state),
        );
      const result = spawnSync('bash', ['-e', '-c', validation], {
        cwd: directory,
        env: { ...process.env, GITHUB_REF_NAME: branch },
        encoding: 'utf8',
      });
      assert.equal(
        result.status === 0,
        allowed,
        result.stderr || result.stdout,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test('stable promotion versions main through a PR', async () => {
  const promotion = parse(
    await readFile(
      new URL('.github/workflows/promote-stable.yml', root),
      'utf8',
    ),
  );
  const steps = promotion.jobs.prepare.steps;
  assert.equal(
    steps.find((step: { uses?: string }) =>
      step.uses?.startsWith('actions/checkout@'),
    ).with.ref,
    'main',
  );
  assert.match(
    steps.find(
      (step: { name?: string }) => step.name === 'Generate stable versions',
    ).run,
    /changeset pre exit/,
  );
  const publish = steps.find(
    (step: { name?: string }) => step.name === 'Open promotion PR',
  ).run;
  assert.match(publish, /gh pr create/);
  assert.match(publish, /--base main/);
  assert.doesNotMatch(publish, /gh pr merge|changeset publish/);
});
