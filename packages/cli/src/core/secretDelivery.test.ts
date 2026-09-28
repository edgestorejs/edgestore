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
      { EDGESTORE_ACCESS_KEY: 'access' },
      { output: '.env.local' },
    );

    expect(await readFile(file, 'utf8')).toBe('EDGESTORE_ACCESS_KEY=access\n');
    await expect(
      deliverEnvSecret(
        directory,
        { EDGESTORE_ACCESS_KEY: 'next' },
        { output: '.env.local' },
      ),
    ).rejects.toMatchObject({ code: 'secret_output_exists' });
  });

  it('requires --update before overriding legacy credentials', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'edgestore-secret-'));
    const file = path.join(directory, '.env.local');
    const contents = 'export EDGE_STORE_ACCESS_KEY=existing\n';
    await writeFile(file, contents);
    const values = { EDGESTORE_ACCESS_KEY: 'next' };
    const options = { output: '.env.local' };
    await expect(
      preflightEnvSecret(directory, Object.keys(values), options),
    ).rejects.toMatchObject({ code: 'secret_output_exists' });
    await expect(
      deliverEnvSecret(directory, values, options),
    ).rejects.toMatchObject({ code: 'secret_output_exists' });
    expect(await readFile(file, 'utf8')).toBe(contents);
    await deliverEnvSecret(directory, values, { ...options, update: true });
    expect(await readFile(file, 'utf8')).toBe(
      `${contents}EDGESTORE_ACCESS_KEY=next\n`,
    );
  });

  it('updates existing values and preserves unrelated lines', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'edgestore-secret-'));
    const file = path.join(directory, '.env.local');
    await writeFile(file, 'OTHER=value\nEDGESTORE_ACCESS_KEY=old\n');

    await deliverEnvSecret(
      directory,
      { EDGESTORE_ACCESS_KEY: 'next' },
      { output: '.env.local', update: true },
    );

    expect(await readFile(file, 'utf8')).toBe(
      'OTHER=value\nEDGESTORE_ACCESS_KEY=next\n',
    );
  });

  it('replaces every exact duplicate assignment with --update', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'edgestore-secret-'));
    const file = path.join(directory, '.env.local');
    await writeFile(
      file,
      [
        '# keys',
        'export EDGESTORE_ACCESS_KEY=old-one',
        'OTHER=value',
        'EDGESTORE_ACCESS_KEY = old-two',
        'EDGESTORE_ACCESS_KEY_SUFFIX=untouched',
        '',
      ].join('\n'),
    );

    await deliverEnvSecret(
      directory,
      { EDGESTORE_ACCESS_KEY: 'next' },
      { output: '.env.local', update: true },
    );

    expect(await readFile(file, 'utf8')).toBe(
      [
        '# keys',
        'export EDGESTORE_ACCESS_KEY=next',
        'OTHER=value',
        'EDGESTORE_ACCESS_KEY = next',
        'EDGESTORE_ACCESS_KEY_SUFFIX=untouched',
        '',
      ].join('\n'),
    );
  });

  it('preflights existing assignments without changing the file', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'edgestore-secret-'));
    const file = path.join(directory, '.env.local');
    await writeFile(file, 'EDGESTORE_ACCESS_KEY=old\n');

    await expect(
      preflightEnvSecret(directory, ['EDGESTORE_ACCESS_KEY'], {
        output: '.env.local',
      }),
    ).rejects.toMatchObject({ code: 'secret_output_exists' });
    await expect(readFile(file, 'utf8')).resolves.toBe(
      'EDGESTORE_ACCESS_KEY=old\n',
    );
  });

  it('recognizes exported and spaced assignments during preflight', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'edgestore-secret-'));
    const file = path.join(directory, '.env.local');
    const contents = [
      'export EDGESTORE_ACCESS_KEY=old',
      'EDGESTORE_TOKEN = old',
      '',
    ].join('\n');
    await writeFile(file, contents);

    await expect(
      preflightEnvSecret(
        directory,
        ['EDGESTORE_ACCESS_KEY', 'EDGESTORE_TOKEN'],
        { output: '.env.local' },
      ),
    ).rejects.toMatchObject({ code: 'secret_output_exists' });
    await expect(readFile(file, 'utf8')).resolves.toBe(contents);
  });
});
