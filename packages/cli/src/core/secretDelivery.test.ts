import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deliverEnvSecret } from './secretDelivery';

describe('deliverEnvSecret', () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('creates an env file and refuses to overwrite values by default', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'edgestore-secret-'));
    const file = path.join(directory, '.env.local');

    await deliverEnvSecret(
      directory,
      { EDGE_STORE_ACCESS_KEY: 'access' },
      { output: '.env.local' },
    );

    expect(await readFile(file, 'utf8')).toBe('EDGE_STORE_ACCESS_KEY=access\n');
    await expect(
      deliverEnvSecret(
        directory,
        { EDGE_STORE_ACCESS_KEY: 'next' },
        { output: '.env.local' },
      ),
    ).rejects.toMatchObject({ code: 'secret_output_exists' });
  });

  it('updates existing values and preserves unrelated lines', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'edgestore-secret-'));
    const file = path.join(directory, '.env.local');
    await writeFile(file, 'OTHER=value\nEDGE_STORE_ACCESS_KEY=old\n');

    await deliverEnvSecret(
      directory,
      { EDGE_STORE_ACCESS_KEY: 'next' },
      { output: '.env.local', update: true },
    );

    expect(await readFile(file, 'utf8')).toBe(
      'OTHER=value\nEDGE_STORE_ACCESS_KEY=next\n',
    );
  });
});
