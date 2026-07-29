import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
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

async function main() {
  const [nextSha] = process.argv.slice(2);
  if (!nextSha || !/^[a-f0-9]{40}$/.test(nextSha)) {
    throw new Error('Expected the exact 40-character next commit SHA.');
  }

  const repoRoot = path.resolve(__dirname, '../..');
  const branch = `release/promote-next-${nextSha}`;
  const title = 'chore: promote next to stable';
  const body = [
    `Promotes the exact \`next\` commit \`${nextSha}\` to a stable release.`,
    '',
    '- Exits Changesets prerelease mode.',
    '- Generates stable package versions and changelogs.',
    '- Verifies the stable release guards and complete test suite.',
    '- Publishes to npm `latest` after this PR is merged.',
    '- Synchronizes `next` and re-enters prerelease mode after publication.',
    '',
    '**Merge this PR with a merge commit.** If `next` advances, CI will require this PR to be regenerated.',
  ].join('\n');

  const existingUrl = capture(
    'gh',
    [
      'pr',
      'list',
      '--base',
      'main',
      '--head',
      branch,
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
    console.log(`Promotion PR already exists: ${existingUrl}`);
    return;
  }

  run('git', ['switch', '-c', branch], repoRoot);
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
  run('git', ['add', '-A'], repoRoot);
  run('git', ['commit', '-m', title], repoRoot);
  run('git', ['push', '-u', 'origin', branch], repoRoot);

  const url = capture(
    'gh',
    [
      'pr',
      'create',
      '--base',
      'main',
      '--head',
      branch,
      '--title',
      title,
      '--body',
      body,
    ],
    repoRoot,
  );
  console.log(`Created promotion PR: ${url}`);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await appendFile(
      summaryPath,
      `## Promotion PR\n\n- ${url}\n- Pinned next commit: \`${nextSha}\`\n`,
      'utf8',
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
