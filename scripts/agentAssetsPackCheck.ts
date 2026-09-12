import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillAssets } from './agentAssets.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(
  path.join(os.tmpdir(), 'edgestore-skill-pack-'),
);
try {
  execFileSync(
    'pnpm',
    ['--filter', '@edgestore/cli', 'pack', '--pack-destination', directory],
    { cwd: root, stdio: 'pipe' },
  );
  const archives = (await readdir(directory)).filter((file) =>
    file.endsWith('.tgz'),
  );
  assert.equal(archives.length, 1);
  const packed = execFileSync(
    'tar',
    [
      '-xOzf',
      path.join(directory, archives[0]!),
      'package/agent-assets/skills.json',
    ],
    { encoding: 'utf8' },
  );
  assert.deepEqual(JSON.parse(packed), await skillAssets());
  console.log('Verified exact canonical skill bytes in the real CLI tarball.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
