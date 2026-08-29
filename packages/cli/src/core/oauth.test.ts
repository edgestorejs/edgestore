import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OAuthCredential } from './credentials';
import { DefaultOAuthService } from './oauth';

const oauthMocks = vi.hoisted(() => {
  class AuthorizationResponseError extends Error {
    constructor(readonly error: string) {
      super('authorization response error');
    }
  }

  class ResponseBodyError extends Error {
    constructor(readonly error: string) {
      super('response body error');
    }
  }

  const config = {
    clientMetadata: () => ({ client_id: 'client_123' }),
  };
  return {
    AuthorizationResponseError,
    ResponseBodyError,
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
    initiateDeviceAuthorization: vi.fn(async () => ({
      device_code: 'device_123',
      user_code: 'ABCD-EFGH',
      verification_uri: 'https://dashboard.example.test/oauth/device',
      verification_uri_complete:
        'https://dashboard.example.test/oauth/device?user_code=ABCD-EFGH',
      expires_in: 600,
    })),
    pollDeviceAuthorizationGrant: vi.fn(async () => ({
      access_token: 'device_access_123',
      refresh_token: 'device_refresh_123',
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
  AuthorizationResponseError: oauthMocks.AuthorizationResponseError,
  ResponseBodyError: oauthMocks.ResponseBodyError,
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
  initiateDeviceAuthorization: oauthMocks.initiateDeviceAuthorization,
  pollDeviceAuthorizationGrant: oauthMocks.pollDeviceAuthorizationGrant,
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
        grant_types: ['authorization_code', 'refresh_token'],
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

  it('registers a callback-free client and completes device login', async () => {
    const fetchImplementation: typeof fetch = async () =>
      Response.json({
        resource: 'https://api.example.test/v2',
        authorization_servers: ['https://dashboard.example.test'],
        scopes_supported: ['account:read', 'project:read', 'file:write'],
      });
    const openUrl = vi.fn(async (_url: string) => undefined);
    const onDeviceAuthorization = vi.fn();
    const onClientRegistered = vi.fn(async () => undefined);
    const signal = new AbortController().signal;
    const service = new DefaultOAuthService(fetchImplementation);

    const result = await service.loginWithDeviceCode({
      apiOrigin: 'https://api.example.test',
      resource: 'https://api.example.test/v2',
      client: {
        version: 2,
        flow: 'browser',
        clientId: 'browser_client',
        issuer: 'https://dashboard.example.test',
        redirectUri: 'http://127.0.0.1:45678/oauth/callback',
      },
      signal,
      openUrl,
      onDeviceAuthorization,
      onClientRegistered,
    });

    expect(oauthMocks.dynamicClientRegistration).toHaveBeenCalledWith(
      new URL('https://dashboard.example.test'),
      expect.objectContaining({
        application_type: 'native',
        redirect_uris: [],
        grant_types: [
          'urn:ietf:params:oauth:grant-type:device_code',
          'refresh_token',
        ],
        response_types: [],
      }),
      expect.any(Function),
      expect.objectContaining({ algorithm: 'oauth2' }),
    );
    expect(oauthMocks.initiateDeviceAuthorization).toHaveBeenCalledWith(
      oauthMocks.config,
      {
        resource: 'https://api.example.test/v2',
        scope: 'account:read project:read file:write',
      },
    );
    expect(onDeviceAuthorization).toHaveBeenCalledWith({
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://dashboard.example.test/oauth/device',
      verificationUriComplete:
        'https://dashboard.example.test/oauth/device?user_code=ABCD-EFGH',
      expiresIn: 600,
    });
    expect(onDeviceAuthorization.mock.invocationCallOrder[0]).toBeLessThan(
      openUrl.mock.invocationCallOrder[0]!,
    );
    expect(oauthMocks.pollDeviceAuthorizationGrant).toHaveBeenCalledWith(
      oauthMocks.config,
      expect.objectContaining({ device_code: 'device_123' }),
      { resource: 'https://api.example.test/v2' },
      { signal },
    );
    expect(onClientRegistered).toHaveBeenCalledWith({
      version: 2,
      flow: 'device',
      clientId: 'client_123',
      issuer: 'https://dashboard.example.test',
    });
    expect(result).toMatchObject({
      credential: {
        accessToken: 'device_access_123',
        refreshToken: 'device_refresh_123',
      },
      client: { version: 2, flow: 'device', clientId: 'client_123' },
    });
  });

  it('re-registers once when a cached client is rejected', async () => {
    oauthMocks.authorizationCodeGrant
      .mockRejectedValueOnce(
        new oauthMocks.AuthorizationResponseError('invalid_client'),
      )
      .mockResolvedValueOnce({
        access_token: 'access_123',
        refresh_token: 'refresh_123',
        expires_in: 3_600,
        scope: 'account:read project:read file:write',
      });
    const onClientRegistered = vi.fn(async () => undefined);
    const openUrl = vi.fn(async () => undefined);
    const service = new DefaultOAuthService(async () =>
      Response.json({
        resource: 'https://api.example.test/v2',
        authorization_servers: ['https://dashboard.example.test'],
        scopes_supported: ['account:read'],
      }),
    );

    const result = await service.login({
      apiOrigin: 'https://api.example.test',
      resource: 'https://api.example.test/v2',
      client: {
        version: 2,
        flow: 'browser',
        clientId: 'stale_client',
        issuer: 'https://dashboard.example.test',
        redirectUri: 'http://127.0.0.1:45678/oauth/callback',
      },
      signal: new AbortController().signal,
      openUrl,
      onClientRegistered,
    });

    expect(oauthMocks.discovery).toHaveBeenCalledOnce();
    expect(oauthMocks.dynamicClientRegistration).toHaveBeenCalledOnce();
    expect(onClientRegistered).toHaveBeenCalledOnce();
    expect(openUrl).toHaveBeenCalledTimes(2);
    expect(callbackMocks.close).toHaveBeenCalledTimes(2);
    expect(result.client.clientId).toBe('client_123');
  });

  it('does not re-register when authorization is denied', async () => {
    oauthMocks.authorizationCodeGrant.mockRejectedValueOnce(
      new oauthMocks.AuthorizationResponseError('access_denied'),
    );
    const service = new DefaultOAuthService(async () =>
      Response.json({
        resource: 'https://api.example.test/v2',
        authorization_servers: ['https://dashboard.example.test'],
        scopes_supported: ['account:read'],
      }),
    );

    await expect(
      service.login({
        apiOrigin: 'https://api.example.test',
        resource: 'https://api.example.test/v2',
        client: {
          version: 2,
          flow: 'browser',
          clientId: 'client_123',
          issuer: 'https://dashboard.example.test',
          redirectUri: 'http://127.0.0.1:45678/oauth/callback',
        },
        signal: new AbortController().signal,
        openUrl: vi.fn(async () => undefined),
      }),
    ).rejects.toMatchObject({ code: 'oauth_login_failed' });

    expect(oauthMocks.dynamicClientRegistration).not.toHaveBeenCalled();
    expect(callbackMocks.open).toHaveBeenCalledOnce();
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
