import { CliError, usageError } from '../core/errors';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor, sdkFor } from '../core/runtime';
import {
  deliverEnvSecretWithRollback,
  preflightEnvSecret,
  type SecretDeliveryOptions,
} from '../core/secretDelivery';

type KeyOptions = SecretDeliveryOptions & {
  name: string;
};

export async function projectKeyListCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  project: string,
): Promise<void> {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.projectKeys.list({
    project,
    signal: runtime.signal,
  });
  const rows = result.keys.map((key) => [
    key.id,
    key.name,
    key.accessKey,
    key.revokedAt ? 'revoked' : 'active',
    key.createdAt,
  ]);
  outputFor(runtime, flags).result(
    result,
    rows.length
      ? renderTable(['ID', 'NAME', 'ACCESS KEY', 'STATUS', 'CREATED'], rows)
      : 'No project keys found.',
  );
}

export async function projectKeyCreateCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: KeyOptions & { project: string },
): Promise<void> {
  requirePlainSecretDelivery(flags, input);
  await preflightKeyDelivery(runtime, input);
  const sdk = await sdkFor(runtime, flags);
  const { result, delivered } = await createAndDeliverKey(runtime, sdk, input);
  const values = keyValues(result.key.accessKey, result.secretKey);
  outputFor(runtime, flags).result(
    result,
    [
      `Created project key "${result.key.name}".`,
      ...(delivered.length ? ['', ...delivered] : ['', ...envLines(values)]),
      '',
      'Save this secret now. You will not be able to view it again.',
    ].join('\n'),
    result.key.id,
  );
}

export async function projectKeyRevokeCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { project: string; keyId: string; yes?: boolean },
): Promise<void> {
  const sdk = await sdkFor(runtime, flags);
  const listed = await sdk.management.projectKeys.list({
    project: input.project,
    signal: runtime.signal,
  });
  const key = listed.keys.find((item) => item.id === input.keyId);
  if (!input.yes) {
    requireInteractiveConfirmation(runtime, flags, [
      `edgestore project key revoke ${input.project} ${input.keyId} --yes`,
    ]);
    const activeCount = listed.keys.filter((item) => !item.revokedAt).length;
    const warning =
      key && !key.revokedAt && activeCount === 1
        ? ' This is the last active key and runtime access will stop.'
        : '';
    await runtime.prompts.confirmTyped(
      `Revoke project key ${input.keyId}?${warning} Type ${input.keyId} to confirm`,
      input.keyId,
    );
  }
  const result = await sdk.management.projectKeys.revoke({
    project: input.project,
    keyId: input.keyId,
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    result,
    `Revoked project key ${input.keyId}.`,
    input.keyId,
  );
}

export async function projectKeyRotateCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: {
    project: string;
    keyId: string;
    yes?: boolean;
  } & KeyOptions,
): Promise<void> {
  if (!input.yes) {
    requireInteractiveConfirmation(runtime, flags, [
      `edgestore project key rotate ${input.project} ${input.keyId} --name ${input.name} --output .env.local --yes`,
    ]);
  } else if (!input.copy && !input.output) {
    throw usageError(
      'secret_delivery_required',
      'Non-interactive rotation requires --copy or --output.',
    );
  }

  requirePlainSecretDelivery(flags, input);
  const sdk = await sdkFor(runtime, flags);
  const listed = await sdk.management.projectKeys.list({
    project: input.project,
    signal: runtime.signal,
  });
  const target = listed.keys.find((key) => key.id === input.keyId);
  if (!target) {
    throw new CliError(
      'project_key_not_found',
      `Project key ${input.keyId} was not found in ${input.project}.`,
    );
  }
  if (target.revokedAt) {
    throw new CliError(
      'project_key_revoked',
      `Project key ${input.keyId} is already revoked.`,
    );
  }
  await preflightKeyDelivery(runtime, input);

  const { result, delivered } = await createAndDeliverKey(runtime, sdk, input);
  const values = keyValues(result.key.accessKey, result.secretKey);
  const output = outputFor(runtime, flags);
  const secretMessage = [
    `Created replacement key "${result.key.name}".`,
    ...(delivered.length ? ['', ...delivered] : ['', ...envLines(values)]),
    '',
    'Save this secret now. You will not be able to view it again.',
  ].join('\n');

  if (!input.yes) {
    output.message(secretMessage);
    await runtime.prompts.confirmTyped(
      `Type saved to revoke ${input.keyId}`,
      'saved',
    );
  }
  await sdk.management.projectKeys.revoke({
    project: input.project,
    keyId: input.keyId,
    signal: runtime.signal,
  });
  output.result(
    { replacement: result, revokedKeyId: input.keyId },
    input.yes
      ? [secretMessage, '', `Revoked old project key ${input.keyId}.`].join(
          '\n',
        )
      : `Revoked old project key ${input.keyId}.`,
    result.key.id,
  );
}

async function createAndDeliverKey(
  runtime: CliRuntime,
  sdk: Awaited<ReturnType<typeof sdkFor>>,
  input: { project: string; name: string } & SecretDeliveryOptions,
) {
  const result = await sdk.management.projectKeys.create({
    project: input.project,
    name: input.name,
    signal: runtime.signal,
  });
  const delivered = await deliverEnvSecretWithRollback({
    cwd: runtime.cwd,
    values: keyValues(result.key.accessKey, result.secretKey),
    options: input,
    credential: { label: 'project key', id: result.key.id },
    rollback: async (signal) => {
      await sdk.management.projectKeys.revoke({
        project: input.project,
        keyId: result.key.id,
        signal,
      });
    },
    manualRollbackCommand: `edgestore project key revoke ${input.project} ${result.key.id} --yes`,
  });
  return { result, delivered };
}

async function preflightKeyDelivery(
  runtime: CliRuntime,
  options: SecretDeliveryOptions,
): Promise<void> {
  await preflightEnvSecret(
    runtime.cwd,
    ['EDGE_STORE_ACCESS_KEY', 'EDGE_STORE_SECRET_KEY'],
    options,
  );
}

function requirePlainSecretDelivery(
  flags: GlobalFlags,
  options: SecretDeliveryOptions,
): void {
  if (flags.plain && !options.copy && !options.output) {
    throw usageError(
      'secret_delivery_required',
      'Plain output requires --copy or --output for the one-time key.',
    );
  }
}

function keyValues(accessKey: string, secretKey: string) {
  return {
    EDGE_STORE_ACCESS_KEY: accessKey,
    EDGE_STORE_SECRET_KEY: secretKey,
  };
}

function envLines(values: Record<string, string>): string[] {
  return Object.entries(values).map(([name, value]) => `${name}=${value}`);
}

function requireInteractiveConfirmation(
  runtime: CliRuntime,
  flags: GlobalFlags,
  suggestions: string[],
): void {
  if (!runtime.io.inputIsTty || flags.json) {
    throw usageError(
      'confirmation_required',
      'This operation requires confirmation.',
      suggestions,
    );
  }
}
