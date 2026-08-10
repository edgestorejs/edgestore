import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './cli';
import { account, accountToken, createFixture } from './testFixture';

describe('token', () => {
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
        '--api-url',
        'https://api-dev.edgestore.dev',
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
        `edgestore --json --api-url https://api-dev.edgestore.dev token revoke ${accountToken.id} --yes`,
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

  it('creates management tokens with the storage preset', async () => {
    await runCli(
      [
        'token',
        'create',
        '--name',
        'storage access',
        '--preset',
        'storage-management',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.createAccountToken).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'storage access',
        preset: 'storage-management',
      }),
    );
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

  it('rejects conflicting token ownership options', async () => {
    const exitCode = await runCli(
      [
        'token',
        'create',
        '--name',
        'conflicting owner',
        '--user',
        '--account',
        account.id,
        '--preset',
        'deploy',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.stderr()).toContain(
      '--user and --account cannot be used together.',
    );
    expect(fixture.createUserToken).not.toHaveBeenCalled();
    expect(fixture.createAccountToken).not.toHaveBeenCalled();
  });

  it('rejects conflicting token ownership options when listing', async () => {
    const exitCode = await runCli(
      ['token', 'list', '--user', '--account', account.id],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.stderr()).toContain(
      '--user and --account cannot be used together.',
    );
    expect(fixture.listUserTokens).not.toHaveBeenCalled();
    expect(fixture.listAccountTokens).not.toHaveBeenCalled();
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
});
