import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './cli';
import { CliError } from './core/errors';
import { createFixture, project, projectKey } from './testFixture';

describe('project', () => {
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

  it('links by project ID but stores the canonical base path', async () => {
    await runCli(['project', 'link', project.id], fixture.runtime, '0.0.0');

    expect(fixture.repoConfig.config).toEqual({
      account: 'acc_123',
      project: 'x36t1ejdlz',
    });
    expect(fixture.stdout()).toContain('Marketing Site (x36t1ejdlz)');
  });

  it('creates a project without linking the current directory', async () => {
    await runCli(
      ['project', 'create', '--name', 'Marketing Site'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.repoConfig.config).toBeUndefined();
    expect(fixture.stdout()).toContain('EDGE_STORE_ACCESS_KEY=access_test');
    expect(fixture.stdout()).toContain(
      'You will not be able to view it again.',
    );
  });

  it('rejects plain project creation before creating a one-time key', async () => {
    const exitCode = await runCli(
      ['--plain', 'project', 'create', '--name', 'Marketing Site'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.createProject).not.toHaveBeenCalled();
    expect(fixture.stdout()).toBe('');
    expect(fixture.stderr()).toContain('--without-key');
  });

  it('supports plain project creation without an initial key', async () => {
    const exitCode = await runCli(
      [
        '--plain',
        'project',
        'create',
        '--name',
        'Marketing Site',
        '--without-key',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ createKey: false }),
    );
    expect(fixture.stdout()).toBe(`${project.basePath}\n`);
  });

  it('requires explicit confirmation for non-interactive deletion', async () => {
    fixture.runtime.io.inputIsTty = false;

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'project',
        'delete',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(JSON.parse(fixture.stderr()).error.suggestions).toEqual([
      `edgestore --json --api-url https://api-dev.edgestore.dev project delete ${project.basePath} --yes`,
    ]);
  });

  it('requires --yes for project deletion in plain mode', async () => {
    const exitCode = await runCli(
      ['--plain', 'project', 'delete', project.basePath],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.deleteProject).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('--yes');
  });

  it('deletes the canonical project after typed confirmation', async () => {
    await runCli(['project', 'delete', project.id], fixture.runtime, '0.0.0');

    expect(fixture.confirmTyped).toHaveBeenCalledWith(
      expect.stringContaining(project.basePath),
      project.basePath,
    );
    expect(fixture.stdout()).toContain('Deleted project');
  });

  it('deletes the supplied project reference when forced', async () => {
    await runCli(
      ['--plain', 'project', 'delete', project.id, '--yes'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.deleteProject).toHaveBeenCalledWith({
      project: project.id,
      signal: fixture.runtime.signal,
    });
    expect(fixture.stdout()).toBe(`${project.id}\n`);
  });

  it('creates a project key and exposes its secret once', async () => {
    await runCli(
      ['project', 'key', 'create', project.basePath, '--name', 'production'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain('EDGE_STORE_ACCESS_KEY=access_test');
    expect(fixture.stdout()).toContain('EDGE_STORE_SECRET_KEY=secret_test');
  });

  it('requires a destination for plain project-key creation', async () => {
    const exitCode = await runCli(
      [
        '--plain',
        'project',
        'key',
        'create',
        project.basePath,
        '--name',
        'production',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.createProjectKey).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('--copy or --output');
  });

  it('keeps the key ID on plain stdout when the secret is delivered', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-key-'),
    );
    fixture.runtime.cwd = temporaryDirectory;

    const exitCode = await runCli(
      [
        '--plain',
        'project',
        'key',
        'create',
        project.basePath,
        '--name',
        'production',
        '--output',
        '.env.local',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.stdout()).toBe(`${projectKey.id}\n`);
    await expect(
      readFile(path.join(temporaryDirectory, '.env.local'), 'utf8'),
    ).resolves.toContain('EDGE_STORE_SECRET_KEY=secret_test');
  });

  it('keeps only the replacement key ID on plain rotation stdout', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-key-'),
    );
    fixture.runtime.cwd = temporaryDirectory;

    const exitCode = await runCli(
      [
        '--plain',
        'project',
        'key',
        'rotate',
        project.basePath,
        projectKey.id,
        '--name',
        'replacement',
        '--output',
        '.env.local',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.confirmTyped).toHaveBeenCalledWith(
      expect.stringContaining(projectKey.id),
      'saved',
    );
    expect(fixture.stdout()).toBe(`${projectKey.id}\n`);
  });

  it('keeps a persisted replacement active when rotation is canceled', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-key-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await writeFile(
      path.join(temporaryDirectory, '.env.local'),
      'EDGE_STORE_ACCESS_KEY=access_old\nEDGE_STORE_SECRET_KEY=secret_old\n',
    );
    fixture.createProjectKey.mockResolvedValueOnce({
      key: { ...projectKey, id: 'key_replacement' },
      secretKey: 'secret_test',
    });
    fixture.confirmTyped.mockRejectedValueOnce(
      new CliError('interrupted', 'Operation canceled.', { exitCode: 130 }),
    );

    const exitCode = await runCli(
      [
        '--plain',
        'project',
        'key',
        'rotate',
        project.basePath,
        projectKey.id,
        '--name',
        'replacement',
        '--output',
        '.env.local',
        '--update',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(130);
    expect(fixture.revokeProjectKey).not.toHaveBeenCalled();
    expect(fixture.stdout()).toBe('');
    expect(fixture.stderr()).toContain(
      'Replacement key key_replacement remains active',
    );
    expect(fixture.stderr()).toContain('The old key was not revoked.');
    expect(fixture.stderr()).toContain(
      `edgestore --plain project key revoke ${project.basePath} ${projectKey.id} --yes`,
    );
    await expect(
      readFile(path.join(temporaryDirectory, '.env.local'), 'utf8'),
    ).resolves.toContain('EDGE_STORE_SECRET_KEY=secret_test');
  });

  it('revokes an unpersisted replacement when rotation is canceled', async () => {
    fixture.createProjectKey.mockResolvedValueOnce({
      key: { ...projectKey, id: 'key_replacement' },
      secretKey: 'secret_test',
    });
    fixture.confirmTyped.mockRejectedValueOnce(
      new CliError('interrupted', 'Operation canceled.', { exitCode: 130 }),
    );

    const exitCode = await runCli(
      [
        'project',
        'key',
        'rotate',
        project.basePath,
        projectKey.id,
        '--name',
        'replacement',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(130);
    expect(fixture.revokeProjectKey).toHaveBeenCalledWith({
      project: project.basePath,
      keyId: 'key_replacement',
      signal: expect.objectContaining({ aborted: false }),
    });
    expect(fixture.stderr()).toContain(
      'Operation canceled. The replacement project key was revoked.',
    );
  });

  it('reports manual cleanup when canceled rotation rollback fails', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-key-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.createProjectKey.mockResolvedValueOnce({
      key: { ...projectKey, id: 'key_replacement' },
      secretKey: 'secret_test',
    });
    fixture.confirmTyped.mockRejectedValueOnce(
      new CliError('interrupted', 'Operation canceled.', { exitCode: 130 }),
    );
    fixture.revokeProjectKey.mockRejectedValueOnce(
      new Error('revocation unavailable'),
    );

    const exitCode = await runCli(
      [
        '--api-url',
        'https://api-dev.edgestore.dev',
        'project',
        'key',
        'rotate',
        project.basePath,
        projectKey.id,
        '--name',
        'replacement',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(130);
    expect(fixture.stderr()).toContain(
      `edgestore --api-url https://api-dev.edgestore.dev project key revoke ${project.basePath} key_replacement --yes`,
    );
  });

  it('preserves and quotes rotation options in confirmation recovery', async () => {
    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'project',
        'key',
        'rotate',
        project.basePath,
        projectKey.id,
        '--name',
        'replacement key',
        '--output',
        '.env development',
        '--update',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(JSON.parse(fixture.stderr()).error.suggestions).toEqual([
      `edgestore --json --api-url https://api-dev.edgestore.dev project key rotate ${project.basePath} ${projectKey.id} --name 'replacement key' --output '.env development' --update --yes`,
    ]);
  });

  it('validates a rotation target before creating its replacement', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-key-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.listProjectKeys.mockResolvedValueOnce({ keys: [] });

    const exitCode = await runCli(
      [
        'project',
        'key',
        'rotate',
        project.basePath,
        'missing',
        '--name',
        'replacement',
        '--output',
        '.env.local',
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.createProjectKey).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('was not found');
  });

  it('does not rotate an already revoked project key', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-key-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.listProjectKeys.mockResolvedValueOnce({
      keys: [{ ...projectKey, revokedAt: '2026-02-01T00:00:00.000Z' }],
    });

    const exitCode = await runCli(
      [
        'project',
        'key',
        'rotate',
        project.basePath,
        projectKey.id,
        '--name',
        'replacement',
        '--output',
        '.env.local',
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.createProjectKey).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('already revoked');
  });

  it('revokes a key when delivery fails after preflight', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-key-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.createProjectKey.mockImplementationOnce(async () => {
      await writeFile(
        path.join(temporaryDirectory!, '.env.local'),
        'EDGE_STORE_ACCESS_KEY=raced\n',
      );
      return { key: projectKey, secretKey: 'secret_test' };
    });

    const exitCode = await runCli(
      [
        '--json',
        'project',
        'key',
        'create',
        project.basePath,
        '--name',
        'production',
        '--output',
        '.env.local',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.stdout()).toBe('');
    expect(fixture.revokeProjectKey).toHaveBeenCalledWith(
      expect.objectContaining({
        project: project.basePath,
        keyId: projectKey.id,
        signal: expect.objectContaining({ aborted: false }),
      }),
    );
    expect(JSON.parse(fixture.stderr()).error.details.rollback).toEqual({
      status: 'succeeded',
      credentialId: projectKey.id,
    });
  });

  it('reports the recovery command when delivery rollback fails', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-key-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.createProjectKey.mockImplementationOnce(async () => {
      await writeFile(
        path.join(temporaryDirectory!, '.env.local'),
        'EDGE_STORE_ACCESS_KEY=raced\n',
      );
      return { key: projectKey, secretKey: 'secret_test' };
    });
    fixture.revokeProjectKey.mockRejectedValueOnce(new Error('denied'));

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'project',
        'key',
        'create',
        project.basePath,
        '--name',
        'production',
        '--output',
        '.env.local',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    const error = JSON.parse(fixture.stderr()).error;
    expect(error.details.rollback).toMatchObject({
      status: 'failed',
      credentialId: projectKey.id,
    });
    expect(error.suggestions).toContain(
      `edgestore --json --api-url https://api-dev.edgestore.dev project key revoke ${project.basePath} ${projectKey.id} --yes`,
    );
  });

  it('requires typed confirmation before revoking a project key', async () => {
    await runCli(
      ['project', 'key', 'revoke', project.basePath, 'key_123'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.confirmTyped).toHaveBeenCalledWith(
      expect.stringContaining('last active key'),
      'key_123',
    );
  });

  it('revokes a project key with revoke-only access when forced', async () => {
    fixture.listProjectKeys.mockRejectedValueOnce(new Error('read denied'));

    const exitCode = await runCli(
      ['project', 'key', 'revoke', project.basePath, projectKey.id, '--yes'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.revokeProjectKey).toHaveBeenCalledWith({
      project: project.basePath,
      keyId: projectKey.id,
      signal: fixture.runtime.signal,
    });
  });
});
