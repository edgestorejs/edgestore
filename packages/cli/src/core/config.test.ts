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
  it('writes at the nearest package root and discovers it from a child', async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, '.git'), 'gitdir: elsewhere\n');
    await writeFile(path.join(root, 'package.json'), '{}');
    const workspace = path.join(root, 'apps', 'web');
    const child = path.join(workspace, 'src');
    await mkdir(child, { recursive: true });
    await writeFile(path.join(workspace, 'package.json'), '{}');
    const store = new RepoConfigStore(child);

    const configPath = await store.write({
      account: 'acc_123',
      project: 'x36t1ejdlz',
      envFile: '.env.development.local',
    });

    expect(configPath).toBe(path.join(workspace, '.edgestore', 'config.json'));
    await expect(store.read()).resolves.toEqual({
      config: {
        account: 'acc_123',
        project: 'x36t1ejdlz',
        envFile: '.env.development.local',
      },
      path: configPath,
    });
  });

  it('does not inherit the monorepo root config inside a workspace', async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, '.git'), 'gitdir: elsewhere\n');
    await writeFile(path.join(root, 'package.json'), '{}');
    await new RepoConfigStore(root).write({
      account: 'acc_root',
      project: 'root-project',
    });
    const workspace = path.join(root, 'apps', 'web');
    await mkdir(workspace, { recursive: true });
    await writeFile(path.join(workspace, 'package.json'), '{}');

    await expect(
      new RepoConfigStore(workspace).read(),
    ).resolves.toBeUndefined();
  });

  it('falls back to the Git root when no package manifest exists', async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, '.git'), 'gitdir: elsewhere\n');
    const child = path.join(root, 'scripts', 'release');
    await mkdir(child, { recursive: true });
    const store = new RepoConfigStore(child);

    const configPath = await store.write({
      account: 'acc_123',
      project: 'x36t1ejdlz',
    });

    expect(configPath).toBe(path.join(root, '.edgestore', 'config.json'));
    await expect(store.read()).resolves.toMatchObject({
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

  it('does not discover or remove config outside the nearest Git root', async () => {
    const outer = await temporaryDirectory();
    await writeFile(path.join(outer, '.git'), 'gitdir: outer\n');
    const outerStore = new RepoConfigStore(outer);
    const outerConfigPath = await outerStore.write({
      account: 'acc_outer',
      project: 'outer-project',
    });

    const nested = path.join(outer, 'nested');
    const child = path.join(nested, 'apps', 'web');
    await mkdir(child, { recursive: true });
    await writeFile(path.join(nested, '.git'), 'gitdir: nested\n');
    const nestedStore = new RepoConfigStore(child);

    await expect(nestedStore.read()).resolves.toBeUndefined();
    await expect(nestedStore.remove()).resolves.toBeUndefined();
    await expect(readFile(outerConfigPath, 'utf8')).resolves.toContain(
      'outer-project',
    );
  });

  it('discovers the nearest package outside a Git repository', async () => {
    const parent = await temporaryDirectory();
    await writeFile(path.join(parent, 'package.json'), '{}');
    const parentStore = new RepoConfigStore(parent);
    await parentStore.write({
      account: 'acc_parent',
      project: 'parent-project',
    });
    const child = path.join(parent, 'child');
    await mkdir(child);

    await expect(new RepoConfigStore(child).read()).resolves.toMatchObject({
      config: { account: 'acc_parent', project: 'parent-project' },
    });
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'edgestore-cli-'));
  temporaryDirectories.push(directory);
  return directory;
}
