import * as oauth from 'openid-client';
import { z } from 'zod';
import type { OAuthClientRegistration, OAuthCredential } from './credentials';
import { CliError } from './errors';
import {
  isReusableOAuthRedirectUri,
  openOAuthCallbackServer,
  type OAuthCallbackServer,
} from './oauthCallback';

const resourceMetadataSchema = z
  .object({
    resource: z.string().url(),
    authorization_servers: z.array(z.string().url()).min(1),
    scopes_supported: z.array(z.string().min(1)).min(1),
    bearer_methods_supported: z.array(z.string()).optional(),
  })
  .passthrough();

export type BrowserOAuthLoginResult = {
  credential: OAuthCredential;
  client: OAuthClientRegistration;
};

export type BrowserOAuthLoginInput = {
  apiOrigin: string;
  resource: string;
  client?: OAuthClientRegistration;
  signal: AbortSignal;
  openUrl(url: string): Promise<void>;
  onAuthorizationUrl?(url: string): void;
  onBrowserOpenFailed?(url: string, error: unknown): void;
  onClientRegistered?(client: OAuthClientRegistration): Promise<void>;
};

export interface OAuthService {
  login(input: BrowserOAuthLoginInput): Promise<BrowserOAuthLoginResult>;
  refresh(
    credential: OAuthCredential,
    signal: AbortSignal,
  ): Promise<OAuthCredential>;
  revoke(credential: OAuthCredential, signal: AbortSignal): Promise<void>;
}

export class DefaultOAuthService implements OAuthService {
  constructor(private readonly fetchImplementation: typeof fetch = fetch) {}

  async login(input: BrowserOAuthLoginInput): Promise<BrowserOAuthLoginResult> {
    try {
      return await this.performLogin(input);
    } catch (error) {
      if (input.signal.aborted || error instanceof CliError) throw error;
      throw new CliError('oauth_login_failed', oauthErrorMessage(error), {
        suggestions: ['edgestore login', 'edgestore login --token'],
      });
    }
  }

  async refresh(
    credential: OAuthCredential,
    signal: AbortSignal,
  ): Promise<OAuthCredential> {
    try {
      const config = await this.discover(new URL(credential.issuer), {
        clientId: credential.clientId,
        signal,
      });
      const tokens = await oauth.refreshTokenGrant(
        config,
        credential.refreshToken,
        { resource: credential.resource },
      );
      return credentialFromTokens(tokens, {
        clientId: credential.clientId,
        issuer: credential.issuer,
        resource: credential.resource,
        fallbackRefreshToken: credential.refreshToken,
        fallbackScope: credential.scope,
      });
    } catch (error) {
      if (signal.aborted || error instanceof CliError) throw error;
      throw new CliError(
        'oauth_refresh_failed',
        'The browser login could not be refreshed.',
        {
          details: oauthErrorMessage(error),
          suggestions: ['edgestore login', 'edgestore login --token'],
        },
      );
    }
  }

  async revoke(
    credential: OAuthCredential,
    signal: AbortSignal,
  ): Promise<void> {
    const config = await this.discover(new URL(credential.issuer), {
      clientId: credential.clientId,
      signal,
    });
    await oauth.tokenRevocation(config, credential.refreshToken, {
      token_type_hint: 'refresh_token',
    });
  }

  private async performLogin(
    input: BrowserOAuthLoginInput,
  ): Promise<BrowserOAuthLoginResult> {
    const metadata = await this.protectedResourceMetadata(
      input.apiOrigin,
      input.resource,
      input.signal,
    );
    const issuer = new URL(metadata.authorization_servers[0]!);
    const issuerIdentifier = normalizeUrl(issuer.toString());
    const reusableClient = reusableClientRegistration(input.client, issuer);
    const state = oauth.randomState();
    const callback = await openCallback(
      state,
      input.signal,
      reusableClient?.redirectUri,
    );
    const clientForCallback =
      callback.redirectUri === reusableClient?.redirectUri
        ? reusableClient
        : undefined;

    try {
      const config = clientForCallback
        ? await this.discover(issuer, {
            clientId: clientForCallback.clientId,
            redirectUri: callback.redirectUri,
            signal: input.signal,
          })
        : await this.register(issuer, callback.redirectUri, input.signal);
      const clientId = config.clientMetadata().client_id;
      if (!clientId) {
        throw new CliError(
          'oauth_registration_failed',
          'The OAuth server did not return a client ID.',
        );
      }
      const clientRegistration: OAuthClientRegistration = {
        version: 1,
        clientId,
        issuer: issuerIdentifier,
        redirectUri: callback.redirectUri,
      };
      if (!clientForCallback) {
        await input.onClientRegistered?.(clientRegistration);
      }

      const verifier = oauth.randomPKCECodeVerifier();
      const authorizationUrl = oauth.buildAuthorizationUrl(config, {
        response_type: 'code',
        redirect_uri: callback.redirectUri,
        resource: metadata.resource,
        scope: [...new Set(metadata.scopes_supported)].join(' '),
        code_challenge: await oauth.calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256',
        state,
      });
      input.onAuthorizationUrl?.(authorizationUrl.toString());
      try {
        await input.openUrl(authorizationUrl.toString());
      } catch (error) {
        input.onBrowserOpenFailed?.(authorizationUrl.toString(), error);
      }

      const callbackUrl = await callback.callback;
      const tokens = await oauth.authorizationCodeGrant(
        config,
        callbackUrl,
        { pkceCodeVerifier: verifier, expectedState: state },
        { resource: metadata.resource },
      );
      return {
        credential: credentialFromTokens(tokens, {
          clientId,
          issuer: issuerIdentifier,
          resource: metadata.resource,
        }),
        client: clientRegistration,
      };
    } finally {
      await callback.close();
    }
  }

  private async protectedResourceMetadata(
    apiOrigin: string,
    expectedResource: string,
    signal: AbortSignal,
  ) {
    const metadataUrl = new URL(
      '/.well-known/oauth-protected-resource/v2',
      apiOrigin,
    );
    const response = await this.fetchImplementation(metadataUrl, { signal });
    if (!response.ok) {
      throw new CliError(
        'oauth_metadata_unavailable',
        `The EdgeStore API does not advertise browser login (${response.status}).`,
        { suggestions: ['edgestore login --token'] },
      );
    }

    const result = resourceMetadataSchema.safeParse(await response.json());
    if (!result.success) {
      throw new CliError(
        'invalid_oauth_metadata',
        'The EdgeStore API returned invalid OAuth metadata.',
        { details: result.error },
      );
    }
    if (normalizeUrl(result.data.resource) !== normalizeUrl(expectedResource)) {
      throw new CliError(
        'invalid_oauth_resource',
        'The OAuth metadata does not match the selected EdgeStore API.',
      );
    }
    return result.data;
  }

  private async register(
    issuer: URL,
    redirectUri: string,
    signal: AbortSignal,
  ) {
    return await oauth.dynamicClientRegistration(
      issuer,
      {
        application_type: 'native',
        client_name: 'EdgeStore CLI',
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      },
      oauth.None(),
      this.discoveryOptions(issuer, signal),
    );
  }

  private async discover(
    issuer: URL,
    options: {
      clientId: string;
      redirectUri?: string;
      signal: AbortSignal;
    },
  ) {
    return await oauth.discovery(
      issuer,
      options.clientId,
      {
        token_endpoint_auth_method: 'none',
        ...(options.redirectUri
          ? { redirect_uris: [options.redirectUri] }
          : {}),
      },
      oauth.None(),
      this.discoveryOptions(issuer, options.signal),
    );
  }

  private discoveryOptions(issuer: URL, signal: AbortSignal) {
    const fetchWithSignal: oauth.CustomFetch = (url, options) => {
      const body =
        options.body instanceof Uint8Array
          ? Uint8Array.from(options.body)
          : options.body;
      const requestSignal = options.signal
        ? AbortSignal.any([signal, options.signal])
        : signal;
      return this.fetchImplementation(
        new Request(url, { ...options, body, signal: requestSignal }),
      );
    };
    return {
      algorithm: 'oauth2' as const,
      [oauth.customFetch]: fetchWithSignal,
      ...(issuer.protocol === 'http:' && isLoopback(issuer)
        ? { execute: [oauth.allowInsecureRequests] }
        : {}),
    };
  }
}

async function openCallback(
  state: string,
  signal: AbortSignal,
  preferredRedirectUri?: string,
): Promise<OAuthCallbackServer> {
  if (!preferredRedirectUri) {
    return await openOAuthCallbackServer(state, signal);
  }
  try {
    return await openOAuthCallbackServer(state, signal, preferredRedirectUri);
  } catch (error) {
    if (!isAddressInUse(error)) throw error;
    return await openOAuthCallbackServer(state, signal);
  }
}

function reusableClientRegistration(
  client: OAuthClientRegistration | undefined,
  issuer: URL,
) {
  return client &&
    normalizeUrl(client.issuer) === normalizeUrl(issuer.toString()) &&
    isReusableOAuthRedirectUri(client.redirectUri)
    ? client
    : undefined;
}

function credentialFromTokens(
  tokens: oauth.TokenEndpointResponse,
  context: {
    clientId: string;
    issuer: string;
    resource: string;
    fallbackRefreshToken?: string;
    fallbackScope?: string;
  },
): OAuthCredential {
  const refreshToken = tokens.refresh_token ?? context.fallbackRefreshToken;
  if (!tokens.access_token || !refreshToken) {
    throw new CliError(
      'invalid_oauth_token_response',
      'The OAuth server did not return the required access and refresh tokens.',
    );
  }
  return {
    version: 1,
    kind: 'oauth',
    accessToken: tokens.access_token,
    refreshToken,
    expiresAt: Date.now() + (tokens.expires_in ?? 60 * 60) * 1_000,
    clientId: context.clientId,
    issuer: context.issuer,
    resource: context.resource,
    scope: tokens.scope ?? context.fallbackScope,
  };
}

function normalizeUrl(value: string) {
  return new URL(value).toString().replace(/\/$/, '');
}

function isLoopback(url: URL) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

function isAddressInUse(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && error.code === 'EADDRINUSE'
  );
}

function oauthErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'Browser login failed.';
}
