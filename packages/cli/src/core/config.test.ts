import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GlobalConfigStore, RepoConfigStore } from './config';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('GlobalConfigStore', () => {
  it('returns an empty versioned config before the file exists', async () => {
    const root = await temporaryDirectory();
    const store = new GlobalConfigStore(path.join(root, 'config.json'));

    await expect(store.read()).resolves.toEqual({ version: 1 });
  });

  it('writes and reads active account state', async () => {
    const root = await temporaryDirectory();
    const configPath = path.join(root, 'nested', 'config.json');
    const store = new GlobalConfigStore(configPath);

    await store.write({ version: 1, activeAccount: 'acc_123' });

    await expect(store.read()).resolves.toEqual({
      version: 1,
      activeAccount: 'acc_123',
    });
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({
      version: 1,
      activeAccount: 'acc_123',
    });
  });
});

describe('RepoConfigStore', () => {
  it('writes at the Git root and discovers the config from a child', async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, '.git'), 'gitdir: elsewhere\n');
    const child = path.join(root, 'apps', 'web');
    await mkdir(child, { recursive: true });
    const store = new RepoConfigStore(child);

    const configPath = await store.write({
      account: 'acc_123',
      project: 'x36t1ejdlz',
    });

    expect(configPath).toBe(path.join(root, '.edgestore', 'config.json'));
    await expect(store.read()).resolves.toEqual({
      config: { account: 'acc_123', project: 'x36t1ejdlz' },
      path: configPath,
    });
  });

  it('removes only the local config', async () => {
    const root = await temporaryDirectory();
    const store = new RepoConfigStore(root);
    const configPath = await store.write({
      account: 'acc_123',
      project: 'x36t1ejdlz',
    });
    await writeFile(path.join(root, '.edgestore', 'keep.txt'), 'keep');

    await expect(store.remove()).resolves.toBe(configPath);
    await expect(
      readFile(path.join(root, '.edgestore', 'keep.txt'), 'utf8'),
    ).resolves.toBe('keep');
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'edgestore-cli-'));
  temporaryDirectories.push(directory);
  return directory;
}
