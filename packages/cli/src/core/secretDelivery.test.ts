import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deliverEnvSecret, preflightEnvSecret } from './secretDelivery';

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

  it('replaces every exact duplicate assignment with --update', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'edgestore-secret-'));
    const file = path.join(directory, '.env.local');
    await writeFile(
      file,
      [
        '# keys',
        'export EDGE_STORE_ACCESS_KEY=old-one',
        'OTHER=value',
        'EDGE_STORE_ACCESS_KEY = old-two',
        'EDGE_STORE_ACCESS_KEY_SUFFIX=untouched',
        '',
      ].join('\n'),
    );

    await deliverEnvSecret(
      directory,
      { EDGE_STORE_ACCESS_KEY: 'next' },
      { output: '.env.local', update: true },
    );

    expect(await readFile(file, 'utf8')).toBe(
      [
        '# keys',
        'export EDGE_STORE_ACCESS_KEY=next',
        'OTHER=value',
        'EDGE_STORE_ACCESS_KEY = next',
        'EDGE_STORE_ACCESS_KEY_SUFFIX=untouched',
        '',
      ].join('\n'),
    );
  });

  it('preflights existing assignments without changing the file', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'edgestore-secret-'));
    const file = path.join(directory, '.env.local');
    await writeFile(file, 'EDGE_STORE_ACCESS_KEY=old\n');

    await expect(
      preflightEnvSecret(directory, ['EDGE_STORE_ACCESS_KEY'], {
        output: '.env.local',
      }),
    ).rejects.toMatchObject({ code: 'secret_output_exists' });
    await expect(readFile(file, 'utf8')).resolves.toBe(
      'EDGE_STORE_ACCESS_KEY=old\n',
    );
  });

  it('recognizes exported and spaced assignments during preflight', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'edgestore-secret-'));
    const file = path.join(directory, '.env.local');
    const contents = [
      'export EDGE_STORE_ACCESS_KEY=old',
      'EDGESTORE_TOKEN = old',
      '',
    ].join('\n');
    await writeFile(file, contents);

    await expect(
      preflightEnvSecret(
        directory,
        ['EDGE_STORE_ACCESS_KEY', 'EDGESTORE_TOKEN'],
        { output: '.env.local' },
      ),
    ).rejects.toMatchObject({ code: 'secret_output_exists' });
    await expect(readFile(file, 'utf8')).resolves.toBe(contents);
  });
});
