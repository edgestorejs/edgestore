import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './cli';
import {
  parseStoredOAuthCredential,
  serializeOAuthCredential,
  type OAuthCredential,
} from './core/credentials';
import { account, createFixture, teamAccount } from './testFixture';

describe('auth', () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
  });

  it('logs in through the browser by default', async () => {
    await runCli(['login'], fixture.runtime, '0.0.0');

    expect(fixture.oauthLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        apiOrigin: 'https://api.edgestore.dev',
        resource: 'https://api.edgestore.dev/v2',
      }),
    );
    expect(fixture.openUrl).toHaveBeenCalledWith(
      expect.stringContaining('/oauth/authorize'),
    );
    expect(fixture.setCachedOAuthClient).toHaveBeenCalledWith(
      'https://api.edgestore.dev',
      expect.objectContaining({ clientId: 'oauth_client' }),
    );
    const stored = fixture.setCredential.mock.calls.at(-1)?.[1] as string;
    expect(parseStoredOAuthCredential(stored)).toMatchObject({
      accessToken: 'oauth_access',
      refreshToken: 'oauth_refresh',
    });
    expect(fixture.stdout()).toContain('Logged in as ravi@example.com.');
    expect(fixture.stderr()).toContain(
      'Opening a browser to continue login...',
    );
    expect(fixture.stderr()).toContain(
      'https://dashboard.edgestore.dev/oauth/authorize?client_id=oauth_client',
    );
  });

  it('logs in with a device code without a local callback', async () => {
    await runCli(['login', '--device'], fixture.runtime, '0.0.0');

    expect(fixture.oauthDeviceLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        apiOrigin: 'https://api.edgestore.dev',
        resource: 'https://api.edgestore.dev/v2',
      }),
    );
    expect(fixture.oauthLogin).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('ABCD-EFGH');
    expect(fixture.stderr()).toContain(
      'https://dashboard.edgestore.dev/oauth/device?user_code=ABCD-EFGH',
    );
    expect(fixture.openUrl).toHaveBeenCalledWith(
      'https://dashboard.edgestore.dev/oauth/device?user_code=ABCD-EFGH',
    );
    expect(fixture.setCredential).toHaveBeenCalled();
    expect(fixture.stdout()).toContain('Logged in as ravi@example.com.');
  });

  it('selects an account authorized by the OAuth grant', async () => {
    fixture.globalConfig.activeAccounts['https://api.edgestore.dev'] =
      'acc_unavailable';
    fixture.whoami.mockResolvedValueOnce({
      actor: {
        kind: 'oauth_user',
        subject: 'user_123',
        clientId: 'oauth_client',
        scopes: ['account:read', 'project:read'],
        access: {
          accounts: [{ accountId: teamAccount.id, projects: { mode: 'all' } }],
        },
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
    });

    await runCli(['login'], fixture.runtime, '0.0.0');

    expect(
      fixture.globalConfig.activeAccounts['https://api.edgestore.dev'],
    ).toBe(teamAccount.id);
    expect(fixture.stdout()).toContain('2 scopes across 1 account.');
  });

  it('revokes a new OAuth grant when identity validation fails', async () => {
    fixture.whoami.mockRejectedValueOnce(new Error('API unavailable'));

    const exitCode = await runCli(['login'], fixture.runtime, '0.0.0');

    expect(exitCode).toBe(1);
    expect(fixture.oauthRevoke).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: 'oauth_refresh' }),
      expect.any(AbortSignal),
    );
    expect(fixture.setCredential).not.toHaveBeenCalled();
  });

  it('revokes a new OAuth grant when identity validation is interrupted', async () => {
    fixture.whoami.mockImplementationOnce(async () => {
      fixture.abortController.abort();
      throw fixture.abortController.signal.reason;
    });

    const exitCode = await runCli(['login'], fixture.runtime, '0.0.0');

    expect(exitCode).toBe(130);
    expect(fixture.oauthRevoke).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: 'oauth_refresh' }),
      expect.any(AbortSignal),
    );
    const cleanupSignal = fixture.oauthRevoke.mock.calls[0]?.[1];
    expect(cleanupSignal?.aborted).toBe(false);
  });

  it('reports when a failed OAuth login cannot revoke its new grant', async () => {
    fixture.whoami.mockRejectedValueOnce(new Error('API unavailable'));
    fixture.oauthRevoke.mockRejectedValueOnce(new Error('Issuer unavailable'));

    const exitCode = await runCli(['login'], fixture.runtime, '0.0.0');

    expect(exitCode).toBe(1);
    expect(fixture.stderr()).toContain(
      'Login failed and the new OAuth grant could not be revoked.',
    );
  });

  it.each([
    ['browser', ['login']],
    ['device', ['login', '--device']],
  ])(
    'reports partial %s login when active-account storage fails',
    async (_mode, command) => {
      fixture.runtime.io.inputIsTty = false;
      fixture.globalConfig.activeAccounts['https://api.edgestore.dev'] =
        teamAccount.id;
      fixture.runtime.globalConfig.write = vi.fn(async () => {
        throw new Error('Config is read-only');
      });

      const exitCode = await runCli(command, fixture.runtime, '0.0.0');

      expect(exitCode).toBe(1);
      expect(fixture.setCredential).toHaveBeenCalled();
      expect(fixture.stderr()).toContain(
        'Login succeeded and the credential was stored, but the active account could not be updated.',
      );
    },
  );

  it('reports partial token login when active-account storage fails', async () => {
    fixture.runtime.io.inputIsTty = false;
    fixture.globalConfig.activeAccounts['https://api.edgestore.dev'] =
      teamAccount.id;
    fixture.runtime.globalConfig.write = vi.fn(async () => {
      throw new Error('Config is read-only');
    });

    const exitCode = await runCli(
      ['--json', 'login', '--token'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.setCredential).toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'login_partial_failure',
      details: {
        status: 'partial',
        credentialStored: true,
        activeAccount: { status: 'update_failed' },
      },
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

  it('warns when an environment token shadows a browser login', async () => {
    fixture.runtime.env.EDGESTORE_TOKEN = 'environment_token';
    fixture.globalConfig.activeAccounts['https://api.edgestore.dev'] =
      'acc_existing';

    await runCli(['login'], fixture.runtime, '0.0.0');

    expect(fixture.setCredential).toHaveBeenCalled();
    expect(fixture.stderr()).toContain(
      'EDGESTORE_TOKEN is set, so this stored login is not currently active.',
    );
    expect(
      fixture.globalConfig.activeAccounts['https://api.edgestore.dev'],
    ).toBe('acc_existing');
  });

  it('reports an environment-token override in structured token login', async () => {
    fixture.runtime.env.EDGESTORE_TOKEN = 'environment_token';
    fixture.runtime.io.inputIsTty = false;

    await runCli(['--json', 'login', '--token'], fixture.runtime, '0.0.0');

    expect(JSON.parse(fixture.stdout())).toMatchObject({
      authenticated: true,
      credentialStored: true,
      credentialActive: false,
      environmentTokenActive: true,
    });
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

  it.each(['--json', '--plain'])(
    'does not prompt for a token in %s mode',
    async (outputMode) => {
      const exitCode = await runCli(
        ['login', '--token', outputMode],
        fixture.runtime,
        '0.0.0',
      );

      expect(exitCode).toBe(2);
      expect(fixture.readToken).not.toHaveBeenCalled();
      if (outputMode === '--json') {
        expect(JSON.parse(fixture.stderr()).error.code).toBe(
          'interactive_input_disabled',
        );
      } else {
        expect(fixture.stderr()).toContain(
          'Interactive token input is disabled',
        );
      }
    },
  );

  it.each([
    ['browser', '--json', ['--json', 'login']],
    ['browser', '--plain', ['--plain', 'login']],
    ['device', '--json', ['--json', 'login', '--device']],
    ['device', '--plain', ['--plain', 'login', '--device']],
  ])(
    'rejects %s OAuth login in %s mode before starting OAuth',
    async (_flow, outputMode, command) => {
      const exitCode = await runCli(command, fixture.runtime, '0.0.0');

      expect(exitCode).toBe(2);
      expect(fixture.oauthLogin).not.toHaveBeenCalled();
      expect(fixture.oauthDeviceLogin).not.toHaveBeenCalled();
      expect(fixture.setCachedOAuthClient).not.toHaveBeenCalled();
      if (outputMode === '--json') {
        expect(JSON.parse(fixture.stderr()).error.code).toBe(
          'interactive_input_disabled',
        );
      } else {
        expect(fixture.stderr()).toContain(
          'OAuth login is interactive and cannot be used',
        );
      }
    },
  );

  it('accepts piped token input in plain mode', async () => {
    fixture.runtime.io.inputIsTty = false;

    const exitCode = await runCli(
      ['login', '--token', '--plain'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.readToken).toHaveBeenCalled();
    expect(fixture.stdout()).toBe('ravi@example.com\n');
  });

  it('rejects conflicting login modes', async () => {
    const exitCode = await runCli(
      ['--json', 'login', '--device', '--token'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.oauthDeviceLogin).not.toHaveBeenCalled();
    expect(fixture.readToken).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error.code).toBe(
      'conflicting_login_modes',
    );
  });

  it('revokes an OAuth refresh token before removing the local login', async () => {
    const credential = oauthCredential();
    await fixture.credentials.set(
      'https://api.edgestore.dev',
      serializeOAuthCredential(credential),
    );

    await runCli(['logout'], fixture.runtime, '0.0.0');

    expect(fixture.oauthRevoke).toHaveBeenCalledWith(
      credential,
      fixture.runtime.signal,
    );
    expect(fixture.stdout()).toContain('Logged out.');
  });

  it('removes a malformed OAuth login without attempting revocation', async () => {
    const malformed = serializeOAuthCredential(oauthCredential()).slice(0, -1);
    await fixture.credentials.set('https://api.edgestore.dev', malformed);

    const exitCode = await runCli(['logout'], fixture.runtime, '0.0.0');

    expect(exitCode).toBe(0);
    expect(fixture.oauthRevoke).not.toHaveBeenCalled();
    await expect(
      fixture.credentials.get('https://api.edgestore.dev'),
    ).resolves.toBeUndefined();
    expect(fixture.stderr()).toContain('stored OAuth login is invalid');
    expect(fixture.stdout()).toContain('Logged out.');
  });

  it('keeps JSON output parseable when logout emits a warning', async () => {
    const malformed = serializeOAuthCredential(oauthCredential()).slice(0, -1);
    await fixture.credentials.set('https://api.edgestore.dev', malformed);

    const exitCode = await runCli(
      ['--json', 'logout'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(fixture.stdout())).toMatchObject({ loggedOut: true });
    expect(fixture.stderr()).toBe('');
  });

  it('reports partial logout when remote revocation succeeds but local deletion fails', async () => {
    await fixture.credentials.set(
      'https://api.edgestore.dev',
      serializeOAuthCredential(oauthCredential()),
    );
    fixture.runtime.credentials.delete = vi.fn(async () => {
      throw new Error('Keychain is locked');
    });

    const exitCode = await runCli(
      ['--json', 'logout'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'logout_partial_failure',
      details: {
        status: 'partial',
        oauthGrant: { status: 'revoked' },
        localCredential: { status: 'delete_failed' },
      },
    });
  });

  it('reports both logout failures as one JSON error', async () => {
    await fixture.credentials.set(
      'https://api.edgestore.dev',
      serializeOAuthCredential(oauthCredential()),
    );
    fixture.oauthRevoke.mockRejectedValueOnce(new Error('Issuer unavailable'));
    fixture.runtime.credentials.delete = vi.fn(async () => {
      throw new Error('Keychain is locked');
    });

    const exitCode = await runCli(
      ['--json', 'logout'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'logout_failed',
      details: {
        status: 'failed',
        oauthGrant: { status: 'revocation_failed' },
        localCredential: { status: 'delete_failed' },
      },
    });
  });
});

function oauthCredential(): OAuthCredential {
  return {
    version: 1,
    kind: 'oauth',
    accessToken: 'oauth_access',
    refreshToken: 'oauth_refresh',
    expiresAt: Date.now() + 60 * 60 * 1_000,
    clientId: 'oauth_client',
    issuer: 'https://dashboard.edgestore.dev',
    resource: 'https://api.edgestore.dev/v2',
  };
}
