import type { ManagementEdgeStoreSdk } from '@edgestore/sdk';
import { usageError } from '../core/errors';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { apiUrlFor, credentialFor, outputFor } from '../core/runtime';

export type LoginOptions = {
  token?: boolean;
};

export async function loginCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: LoginOptions,
): Promise<void> {
  if (!options.token) {
    throw usageError(
      'browser_login_unavailable',
      'Browser login is not available yet.',
      ['edgestore login --token'],
    );
  }
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

  await runtime.credentials.set(token);
  const accountId = accountIdFromActor(identity.actor);
  if (accountId) {
    const config = await runtime.globalConfig.read();
    await runtime.globalConfig.write({
      ...config,
      activeAccount: accountId,
    });
  }

  outputFor(runtime, flags).result(
    { authenticated: true, actor: identity.actor },
    `Logged in as ${actorLabel(identity.actor)}.`,
    actorLabel(identity.actor),
  );
}

export async function logoutCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<void> {
  const deleted = await runtime.credentials.delete();
  const environmentTokenActive = Boolean(runtime.env.EDGESTORE_TOKEN?.trim());
  const output = outputFor(runtime, flags);

  output.result(
    { loggedOut: deleted, environmentTokenActive },
    deleted ? 'Logged out.' : 'No stored login found.',
    String(deleted),
  );
  if (environmentTokenActive && output.options.mode === 'human') {
    output.warning(
      'EDGESTORE_TOKEN is still set and will authenticate this process.',
    );
  }
}

export async function whoamiCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<void> {
  const credential = await credentialFor(runtime);
  const apiUrl = apiUrlFor(runtime, flags);
  const sdk = runtime.sdkFactory({
    token: credential.token,
    baseUrl: apiUrl.sdkBaseUrl,
  });
  const identity = await sdk.management.whoami({ signal: runtime.signal });
  const globalConfig = await runtime.globalConfig.read();
  const localConfig = await runtime.repoConfig.read();

  const context = {
    activeAccount: globalConfig.activeAccount,
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

function accountIdFromActor(
  actor: Awaited<
    ReturnType<ManagementEdgeStoreSdk['management']['whoami']>
  >['actor'],
): string | undefined {
  return actor.kind === 'account_token'
    ? actor.accountId
    : actor.user.accountId;
}
