import { describe, expect, it, vi } from 'vitest';
import { resolveCredential, type CredentialStore } from './credentials';

describe('resolveCredential', () => {
  it('prefers EDGESTORE_TOKEN without reading the keychain', async () => {
    const store = credentialStore('stored');

    await expect(resolveCredential(' environment ', store)).resolves.toEqual({
      token: 'environment',
      source: 'environment',
    });
    expect(store.get).not.toHaveBeenCalled();
  });

  it('uses the keychain when the environment token is absent', async () => {
    const store = credentialStore(' stored ');

    await expect(resolveCredential(undefined, store)).resolves.toEqual({
      token: 'stored',
      source: 'keychain',
    });
  });
});

function credentialStore(token: string): Omit<CredentialStore, 'get'> & {
  get: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn(async () => token),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => true),
    available: vi.fn(async () => true),
  };
}
