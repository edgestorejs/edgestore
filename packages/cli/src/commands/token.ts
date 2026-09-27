import type { ManagementEdgeStoreSdk } from '@edgestore/sdk';
import { renderCliCommand } from '../core/command';
import { usageError } from '../core/errors';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { isInteractive, outputFor, sdkFor } from '../core/runtime';
import {
  deliverEnvSecretWithRollback,
  preflightEnvSecret,
  type SecretDeliveryOptions,
} from '../core/secretDelivery';
import { protectSecretFile } from '../core/secretFile';
import { activeAccount } from './account';

type TokenScope = NonNullable<
  Parameters<
    ManagementEdgeStoreSdk['management']['tokens']['createUser']
  >[0]['scopes']
>[number];

type TokenPreset = NonNullable<
  Parameters<
    ManagementEdgeStoreSdk['management']['tokens']['createUser']
  >[0]['preset']
>;

function validateTokenOwner(options: {
  user?: boolean;
  account?: string;
}): void {
  if (options.user && options.account) {
    throw usageError(
      'conflicting_token_owner',
      '--user and --account cannot be used together.',
    );
  }
}

export async function tokenListCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: {
    user?: boolean;
    account?: string;
    page?: number;
    limit?: number;
    all?: boolean;
  },
): Promise<void> {
  validateTokenOwner(options);
  const sdk = await sdkFor(runtime, flags);
  const pageSize = options.limit ?? 50;
  const account = options.user
    ? undefined
    : await activeAccount(runtime, flags, options.account);
  const tokens = [];
  let page = options.page ?? 1;

  do {
    const result = options.user
      ? await sdk.management.tokens.listUser({
          page,
          pageSize,
          signal: runtime.signal,
        })
      : await sdk.management.tokens.listAccount({
          account: account!,
          page,
          pageSize,
          signal: runtime.signal,
        });
    tokens.push(...result.tokens);
    if (!options.all || result.tokens.length < pageSize) break;
    page += 1;
  } while (true);

  const now = Date.now();
  const rows = tokens.map((token) => [
    token.id,
    token.name,
    token.kind.toLowerCase(),
    token.scopes.join(','),
    token.lastUsedAt ?? 'never',
    token.revokedAt
      ? 'revoked'
      : token.expiresAt && Date.parse(token.expiresAt) <= now
        ? 'expired'
        : 'active',
  ]);
  outputFor(runtime, flags).result(
    { tokens },
    rows.length
      ? renderTable(
          ['ID', 'NAME', 'TYPE', 'SCOPES', 'LAST USED', 'STATUS'],
          rows,
        )
      : 'No management tokens found.',
  );
}

export async function tokenCreateCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: {
    user?: boolean;
    account?: string;
    name: string;
    preset?: TokenPreset;
    scope?: string[];
    expiresAt?: string;
  } & SecretDeliveryOptions,
): Promise<void> {
  validateTokenOwner(options);
  if (options.preset && options.scope?.length) {
    throw usageError(
      'conflicting_token_permissions',
      '--preset and --scope cannot be used together.',
    );
  }
  if (!options.preset && !options.scope?.length) {
    throw usageError(
      'token_permissions_required',
      'Token creation requires --preset or at least one --scope.',
    );
  }
  if (!isInteractive(runtime, flags) && !options.output) {
    throw usageError(
      'secret_delivery_required',
      'Automated token creation requires --output to deliver the one-time token to a protected env file.',
    );
  }
  await preflightEnvSecret(runtime.cwd, ['EDGESTORE_TOKEN'], options);
  if (options.output) await protectSecretFile(runtime.cwd, options.output);
  const sdk = await sdkFor(runtime, flags);
  const permissions = options.preset
    ? { preset: options.preset }
    : { scopes: options.scope as TokenScope[] };
  const body = {
    name: options.name,
    ...permissions,
    ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
    signal: runtime.signal,
  };
  const result = options.user
    ? await sdk.management.tokens.createUser(body)
    : await sdk.management.tokens.createAccount({
        account: await activeAccount(runtime, flags, options.account),
        ...body,
      });
  const delivered = await deliverEnvSecretWithRollback({
    cwd: runtime.cwd,
    values: { EDGESTORE_TOKEN: result.secret },
    options,
    credential: { label: 'management token', id: result.token.id },
    rollback: async (signal) => {
      await sdk.management.tokens.revoke({
        tokenId: result.token.id,
        signal,
      });
    },
    manualRollbackCommand: renderCliCommand(flags, [
      'token',
      'revoke',
      result.token.id,
      '--yes',
    ]),
    recoverySuggestions: [
      'Use a credential with token:revoke access or revoke the token in the dashboard.',
    ],
  });
  outputFor(runtime, flags).result(
    { token: result.token, delivery: delivered },
    [
      `Created ${result.token.kind.toLowerCase()} token "${result.token.name}".`,
      ...(delivered.length
        ? ['', ...delivered]
        : ['', `EDGESTORE_TOKEN=${result.secret}`]),
      '',
      'Save this token now. You will not be able to view it again.',
    ].join('\n'),
    result.token.id,
  );
}

export async function tokenRevokeCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { tokenId: string; yes?: boolean },
): Promise<void> {
  if (!input.yes) {
    if (!isInteractive(runtime, flags)) {
      throw usageError(
        'confirmation_required',
        'Token revocation requires confirmation.',
        [renderCliCommand(flags, ['token', 'revoke', input.tokenId, '--yes'])],
      );
    }
    await runtime.prompts.confirmTyped(
      `Type ${input.tokenId} to revoke this token`,
      input.tokenId,
    );
  }
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.tokens.revoke({
    tokenId: input.tokenId,
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    result,
    `Revoked management token ${input.tokenId}.`,
    input.tokenId,
  );
}
