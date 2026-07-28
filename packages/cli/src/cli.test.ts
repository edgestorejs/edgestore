import { PassThrough, Readable } from 'node:stream';
import type { ManagementEdgeStoreSdk } from '@edgestore/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('runCli', () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
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
      ['bucket', 'empty', 'publicFiles', '--yes'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain('Job: job_123');
    expect(fixture.stdout()).toContain('empty-status publicFiles');
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
    token: {
      id: 'tok_created',
      name: 'deploy',
      kind: 'ACCOUNT' as const,
      tokenPrefix: 'edge_',
      scopes: ['project:read'],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      lastUsedAt: null,
      revokedAt: null,
      expiresAt: null,
      accountId: account.id,
      userId: null,
    },
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
        create: vi.fn(async () => ({
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
        })),
        delete: vi.fn(async () => ({})),
      },
      projectKeys: {
        list: vi.fn(async () => ({
          keys: [
            {
              id: 'key_123',
              name: 'production',
              accessKey: 'access_test',
              projectId: project.id,
              accountId: account.id,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt,
              revokedAt: null,
            },
          ],
        })),
        create: vi.fn(async () => ({
          key: {
            id: 'key_123',
            name: 'production',
            accessKey: 'access_test',
            projectId: project.id,
            accountId: account.id,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            revokedAt: null,
          },
          secretKey: 'secret_test',
        })),
        revoke: vi.fn(async () => ({})),
      },
      tokens: {
        listAccount: vi.fn(async () => ({ tokens: [] })),
        listUser: vi.fn(async () => ({ tokens: [] })),
        createAccount: createAccountToken,
        createUser: createUserToken,
        revoke: vi.fn(async () => ({})),
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
        create: vi.fn(async () => ({
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
        delete: vi.fn(async () => ({})),
        empty: vi.fn(async () => ({
          jobId: 'job_123',
          bucketId: 'bucket_123',
          status: 'QUEUED',
        })),
        emptyJobs: {
          latest: vi.fn(),
          get: vi.fn(),
          retry: vi.fn(),
        },
      },
    },
  } as unknown as ManagementEdgeStoreSdk;

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
    signal: new AbortController().signal,
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
    globalConfig,
    repoConfig,
    credentials,
    setCredential,
    readToken,
    confirmTyped,
    createAccountToken,
    createUserToken,
    stdout: () => Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: () => Buffer.concat(stderrChunks).toString('utf8'),
  };
}
