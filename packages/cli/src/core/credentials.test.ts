import { describe, expect, it, vi } from 'vitest';
import { resolveCredential, type CredentialStore } from './credentials';

describe('resolveCredential', () => {
  it('prefers EDGESTORE_TOKEN without reading the keychain', async () => {
    const { store, getCredential } = credentialStore('stored');

    await expect(
      resolveCredential(' environment ', store, 'https://api.edgestore.dev'),
    ).resolves.toEqual({ token: 'environment', source: 'environment' });
    expect(getCredential).not.toHaveBeenCalled();
  });

  it('uses the keychain when the environment token is absent', async () => {
    const { store, getCredential } = credentialStore(' stored ');

    await expect(
      resolveCredential(undefined, store, 'https://api-dev.edgestore.dev'),
    ).resolves.toEqual({ token: 'stored', source: 'keychain' });
    expect(getCredential).toHaveBeenCalledWith('https://api-dev.edgestore.dev');
  });
});

function credentialStore(token: string): {
  store: CredentialStore;
  getCredential: ReturnType<typeof vi.fn<CredentialStore['get']>>;
} {
  const getCredential = vi.fn<CredentialStore['get']>(async () => token);
  const store: CredentialStore = {
    get: getCredential,
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => true),
    available: vi.fn(async () => true),
  };
  return { store, getCredential };
}
