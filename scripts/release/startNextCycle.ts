import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

function run(command: string, args: string[], repoRoot: string): void {
  execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });
}

function capture(command: string, args: string[], repoRoot: string): string {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
}

function promotionNextSha(
  mainSha: string,
  repoRoot: string,
): string | undefined {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY is required to identify the merged PR.');
  }

  const headRef = capture(
    'gh',
    [
      'api',
      `repos/${repository}/commits/${mainSha}/pulls`,
      '--jq',
      'map(select(.merged_at != null and .base.ref == "main" and (.head.ref | startswith("release/promote-next-"))))[0].head.ref // ""',
    ],
    repoRoot,
  );
  if (!headRef) return undefined;

  const nextSha = headRef.slice('release/promote-next-'.length);
  if (!/^[a-f0-9]{40}$/.test(nextSha)) {
    throw new Error(`Promotion PR has an invalid next SHA: ${headRef}`);
  }
  return nextSha;
}

function isAncestor(ancestor: string, descendant: string, repoRoot: string) {
  return (
    spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
    }).status === 0
  );
}

async function main() {
  const repoRoot = path.resolve(__dirname, '../..');
  const mainSha = capture('git', ['rev-parse', 'HEAD'], repoRoot);
  const promotedNextSha = promotionNextSha(mainSha, repoRoot);
  if (!promotedNextSha) {
    console.log(
      'The stable publication did not come from a next promotion; leaving next unchanged.',
    );
    return;
  }

  const shortSha = mainSha.slice(0, 12);
  const fallbackBranch = `release/start-next-${shortSha}`;

  run('git', ['fetch', 'origin', 'next'], repoRoot);
  const currentNextSha = capture('git', ['rev-parse', 'origin/next'], repoRoot);
  const canFastForward =
    currentNextSha === promotedNextSha &&
    isAncestor('origin/next', mainSha, repoRoot);

  run('pnpm', ['exec', 'changeset', 'pre', 'enter', 'next'], repoRoot);
  run('git', ['config', 'user.name', 'github-actions[bot]'], repoRoot);
  run(
    'git',
    [
      'config',
      'user.email',
      '41898282+github-actions[bot]@users.noreply.github.com',
    ],
    repoRoot,
  );
  run('git', ['add', '.changeset/pre.json'], repoRoot);
  run('git', ['commit', '-m', 'chore: start next prerelease cycle'], repoRoot);

  if (canFastForward) {
    const directPush = spawnSync(
      'git',
      ['push', 'origin', 'HEAD:refs/heads/next'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: process.env,
        stdio: 'inherit',
      },
    );
    if (directPush.status === 0) {
      console.log('Updated next and entered the next prerelease cycle.');
      return;
    }
  }

  console.warn(
    'Next advanced or rejected a direct update; creating a Start next cycle PR instead.',
  );
  run(
    'git',
    ['push', '-u', 'origin', `HEAD:refs/heads/${fallbackBranch}`],
    repoRoot,
  );

  const existingUrl = capture(
    'gh',
    [
      'pr',
      'list',
      '--base',
      'next',
      '--head',
      fallbackBranch,
      '--state',
      'open',
      '--json',
      'url',
      '--jq',
      '.[0].url // ""',
    ],
    repoRoot,
  );
  if (existingUrl) {
    console.log(`Start next cycle PR already exists: ${existingUrl}`);
    return;
  }

  const url = capture(
    'gh',
    [
      'pr',
      'create',
      '--base',
      'next',
      '--head',
      fallbackBranch,
      '--title',
      'chore: start next prerelease cycle',
      '--body',
      'Synchronizes `next` with the stable release and re-enters Changesets prerelease mode using the `next` tag.',
    ],
    repoRoot,
  );
  console.log(`Created Start next cycle PR: ${url}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
