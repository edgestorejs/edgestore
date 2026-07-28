import { usageError } from '../core/errors';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor, sdkFor } from '../core/runtime';
import {
  deliverEnvSecret,
  type SecretDeliveryOptions,
} from '../core/secretDelivery';
import { activeAccount } from './account';

const tokenScopes = [
  'account:read',
  'project:read',
  'project:create',
  'project:delete',
  'bucket:read',
  'bucket:write',
  'file:read',
  'file:write',
  'project-key:read',
  'project-key:create',
  'project-key:revoke',
  'member:read',
  'member:write',
  'token:read',
  'token:create',
  'token:revoke',
] as const;
type TokenScope = (typeof tokenScopes)[number];

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
  const sdk = await sdkFor(runtime, flags);
  const pageSize = options.limit ?? 50;
  const account = options.user
    ? undefined
    : await activeAccount(runtime, options.account);
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

  const rows = tokens.map((token) => [
    token.id,
    token.name,
    token.kind.toLowerCase(),
    token.scopes.join(','),
    token.lastUsedAt ?? 'never',
    token.revokedAt ? 'revoked' : 'active',
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
    preset?: 'deploy' | 'read-only' | 'full-access';
    scope?: string[];
    expiresAt?: string;
  } & SecretDeliveryOptions,
): Promise<void> {
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
  const scopes = options.scope?.map(validateScope);
  const sdk = await sdkFor(runtime, flags);
  const body = {
    name: options.name,
    preset: options.preset,
    scopes,
    expiresAt: options.expiresAt,
    signal: runtime.signal,
  };
  const result = options.user
    ? await sdk.management.tokens.createUser(body)
    : await sdk.management.tokens.createAccount({
        account: await activeAccount(runtime, options.account),
        ...body,
      });
  const delivered = await deliverEnvSecret(
    runtime.cwd,
    { EDGESTORE_TOKEN: result.secret },
    options,
  );
  outputFor(runtime, flags).result(
    result,
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
    if (!runtime.io.inputIsTty || flags.json) {
      throw usageError(
        'confirmation_required',
        'Token revocation requires confirmation.',
        [`edgestore token revoke ${input.tokenId} --yes`],
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

function validateScope(value: string): TokenScope {
  if ((tokenScopes as readonly string[]).includes(value)) {
    return value as TokenScope;
  }
  throw usageError('invalid_token_scope', `Unsupported token scope: ${value}.`);
}
