import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KeyringCredentialStore,
  parseStoredOAuthCredential,
  resolveCredential,
  serializeOAuthCredential,
  type CredentialStore,
  type OAuthCredential,
} from './credentials';

const keyringMocks = vi.hoisted(() => {
  const getPassword = vi.fn<() => Promise<string | null>>();
  const setPassword = vi.fn<(value: string) => Promise<void>>();
  const deleteCredential = vi.fn<() => Promise<boolean>>();

  return {
    getPassword,
    setPassword,
    deleteCredential,
    AsyncEntry: class {
      getPassword() {
        return getPassword();
      }

      setPassword(value: string) {
        return setPassword(value);
      }

      deleteCredential() {
        return deleteCredential();
      }
    },
  };
});

vi.mock('@napi-rs/keyring', () => ({ AsyncEntry: keyringMocks.AsyncEntry }));

beforeEach(() => {
  keyringMocks.getPassword.mockReset().mockResolvedValue(null);
  keyringMocks.setPassword.mockReset().mockResolvedValue(undefined);
  keyringMocks.deleteCredential.mockReset().mockResolvedValue(true);
});

describe('resolveCredential', () => {
  it('prefers EDGESTORE_TOKEN without reading the keychain', async () => {
    const { store, getCredential } = credentialStore('stored');

    await expect(
      resolveCredential(' environment ', store, {
        apiOrigin: 'https://api.edgestore.dev',
      }),
    ).resolves.toEqual({ token: 'environment', source: 'environment' });
    expect(getCredential).not.toHaveBeenCalled();
  });

  it('uses the keychain when the environment token is absent', async () => {
    const { store, getCredential } = credentialStore(' stored ');

    await expect(
      resolveCredential(undefined, store, {
        apiOrigin: 'https://api-dev.edgestore.dev',
      }),
    ).resolves.toEqual({ token: 'stored', source: 'keychain' });
    expect(getCredential).toHaveBeenCalledWith('https://api-dev.edgestore.dev');
  });

  it('uses an unexpired OAuth access token without refreshing it', async () => {
    const credential = oauthCredential({ expiresAt: 1_000_000 });
    const { store } = credentialStore(serializeOAuthCredential(credential));
    const refresh = vi.fn();
    const revoke = vi.fn();

    await expect(
      resolveCredential(undefined, store, {
        apiOrigin: 'https://api.edgestore.dev',
        oauth: { refresh, revoke },
        signal: new AbortController().signal,
        now: () => 1,
      }),
    ).resolves.toEqual({ token: 'oauth_access', source: 'oauth' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes an expiring OAuth login and stores rotated tokens', async () => {
    const credential = oauthCredential({ expiresAt: 1_000 });
    const refreshed = oauthCredential({
      accessToken: 'oauth_access_new',
      refreshToken: 'oauth_refresh_new',
      expiresAt: 1_000_000,
    });
    const { store, setCredential } = credentialStore(
      serializeOAuthCredential(credential),
    );
    const refresh = vi.fn(async () => refreshed);
    const revoke = vi.fn(async () => undefined);

    await expect(
      resolveCredential(undefined, store, {
        apiOrigin: 'https://api.edgestore.dev',
        oauth: { refresh, revoke },
        signal: new AbortController().signal,
        now: () => 1,
      }),
    ).resolves.toEqual({ token: 'oauth_access_new', source: 'oauth' });
    expect(refresh).toHaveBeenCalledWith(credential, expect.any(AbortSignal));
    expect(setCredential).toHaveBeenCalledWith(
      'https://api.edgestore.dev',
      serializeOAuthCredential(refreshed),
    );
    expect(
      parseStoredOAuthCredential(setCredential.mock.calls[0]?.[1]),
    ).toEqual(refreshed);
  });

  it('revokes a rotated OAuth credential when storing it fails', async () => {
    const credential = oauthCredential({ expiresAt: 1_000 });
    const refreshed = oauthCredential({
      accessToken: 'oauth_access_new',
      refreshToken: 'oauth_refresh_new',
      expiresAt: 1_000_000,
    });
    const { store, setCredential } = credentialStore(
      serializeOAuthCredential(credential),
    );
    setCredential.mockRejectedValueOnce(new Error('Keychain is locked'));
    const refresh = vi.fn(async () => refreshed);
    const revoke = vi.fn(async () => undefined);

    await expect(
      resolveCredential(undefined, store, {
        apiOrigin: 'https://api.edgestore.dev',
        oauth: { refresh, revoke },
        signal: new AbortController().signal,
        now: () => 1,
      }),
    ).rejects.toMatchObject({
      code: 'oauth_refresh_storage_failed',
      options: {
        details: {
          status: 'rolled_back',
          refreshedCredentialStored: false,
          oauthGrant: { status: 'revoked' },
        },
      },
    });
    expect(revoke).toHaveBeenCalledWith(refreshed, expect.any(AbortSignal));
  });

  it('reports partial refresh when rotated credential revocation fails', async () => {
    const credential = oauthCredential({ expiresAt: 1_000 });
    const refreshed = oauthCredential({
      accessToken: 'oauth_access_new',
      refreshToken: 'oauth_refresh_new',
      expiresAt: 1_000_000,
    });
    const { store, setCredential } = credentialStore(
      serializeOAuthCredential(credential),
    );
    setCredential.mockRejectedValueOnce(new Error('Keychain is locked'));
    const refresh = vi.fn(async () => refreshed);
    const revoke = vi.fn(async () => {
      throw new Error('Issuer unavailable');
    });

    await expect(
      resolveCredential(undefined, store, {
        apiOrigin: 'https://api.edgestore.dev',
        oauth: { refresh, revoke },
        signal: new AbortController().signal,
        now: () => 1,
      }),
    ).rejects.toMatchObject({
      code: 'oauth_refresh_storage_failed',
      options: {
        details: {
          status: 'partial',
          oauthGrant: { status: 'revocation_failed' },
        },
      },
    });
  });
});

describe('OAuth client cache', () => {
  it('reads a valid cached registration', async () => {
    keyringMocks.getPassword.mockResolvedValueOnce(
      JSON.stringify({
        version: 2,
        clientId: 'client_123',
        issuer: 'https://dashboard.edgestore.dev',
        redirectUri: 'http://127.0.0.1:45678/oauth/callback',
      }),
    );

    await expect(
      new KeyringCredentialStore().getCachedOAuthClient(
        'https://api.edgestore.dev',
      ),
    ).resolves.toMatchObject({ clientId: 'client_123' });
  });

  it.each([
    ['malformed JSON', '{'],
    [
      'an unsupported version',
      JSON.stringify({
        version: 1,
        clientId: 'client_123',
        issuer: 'https://dashboard.edgestore.dev',
        redirectUri: 'http://127.0.0.1:45678/oauth/callback',
      }),
    ],
  ])('treats %s as a cache miss', async (_case, value) => {
    keyringMocks.getPassword.mockResolvedValueOnce(value);

    await expect(
      new KeyringCredentialStore().getCachedOAuthClient(
        'https://api.edgestore.dev',
      ),
    ).resolves.toBeUndefined();
  });

  it('propagates keychain read failures', async () => {
    keyringMocks.getPassword.mockRejectedValueOnce(
      new Error('keychain failed'),
    );

    await expect(
      new KeyringCredentialStore().getCachedOAuthClient(
        'https://api.edgestore.dev',
      ),
    ).rejects.toThrow('keychain failed');
  });
});

function credentialStore(token: string): {
  store: CredentialStore;
  getCredential: ReturnType<typeof vi.fn<CredentialStore['get']>>;
  setCredential: ReturnType<typeof vi.fn<CredentialStore['set']>>;
} {
  const getCredential = vi.fn<CredentialStore['get']>(async () => token);
  const setCredential = vi.fn<CredentialStore['set']>(async () => undefined);
  const store: CredentialStore = {
    get: getCredential,
    set: setCredential,
    delete: vi.fn(async () => true),
    getCachedOAuthClient: vi.fn(async () => undefined),
    setCachedOAuthClient: vi.fn(async () => undefined),
    available: vi.fn(async () => true),
  };
  return { store, getCredential, setCredential };
}

function oauthCredential(
  overrides: Partial<OAuthCredential> = {},
): OAuthCredential {
  return {
    version: 1,
    kind: 'oauth',
    accessToken: 'oauth_access',
    refreshToken: 'oauth_refresh',
    expiresAt: 1_000_000,
    clientId: 'client_123',
    issuer: 'https://dashboard.edgestore.dev',
    resource: 'https://api.edgestore.dev/v2',
    ...overrides,
  };
}
