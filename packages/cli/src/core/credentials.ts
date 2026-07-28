import { CliError } from './errors';

const SERVICE_NAME = 'edgestore-cli';
const CREDENTIAL_NAME = 'management-credential';

export interface CredentialStore {
  get(): Promise<string | undefined>;
  set(token: string): Promise<void>;
  delete(): Promise<boolean>;
  available(): Promise<boolean>;
}

export class KeyringCredentialStore implements CredentialStore {
  async get(): Promise<string | undefined> {
    const entry = await createEntry();
    return (await entry.getPassword()) ?? undefined;
  }

  async set(token: string): Promise<void> {
    const entry = await createEntry();
    await entry.setPassword(token);
  }

  async delete(): Promise<boolean> {
    const entry = await createEntry();
    return entry.deleteCredential();
  }

  async available(): Promise<boolean> {
    try {
      await import('@napi-rs/keyring');
      return true;
    } catch {
      return false;
    }
  }
}

async function createEntry() {
  try {
    const { AsyncEntry } = await import('@napi-rs/keyring');
    return new AsyncEntry(SERVICE_NAME, CREDENTIAL_NAME);
  } catch (error) {
    throw new CliError(
      'keychain_unavailable',
      'The operating system credential store is unavailable.',
      {
        details: error,
        suggestions: [
          'Set EDGESTORE_TOKEN for automation or configure your OS credential store.',
        ],
        exitCode: 2,
      },
    );
  }
}

export type ResolvedCredential = {
  token: string;
  source: 'environment' | 'keychain';
};

export async function resolveCredential(
  envToken: string | undefined,
  store: CredentialStore,
): Promise<ResolvedCredential | undefined> {
  if (envToken?.trim()) {
    return { token: envToken.trim(), source: 'environment' };
  }

  const token = await store.get();
  return token?.trim()
    ? { token: token.trim(), source: 'keychain' }
    : undefined;
}
