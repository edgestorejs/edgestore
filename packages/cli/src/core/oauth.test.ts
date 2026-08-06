import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OAuthCredential } from './credentials';
import { DefaultOAuthService } from './oauth';

const oauthMocks = vi.hoisted(() => {
  const config = {
    clientMetadata: () => ({ client_id: 'client_123' }),
  };
  return {
    config,
    dynamicClientRegistration: vi.fn(async () => config),
    discovery: vi.fn(async () => config),
    buildAuthorizationUrl: vi.fn(
      (_config: unknown, parameters: Record<string, string>) => {
        const url = new URL('https://dashboard.example.test/oauth/authorize');
        url.search = new URLSearchParams(parameters).toString();
        return url;
      },
    ),
    authorizationCodeGrant: vi.fn(async () => ({
      access_token: 'access_123',
      refresh_token: 'refresh_123',
      expires_in: 3_600,
      scope: 'account:read project:read file:write',
    })),
    refreshTokenGrant: vi.fn(async () => ({
      access_token: 'access_456',
      refresh_token: 'refresh_456',
      expires_in: 3_600,
      scope: 'account:read project:read file:write',
    })),
    tokenRevocation: vi.fn(async () => undefined),
  };
});

const callbackMocks = vi.hoisted(() => {
  const close = vi.fn(async () => undefined);
  return {
    close,
    open: vi.fn(async (state: string) => {
      const callbackUrl = new URL('http://127.0.0.1:45678/oauth/callback');
      callbackUrl.searchParams.set('state', state);
      callbackUrl.searchParams.set('code', 'code_123');
      return {
        redirectUri: 'http://127.0.0.1:45678/oauth/callback',
        callback: Promise.resolve(callbackUrl),
        close,
      };
    }),
  };
});

vi.mock('openid-client', () => ({
  customFetch: Symbol.for('openid-client.customFetch'),
  allowInsecureRequests: vi.fn(),
  None: vi.fn(() => vi.fn()),
  randomState: vi.fn(() => 'state_123'),
  randomPKCECodeVerifier: vi.fn(() => 'verifier_123'),
  calculatePKCECodeChallenge: vi.fn(async () => 'challenge_123'),
  dynamicClientRegistration: oauthMocks.dynamicClientRegistration,
  discovery: oauthMocks.discovery,
  buildAuthorizationUrl: oauthMocks.buildAuthorizationUrl,
  authorizationCodeGrant: oauthMocks.authorizationCodeGrant,
  refreshTokenGrant: oauthMocks.refreshTokenGrant,
  tokenRevocation: oauthMocks.tokenRevocation,
}));

vi.mock('./oauthCallback', () => ({
  isReusableOAuthRedirectUri: vi.fn(() => true),
  openOAuthCallbackServer: callbackMocks.open,
}));

describe('OAuth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a native client and requests the advertised API access', async () => {
    const fetchImplementation: typeof fetch = async () =>
      Response.json({
        resource: 'https://api.example.test/v2',
        authorization_servers: ['https://dashboard.example.test'],
        scopes_supported: ['account:read', 'project:read', 'file:write'],
        bearer_methods_supported: ['header'],
      });
    const openUrl = vi.fn(async (_url: string) => undefined);
    const onClientRegistered = vi.fn(async () => undefined);
    const service = new DefaultOAuthService(fetchImplementation);

    const result = await service.login({
      apiOrigin: 'https://api.example.test',
      resource: 'https://api.example.test/v2',
      signal: new AbortController().signal,
      openUrl,
      onClientRegistered,
    });

    expect(oauthMocks.dynamicClientRegistration).toHaveBeenCalledWith(
      new URL('https://dashboard.example.test'),
      expect.objectContaining({
        application_type: 'native',
        redirect_uris: ['http://127.0.0.1:45678/oauth/callback'],
        token_endpoint_auth_method: 'none',
      }),
      expect.any(Function),
      expect.objectContaining({ algorithm: 'oauth2' }),
    );
    const authorizationUrl = new URL(openUrl.mock.calls[0]![0]);
    expect(authorizationUrl.searchParams.get('resource')).toBe(
      'https://api.example.test/v2',
    );
    expect(authorizationUrl.searchParams.get('scope')).toBe(
      'account:read project:read file:write',
    );
    expect(oauthMocks.authorizationCodeGrant).toHaveBeenCalledWith(
      oauthMocks.config,
      expect.any(URL),
      { pkceCodeVerifier: 'verifier_123', expectedState: 'state_123' },
      { resource: 'https://api.example.test/v2' },
    );
    expect(onClientRegistered).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client_123' }),
    );
    expect(onClientRegistered.mock.invocationCallOrder[0]).toBeLessThan(
      openUrl.mock.invocationCallOrder[0]!,
    );
    expect(result).toMatchObject({
      credential: {
        accessToken: 'access_123',
        refreshToken: 'refresh_123',
      },
      client: { clientId: 'client_123' },
    });
    expect(callbackMocks.close).toHaveBeenCalledOnce();
  });

  it('keeps rotated refresh tokens and revokes the latest grant', async () => {
    const service = new DefaultOAuthService();
    const credential = oauthCredential();

    const refreshed = await service.refresh(
      credential,
      new AbortController().signal,
    );
    await service.revoke(refreshed, new AbortController().signal);

    expect(oauthMocks.refreshTokenGrant).toHaveBeenCalledWith(
      oauthMocks.config,
      'refresh_123',
      { resource: 'https://api.example.test/v2' },
    );
    expect(refreshed.refreshToken).toBe('refresh_456');
    expect(oauthMocks.tokenRevocation).toHaveBeenCalledWith(
      oauthMocks.config,
      'refresh_456',
      { token_type_hint: 'refresh_token' },
    );
  });
});

function oauthCredential(): OAuthCredential {
  return {
    version: 1,
    kind: 'oauth',
    accessToken: 'access_123',
    refreshToken: 'refresh_123',
    expiresAt: Date.now() + 60 * 60 * 1_000,
    clientId: 'client_123',
    issuer: 'https://dashboard.example.test',
    resource: 'https://api.example.test/v2',
  };
}
