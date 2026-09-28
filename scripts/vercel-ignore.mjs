import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));

function git(...args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    timeout: 15_000,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed; no safe comparison available`);
  }
  return result.stdout.trim();
}

function commit(ref) {
  return git('rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`);
}

function baseline(head) {
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
  if (previous) {
    try {
      return commit(previous);
    } catch {
      // Vercel's shallow clone may not contain the last successful deployment.
      git('fetch', '--quiet', '--no-tags', '--depth=1', 'origin', previous);
      return commit(previous);
    }
  }

  const pr = process.env.VERCEL_GIT_PULL_REQUEST_ID;
  if (!pr || !/^\d+$/.test(pr)) {
    throw new Error('No previous deployment or pull request');
  }

  // GitHub's test merge has the target branch as its first parent and the PR
  // head as its second. Fetch bounded history to find the actual merge base,
  // without assuming that every PR targets the repository's default branch.
  git(
    'fetch',
    '--quiet',
    '--no-tags',
    '--depth=100',
    'origin',
    `refs/pull/${pr}/merge`,
  );
  if (commit('FETCH_HEAD^2') !== head) {
    throw new Error('Pull request merge ref is stale');
  }
  const base = git('merge-base', '--all', head, commit('FETCH_HEAD^1'));
  if (!base || base.includes('\n')) {
    throw new Error('No unique pull request merge base');
  }
  return base;
}

function shouldIgnore() {
  const paths = process.argv.slice(2);
  if (paths.length === 0) throw new Error('No project paths configured');
  const head = commit(process.env.VERCEL_GIT_COMMIT_SHA || 'HEAD');
  const base = baseline(head);
  console.log(`Comparing ${base} to ${head}`);
  // Preserve the existing project filters and rebuild when this policy changes.
  return (
    git(
      'diff',
      '--name-only',
      base,
      head,
      '--',
      ...paths,
      'scripts/vercel-ignore.mjs',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'package.json',
      'turbo.json',
    ) === ''
  );
}

// Vercel's Ignored Build Step uses 0 to skip and 1 to build. Any uncertainty
// must build, including missing PR refs, shallow history and Git failures.
try {
  const ignore = shouldIgnore();
  console.log(
    ignore ? 'Ignoring: no relevant changes' : 'Building: relevant changes',
  );
  process.exitCode = ignore ? 0 : 1;
} catch (error) {
  console.log(`Building: ${error.message}`);
  process.exitCode = 1;
}
