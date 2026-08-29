import type { ManagementEdgeStoreSdk } from '@edgestore/sdk';
import { renderCliCommand } from '../core/command';
import { activeAccountFor, withActiveAccount } from '../core/config';
import {
  parseStoredOAuthCredential,
  serializeOAuthCredential,
  type OAuthClientRegistration,
  type OAuthCredential,
} from '../core/credentials';
import { CliError, normalizeError, usageError } from '../core/errors';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { apiUrlFor, credentialFor, outputFor } from '../core/runtime';
import { selectWorkspaceContext } from '../core/workspace';

export type LoginOptions = {
  device?: boolean;
  token?: boolean;
};

export async function loginCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: LoginOptions,
): Promise<void> {
  if (options.device && options.token) {
    throw usageError(
      'conflicting_login_modes',
      '--device and --token cannot be used together.',
    );
  }
  if (options.device) return await oauthLogin(runtime, flags, 'device');
  if (!options.token) return await oauthLogin(runtime, flags, 'browser');
  if (flags.json && runtime.io.inputIsTty) {
    throw usageError(
      'interactive_input_disabled',
      'Interactive token input is disabled with --json.',
      ['printf %s "$EDGESTORE_TOKEN" | edgestore login --token --json'],
    );
  }

  const token = await runtime.prompts.readToken(
    runtime.io.stdin,
    runtime.io.inputIsTty,
  );
  const apiUrl = apiUrlFor(runtime, flags);
  const sdk = runtime.sdkFactory({
    token,
    baseUrl: apiUrl.sdkBaseUrl,
  });
  const identity = await sdk.management.whoami({ signal: runtime.signal });
  const environmentTokenActive = hasEnvironmentToken(runtime);

  await runtime.credentials.set(apiUrl.displayUrl, token);
  if (!environmentTokenActive) {
    await updateActiveAccountAfterLogin(runtime, flags, identity.actor);
  }

  const output = outputFor(runtime, flags);
  output.result(
    loginResult(identity.actor, environmentTokenActive),
    `Logged in as ${actorLabel(identity.actor)}.`,
    actorLabel(identity.actor),
  );
  warnWhenStoredLoginIsInactive(output, environmentTokenActive);
}

export async function logoutCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<void> {
  const apiOrigin = apiUrlFor(runtime, flags).displayUrl;
  const output = outputFor(runtime, flags);
  const stored = await runtime.credentials.get(apiOrigin);
  let oauthCredential;
  try {
    oauthCredential = parseStoredOAuthCredential(stored);
  } catch {
    output.warning(
      'The stored OAuth login is invalid. Skipping remote revocation.',
    );
  }
  let oauthRevoked: boolean | undefined;
  let revocationFailure: CliError | undefined;
  if (oauthCredential) {
    try {
      await runtime.oauth.revoke(oauthCredential, runtime.signal);
      oauthRevoked = true;
    } catch (error) {
      if (runtime.signal.aborted) throw error;
      oauthRevoked = false;
      revocationFailure = normalizeError(error);
      output.warning(
        'The OAuth grant could not be revoked remotely. The login will still be removed locally.',
      );
    }
  }
  let deleted: boolean;
  try {
    deleted = await runtime.credentials.delete(apiOrigin);
  } catch (error) {
    const deletionFailure = normalizeError(error);
    if (oauthRevoked) {
      throw new CliError(
        'logout_partial_failure',
        'The OAuth grant was revoked, but the stored login could not be removed.',
        {
          details: {
            status: 'partial',
            oauthGrant: { status: 'revoked' },
            localCredential: {
              status: 'delete_failed',
              cause: errorDetails(deletionFailure),
            },
          },
          requestId: deletionFailure.options.requestId,
          suggestions: [renderCliCommand(flags, ['logout'])],
          exitCode: deletionFailure.exitCode,
        },
      );
    }
    if (revocationFailure) {
      throw new CliError(
        'logout_failed',
        'The OAuth grant could not be revoked and the stored login could not be removed.',
        {
          details: {
            status: 'failed',
            oauthGrant: {
              status: 'revocation_failed',
              cause: errorDetails(revocationFailure),
            },
            localCredential: {
              status: 'delete_failed',
              cause: errorDetails(deletionFailure),
            },
          },
          requestId:
            deletionFailure.options.requestId ??
            revocationFailure.options.requestId,
          suggestions: [renderCliCommand(flags, ['logout'])],
          exitCode: deletionFailure.exitCode,
        },
      );
    }
    throw deletionFailure;
  }
  const environmentTokenActive = Boolean(runtime.env.EDGESTORE_TOKEN?.trim());

  output.result(
    {
      loggedOut: deleted,
      environmentTokenActive,
      ...(oauthRevoked === undefined ? {} : { oauthRevoked }),
    },
    deleted ? 'Logged out.' : 'No stored login found.',
    String(deleted),
  );
  if (environmentTokenActive && output.options.mode === 'human') {
    output.warning(
      'EDGESTORE_TOKEN is still set and will authenticate this process.',
    );
  }
}

function errorDetails(error: CliError) {
  return {
    code: error.code,
    message: error.message,
    ...(error.options.details === undefined
      ? {}
      : { details: error.options.details }),
  };
}

export async function whoamiCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<void> {
  await selectWorkspaceContext(runtime, flags, 'read');
  const credential = await credentialFor(runtime, flags);
  const apiUrl = apiUrlFor(runtime, flags);
  const sdk = runtime.sdkFactory({
    token: credential.token,
    baseUrl: apiUrl.sdkBaseUrl,
  });
  const identity = await sdk.management.whoami({ signal: runtime.signal });
  const globalConfig = await runtime.globalConfig.read();
  const localConfig = await runtime.repoConfig.read();
  const activeAccount = activeAccountFor(globalConfig, apiUrl.displayUrl);

  const context = {
    activeAccount,
    localAccount: localConfig?.config.account,
    localProject: localConfig?.config.project,
    apiUrl: apiUrl.displayUrl,
  };
  const lines = [
    `Identity: ${actorLabel(identity.actor)}`,
    `Credential: ${credential.source}`,
    `Active account: ${context.activeAccount ?? 'none'}`,
    `Local project: ${context.localProject ?? 'none'}`,
  ];
  if (context.localAccount && context.localAccount !== context.activeAccount) {
    lines.push(`Local account: ${context.localAccount}`);
  }
  lines.push(`API: ${context.apiUrl}`);

  outputFor(runtime, flags).result(
    {
      actor: identity.actor,
      credentialSource: credential.source,
      context,
    },
    lines.join('\n'),
  );
}

function actorLabel(
  actor: Awaited<
    ReturnType<ManagementEdgeStoreSdk['management']['whoami']>
  >['actor'],
): string {
  if (actor.kind === 'account_token') {
    return `account token ${actor.tokenId}`;
  }
  if (actor.kind === 'user_token') {
    return actor.user.email;
  }
  return actor.user.email;
}

async function oauthLogin(
  runtime: CliRuntime,
  flags: GlobalFlags,
  mode: 'browser' | 'device',
): Promise<void> {
  const apiUrl = apiUrlFor(runtime, flags);
  const output = outputFor(runtime, flags);
  const sharedInput = {
    apiOrigin: apiUrl.displayUrl,
    resource: apiUrl.sdkBaseUrl,
    client: await runtime.credentials.getCachedOAuthClient(apiUrl.displayUrl),
    signal: runtime.signal,
    openUrl: (url: string) => runtime.openUrl(url),
    onBrowserOpenFailed: (url: string) => {
      output.warning(
        `Could not open a browser automatically. Open this URL:\n  ${url}`,
      );
    },
    onClientRegistered: (client: OAuthClientRegistration) =>
      runtime.credentials.setCachedOAuthClient(apiUrl.displayUrl, client),
  };
  const result =
    mode === 'device'
      ? await runtime.oauth.loginWithDeviceCode({
          ...sharedInput,
          onDeviceAuthorization: (authorization) => {
            if (output.options.mode !== 'human') return;
            const url =
              authorization.verificationUriComplete ??
              authorization.verificationUri;
            runtime.io.stderr.write(
              `Confirm this one-time code in your browser:\n  ${authorization.userCode}\nOpening a browser to continue login...\nIf it does not open, visit:\n  ${url}\n`,
            );
          },
        })
      : await runtime.oauth.login({
          ...sharedInput,
          onAuthorizationUrl: (url) => {
            if (output.options.mode === 'human') {
              runtime.io.stderr.write(
                `Opening a browser to continue login...\nIf it does not open, visit:\n  ${url}\n`,
              );
            }
          },
        });
  let identity: Awaited<
    ReturnType<ManagementEdgeStoreSdk['management']['whoami']>
  >;
  let credentialStored = false;
  try {
    await runtime.credentials.setCachedOAuthClient(
      apiUrl.displayUrl,
      result.client,
    );
    const sdk = runtime.sdkFactory({
      token: result.credential.accessToken,
      baseUrl: apiUrl.sdkBaseUrl,
    });
    identity = await sdk.management.whoami({ signal: runtime.signal });
    await runtime.credentials.set(
      apiUrl.displayUrl,
      serializeOAuthCredential(result.credential),
    );
    credentialStored = true;
  } catch (error) {
    if (!credentialStored) {
      await revokeFailedLogin(runtime, result.credential, error);
    }
    throw error;
  }
  const environmentTokenActive = hasEnvironmentToken(runtime);
  if (!environmentTokenActive) {
    await updateActiveAccountAfterLogin(runtime, flags, identity.actor);
  }

  const accessSummary =
    identity.actor.kind === 'oauth_user'
      ? formatOAuthAccess(
          identity.actor.scopes.length,
          identity.actor.access.accounts.length,
        )
      : '';
  output.result(
    loginResult(identity.actor, environmentTokenActive),
    `Logged in as ${actorLabel(identity.actor)}.${accessSummary}`,
    actorLabel(identity.actor),
  );
  warnWhenStoredLoginIsInactive(output, environmentTokenActive);
}

function formatOAuthAccess(scopeCount: number, accountCount: number) {
  return `\nAccess: ${scopeCount} ${scopeCount === 1 ? 'scope' : 'scopes'} across ${accountCount} ${accountCount === 1 ? 'account' : 'accounts'}.`;
}

async function updateActiveAccount(
  runtime: CliRuntime,
  flags: GlobalFlags,
  actor: Awaited<
    ReturnType<ManagementEdgeStoreSdk['management']['whoami']>
  >['actor'],
): Promise<void> {
  const config = await runtime.globalConfig.read();
  const apiOrigin = apiUrlFor(runtime, flags).displayUrl;
  const current = activeAccountFor(config, apiOrigin);
  let accountId: string | undefined;
  if (actor.kind === 'account_token') {
    accountId = actor.accountId;
  } else if (actor.kind === 'oauth_user') {
    const available = actor.access.accounts.map((item) => item.accountId);
    accountId = available.includes(current ?? '') ? current : available[0];
  } else {
    accountId = actor.user.accountId;
  }
  if (accountId && accountId !== current) {
    await runtime.globalConfig.write(
      withActiveAccount(config, apiOrigin, accountId),
    );
  }
}

async function updateActiveAccountAfterLogin(
  runtime: CliRuntime,
  flags: GlobalFlags,
  actor: Awaited<
    ReturnType<ManagementEdgeStoreSdk['management']['whoami']>
  >['actor'],
): Promise<void> {
  try {
    await updateActiveAccount(runtime, flags, actor);
  } catch (error) {
    const failure = normalizeError(error);
    throw new CliError(
      'login_partial_failure',
      'Login succeeded and the credential was stored, but the active account could not be updated.',
      {
        details: {
          status: 'partial',
          credentialStored: true,
          activeAccount: { status: 'update_failed' },
          configPath: runtime.globalConfig.path,
          actor,
          cause: {
            code: failure.code,
            message: failure.message,
            ...(failure.options.details === undefined
              ? {}
              : { details: failure.options.details }),
          },
        },
        requestId: failure.options.requestId,
        suggestions: [
          ...(failure.options.suggestions ?? []),
          'Fix access to the global config, then run edgestore account switch <account-id>.',
        ],
        exitCode: failure.exitCode,
      },
    );
  }
}

async function revokeFailedLogin(
  runtime: CliRuntime,
  credential: OAuthCredential,
  loginError: unknown,
): Promise<void> {
  try {
    await runtime.oauth.revoke(credential, AbortSignal.timeout(10_000));
  } catch (error) {
    const failure = normalizeError(loginError);
    const cleanup = normalizeError(error);
    throw new CliError(
      'oauth_login_cleanup_failed',
      'Login failed and the new OAuth grant could not be revoked.',
      {
        details: {
          status: 'partial',
          credentialStored: false,
          oauthGrant: { status: 'revocation_failed' },
          cause: { code: failure.code, message: failure.message },
          cleanup: { code: cleanup.code, message: cleanup.message },
        },
        suggestions: [
          'Revoke the EdgeStore CLI grant from your account settings.',
          'edgestore login',
        ],
      },
    );
  }
}

function hasEnvironmentToken(runtime: CliRuntime): boolean {
  return Boolean(runtime.env.EDGESTORE_TOKEN?.trim());
}

function loginResult(
  actor: Awaited<
    ReturnType<ManagementEdgeStoreSdk['management']['whoami']>
  >['actor'],
  environmentTokenActive: boolean,
) {
  return {
    authenticated: true,
    credentialStored: true,
    credentialActive: !environmentTokenActive,
    environmentTokenActive,
    actor,
  };
}

function warnWhenStoredLoginIsInactive(
  output: ReturnType<typeof outputFor>,
  environmentTokenActive: boolean,
): void {
  if (environmentTokenActive && output.options.mode === 'human') {
    output.warning(
      'EDGESTORE_TOKEN is set, so this stored login is not currently active.',
    );
  }
}
