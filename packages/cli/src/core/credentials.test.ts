import { describe, expect, it, vi } from 'vitest';
import {
  parseStoredOAuthCredential,
  resolveCredential,
  serializeOAuthCredential,
  type CredentialStore,
  type OAuthCredential,
} from './credentials';

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

    await expect(
      resolveCredential(undefined, store, {
        apiOrigin: 'https://api.edgestore.dev',
        oauth: { refresh },
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

    await expect(
      resolveCredential(undefined, store, {
        apiOrigin: 'https://api.edgestore.dev',
        oauth: { refresh },
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
    getOAuthClient: vi.fn(async () => undefined),
    setOAuthClient: vi.fn(async () => undefined),
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
