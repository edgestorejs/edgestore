import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  detectPackages,
  renderInstallCommand,
  type PackagePlan,
} from './packageInstall';

describe('detectPackages', () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('prefers local packageManager metadata over a local lockfile', async () => {
    directory = await repository();
    await manifest(directory, { packageManager: 'yarn@4.9.0' });
    await writeFile(path.join(directory, 'package-lock.json'), '{}');

    await expect(detectPackages(directory)).resolves.toMatchObject({
      manager: 'yarn',
    });
  });

  it('lets nearer workspace evidence override ancestor metadata', async () => {
    directory = await repository();
    await manifest(directory, { packageManager: 'pnpm@11.15.1' });
    const workspace = path.join(directory, 'apps', 'web');
    await mkdir(workspace, { recursive: true });
    await manifest(workspace, {});
    await writeFile(path.join(workspace, 'package-lock.json'), '{}');

    await expect(detectPackages(workspace)).resolves.toMatchObject({
      manager: 'npm',
    });
  });

  it('prefers a lockfile over devEngines in the same package', async () => {
    directory = await repository();
    await manifest(directory, {
      devEngines: { packageManager: { name: 'pnpm', version: '11.15.1' } },
    });
    await writeFile(path.join(directory, 'bun.lock'), '');

    await expect(detectPackages(directory)).resolves.toMatchObject({
      manager: 'bun',
    });
  });

  it('stops at the nearest Git root and defaults to npm', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'edgestore-manager-'));
    await manifest(directory, { packageManager: 'yarn@4.9.0' });
    const repositoryRoot = path.join(directory, 'repository');
    const workspace = path.join(repositoryRoot, 'apps', 'web');
    await mkdir(path.join(repositoryRoot, '.git'), { recursive: true });
    await mkdir(workspace, { recursive: true });
    await manifest(workspace, {});

    await expect(detectPackages(workspace)).resolves.toMatchObject({
      manager: 'npm',
    });
  });

  it('reports an invalid package manifest', async () => {
    directory = await repository();
    await writeFile(path.join(directory, 'package.json'), '{ invalid json');

    await expect(detectPackages(directory)).rejects.toMatchObject({
      code: 'invalid_package_manifest',
      message: `Invalid package manifest at ${path.join(directory, 'package.json')}.`,
    });
  });
});

describe('renderInstallCommand', () => {
  const workspace = { root: '/repo', packageName: 'web' };

  it.each([
    {
      manager: 'pnpm' as const,
      args: ['add', '@edgestore/server'],
      expected: 'pnpm --filter ./apps/web add @edgestore/server',
    },
    {
      manager: 'npm' as const,
      args: ['install', '@edgestore/server'],
      expected: 'npm install @edgestore/server --workspace apps/web',
    },
    {
      manager: 'yarn' as const,
      args: ['add', '@edgestore/server'],
      expected: 'yarn workspace web add @edgestore/server',
    },
    {
      manager: 'bun' as const,
      args: ['add', '@edgestore/server'],
      expected: 'bun --cwd apps/web add @edgestore/server',
    },
  ])('renders a $manager workspace command', ({ manager, args, expected }) => {
    const plan: PackagePlan = {
      framework: 'node',
      manager,
      missing: ['@edgestore/server'],
      workspace,
    };

    expect(
      renderInstallCommand(manager, args, {
        plan,
        packageCwd: '/repo/apps/web',
        invocationCwd: '/repo',
      }),
    ).toBe(expected);
  });

  it('falls back to cwd targeting for an unnamed Yarn workspace', () => {
    const plan: PackagePlan = {
      framework: 'node',
      manager: 'yarn',
      missing: ['@edgestore/server'],
      workspace: { root: '/repo' },
    };

    expect(
      renderInstallCommand('yarn', ['add', '@edgestore/server'], {
        plan,
        packageCwd: '/repo/apps/web',
        invocationCwd: '/repo',
      }),
    ).toBe('yarn --cwd apps/web add @edgestore/server');
  });

  it('uses pnpm directory targeting outside the workspace root', () => {
    const plan: PackagePlan = {
      framework: 'node',
      manager: 'pnpm',
      missing: ['@edgestore/server'],
      workspace,
    };

    expect(
      renderInstallCommand('pnpm', ['add', '@edgestore/server'], {
        plan,
        packageCwd: '/repo/apps/web',
        invocationCwd: '/repo/apps/web/src',
      }),
    ).toBe('pnpm --dir .. add @edgestore/server');
  });
});

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'edgestore-manager-'));
  await mkdir(path.join(root, '.git'));
  return root;
}

async function manifest(
  directory: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await writeFile(
    path.join(directory, 'package.json'),
    `${JSON.stringify({ dependencies: {}, ...fields }, null, 2)}\n`,
  );
}
