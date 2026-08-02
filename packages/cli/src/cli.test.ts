import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import type { ManagementEdgeStoreSdk } from '@edgestore/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './cli';
import type {
  GlobalConfig,
  LocatedRepoConfig,
  RepoConfig,
} from './core/config';
import type { CredentialStore } from './core/credentials';
import type { CliRuntime } from './core/runtime';

const account = {
  id: 'acc_123',
  type: 'PERSONAL',
  displayName: 'ravi@example.com',
  role: 'OWNER',
  planType: 'free',
  projectCount: 1,
  usageBytes: 0,
  storageLimitBytes: 1_000,
  projectLimit: 3,
  memberLimit: 1,
  isPaused: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as const;

const project = {
  id: 'proj_123',
  basePath: 'x36t1ejdlz',
  name: 'Marketing Site',
  accountId: account.id,
  usageBytes: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const projectKey = {
  id: 'key_123',
  name: 'production',
  accessKey: 'access_test',
  projectId: project.id,
  accountId: account.id,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  revokedAt: null as string | null,
};

const accountToken = {
  id: 'tok_created',
  name: 'deploy',
  kind: 'ACCOUNT' as const,
  tokenPrefix: 'edge_',
  scopes: ['project:read'],
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  lastUsedAt: null,
  revokedAt: null as string | null,
  expiresAt: null as string | null,
  accountId: account.id,
  userId: null,
};

const failedEmptyJob = {
  id: 'job_123',
  bucketId: 'bucket_123',
  projectId: project.id,
  accountId: account.id,
  status: 'FAILED' as const,
  phase: 'DELETING_FILES' as const,
  totalCount: 5,
  totalBytes: 500,
  processedCount: 2,
  freedBytes: 200,
  pendingS3CleanupCount: 1,
  canceledUploadCount: 0,
  orphanObjectCount: 1,
  orphanBytes: 20,
  cloudFrontInvalidationId: null,
  error: 'storage unavailable',
  heartbeatAt: project.updatedAt,
  startedAt: project.createdAt,
  completedAt: project.updatedAt,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
};

describe('runCli', () => {
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

  it('renders account lists and marks the active account', async () => {
    const exitCode = await runCli(
      ['account', 'list'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.stdout()).toContain('CURRENT');
    expect(fixture.stdout()).toContain('acc_123');
    expect(fixture.stdout()).toContain('personal');
    expect(fixture.stderr()).toBe('');
  });

  it('preserves SDK response casing in JSON', async () => {
    await runCli(['--json', 'account', 'list'], fixture.runtime, '0.0.0');

    expect(JSON.parse(fixture.stdout())).toEqual({ accounts: [account] });
  });

  it('switches to the personal account without changing remote state', async () => {
    fixture.globalConfig.activeAccount = undefined;

    await runCli(
      ['account', 'switch', 'personal', '--plain'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.globalConfig.activeAccount).toBe('acc_123');
    expect(fixture.stdout()).toBe('acc_123\n');
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
      ['project', 'delete', project.basePath],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
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
      `edgestore project key revoke ${project.basePath} ${projectKey.id} --yes`,
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

  it('creates an account management token with one-time output', async () => {
    await runCli(
      ['token', 'create', '--name', 'deploy', '--preset', 'deploy'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain('EDGESTORE_TOKEN=mgmt_created');
    expect(fixture.stdout()).toContain(
      'You will not be able to view it again.',
    );
    const input = fixture.createAccountToken.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      account: account.id,
      name: 'deploy',
      preset: 'deploy',
    });
    expect(input).not.toHaveProperty('scopes');
  });

  it('requires a destination for plain token creation', async () => {
    const exitCode = await runCli(
      ['--plain', 'token', 'create', '--name', 'deploy', '--preset', 'deploy'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.createAccountToken).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('--copy or --output');
  });

  it('preflights token output before creating the token', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-token-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await writeFile(
      path.join(temporaryDirectory, '.env.local'),
      'EDGESTORE_TOKEN=existing\n',
    );

    const exitCode = await runCli(
      [
        'token',
        'create',
        '--name',
        'deploy',
        '--preset',
        'deploy',
        '--output',
        '.env.local',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.createAccountToken).not.toHaveBeenCalled();
  });

  it('reports a privileged recovery path when token rollback fails', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-token-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.createAccountToken.mockImplementationOnce(async () => {
      await writeFile(
        path.join(temporaryDirectory!, '.env.local'),
        'EDGESTORE_TOKEN=raced\n',
      );
      return { token: accountToken, secret: 'mgmt_created' };
    });
    fixture.revokeToken.mockRejectedValueOnce(new Error('forbidden'));

    const exitCode = await runCli(
      [
        '--json',
        'token',
        'create',
        '--name',
        'deploy',
        '--preset',
        'deploy',
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
      credentialId: accountToken.id,
    });
    expect(error.suggestions).toEqual(
      expect.arrayContaining([
        `edgestore token revoke ${accountToken.id} --yes`,
        expect.stringContaining('token:revoke'),
      ]),
    );
  });

  it('renders revoked, expired, and active token status deterministically', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T00:00:00.000Z'));
    fixture.listAccountTokens.mockResolvedValueOnce({
      tokens: [
        {
          ...accountToken,
          id: 'tok_revoked',
          revokedAt: '2026-07-01T00:00:00.000Z',
          expiresAt: '2026-06-01T00:00:00.000Z',
        },
        {
          ...accountToken,
          id: 'tok_expired',
          expiresAt: '2026-08-01T00:00:00.000Z',
        },
        { ...accountToken, id: 'tok_active' },
      ],
    });

    await runCli(['token', 'list'], fixture.runtime, '0.0.0');

    expect(fixture.stdout()).toContain('tok_revoked');
    expect(fixture.stdout()).toMatch(/tok_revoked.*revoked/);
    expect(fixture.stdout()).toMatch(/tok_expired.*expired/);
    expect(fixture.stdout()).toMatch(/tok_active.*active/);
  });

  it('creates user-owned management tokens from presets', async () => {
    await runCli(
      [
        'token',
        'create',
        '--name',
        'read access',
        '--user',
        '--preset',
        'read-only',
      ],
      fixture.runtime,
      '0.0.0',
    );

    const input = fixture.createUserToken.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      name: 'read access',
      preset: 'read-only',
    });
    expect(input).not.toHaveProperty('account');
    expect(input).not.toHaveProperty('scopes');
  });

  it('forwards repeated explicit token scopes unchanged', async () => {
    await runCli(
      [
        'token',
        'create',
        '--name',
        'custom access',
        '--scope',
        'account:read',
        '--scope',
        'project:read',
      ],
      fixture.runtime,
      '0.0.0',
    );

    const input = fixture.createAccountToken.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      account: account.id,
      name: 'custom access',
      scopes: ['account:read', 'project:read'],
    });
    expect(input).not.toHaveProperty('preset');
  });

  it('rejects conflicting token permission options', async () => {
    const exitCode = await runCli(
      [
        'token',
        'create',
        '--name',
        'conflicting',
        '--preset',
        'deploy',
        '--scope',
        'project:read',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.stderr()).toContain(
      '--preset and --scope cannot be used together.',
    );
    expect(fixture.createAccountToken).not.toHaveBeenCalled();
  });

  it('requires token permissions', async () => {
    const exitCode = await runCli(
      ['token', 'create', '--name', 'missing permissions'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.stderr()).toContain(
      'Token creation requires --preset or at least one --scope.',
    );
    expect(fixture.createAccountToken).not.toHaveBeenCalled();
  });

  it('creates a bucket in the linked project', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    await runCli(
      ['bucket', 'create', 'publicFiles', '--type', 'file', '--public'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain(
      'Created public file bucket publicFiles.',
    );
  });

  it('starts an empty-bucket job and prints its status command', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    await runCli(
      [
        '--api-url',
        'https://api-dev.edgestore.dev',
        'bucket',
        'empty',
        'publicFiles',
        '--project',
        project.basePath,
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain('Job: job_123');
    expect(fixture.stdout()).toContain(
      `edgestore --api-url https://api-dev.edgestore.dev bucket empty-status publicFiles --job job_123 --project ${project.basePath}`,
    );
  });

  it('preserves applicable options in confirmation follow-ups', async () => {
    fixture.runtime.io.inputIsTty = false;

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'bucket',
        'empty',
        'publicFiles',
        '--project',
        project.basePath,
        '--retry',
        'job_old',
        '--wait',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(JSON.parse(fixture.stderr()).error.suggestions).toEqual([
      `edgestore --json --api-url https://api-dev.edgestore.dev bucket empty publicFiles --retry job_old --wait --yes --project ${project.basePath}`,
    ]);
    expect(fixture.emptyBucket).not.toHaveBeenCalled();
  });

  it('emits one structured error when a waited empty job fails', async () => {
    fixture.getEmptyJob.mockResolvedValueOnce({ job: failedEmptyJob });

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'bucket',
        'empty',
        'publicFiles',
        '--project',
        project.basePath,
        '--wait',
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.stdout()).toBe('');
    expect(JSON.parse(fixture.stderr())).toEqual({
      error: {
        code: 'bucket_empty_failed',
        message:
          'Bucket empty job job_123 failed after 2/5 files: storage unavailable.',
        details: { job: failedEmptyJob },
        suggestions: [
          `edgestore --json --api-url https://api-dev.edgestore.dev bucket empty publicFiles --retry job_123 --wait --yes --project ${project.basePath}`,
        ],
      },
    });
  });

  it('reports when a bucket has no empty-bucket job', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    const exitCode = await runCli(
      ['--json', 'bucket', 'empty-status', 'publicFiles'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(fixture.stderr())).toEqual({
      error: {
        code: 'bucket_empty_job_not_found',
        message: 'No empty-bucket job found for publicFiles.',
        suggestions: [
          `edgestore bucket empty publicFiles --project ${project.basePath}`,
        ],
      },
    });
  });

  it('lists files only within the required bucket', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    await runCli(
      ['file', 'list', '--bucket', 'publicFiles'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain('file_123');
    expect(fixture.stdout()).toContain('logo.png');
  });

  it('streams downloads through a restrictive temporary file', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-download-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('first '));
                controller.enqueue(new TextEncoder().encode('second'));
                controller.close();
              },
            }),
          ),
      ),
    );

    const exitCode = await runCli(
      [
        'file',
        'download',
        'file_123',
        '--output',
        'download.txt',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    const outputPath = path.join(temporaryDirectory, 'download.txt');
    expect(exitCode).toBe(0);
    await expect(readFile(outputPath, 'utf8')).resolves.toBe('first second');
    expect((await stat(outputPath)).mode & 0o777).toBe(0o600);
    await expect(readdir(temporaryDirectory)).resolves.toEqual([
      'download.txt',
    ]);
  });

  it('preserves an existing download after a mid-stream failure', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-download-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    const outputPath = path.join(temporaryDirectory, 'download.txt');
    await writeFile(outputPath, 'original');
    let pullCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              pull(controller) {
                pullCount += 1;
                if (pullCount === 1) {
                  controller.enqueue(new TextEncoder().encode('partial'));
                } else {
                  controller.error(new Error('stream failed'));
                }
              },
            }),
          ),
      ),
    );

    const exitCode = await runCli(
      [
        'file',
        'download',
        'file_123',
        '--output',
        'download.txt',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    await expect(readFile(outputPath, 'utf8')).resolves.toBe('original');
    await expect(readdir(temporaryDirectory)).resolves.toEqual([
      'download.txt',
    ]);
  });

  it('removes a partial download after cancellation', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-download-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    const outputPath = path.join(temporaryDirectory, 'download.txt');
    await writeFile(outputPath, 'original');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('partial'));
                fixture.abortController.abort();
              },
            }),
          ),
      ),
    );

    const exitCode = await runCli(
      [
        'file',
        'download',
        'file_123',
        '--output',
        'download.txt',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(130);
    await expect(readFile(outputPath, 'utf8')).resolves.toBe('original');
    await expect(readdir(temporaryDirectory)).resolves.toEqual([
      'download.txt',
    ]);
  });

  it('reports exact partial state when a later delete batch fails', async () => {
    const references = Array.from(
      { length: 201 },
      (_, index) => `file_${index + 1}`,
    );
    let requestCount = 0;
    fixture.deleteFiles.mockImplementation(async (input) => {
      requestCount += 1;
      if (requestCount === 2) throw new Error('second batch failed');
      return {
        results: input.files.map((fileRef) => ({
          fileRef,
          success: true as const,
        })),
        successCount: input.files.length,
        failureCount: 0,
      };
    });

    const exitCode = await runCli(
      [
        '--json',
        'file',
        'delete',
        ...references,
        '--project',
        project.basePath,
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.stdout()).toBe('');
    expect(fixture.deleteFiles).toHaveBeenCalledTimes(2);
    const details = JSON.parse(fixture.stderr()).error.details;
    expect(details.completed.successCount).toBe(100);
    expect(details.completed.results).toHaveLength(100);
    expect(details.uncertainReferences).toEqual(references.slice(100, 200));
    expect(details.notAttemptedReferences).toEqual(references.slice(200));
    expect(details.cause).toMatchObject({
      code: 'unexpected_error',
      message: 'second batch failed',
    });
  });

  it('rejects unsupported bucket types before calling the SDK', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    const exitCode = await runCli(
      ['bucket', 'create', 'archives', '--type', 'video', '--protected'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.createBucket).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('file or image');
  });

  it('validates a token before saving it', async () => {
    await runCli(['login', '--token'], fixture.runtime, '0.0.0');

    expect(fixture.setCredential).toHaveBeenCalledWith('mgmt_test');
    expect(fixture.stdout()).toContain('Logged in as ravi@example.com.');
  });

  it('does not prompt for a token in JSON mode', async () => {
    const exitCode = await runCli(
      ['login', '--token', '--json'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.readToken).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error.code).toBe(
      'interactive_input_disabled',
    );
  });

  it('emits stable JSON errors on stderr', async () => {
    fixture.globalConfig.activeAccount = undefined;

    const exitCode = await runCli(
      ['--json', 'project', 'list'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.stdout()).toBe('');
    expect(JSON.parse(fixture.stderr())).toEqual({
      error: {
        code: 'account_context_required',
        message: 'No active account selected.',
        suggestions: [
          'edgestore account list',
          'edgestore account switch <account-id>',
        ],
      },
    });
  });

  it('rejects conflicting output modes', async () => {
    const exitCode = await runCli(
      ['--json', '--plain', 'account', 'list'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.stderr()).toContain(
      '--json and --plain cannot be used together.',
    );
  });

  it.each([
    {
      name: 'unknown option',
      argv: ['--json', 'account', 'list', '--wat'],
      commanderCode: 'commander.unknownOption',
    },
    {
      name: 'missing argument with a trailing global option',
      argv: ['project', 'link', '--json'],
      commanderCode: 'commander.missingArgument',
    },
  ])(
    'emits one JSON syntax error for $name',
    async ({ argv, commanderCode }) => {
      const exitCode = await runCli(argv, fixture.runtime, '0.0.0');

      expect(exitCode).toBe(2);
      expect(fixture.stdout()).toBe('');
      expect(JSON.parse(fixture.stderr())).toMatchObject({
        error: {
          code: 'invalid_cli_syntax',
          details: { commanderCode },
        },
      });
    },
  );

  it('preserves Commander diagnostics in human mode', async () => {
    const exitCode = await runCli(
      ['account', 'list', '--wat'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.stdout()).toBe('');
    expect(fixture.stderr()).toContain("unknown option '--wat'");
  });

  it.each([
    { argv: ['--help'], expected: 'Usage: edgestore' },
    { argv: ['--version'], expected: '0.0.0' },
  ])(
    'keeps $argv successful and human-readable',
    async ({ argv, expected }) => {
      const exitCode = await runCli(argv, fixture.runtime, '0.0.0');

      expect(exitCode).toBe(0);
      expect(fixture.stdout()).toContain(expected);
      expect(fixture.stderr()).toBe('');
    },
  );
});

function createFixture() {
  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  stdoutStream.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  stderrStream.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

  const globalConfig: GlobalConfig = {
    version: 1,
    activeAccount: account.id,
  };
  const repoConfig: { config?: RepoConfig } = {};
  const credentialValue = { value: 'stored_token' };
  const readToken = vi.fn(async () => 'mgmt_test');
  const setCredential = vi.fn(async (token: string) => {
    credentialValue.value = token;
  });
  const confirmTyped = vi.fn(async () => undefined);
  const credentials: CredentialStore = {
    get: vi.fn(async () => credentialValue.value),
    set: setCredential,
    delete: vi.fn(async () => {
      const existed = Boolean(credentialValue.value);
      credentialValue.value = '';
      return existed;
    }),
    available: vi.fn(async () => true),
  };

  const createAccountToken = vi.fn(async (_input: unknown) => ({
    token: accountToken,
    secret: 'mgmt_created',
  }));
  const createUserToken = vi.fn(async (_input: unknown) => ({
    token: {
      id: 'tok_user_created',
      name: 'read access',
      kind: 'USER' as const,
      tokenPrefix: 'edge_',
      scopes: ['account:read'],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      lastUsedAt: null,
      revokedAt: null,
      expiresAt: null,
      accountId: null,
      userId: 'user_123',
    },
    secret: 'mgmt_user_created',
  }));
  const createProject = vi.fn(async () => ({
    project,
    projectKey: {
      key: {
        id: 'key_123',
        name: 'default',
        accessKey: 'access_test',
        projectId: project.id,
        accountId: account.id,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        revokedAt: null,
      },
      secretKey: 'secret_test',
    },
  }));
  const listProjectKeys = vi.fn(async () => ({ keys: [projectKey] }));
  const createProjectKey = vi.fn(async () => ({
    key: projectKey,
    secretKey: 'secret_test',
  }));
  const revokeProjectKey = vi.fn(async () => ({}));
  const listAccountTokens = vi.fn(async () => ({
    tokens: [] as (typeof accountToken)[],
  }));
  const revokeToken = vi.fn(async () => ({}));
  const createBucket = vi.fn(async () => ({
    bucket: {
      id: 'bucket_123',
      name: 'publicFiles',
      projectId: project.id,
      accountId: account.id,
      type: 'file' as const,
      visibility: 'public' as const,
      usageBytes: 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  }));
  const emptyBucket = vi.fn(async () => ({
    jobId: 'job_123',
    bucketId: 'bucket_123',
    status: 'QUEUED' as const,
  }));
  const latestEmptyJob = vi.fn(async () => ({ job: null }));
  const getEmptyJob = vi.fn();
  const retryEmptyJob = vi.fn();
  const generateAccessUrls = vi.fn(async () => ({
    accessUrls: [
      {
        fileRef: { id: 'file_123' },
        url: 'https://files.example/download',
        expiresAt: null,
        expiresIn: null,
      },
    ],
  }));
  type DeleteFilesInput = Parameters<
    ManagementEdgeStoreSdk['management']['files']['delete']
  >[0];
  type DeleteFilesResult = Awaited<
    ReturnType<ManagementEdgeStoreSdk['management']['files']['delete']>
  >;
  const deleteFiles = vi.fn(
    async (_input: DeleteFilesInput): Promise<DeleteFilesResult> => ({
      results: [],
      successCount: 0,
      failureCount: 0,
    }),
  );
  const sdk = {
    system: {
      health: vi.fn(async () => ({ status: 'ok' })),
    },
    management: {
      whoami: vi.fn(async () => ({
        actor: {
          kind: 'user_token',
          tokenId: 'tok_123',
          scopes: ['account:read', 'project:read'],
          user: {
            id: 'user_123',
            clerkUserId: 'clerk_123',
            accountId: account.id,
            email: 'ravi@example.com',
            username: 'ravi',
            firstName: 'Ravi',
            lastName: null,
            picture: 'https://example.com/ravi.png',
          },
        },
      })),
      accounts: {
        list: vi.fn(async () => ({ accounts: [account] })),
        get: vi.fn(async () => ({ account })),
      },
      projects: {
        list: vi.fn(async () => ({ projects: [project] })),
        get: vi.fn(async () => ({ project })),
        create: createProject,
        delete: vi.fn(async () => ({})),
      },
      projectKeys: {
        list: listProjectKeys,
        create: createProjectKey,
        revoke: revokeProjectKey,
      },
      tokens: {
        listAccount: listAccountTokens,
        listUser: vi.fn(async () => ({ tokens: [] })),
        createAccount: createAccountToken,
        createUser: createUserToken,
        revoke: revokeToken,
      },
      buckets: {
        list: vi.fn(async () => ({ buckets: [] })),
        get: vi.fn(async () => ({
          bucket: {
            id: 'bucket_123',
            name: 'publicFiles',
            projectId: project.id,
            accountId: account.id,
            type: 'file',
            visibility: 'public',
            usageBytes: 0,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          },
        })),
        create: createBucket,
        delete: vi.fn(async () => ({})),
        empty: emptyBucket,
        emptyJobs: {
          latest: latestEmptyJob,
          get: getEmptyJob,
          retry: retryEmptyJob,
        },
      },
      files: {
        list: vi.fn(async () => ({
          files: [
            {
              id: 'file_123',
              url: 'https://files.example/logo.png',
              key: 'publicFiles/_public/logo.png',
              thumbnailUrl: null,
              thumbnailKey: null,
              bucketId: 'bucket_123',
              bucketName: 'publicFiles',
              projectId: project.id,
              accountId: account.id,
              name: 'logo.png',
              path: {},
              metadata: {},
              sizeBytes: 10,
              mimeType: 'image/png',
              state: 'uploaded',
              temporary: false,
              uploadedAt: project.createdAt,
              updatedAt: project.updatedAt,
            },
          ],
          pagination: { limit: 50, nextCursor: null, hasMore: false },
        })),
        lookup: vi.fn(),
        generateAccessUrls,
        delete: deleteFiles,
      },
    },
  } as unknown as ManagementEdgeStoreSdk;

  const abortController = new AbortController();
  const runtime: CliRuntime = {
    exitCode: 0,
    cwd: '/repo',
    env: {},
    io: {
      stdin: Readable.from([]),
      stdout: stdoutStream,
      stderr: stderrStream,
      inputIsTty: true,
      outputIsTty: false,
    },
    signal: abortController.signal,
    globalConfig: {
      path: '/config/edgestore/config.json',
      read: vi.fn(async () => ({ ...globalConfig })),
      write: vi.fn(async (config: GlobalConfig) => {
        Object.assign(globalConfig, config);
      }),
    },
    repoConfig: {
      read: vi.fn(async (): Promise<LocatedRepoConfig | undefined> =>
        repoConfig.config
          ? {
              config: { ...repoConfig.config },
              path: '/repo/.edgestore/config.json',
            }
          : undefined,
      ),
      write: vi.fn(async (config: RepoConfig) => {
        repoConfig.config = config;
        return '/repo/.edgestore/config.json';
      }),
      remove: vi.fn(async () => {
        if (!repoConfig.config) {
          return undefined;
        }
        repoConfig.config = undefined;
        return '/repo/.edgestore/config.json';
      }),
    },
    credentials,
    prompts: {
      readToken,
      confirmTyped,
    },
    sdkFactory: vi.fn(() => sdk),
  };

  return {
    runtime,
    abortController,
    globalConfig,
    repoConfig,
    credentials,
    setCredential,
    readToken,
    confirmTyped,
    createAccountToken,
    createUserToken,
    listAccountTokens,
    revokeToken,
    createBucket,
    emptyBucket,
    latestEmptyJob,
    getEmptyJob,
    retryEmptyJob,
    generateAccessUrls,
    deleteFiles,
    createProject,
    listProjectKeys,
    createProjectKey,
    revokeProjectKey,
    stdout: () => Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: () => Buffer.concat(stderrChunks).toString('utf8'),
  };
}
