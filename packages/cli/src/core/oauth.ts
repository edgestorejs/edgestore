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

const deviceGrantType = 'urn:ietf:params:oauth:grant-type:device_code';

export type OAuthLoginResult = {
  credential: OAuthCredential;
  client: OAuthClientRegistration;
};

type OAuthLoginInput = {
  apiOrigin: string;
  resource: string;
  client?: OAuthClientRegistration;
  signal: AbortSignal;
  openUrl(url: string): Promise<void>;
  onAuthorizationUrl?(url: string): void;
  onBrowserOpenFailed?(url: string, error: unknown): void;
  onClientRegistered?(client: OAuthClientRegistration): Promise<void>;
};

export type BrowserOAuthLoginInput = OAuthLoginInput & {
  onAuthorizationUrl?(url: string): void;
};

export type DeviceOAuthLoginInput = OAuthLoginInput & {
  onDeviceAuthorization?(authorization: {
    userCode: string;
    verificationUri: string;
    verificationUriComplete?: string;
    expiresIn: number;
  }): void;
};

export interface OAuthService {
  login(input: BrowserOAuthLoginInput): Promise<OAuthLoginResult>;
  loginWithDeviceCode(input: DeviceOAuthLoginInput): Promise<OAuthLoginResult>;
  refresh(
    credential: OAuthCredential,
    signal: AbortSignal,
  ): Promise<OAuthCredential>;
  revoke(credential: OAuthCredential, signal: AbortSignal): Promise<void>;
}

export class DefaultOAuthService implements OAuthService {
  constructor(private readonly fetchImplementation: typeof fetch = fetch) {}

  async login(input: BrowserOAuthLoginInput): Promise<OAuthLoginResult> {
    try {
      return await this.performLoginWithRecovery(input);
    } catch (error) {
      if (input.signal.aborted || error instanceof CliError) throw error;
      throw new CliError('oauth_login_failed', oauthErrorMessage(error), {
        suggestions: ['edgestore login', 'edgestore login --token'],
      });
    }
  }

  async loginWithDeviceCode(
    input: DeviceOAuthLoginInput,
  ): Promise<OAuthLoginResult> {
    try {
      return await this.performDeviceLoginWithRecovery(input);
    } catch (error) {
      if (input.signal.aborted || error instanceof CliError) throw error;
      throw new CliError('oauth_login_failed', oauthErrorMessage(error), {
        suggestions: ['edgestore login --device', 'edgestore login --token'],
      });
    }
  }

  private async performLoginWithRecovery(
    input: BrowserOAuthLoginInput,
  ): Promise<OAuthLoginResult> {
    try {
      return await this.performLogin(input);
    } catch (error) {
      if (!input.client || !isInvalidClientError(error)) throw error;
      return await this.performLogin({ ...input, client: undefined });
    }
  }

  private async performDeviceLoginWithRecovery(
    input: DeviceOAuthLoginInput,
  ): Promise<OAuthLoginResult> {
    try {
      return await this.performDeviceLogin(input);
    } catch (error) {
      if (!input.client || !isInvalidClientError(error)) throw error;
      return await this.performDeviceLogin({ ...input, client: undefined });
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
  ): Promise<OAuthLoginResult> {
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
        version: 2,
        flow: 'browser',
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

  private async performDeviceLogin(
    input: DeviceOAuthLoginInput,
  ): Promise<OAuthLoginResult> {
    const metadata = await this.protectedResourceMetadata(
      input.apiOrigin,
      input.resource,
      input.signal,
    );
    const issuer = new URL(metadata.authorization_servers[0]!);
    const issuerIdentifier = normalizeUrl(issuer.toString());
    const reusableClient = reusableDeviceClientRegistration(
      input.client,
      issuer,
    );
    const config = reusableClient
      ? await this.discover(issuer, {
          clientId: reusableClient.clientId,
          signal: input.signal,
        })
      : await this.registerDeviceClient(issuer, input.signal);
    const clientId = config.clientMetadata().client_id;
    if (!clientId) {
      throw new CliError(
        'oauth_registration_failed',
        'The OAuth server did not return a client ID.',
      );
    }
    const clientRegistration: OAuthClientRegistration = reusableClient ?? {
      version: 2,
      flow: 'device',
      clientId,
      issuer: issuerIdentifier,
    };
    if (!reusableClient) {
      await input.onClientRegistered?.(clientRegistration);
    }

    const authorization = await oauth.initiateDeviceAuthorization(config, {
      resource: metadata.resource,
      scope: [...new Set(metadata.scopes_supported)].join(' '),
    });
    input.onDeviceAuthorization?.({
      userCode: authorization.user_code,
      verificationUri: authorization.verification_uri,
      ...(authorization.verification_uri_complete
        ? { verificationUriComplete: authorization.verification_uri_complete }
        : {}),
      expiresIn: authorization.expires_in,
    });
    const verificationUrl =
      authorization.verification_uri_complete ?? authorization.verification_uri;
    try {
      await input.openUrl(verificationUrl);
    } catch (error) {
      input.onBrowserOpenFailed?.(verificationUrl, error);
    }

    const tokens = await oauth.pollDeviceAuthorizationGrant(
      config,
      authorization,
      { resource: metadata.resource },
      { signal: input.signal },
    );
    return {
      credential: credentialFromTokens(tokens, {
        clientId,
        issuer: issuerIdentifier,
        resource: metadata.resource,
      }),
      client: clientRegistration,
    };
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
        `The EdgeStore API does not advertise OAuth login (${response.status}).`,
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

  private async registerDeviceClient(issuer: URL, signal: AbortSignal) {
    return await oauth.dynamicClientRegistration(
      issuer,
      {
        application_type: 'native',
        client_name: 'EdgeStore CLI',
        redirect_uris: [],
        token_endpoint_auth_method: 'none',
        grant_types: [deviceGrantType, 'refresh_token'],
        response_types: [],
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
  if (
    client?.flow !== 'browser' ||
    normalizeUrl(client.issuer) !== normalizeUrl(issuer.toString()) ||
    !isReusableOAuthRedirectUri(client.redirectUri)
  ) {
    return undefined;
  }
  return client;
}

function reusableDeviceClientRegistration(
  client: OAuthClientRegistration | undefined,
  issuer: URL,
) {
  return client?.flow === 'device' &&
    normalizeUrl(client.issuer) === normalizeUrl(issuer.toString())
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

function isInvalidClientError(error: unknown): boolean {
  return (
    (error instanceof oauth.AuthorizationResponseError ||
      error instanceof oauth.ResponseBodyError) &&
    (error.error === 'invalid_client' || error.error === 'unauthorized_client')
  );
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
  return 'OAuth login failed.';
}
