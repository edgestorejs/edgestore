import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './cli';
import {
  account,
  createFixture,
  project,
  projectCreateResult,
} from './testFixture';

describe('init.integration', () => {
  let fixture: ReturnType<typeof createFixture>;
  let temporaryDirectory: string | undefined;

  beforeEach(() => {
    fixture = createFixture();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
      temporaryDirectory = undefined;
    }
  });

  it('links an existing project through non-interactive init', async () => {
    fixture.runtime.io.inputIsTty = false;

    await runCli(
      ['init', '--link', project.basePath, '--without-key'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.repoConfig.config).toEqual({
      account: account.id,
      project: project.basePath,
    });
    expect(fixture.stdout()).toContain(`Linked ${project.name}`);
  });

  it('keeps the project linked when optional bucket setup fails', async () => {
    fixture.runtime.io.inputIsTty = false;
    fixture.createBucket.mockRejectedValueOnce(new Error('bucket unavailable'));

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'init',
        '--link',
        project.basePath,
        '--without-key',
        '--bucket',
        'publicFiles',
        '--bucket-type',
        'file',
        '--public',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.repoConfig.config).toEqual({
      account: account.id,
      project: project.basePath,
    });
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'init_partial_failure',
      details: {
        status: 'partial',
        completedSteps: ['project', 'repository_link'],
        failedStep: 'bucket_creation',
        project: { basePath: project.basePath },
        configPath: '/repo/.edgestore/config.json',
        cause: { code: 'unexpected_error' },
      },
      suggestions: [
        `edgestore --json --api-url https://api-dev.edgestore.dev bucket create publicFiles --type file --public --project ${project.basePath}`,
      ],
    });
  });

  it('validates non-interactive bucket options before creating a project', async () => {
    fixture.runtime.io.inputIsTty = false;

    const exitCode = await runCli(
      ['init', '--new', '--name', 'Marketing Site', '--bucket', 'publicFiles'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.projectCreate).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('Bucket type must be file or image.');
  });

  it('delivers new-project keys to an ignored env file during init', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'edgestore-cli-'));
    fixture.runtime.cwd = directory;
    fixture.runtime.io.inputIsTty = false;

    try {
      await runCli(
        ['init', '--new', '--name', 'Marketing Site'],
        fixture.runtime,
        '0.0.0',
      );

      expect(await readFile(path.join(directory, '.env.local'), 'utf8')).toBe(
        'EDGE_STORE_ACCESS_KEY=access_test\nEDGE_STORE_SECRET_KEY=secret_test\n',
      );
      expect(await readFile(path.join(directory, '.gitignore'), 'utf8')).toBe(
        '/.env.local\n',
      );
      expect(fixture.repoConfig.config).toEqual({
        account: account.id,
        project: project.basePath,
        envFile: '.env.local',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('honors ignore rules from a nested Git directory', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    const appDirectory = path.join(temporaryDirectory, 'app');
    await mkdir(appDirectory);
    execFileSync('git', ['init', '--quiet'], { cwd: temporaryDirectory });
    await writeFile(path.join(appDirectory, '.gitignore'), '.env.local\n');
    fixture.runtime.cwd = appDirectory;
    fixture.runtime.io.inputIsTty = false;

    const exitCode = await runCli(
      ['init', '--new', '--name', 'Marketing Site'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    await expect(
      readFile(path.join(temporaryDirectory, '.gitignore'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      readFile(path.join(appDirectory, '.gitignore'), 'utf8'),
    ).resolves.toBe('.env.local\n');
  });

  it('protects the env file before creating a remote project', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.runtime.io.inputIsTty = false;
    fixture.createProject.mockImplementationOnce(async () => {
      await expect(
        readFile(path.join(temporaryDirectory!, '.gitignore'), 'utf8'),
      ).resolves.toBe('/.env.local\n');
      return projectCreateResult;
    });

    const exitCode = await runCli(
      ['init', '--new', '--name', 'Marketing Site'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
  });

  it('rejects a tracked env file before creating a project', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.runtime.io.inputIsTty = false;
    execFileSync('git', ['init', '--quiet'], { cwd: temporaryDirectory });
    await writeFile(path.join(temporaryDirectory, '.env.local'), 'tracked\n');
    execFileSync('git', ['add', '.env.local'], { cwd: temporaryDirectory });

    const exitCode = await runCli(
      ['init', '--new', '--name', 'Marketing Site', '--update'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.createProject).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('already tracked by Git');
  });

  it('selects and remembers one discovered env file', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await writeFile(
      path.join(temporaryDirectory, '.env.development.local'),
      '',
    );
    await writeFile(path.join(temporaryDirectory, '.env.example'), '');
    const selectEnvFile = vi.fn(async () => '.env.development.local');
    fixture.runtime.prompts.select =
      selectEnvFile as typeof fixture.runtime.prompts.select;

    const exitCode = await runCli(
      ['init', '--link', project.basePath, '--create-key'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.createProjectKey).toHaveBeenCalledWith({
      project: project.basePath,
      name: 'development',
      signal: fixture.runtime.signal,
    });
    expect(selectEnvFile).toHaveBeenCalledWith(
      'Where should EdgeStore save the project key?',
      [
        {
          value: '.env.development.local',
          label: '.env.development.local',
        },
        { value: '.env.local', label: '.env.local' },
      ],
    );
    expect(fixture.repoConfig.config).toEqual({
      account: account.id,
      project: project.basePath,
      envFile: '.env.development.local',
    });
    await expect(
      readFile(path.join(temporaryDirectory, '.gitignore'), 'utf8'),
    ).resolves.toBe('/.env.development.local\n');
  });

  it('rejects an invalid package manifest before remote mutation', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.runtime.io.inputIsTty = false;
    await writeFile(path.join(temporaryDirectory, 'package.json'), '{ nope');

    const exitCode = await runCli(
      ['init', '--new', '--name', 'Marketing Site'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.createProject).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('Invalid package manifest');
  });

  it('preflights init secret output before creating a project', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.runtime.io.inputIsTty = false;
    const outputPath = path.join(temporaryDirectory, '.env.local');
    await writeFile(outputPath, 'EDGE_STORE_ACCESS_KEY=existing\n');

    const exitCode = await runCli(
      ['init', '--new', '--name', 'Marketing Site'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.createProject).not.toHaveBeenCalled();
    await expect(readFile(outputPath, 'utf8')).resolves.toBe(
      'EDGE_STORE_ACCESS_KEY=existing\n',
    );
  });

  it('revokes a raced init key and preserves the new project', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.runtime.io.inputIsTty = false;
    const outputPath = path.join(temporaryDirectory, '.env.local');
    fixture.createProject.mockImplementationOnce(async () => {
      await writeFile(outputPath, 'EDGE_STORE_ACCESS_KEY=raced\n');
      return projectCreateResult;
    });

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'init',
        '--new',
        '--name',
        'Marketing Site',
      ],
      fixture.runtime,
      '0.0.0',
    );

    const rollbackSignal = fixture.revokeProjectKey.mock.calls[0]?.[0].signal;
    const error = JSON.parse(fixture.stderr()).error;
    expect(exitCode).toBe(2);
    expect(fixture.stdout()).toBe('');
    expect(rollbackSignal).toBeDefined();
    expect(rollbackSignal).not.toBe(fixture.runtime.signal);
    expect(error).toMatchObject({
      code: 'secret_delivery_failed',
      details: {
        delivery: {
          rollback: { status: 'succeeded', credentialId: 'key_123' },
        },
        project: { basePath: project.basePath },
      },
      suggestions: [
        'Pass --update to replace the existing values.',
        `edgestore --json --api-url https://api-dev.edgestore.dev init --link ${project.basePath} --create-key --output .env.local`,
      ],
    });
    expect(error.message).toContain(
      `Project ${project.basePath} was preserved.`,
    );
    await expect(readFile(outputPath, 'utf8')).resolves.toBe(
      'EDGE_STORE_ACCESS_KEY=raced\n',
    );
  });

  it('reports exact recovery when init key rollback also fails', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.runtime.io.inputIsTty = false;
    const outputPath = path.join(temporaryDirectory, '.env.local');
    fixture.createProject.mockImplementationOnce(async () => {
      await writeFile(outputPath, 'EDGE_STORE_ACCESS_KEY=raced\n');
      return projectCreateResult;
    });
    fixture.revokeProjectKey.mockRejectedValueOnce(
      new Error('revocation unavailable'),
    );

    const exitCode = await runCli(
      ['--json', 'init', '--new', '--name', 'Marketing Site'],
      fixture.runtime,
      '0.0.0',
    );

    const error = JSON.parse(fixture.stderr()).error;
    expect(exitCode).toBe(2);
    expect(error).toMatchObject({
      code: 'secret_delivery_failed',
      details: {
        delivery: {
          rollback: { status: 'failed', credentialId: 'key_123' },
        },
        project: { basePath: project.basePath },
      },
      suggestions: [
        'Pass --update to replace the existing values.',
        `edgestore --json project key revoke ${project.basePath} key_123 --yes`,
        `edgestore --json init --link ${project.basePath} --create-key --output .env.local`,
      ],
    });
  });

  it('installs packages from the original package directory', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.runtime.io.inputIsTty = false;
    await mkdir(path.join(temporaryDirectory, '.git'));
    await writeFile(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({
        packageManager: 'pnpm@11.15.1',
        dependencies: { next: '16' },
      }),
    );

    const exitCode = await runCli(
      ['init', '--link', project.basePath, '--without-key', '--install'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.runCommand).toHaveBeenCalledWith(
      'pnpm',
      ['add', '@edgestore/server', '@edgestore/react'],
      { cwd: temporaryDirectory },
    );
  });

  it('uses pnpm workspace-root mode for the selected root', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.runtime.io.inputIsTty = false;
    await mkdir(path.join(temporaryDirectory, '.git'));
    await writeFile(
      path.join(temporaryDirectory, 'pnpm-workspace.yaml'),
      "packages:\n  - 'apps/*'\n",
    );
    await writeFile(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({
        packageManager: 'pnpm@11.15.1',
        dependencies: { next: '16' },
      }),
    );

    const exitCode = await runCli(
      ['init', '--link', project.basePath, '--without-key', '--install'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.runCommand).toHaveBeenCalledWith(
      'pnpm',
      ['add', '-w', '@edgestore/server', '@edgestore/react'],
      { cwd: temporaryDirectory },
    );
  });

  it('detects, installs, and renders commands for a Git-less workspace package', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.runtime.io.inputIsTty = false;
    await writeFile(
      path.join(temporaryDirectory, 'pnpm-workspace.yaml'),
      "packages:\n  - 'apps/*'\n",
    );
    await writeFile(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({
        name: 'workspace-root',
        private: true,
        packageManager: 'pnpm@11.15.1',
      }),
    );
    const appDirectory = path.join(temporaryDirectory, 'apps', 'web');
    const apiDirectory = path.join(temporaryDirectory, 'apps', 'api');
    await mkdir(path.join(appDirectory, '.edgestore'), { recursive: true });
    await mkdir(apiDirectory, { recursive: true });
    await writeFile(
      path.join(appDirectory, 'package.json'),
      JSON.stringify({ name: 'web', dependencies: { next: '16' } }),
    );
    await writeFile(
      path.join(apiDirectory, 'package.json'),
      JSON.stringify({ name: 'api' }),
    );
    await writeFile(
      path.join(appDirectory, '.edgestore', 'config.json'),
      JSON.stringify({ account: account.id, project: project.basePath }),
    );

    const exitCode = await runCli(
      ['init', '--link', project.basePath, '--without-key', '--install'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.runtime.cwd).toBe(temporaryDirectory);
    expect(fixture.runtime.workspaceCwd).toBe(appDirectory);
    expect(fixture.runCommand).toHaveBeenCalledWith(
      'pnpm',
      ['add', '@edgestore/server', '@edgestore/react'],
      { cwd: appDirectory },
    );

    const deferredFixture = createFixture();
    deferredFixture.runtime.cwd = temporaryDirectory;
    deferredFixture.runtime.io.inputIsTty = false;
    const deferredExitCode = await runCli(
      ['--json', 'init', '--link', project.basePath, '--without-key'],
      deferredFixture.runtime,
      '0.0.0',
    );

    expect(deferredExitCode).toBe(0);
    expect(JSON.parse(deferredFixture.stdout()).install).toEqual({
      command:
        'pnpm --filter ./apps/web add @edgestore/server @edgestore/react',
      cwd: appDirectory,
      ran: false,
    });
  });

  it('keeps package-manager output off structured stdout', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.runtime.io.inputIsTty = false;
    await mkdir(path.join(temporaryDirectory, '.git'));
    await writeFile(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({
        packageManager: 'pnpm@11.15.1',
        dependencies: { next: '16' },
      }),
    );
    fixture.runCommand.mockImplementationOnce(
      async (_command, _args, options) => {
        options?.stdout?.write('package-manager progress\n');
        options?.stderr?.write('package-manager warning\n');
      },
    );

    const exitCode = await runCli(
      [
        '--json',
        'init',
        '--link',
        project.basePath,
        '--without-key',
        '--install',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(fixture.stdout()).project.basePath).toBe(
      project.basePath,
    );
    expect(fixture.stderr()).toContain('package-manager progress');
    expect(fixture.stderr()).toContain('package-manager warning');
    const commandOptions = fixture.runCommand.mock.calls[0]?.[2];
    expect(commandOptions).toMatchObject({
      cwd: temporaryDirectory,
      stdout: expect.anything(),
      stderr: expect.anything(),
    });
    expect(commandOptions?.stdout).toBe(commandOptions?.stderr);
  });

  it('reports durable init state when package installation fails', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-init-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.runtime.io.inputIsTty = false;
    await writeFile(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@10.0.0', dependencies: {} }),
    );
    fixture.runCommand.mockImplementationOnce(
      async (_command, _args, options) => {
        options?.stdout?.write('package-manager stdout\n');
        options?.stderr?.write('package-manager stderr\n');
        throw new Error('install unavailable');
      },
    );

    const exitCode = await runCli(
      [
        '--json',
        'init',
        '--link',
        project.basePath,
        '--without-key',
        '--install',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.repoConfig.config).toEqual({
      account: account.id,
      project: project.basePath,
    });
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'init_partial_failure',
      details: {
        status: 'partial',
        completedSteps: ['project', 'repository_link'],
        failedStep: 'package_install',
        cause: {
          details: {
            diagnostics: 'package-manager stdout\npackage-manager stderr',
          },
        },
      },
      suggestions: ['pnpm add @edgestore/server'],
    });
  });
});
