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
  const credentialValues = new Map([
    ['https://api.edgestore.dev', 'stored_token'],
  ]);
  const readToken = vi.fn(async () => 'mgmt_test');
  const setCredential = vi.fn(async (apiOrigin: string, token: string) => {
    credentialValues.set(apiOrigin, token);
  });
  const credentials: CredentialStore = {
    get: vi.fn(async (apiOrigin) => credentialValues.get(apiOrigin)),
    set: setCredential,
    delete: vi.fn(async (apiOrigin) => {
      return credentialValues.delete(apiOrigin);
    }),
    available: vi.fn(async () => true),
  };

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
    stdout: () => Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: () => Buffer.concat(stderrChunks).toString('utf8'),
  };
}
