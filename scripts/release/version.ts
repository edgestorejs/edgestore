import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function run(command: string, args: string[], repoRoot: string): void {
  execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });
}

function currentBranch(repoRoot: string): string {
  return execFileSync('git', ['branch', '--show-current'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

function ensureNextPrerelease(repoRoot: string): void {
  const preStatePath = path.join(repoRoot, '.changeset', 'pre.json');

  try {
    const preState = JSON.parse(readFileSync(preStatePath, 'utf8')) as {
      mode?: string;
      tag?: string;
    };
    if (preState.mode !== 'pre' || preState.tag !== 'next') {
      throw new Error(
        'The next branch has an incompatible Changesets prerelease state.',
      );
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      run('pnpm', ['exec', 'changeset', 'pre', 'enter', 'next'], repoRoot);
      return;
    }
    throw error;
  }
}

const repoRoot = path.resolve(__dirname, '../..');
const branch =
  process.env.RELEASE_BRANCH ??
  process.env.GITHUB_REF_NAME ??
  currentBranch(repoRoot);

if (branch === 'next') {
  ensureNextPrerelease(repoRoot);
}

run('pnpm', ['exec', 'changeset', 'version'], repoRoot);
run('pnpm', ['-s', 'sync-versions'], repoRoot);
