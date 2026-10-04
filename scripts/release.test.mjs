import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';

const workflow = parse(
  readFileSync(
    new URL('../.github/workflows/release.yml', import.meta.url),
    'utf8',
  ),
);
const steps = workflow.jobs.release.steps;
const validation = steps.find((step) => step.name === 'Validate release mode');
const changesets = steps.find((step) => step.id === 'changesets');

test('the entire Changesets action requires a validated release mode', () => {
  assert.equal(validation.id, 'release-mode');
  assert.equal(validation.shell, 'bash');
  assert.equal(changesets.uses, 'changesets/action@v1');
  assert.equal(
    changesets.if,
    "steps.release-mode.outputs.should-release == 'true'",
  );
});

const pre = (tag, mode = 'pre') => JSON.stringify({ mode, tag });
const states = [
  { name: 'stable main', branch: 'main', allowed: true },
  { name: 'main RC', branch: 'main', contents: pre('rc'), allowed: true },
  {
    name: 'next prerelease',
    branch: 'next',
    contents: pre('next'),
    allowed: true,
  },
  { name: 'next RC', branch: 'next', contents: pre('rc'), allowed: true },
  { name: 'dormant next', branch: 'next' },
  { name: 'main next tag', branch: 'main', contents: pre('next') },
  { name: 'main exited RC', branch: 'main', contents: pre('rc', 'exit') },
  {
    name: 'next exited prerelease',
    branch: 'next',
    contents: pre('next', 'exit'),
  },
  { name: 'next unsupported tag', branch: 'next', contents: pre('beta') },
  { name: 'main malformed JSON', branch: 'main', contents: '{' },
  { name: 'next malformed JSON', branch: 'next', contents: '{' },
  { name: 'next empty file', branch: 'next', contents: '' },
  { name: 'next missing mode', branch: 'next', contents: '{"tag":"next"}' },
  { name: 'next null state', branch: 'next', contents: 'null' },
  { name: 'next directory in place of file', branch: 'next', directory: true },
  { name: 'next dangling prerelease symlink', branch: 'next', symlink: true },
  { name: 'maintenance branch', branch: '1.x' },
  {
    name: 'feature branch with prerelease',
    branch: 'feature',
    contents: pre('next'),
  },
];

for (const event of ['push', 'workflow_dispatch']) {
  for (const state of states) {
    test(`${event}: ${state.name}`, () => {
      const cwd = mkdtempSync(join(tmpdir(), 'edgestore-release-'));
      try {
        mkdirSync(join(cwd, '.changeset'));
        if (state.contents !== undefined) {
          writeFileSync(join(cwd, '.changeset/pre.json'), state.contents);
        }
        if (state.directory) {
          mkdirSync(join(cwd, '.changeset/pre.json'));
        }
        if (state.symlink) {
          symlinkSync('missing.json', join(cwd, '.changeset/pre.json'));
        }
        const outputPath = join(cwd, 'output');
        const summaryPath = join(cwd, 'summary');
        writeFileSync(outputPath, '');
        writeFileSync(summaryPath, '');
        const result = spawnSync(
          'bash',
          ['--noprofile', '--norc', '-eo', 'pipefail', '-c', validation.run],
          {
            cwd,
            encoding: 'utf8',
            env: {
              ...process.env,
              GITHUB_REF_NAME: state.branch,
              GITHUB_EVENT_NAME: event,
              GITHUB_OUTPUT: outputPath,
              GITHUB_STEP_SUMMARY: summaryPath,
            },
          },
        );
        assert.ifError(result.error);
        const output = readFileSync(outputPath, 'utf8');
        const summary = readFileSync(summaryPath, 'utf8');
        if (state.name === 'dormant next' && event === 'push') {
          assert.equal(result.status, 0, result.stderr);
          assert.equal(output, 'should-release=false\n');
          assert.match(result.stdout, /Skipping release: next is dormant/);
          assert.match(summary, /Release skipped.*RELEASING\.md/);
        } else if (state.allowed) {
          assert.equal(result.status, 0, result.stderr);
          assert.equal(output, 'should-release=true\n');
          assert.equal(summary, '');
        } else {
          assert.notEqual(result.status, 0, result.stdout);
          assert.equal(output, '');
          assert.equal(summary, '');
          if (state.name === 'dormant next') {
            assert.match(
              result.stdout,
              /::error::Cannot release from dormant next/,
            );
            assert.match(result.stdout, /pnpm changeset pre enter next/);
            assert.match(result.stdout, /commit.*pre\.json.*push/);
          }
        }
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    });
  }
}
