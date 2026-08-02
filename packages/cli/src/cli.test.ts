import {
  mkdir,
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
import {
  EdgeStoreAbortError,
  EdgeStoreUploadCleanupError,
  type ManagementEdgeStoreSdk,
} from '@edgestore/sdk';
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

const teamAccount = {
  ...account,
  id: 'acc_team',
  type: 'TEAM',
  displayName: 'EdgeStore',
  memberLimit: 5,
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

const singleUploadRequest = {
  file: { id: 'upload_123' },
  upload: {
    kind: 'single' as const,
    id: 'upload_123',
    signedUrl: 'https://storage.example/upload',
  },
};

const projectCreateResult = {
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

  it('shows usage for the active account', async () => {
    await runCli(['account', 'usage'], fixture.runtime, '0.0.0');

    expect(fixture.stdout()).toContain('Storage: 0/1000 bytes');
    expect(fixture.stdout()).toContain('Projects: 1/3');
  });

  it('leaves a team and switches back to the personal account', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    await runCli(
      ['account', 'leave', '--yes', '--plain'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.accountLeave).toHaveBeenCalledWith({
      account: teamAccount.id,
      signal: fixture.runtime.signal,
    });
    expect(fixture.globalConfig.activeAccount).toBe(account.id);
    expect(fixture.stdout()).toBe(`${account.id}\n`);
  });

  it('preserves API and output context in the account leave confirmation', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;
    fixture.runtime.io.inputIsTty = false;

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'account',
        'leave',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.accountLeave).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error.suggestions).toEqual([
      'edgestore --json --api-url https://api-dev.edgestore.dev account leave --yes',
    ]);
  });

  it('does not leave when the personal fallback cannot be resolved', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;
    fixture.listAccounts.mockRejectedValueOnce(
      new Error('accounts unavailable'),
    );

    const exitCode = await runCli(
      ['account', 'leave', '--yes'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.accountLeave).not.toHaveBeenCalled();
    expect(fixture.globalConfig.activeAccount).toBe(teamAccount.id);
  });

  it('explains that personal accounts do not have members', async () => {
    await runCli(['member', 'list'], fixture.runtime, '0.0.0');

    expect(fixture.stdout()).toContain('Current account is personal.');
    expect(fixture.memberList).not.toHaveBeenCalled();
  });

  it('returns command-specific unavailable results for a personal account', async () => {
    await runCli(['--json', 'member', 'list'], fixture.runtime, '0.0.0');
    expect(JSON.parse(fixture.stdout())).toEqual({
      members: [],
      available: false,
      account,
    });

    fixture = createFixture();
    await runCli(
      ['--json', 'member', 'invitation', 'list'],
      fixture.runtime,
      '0.0.0',
    );
    expect(JSON.parse(fixture.stdout())).toEqual({
      invitations: [],
      available: false,
      account,
    });
    expect(fixture.invitationList).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'invite',
      argv: ['member', 'invite', 'friend@example.com'],
      mutation: 'invitationCreate' as const,
    },
    {
      name: 'role',
      argv: ['member', 'role', 'user_123', 'member'],
      mutation: 'memberUpdate' as const,
    },
    {
      name: 'remove',
      argv: ['member', 'remove', 'user_123', '--yes'],
      mutation: 'memberRemove' as const,
    },
    {
      name: 'invitation revoke',
      argv: ['member', 'invitation', 'revoke', 'inv_123', '--yes'],
      mutation: 'invitationRevoke' as const,
    },
    {
      name: 'invitation resend',
      argv: ['member', 'invitation', 'resend', 'inv_123'],
      mutation: 'invitationResend' as const,
    },
  ])(
    'rejects personal-account $name without output or mutation',
    async (test) => {
      const exitCode = await runCli(
        ['--json', ...test.argv],
        fixture.runtime,
        '0.0.0',
      );

      expect(exitCode).toBe(2);
      expect(fixture.stdout()).toBe('');
      expect(JSON.parse(fixture.stderr()).error).toMatchObject({
        code: 'team_account_required',
      });
      expect(fixture[test.mutation]).not.toHaveBeenCalled();
    },
  );

  it('invites a member to the active team', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    await runCli(
      ['member', 'invite', 'friend@example.com', '--role', 'viewer'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.invitationCreate).toHaveBeenCalledWith({
      account: teamAccount.id,
      email: 'friend@example.com',
      role: 'VIEWER',
      allowOverage: false,
      signal: fixture.runtime.signal,
    });
    expect(fixture.stdout()).toContain('invited');
    expect(fixture.confirmTyped).not.toHaveBeenCalled();
  });

  it('rejects plain member invitations before remote work', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    const exitCode = await runCli(
      ['--plain', 'member', 'invite', 'friend@example.com', '--role', 'viewer'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.listAccounts).not.toHaveBeenCalled();
    expect(fixture.invitationCreate).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('--json');
  });

  it('stops a member invitation batch when canceled', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;
    fixture.invitationCreate.mockImplementationOnce(async () => {
      fixture.abortController.abort();
      throw new EdgeStoreAbortError();
    });

    const exitCode = await runCli(
      [
        '--json',
        'member',
        'invite',
        'one@example.com',
        'two@example.com',
        'three@example.com',
        '--role',
        'viewer',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(130);
    expect(fixture.invitationCreate).toHaveBeenCalledTimes(1);
    expect(fixture.stdout()).toBe('');
    expect(JSON.parse(fixture.stderr()).error.code).toBe('interrupted');
  });

  it('requires --yes for noninteractive owner invitations', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'member',
        'invite',
        'one@example.com',
        'two@example.com',
        '--role',
        'owner',
        '--allow-overage',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.invitationCreate).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error.suggestions).toEqual([
      'edgestore --json --api-url https://api-dev.edgestore.dev member invite one@example.com two@example.com --role owner --allow-overage --yes',
    ]);
  });

  it('uses one --yes to confirm a multi-email owner invitation', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    const exitCode = await runCli(
      [
        'member',
        'invite',
        'one@example.com',
        'two@example.com',
        '--role',
        'owner',
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.invitationCreate).toHaveBeenCalledTimes(2);
    expect(fixture.confirmTyped).not.toHaveBeenCalled();
  });

  it('requires --yes for a noninteractive owner role change', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    const exitCode = await runCli(
      ['--json', 'member', 'role', 'user_123', 'owner'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.memberUpdate).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error.suggestions).toEqual([
      'edgestore --json member role user_123 owner --yes',
    ]);
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
        '.env.local\n',
      );
      expect(fixture.repoConfig.config).toEqual({
        account: account.id,
        project: project.basePath,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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
      ['add', '@edgestore/server', '@edgestore/react', 'zod'],
      { cwd: temporaryDirectory },
    );
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
    expect(fixture.runCommand).toHaveBeenCalledWith(
      'pnpm',
      ['add', '@edgestore/server', '@edgestore/react', 'zod'],
      { cwd: temporaryDirectory, stdout: fixture.runtime.io.stderr },
    );
  });

  it('opens the linked project in the dashboard', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    await runCli(['open', 'project'], fixture.runtime, '0.0.0');

    expect(fixture.openUrl).toHaveBeenCalledWith(
      `https://dashboard.edgestore.dev/projects/${project.basePath}`,
    );
  });

  it('prints dashboard URLs without opening them in plain mode', async () => {
    await runCli(['open', 'billing', '--plain'], fixture.runtime, '0.0.0');

    expect(fixture.openUrl).not.toHaveBeenCalled();
    expect(fixture.stdout()).toBe(
      'https://dashboard.edgestore.dev/settings/billing\n',
    );
  });

  it('keeps the future keys dashboard target out of the live grammar', async () => {
    const exitCode = await runCli(
      ['--json', 'open', 'keys'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.openUrl).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'invalid_open_target',
      suggestions: ['Choose account, billing, or project.'],
    });
  });

  it('prints shell completion scripts', async () => {
    await runCli(['completion', 'fish', '--plain'], fixture.runtime, '0.0.0');

    expect(fixture.stdout()).toContain('complete -c edgestore');
    expect(fixture.stdout()).toContain("-a 'project'");
  });

  it('checks linked project keys without exposing env secrets', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'edgestore-doctor-'));
    fixture.runtime.cwd = directory;
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };
    await writeFile(
      path.join(directory, '.env.local'),
      'EDGE_STORE_ACCESS_KEY=access_test\nEDGE_STORE_SECRET_KEY=do-not-print\n',
    );

    try {
      await runCli(['doctor'], fixture.runtime, '1.2.3');

      expect(fixture.stdout()).toContain('CLI');
      expect(fixture.stdout()).toContain('1.2.3');
      expect(fixture.stdout()).toContain('Linked project');
      expect(fixture.stdout()).not.toContain('do-not-print');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('warns when the configured environment key has been revoked', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'edgestore-doctor-'));
    fixture.runtime.cwd = directory;
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };
    fixture.listProjectKeys.mockResolvedValueOnce({
      keys: [{ ...projectKey, revokedAt: '2026-08-01T00:00:00.000Z' }],
    });
    await writeFile(
      path.join(directory, '.env.local'),
      'EDGE_STORE_ACCESS_KEY=access_test\nEDGE_STORE_SECRET_KEY=secret\n',
    );

    try {
      await runCli(['--json', 'doctor'], fixture.runtime, '1.2.3');

      expect(JSON.parse(fixture.stdout()).checks).toContainEqual({
        name: 'Environment project',
        status: 'warn',
        detail: '.env.local access key has been revoked',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('reports malformed repository config as a failed doctor check', async () => {
    fixture.readRepoConfig.mockRejectedValueOnce(
      new Error('Invalid EdgeStore config at /repo/.edgestore/config.json.'),
    );

    const exitCode = await runCli(
      ['--json', 'doctor'],
      fixture.runtime,
      '1.2.3',
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(fixture.stdout()).checks).toContainEqual({
      name: 'Local config',
      status: 'fail',
      detail: 'Invalid EdgeStore config at /repo/.edgestore/config.json.',
    });
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

  it('reports completed upload status with the canonical URL', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    await runCli(
      ['file', 'upload-status', 'file_123'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain('completed');
    expect(fixture.stdout()).toContain('https://files.example/logo.png');
  });

  it('rejects plain upload before inspecting or uploading files', async () => {
    const exitCode = await runCli(
      [
        '--plain',
        'file',
        'upload',
        'missing.txt',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.uploadFile).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('--json');
  });

  it('reports completed and unattempted files when a later upload fails', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    const paths = ['first.txt', 'second.txt', 'third.txt'];
    await Promise.all(
      paths.map((file) =>
        writeFile(path.join(temporaryDirectory!, file), file),
      ),
    );
    let requestCount = 0;
    fixture.uploadFile.mockImplementation(async () => {
      requestCount += 1;
      if (requestCount === 2) throw new Error('second upload request failed');
      return {
        upload: { id: 'upload_first', status: 'completed' as const },
        file: {
          id: 'upload_first',
          url: 'https://files.example/first.txt',
        },
      };
    });

    const exitCode = await runCli(
      [
        '--json',
        'file',
        'upload',
        ...paths,
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.stdout()).toBe('');
    expect(fixture.uploadFile).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'file_upload_incomplete',
      details: {
        completed: [{ localPath: path.join(temporaryDirectory, 'first.txt') }],
        interruptedPath: path.join(temporaryDirectory, 'second.txt'),
        notAttemptedPaths: [path.join(temporaryDirectory, 'third.txt')],
        cause: { message: 'second upload request failed' },
      },
    });
  });

  it('treats an existing upload path with glob characters literally', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await writeFile(path.join(temporaryDirectory, 'report[1].txt'), 'literal');
    await writeFile(path.join(temporaryDirectory, 'report1.txt'), 'glob');
    const exitCode = await runCli(
      [
        'file',
        'upload',
        'report[1].txt',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.uploadFile).toHaveBeenCalledTimes(1);
    const source = fixture.uploadFile.mock.calls[0]?.[0].source;
    expect(source).toBeInstanceOf(Blob);
    expect((source as Blob).size).toBe(7);
  });

  it('rejects same-size source mutations during upload', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    const sourcePath = path.join(temporaryDirectory, 'source.txt');
    await writeFile(sourcePath, 'upload me');
    fixture.uploadFile.mockImplementationOnce(async (input) => {
      await writeFile(sourcePath, 'UPLOAD ME');
      await (input.source as Blob).arrayBuffer();
      throw new Error('Expected the file-backed Blob read to fail.');
    });

    const exitCode = await runCli(
      [
        '--json',
        'file',
        'upload',
        'source.txt',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(fixture.stderr()).error.code).toBe(
      'upload_source_changed',
    );
  });

  it('reports failed automatic upload cleanup', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await writeFile(path.join(temporaryDirectory, 'source.txt'), 'upload me');
    fixture.abortController.abort();
    fixture.uploadFile.mockRejectedValueOnce(
      new EdgeStoreUploadCleanupError({
        message: 'Automatic cancellation failed.',
        uploadId: 'upload_123',
        uploadCause: new DOMException('aborted', 'AbortError'),
        cleanupCause: new Error('cleanup unavailable'),
      }),
    );

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'file',
        'upload',
        'source.txt',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(130);
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'upload_cleanup_failed',
      details: {
        cause: { code: 'interrupted' },
        cleanup: { status: 'failed', uploadId: 'upload_123' },
      },
      suggestions: [
        `edgestore --json --api-url https://api-dev.edgestore.dev file upload-cancel upload_123 --yes --project ${project.basePath}`,
      ],
    });
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

  it('rejects plain file deletion before deleting files', async () => {
    const exitCode = await runCli(
      [
        '--plain',
        'file',
        'delete',
        'file_123',
        '--project',
        project.basePath,
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.deleteFiles).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('--json');
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

  it('identifies per-file deletion failures in human output', async () => {
    fixture.deleteFiles.mockResolvedValueOnce({
      results: [
        { fileRef: { id: 'file_ok' }, success: true },
        {
          fileRef: { id: 'file_failed' },
          success: false,
          error: {
            code: 'FILE_NOT_DELETABLE',
            message: 'File is already deleted.',
          },
        },
      ],
      successCount: 1,
      failureCount: 1,
    });

    const exitCode = await runCli(
      [
        'file',
        'delete',
        'file_ok',
        'file_failed',
        '--project',
        project.basePath,
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.stdout()).toContain('Deleted 1 file(s); 1 failed.');
    expect(fixture.stdout()).toContain('file_failed: File is already deleted.');
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

  it('deletes a bucket with delete-only access when forced', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };
    fixture.getBucket.mockRejectedValueOnce(new Error('read denied'));

    const exitCode = await runCli(
      ['bucket', 'delete', 'publicFiles', '--yes'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.deleteBucket).toHaveBeenCalledWith({
      project: project.basePath,
      bucket: 'publicFiles',
      signal: fixture.runtime.signal,
    });
  });

  it('validates a token before saving it', async () => {
    await runCli(['login', '--token'], fixture.runtime, '0.0.0');

    expect(fixture.setCredential).toHaveBeenCalledWith(
      'https://api.edgestore.dev',
      'mgmt_test',
    );
    expect(fixture.stdout()).toContain('Logged in as ravi@example.com.');
  });

  it('stores a login for the selected API origin', async () => {
    await runCli(
      ['--api-url', 'https://api-dev.edgestore.dev/v2/', 'login', '--token'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.setCredential).toHaveBeenCalledWith(
      'https://api-dev.edgestore.dev',
      'mgmt_test',
    );
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
  const readRepoConfig = vi.fn(
    async (): Promise<LocatedRepoConfig | undefined> =>
      repoConfig.config
        ? {
            config: { ...repoConfig.config },
            path: '/repo/.edgestore/config.json',
          }
        : undefined,
  );
  const credentialValues = new Map([
    ['https://api.edgestore.dev', 'stored_token'],
    ['https://api-dev.edgestore.dev', 'stored_dev_token'],
  ]);
  const readToken = vi.fn(async () => 'mgmt_test');
  const setCredential = vi.fn(async (apiOrigin: string, token: string) => {
    credentialValues.set(apiOrigin, token);
  });
  const confirmTyped = vi.fn(async () => undefined);
  const availableAccounts: (typeof account | typeof teamAccount)[] = [account];
  const listAccounts = vi.fn(async () => ({
    accounts: [...availableAccounts],
  }));
  const accountLeave = vi.fn(async () => ({}));
  const memberList = vi.fn(async () => ({ members: [] }));
  const memberUpdate = vi.fn(
    async (input: { userId: string; role: string }) => ({
      member: {
        userId: input.userId,
        email: 'member@example.com',
        role: input.role,
      },
    }),
  );
  const memberRemove = vi.fn(async () => ({}));
  const invitationList = vi.fn(async () => ({ invitations: [] }));
  const invitationCreate = vi.fn(async (input: { email: string }) => ({
    invitation: {
      id: 'inv_123',
      accountId: teamAccount.id,
      email: input.email,
      role: 'VIEWER' as const,
      status: 'INITIAL' as const,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  }));
  const openUrl = vi.fn(async () => undefined);
  const runCommand = vi.fn<CliRuntime['runCommand']>(async () => undefined);
  const invitationRevoke = vi.fn(async () => ({}));
  const invitationResend = vi.fn(async () => ({}));
  const credentials: CredentialStore = {
    get: vi.fn(async (apiOrigin) => credentialValues.get(apiOrigin)),
    set: setCredential,
    delete: vi.fn(async (apiOrigin) => {
      return credentialValues.delete(apiOrigin);
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
  const createProject = vi.fn(async () => projectCreateResult);
  const listProjectKeys = vi.fn(async () => ({ keys: [projectKey] }));
  const createProjectKey = vi.fn(async () => ({
    key: projectKey,
    secretKey: 'secret_test',
  }));
  type ProjectKeyRevokeInput = Parameters<
    ManagementEdgeStoreSdk['management']['projectKeys']['revoke']
  >[0];
  const revokeProjectKey = vi.fn(async (_input: ProjectKeyRevokeInput) => ({}));
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
  const getBucket = vi.fn(async () => ({
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
  const deleteBucket = vi.fn(async () => ({}));
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
  type UploadRequestInput = Parameters<
    ManagementEdgeStoreSdk['management']['uploads']['request']
  >[0];
  type UploadFileInput = Parameters<
    ManagementEdgeStoreSdk['management']['uploads']['upload']
  >[0];
  type UploadInput = Parameters<
    ManagementEdgeStoreSdk['management']['uploads']['get']
  >[0];
  const deleteFiles = vi.fn(
    async (_input: DeleteFilesInput): Promise<DeleteFilesResult> => ({
      results: [],
      successCount: 0,
      failureCount: 0,
    }),
  );
  const uploadRequest = vi.fn(
    async (_input: UploadRequestInput) => singleUploadRequest,
  );
  const uploadFile = vi.fn(async (_input: UploadFileInput) => ({
    upload: { id: 'upload_123', status: 'completed' as const },
    file: {
      id: 'upload_123',
      url: 'https://files.example/upload.txt',
    },
  }));
  const uploadCancel = vi.fn(async (_input: UploadInput) => ({
    upload: { id: 'upload_123', status: 'canceled' as const },
  }));
  const uploadGet = vi.fn(async (input: UploadInput) => ({
    upload: { id: input.uploadId, status: 'completed' as const },
    file: {
      id: input.uploadId,
      url:
        input.uploadId === 'file_123'
          ? 'https://files.example/logo.png'
          : 'https://files.example/upload.txt',
    },
  }));
  const completeMultipart = vi.fn(async (_input: UploadInput) => ({}));
  const deleteProject = vi.fn(async () => ({}));
  const sdk = {
    runtime: {
      uploads: {
        upload: vi.fn(),
      },
    },
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
        list: listAccounts,
        get: vi.fn(async ({ account: accountId }: { account: string }) => ({
          account:
            availableAccounts.find((candidate) => candidate.id === accountId) ??
            account,
        })),
        leave: accountLeave,
      },
      members: {
        list: memberList,
        update: memberUpdate,
        remove: memberRemove,
      },
      invitations: {
        list: invitationList,
        create: invitationCreate,
        revoke: invitationRevoke,
        resend: invitationResend,
      },
      projects: {
        list: vi.fn(async () => ({ projects: [project] })),
        get: vi.fn(async () => ({ project })),
        create: createProject,
        delete: deleteProject,
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
        get: getBucket,
        create: createBucket,
        delete: deleteBucket,
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
      uploads: {
        upload: uploadFile,
        request: uploadRequest,
        get: uploadGet,
        cancel: uploadCancel,
        completeMultipart,
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
      read: readRepoConfig,
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
      confirm: vi.fn(async () => false),
      select: vi.fn(async () => {
        throw new Error('Unexpected select prompt');
      }),
      text: vi.fn(async () => {
        throw new Error('Unexpected text prompt');
      }),
    },
    sdkFactory: vi.fn(() => sdk),
    openUrl,
    runCommand,
  };

  return {
    runtime,
    abortController,
    globalConfig,
    repoConfig,
    readRepoConfig,
    credentials,
    setCredential,
    readToken,
    confirmTyped,
    createAccountToken,
    createUserToken,
    availableAccounts,
    listAccounts,
    accountLeave,
    memberList,
    memberUpdate,
    memberRemove,
    invitationList,
    invitationCreate,
    openUrl,
    runCommand,
    invitationRevoke,
    invitationResend,
    listAccountTokens,
    revokeToken,
    createBucket,
    getBucket,
    deleteBucket,
    emptyBucket,
    latestEmptyJob,
    getEmptyJob,
    retryEmptyJob,
    generateAccessUrls,
    deleteFiles,
    uploadFile,
    uploadRequest,
    uploadCancel,
    uploadGet,
    completeMultipart,
    projectCreate: createProject,
    createProject,
    listProjectKeys,
    createProjectKey,
    revokeProjectKey,
    deleteProject,
    stdout: () => Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: () => Buffer.concat(stderrChunks).toString('utf8'),
  };
}
