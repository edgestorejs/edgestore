import { beforeEach, describe, expect, it } from 'vitest';
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
    expect(fixture.setOAuthClient).toHaveBeenCalledWith(
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
  });

  it('selects an account authorized by the OAuth grant', async () => {
    fixture.globalConfig.activeAccount = 'acc_unavailable';
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

    expect(fixture.globalConfig.activeAccount).toBe(teamAccount.id);
    expect(fixture.stdout()).toContain('2 scopes across 1 account.');
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
