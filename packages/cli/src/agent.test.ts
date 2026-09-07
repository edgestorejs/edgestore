import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from './cli';
import {
  applicationKind,
  inspectApplication,
  versionFamily,
} from './core/application';
import { createFixture } from './testFixture';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function app(dependencies: Record<string, string> = {}) {
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'edgestore-context-')),
  );
  directories.push(directory);
  await mkdir(path.join(directory, '.git'));
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({
      name: 'application',
      packageManager: 'pnpm@11.15.1',
      dependencies,
    }),
  );
  return directory;
}

async function install(
  directory: string,
  name: string,
  version = '1.0.0-next.3',
) {
  const root = path.join(directory, 'node_modules', name);
  await mkdir(path.join(root, 'agent-docs'), { recursive: true });
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name,
      version,
      exports: { './package.json': './package.json', '.': './index.js' },
    }),
  );
  await writeFile(
    path.join(root, 'index.js'),
    'throw new Error("Application modules must not execute");',
  );
  await writeFile(
    path.join(root, 'agent-docs/README.md'),
    `# ${name} ${version}: agent references\n`,
  );
  return root;
}

describe('agent context', () => {
  it('reports actual application packages without login, mutation or environment values', async () => {
    const directory = await app({ next: '16', '@edgestore/server': '^1.0.0' });
    const installed = await install(directory, '@edgestore/server');
    await writeFile(
      path.join(directory, '.env.local'),
      'EDGE_STORE_SECRET_KEY=secret-sentinel',
    );
    const fixture = createFixture();
    fixture.runtime.setCwd(directory);
    fixture.repoConfig.config = {
      project: 'project-test',
      account: 'account-test',
      envFile: '.env.local',
    };
    expect(
      await runCli(['agent', 'context', '--json'], fixture.runtime, '9.0.0'),
    ).toBe(0);
    const context = JSON.parse(fixture.stdout());
    expect(context).toMatchObject({
      schemaVersion: 1,
      cliVersion: '9.0.0',
      application: {
        framework: 'next',
        role: 'fullstack',
        packageManager: 'pnpm',
        compatibility: 'v1',
      },
    });
    expect(context.application.packages[0]).toMatchObject({
      name: '@edgestore/server',
      version: '1.0.0-next.3',
      docs: {
        kind: 'bundled',
        path: path.join(installed, 'agent-docs/README.md'),
      },
    });
    expect(context.project.project).toBe('project-test');
    expect(fixture.stdout() + fixture.stderr()).not.toContain(
      'secret-sentinel',
    );
    expect(fixture.oauthLogin).not.toHaveBeenCalled();
    expect(fixture.runtime.sdkFactory).not.toHaveBeenCalled();
    expect(fixture.repoConfig.config).toEqual({
      project: 'project-test',
      account: 'account-test',
      envFile: '.env.local',
    });
    expect(
      await readFile(path.join(directory, '.env.local'), 'utf8'),
    ).toContain('secret-sentinel');
  });

  it('does not mistake undeclared hoisted/transitive packages for application dependencies', async () => {
    const directory = await app({ react: '19' });
    await install(directory, '@edgestore/sdk');
    expect((await inspectApplication(directory)).packages).toEqual(
      expect.arrayContaining([
        {
          name: '@edgestore/sdk',
          declaredVersion: undefined,
          version: undefined,
          status: 'not-declared',
        },
      ]),
    );
  });

  it('reports missing installed packages without inventing versions', async () => {
    const directory = await app({ '@edgestore/react': '^1.0.0' });
    expect((await inspectApplication(directory)).packages[1]).toMatchObject({
      status: 'not-resolved',
      version: undefined,
    });
  });

  it('resolves pnpm-style symlinked package roots and rejects mismatched reference versions', async () => {
    const directory = await app({ '@edgestore/react': '1.0.0-next.3' });
    const store = path.join(directory, '.pnpm-store');
    const root = await install(store, '@edgestore/react');
    await mkdir(path.join(directory, 'node_modules/@edgestore'), {
      recursive: true,
    });
    await symlink(
      root,
      path.join(directory, 'node_modules/@edgestore/react'),
      'junction',
    );
    expect((await inspectApplication(directory)).packages[1]).toMatchObject({
      root,
      docs: { kind: 'bundled' },
    });
    await writeFile(
      path.join(root, 'agent-docs/README.md'),
      '# @edgestore/react 2.0.0: agent references\n',
    );
    expect((await inspectApplication(directory)).packages[1]).toMatchObject({
      docs: { kind: 'online-fallback' },
    });
  });

  it('requires selection at an ambiguous root and respects --cwd and nested directories', async () => {
    const directory = await app();
    await writeFile(
      path.join(directory, 'pnpm-workspace.yaml'),
      'packages:\n  - apps/*\n',
    );
    for (const name of ['web', 'api']) {
      await mkdir(path.join(directory, 'apps', name, 'src'), {
        recursive: true,
      });
      await writeFile(
        path.join(directory, 'apps', name, 'package.json'),
        JSON.stringify({
          name,
          dependencies:
            name === 'web' ? { vite: '8', react: '19' } : { hono: '4' },
        }),
      );
    }
    const fixture = createFixture();
    fixture.runtime.setCwd(directory);
    expect(
      await runCli(['agent', 'context', '--json'], fixture.runtime, '1'),
    ).toBe(2);
    expect(JSON.parse(fixture.stdout()).selectionRequired).toBe(true);
    const selected = createFixture();
    selected.runtime.setCwd(directory);
    expect(
      await runCli(
        ['--cwd', 'apps/web/src', 'agent', 'context', '--json'],
        selected.runtime,
        '1',
      ),
    ).toBe(0);
    expect(JSON.parse(selected.stdout()).application).toMatchObject({
      directory: path.join(directory, 'apps/web'),
      framework: 'vite',
      role: 'frontend',
    });
  });

  it('routes legacy and mixed versions explicitly instead of selecting v1 guidance silently', async () => {
    const directory = await app({
      '@edgestore/react': '0.2.2',
      '@edgestore/server': '1.0.0',
    });
    await install(directory, '@edgestore/react', '0.2.2');
    await install(directory, '@edgestore/server', '1.0.0');
    expect((await inspectApplication(directory)).compatibility).toBe('mixed');
    await install(directory, '@edgestore/server', '0.2.2');
    expect(await inspectApplication(directory)).toMatchObject({
      compatibility: 'legacy',
      warnings: expect.arrayContaining([
        expect.stringContaining('maintain 0.2'),
      ]),
    });
  });

  it('does not echo malformed manifest content', async () => {
    const directory = await app();
    await writeFile(
      path.join(directory, 'package.json'),
      '{"password":"secret-sentinel" garbage',
    );
    await expect(inspectApplication(directory)).rejects.toMatchObject({
      code: 'invalid_package_manifest',
      message: expect.not.stringContaining('secret-sentinel'),
    });
  });
});

it.each([
  [
    { '@tanstack/react-start': '1', vite: '8', react: '19' },
    'tanstack-start',
    'fullstack',
  ],
  [{ next: '16', react: '19' }, 'next', 'fullstack'],
  [{ hono: '4' }, 'hono', 'backend'],
  [{ vite: '8', react: '19' }, 'vite', 'frontend'],
  [{ react: '19' }, 'react', 'frontend'],
  [{}, 'unknown', 'unknown'],
] as const)(
  'classifies application dependencies %j',
  (dependencies, framework, role) => {
    expect(applicationKind(dependencies)).toEqual({ framework, role });
  },
);

it.each([
  ['0.2.4', 'legacy'],
  ['1.0.0-next.3', 'v1'],
  ['1.2.3', 'v1'],
  ['2.0.0', 'unsupported'],
  ['workspace:*', 'unsupported'],
])('classifies version %s', (version, expected) => {
  expect(versionFamily(version)).toBe(expected);
});
