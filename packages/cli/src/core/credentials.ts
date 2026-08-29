import { z } from 'zod';
import { CliError, normalizeError } from './errors';

const SERVICE_NAME = 'edgestore-cli';
const CREDENTIAL_NAME = 'management-credential';
const OAUTH_CLIENT_NAME = 'oauth-client';
const OAUTH_CREDENTIAL_PREFIX = 'edgestore-oauth:';
const REFRESH_WINDOW_MS = 5 * 60 * 1_000;

const oauthCredentialSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('oauth'),
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.number().int().positive(),
    clientId: z.string().min(1),
    issuer: z.string().url(),
    resource: z.string().url(),
    scope: z.string().optional(),
  })
  .strict();

const oauthClientRegistrationSchema = z
  .object({
    version: z.literal(2),
    clientId: z.string().min(1),
    issuer: z.string().url(),
    redirectUri: z.string().url().optional(),
  })
  .strict();

export type OAuthCredential = z.infer<typeof oauthCredentialSchema>;
export type OAuthClientRegistration = z.infer<
  typeof oauthClientRegistrationSchema
>;

export interface CredentialStore {
  get(apiOrigin: string): Promise<string | undefined>;
  set(apiOrigin: string, token: string): Promise<void>;
  delete(apiOrigin: string): Promise<boolean>;
  getCachedOAuthClient(
    apiOrigin: string,
  ): Promise<OAuthClientRegistration | undefined>;
  setCachedOAuthClient(
    apiOrigin: string,
    client: OAuthClientRegistration,
  ): Promise<void>;
  available(): Promise<boolean>;
}

export class KeyringCredentialStore implements CredentialStore {
  async get(apiOrigin: string): Promise<string | undefined> {
    const entry = await createEntry(CREDENTIAL_NAME, apiOrigin);
    return (await entry.getPassword()) ?? undefined;
  }

  async set(apiOrigin: string, token: string): Promise<void> {
    const entry = await createEntry(CREDENTIAL_NAME, apiOrigin);
    await entry.setPassword(token);
  }

  async delete(apiOrigin: string): Promise<boolean> {
    const entry = await createEntry(CREDENTIAL_NAME, apiOrigin);
    return entry.deleteCredential();
  }

  async getCachedOAuthClient(
    apiOrigin: string,
  ): Promise<OAuthClientRegistration | undefined> {
    const entry = await createEntry(OAUTH_CLIENT_NAME, apiOrigin);
    const value = await entry.getPassword();
    if (!value) return undefined;

    return parseCachedOAuthClientRegistration(value);
  }

  async setCachedOAuthClient(
    apiOrigin: string,
    client: OAuthClientRegistration,
  ): Promise<void> {
    const entry = await createEntry(OAUTH_CLIENT_NAME, apiOrigin);
    await entry.setPassword(JSON.stringify(client));
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

async function createEntry(name: string, apiOrigin: string) {
  try {
    const { AsyncEntry } = await import('@napi-rs/keyring');
    return new AsyncEntry(SERVICE_NAME, `${name}:${apiOrigin}`);
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
  source: 'environment' | 'keychain' | 'oauth';
};

type OAuthCredentialLifecycle = {
  refresh(
    credential: OAuthCredential,
    signal: AbortSignal,
  ): Promise<OAuthCredential>;
  revoke(credential: OAuthCredential, signal: AbortSignal): Promise<void>;
};

export async function resolveCredential(
  envToken: string | undefined,
  store: CredentialStore,
  options: {
    apiOrigin: string;
    oauth?: OAuthCredentialLifecycle;
    signal?: AbortSignal;
    now?: () => number;
  },
): Promise<ResolvedCredential | undefined> {
  if (envToken?.trim()) {
    return { token: envToken.trim(), source: 'environment' };
  }

  const stored = await store.get(options.apiOrigin);
  if (!stored?.trim()) return undefined;

  const credential = parseStoredCredential(stored.trim());
  if (typeof credential === 'string') {
    return { token: credential, source: 'keychain' };
  }

  const now = options?.now?.() ?? Date.now();
  if (credential.expiresAt > now + REFRESH_WINDOW_MS) {
    return { token: credential.accessToken, source: 'oauth' };
  }
  if (!options?.oauth || !options.signal) {
    throw invalidStoredCredential(
      'The stored OAuth login has expired and cannot be refreshed.',
    );
  }

  const refreshed = await options.oauth.refresh(credential, options.signal);
  try {
    await store.set(options.apiOrigin, serializeOAuthCredential(refreshed));
  } catch (error) {
    const storage = normalizeError(error);
    let cleanup;
    try {
      await options.oauth.revoke(refreshed, AbortSignal.timeout(10_000));
    } catch (cleanupError) {
      cleanup = normalizeError(cleanupError);
    }
    throw new CliError(
      'oauth_refresh_storage_failed',
      cleanup
        ? 'The refreshed OAuth login could not be stored or revoked.'
        : 'The refreshed OAuth login could not be stored and was revoked.',
      {
        details: {
          status: cleanup ? 'partial' : 'rolled_back',
          refreshedCredentialStored: false,
          storedCredential: { status: 'stale' },
          oauthGrant: { status: cleanup ? 'revocation_failed' : 'revoked' },
          cause: { code: storage.code, message: storage.message },
          ...(cleanup
            ? {
                cleanup: { code: cleanup.code, message: cleanup.message },
              }
            : {}),
        },
        requestId: storage.options.requestId,
        suggestions: cleanup
          ? [
              'Revoke the EdgeStore CLI grant from your account settings.',
              'edgestore login',
            ]
          : ['edgestore login'],
        exitCode: storage.exitCode,
      },
    );
  }
  return { token: refreshed.accessToken, source: 'oauth' };
}

export function serializeOAuthCredential(credential: OAuthCredential): string {
  return `${OAUTH_CREDENTIAL_PREFIX}${JSON.stringify(
    oauthCredentialSchema.parse(credential),
  )}`;
}

export function parseStoredOAuthCredential(
  value: string | undefined,
): OAuthCredential | undefined {
  if (!value?.startsWith(OAUTH_CREDENTIAL_PREFIX)) return undefined;
  const parsed = parseJson(value.slice(OAUTH_CREDENTIAL_PREFIX.length));
  const result = oauthCredentialSchema.safeParse(parsed);
  if (!result.success) {
    throw invalidStoredCredential(
      'The stored OAuth login is invalid.',
      result.error,
    );
  }
  return result.data;
}

function parseStoredCredential(value: string): string | OAuthCredential {
  return parseStoredOAuthCredential(value) ?? value;
}

function parseCachedOAuthClientRegistration(
  value: string,
): OAuthClientRegistration | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  const result = oauthClientRegistrationSchema.safeParse(parsed);
  return result.success ? result.data : undefined;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw invalidStoredCredential('The stored OAuth data is invalid.', error);
  }
}

function invalidStoredCredential(message: string, details?: unknown) {
  return new CliError('invalid_stored_credential', message, {
    details,
    suggestions: ['edgestore login'],
  });
}
