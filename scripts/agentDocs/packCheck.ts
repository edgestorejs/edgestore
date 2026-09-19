import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { packageReferences, repoRoot } from './build';
import { references } from './selection';

// Run after pnpm build. Inspect real tarballs without extracting their paths.
const directory = await mkdtemp(
  path.join(os.tmpdir(), 'edgestore-reference-pack-'),
);
try {
  for (const name of Object.keys(references)) {
    execFileSync(
      'pnpm',
      [
        '--filter',
        `@edgestore/${name}`,
        'pack',
        '--pack-destination',
        directory,
      ],
      {
        cwd: repoRoot,
        stdio: 'pipe',
      },
    );
    const tarballs = (await readdir(directory)).filter(
      (file) => file.startsWith(`edgestore-${name}-`) && file.endsWith('.tgz'),
    );
    assert.equal(tarballs.length, 1, `Expected exactly one ${name} tarball`);
    const tarball = path.join(directory, tarballs[0]!);
    const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
      .trim()
      .split('\n');
    const expected = await packageReferences(name);
    assert.deepEqual(
      entries
        .filter(
          (entry) =>
            entry.startsWith('package/agent-docs/') && !entry.endsWith('/'),
        )
        .sort(),
      [...expected.keys()].map((file) => `package/agent-docs/${file}`).sort(),
    );
    for (const [file, contents] of expected) {
      assert.equal(
        execFileSync('tar', ['-xOzf', tarball, `package/agent-docs/${file}`], {
          encoding: 'utf8',
        }),
        contents,
      );
    }
    assert.ok(entries.includes('package/dist/index.js'));
    console.log(
      `Verified ${name}: ${expected.size} exact-version references in packed artifact`,
    );
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
