import { renderCliCommand } from '../core/command';
import { activeAccountFor, withActiveAccount } from '../core/config';
import { CliError, normalizeError, usageError } from '../core/errors';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { apiUrlFor, outputFor, sdkFor } from '../core/runtime';

type Account = Awaited<
  ReturnType<
    Awaited<ReturnType<typeof sdkFor>>['management']['accounts']['list']
  >
>['accounts'][number];

export async function accountListCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<void> {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.accounts.list({ signal: runtime.signal });
  const config = await runtime.globalConfig.read();
  const activeAccount = activeAccountFor(
    config,
    apiUrlFor(runtime, flags).displayUrl,
  );
  const rows = result.accounts.map((account) => [
    account.id === activeAccount ? '*' : '',
    account.id,
    account.type.toLowerCase(),
    account.displayName,
    account.role?.toLowerCase() ?? '-',
  ]);
  const human = result.accounts.length
    ? renderTable(['CURRENT', 'ID', 'TYPE', 'NAME', 'ROLE'], rows)
    : 'No accounts found.';

  outputFor(runtime, flags).result(result, human);
}

export async function accountCurrentCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<void> {
  const accountId = await activeAccount(runtime, flags);

  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.accounts.get({
    account: accountId,
    signal: runtime.signal,
  });
  const { account } = result;
  outputFor(runtime, flags).result(
    result,
    `${account.displayName} (${account.id})`,
    account.id,
  );
}

export async function accountSwitchCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  selector: string,
): Promise<void> {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.accounts.list({ signal: runtime.signal });
  const account = findAccount(result.accounts, selector);
  if (!account) {
    throw usageError(
      'account_not_found',
      selector === 'personal'
        ? 'No personal account is available to this credential.'
        : `Account ${selector} is not available to this credential.`,
      ['edgestore account list'],
    );
  }

  const config = await runtime.globalConfig.read();
  await runtime.globalConfig.write(
    withActiveAccount(config, apiUrlFor(runtime, flags).displayUrl, account.id),
  );
  outputFor(runtime, flags).result(
    account,
    `Switched to ${account.displayName} (${account.id}).`,
    account.id,
  );
}

export async function activeAccount(
  runtime: CliRuntime,
  flags: GlobalFlags,
  explicitAccount?: string,
): Promise<string> {
  if (explicitAccount) {
    return explicitAccount;
  }

  const config = await runtime.globalConfig.read();
  const account = activeAccountFor(
    config,
    apiUrlFor(runtime, flags).displayUrl,
  );
  if (!account) {
    throw missingAccountError();
  }
  return account;
}

export async function accountUsageCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<void> {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.accounts.get({
    account: await activeAccount(runtime, flags),
    signal: runtime.signal,
  });
  const account = result.account;
  outputFor(runtime, flags).result(
    result,
    [
      `Account: ${account.displayName} (${account.id})`,
      `Storage: ${account.usageBytes}/${account.storageLimitBytes} bytes`,
      `Projects: ${account.projectCount}/${account.projectLimit}`,
      `Plan: ${account.planType}`,
    ].join('\n'),
    String(account.usageBytes),
  );
}

export async function accountBillingCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<void> {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.accounts.get({
    account: await activeAccount(runtime, flags),
    signal: runtime.signal,
  });
  const account = result.account;
  outputFor(runtime, flags).result(
    result,
    [
      `Plan: ${account.planType}`,
      `Storage limit: ${account.storageLimitBytes} bytes`,
      `Project limit: ${account.projectLimit}`,
      `Member limit: ${account.memberLimit}`,
      '',
      'Open billing:',
      '  edgestore open billing',
    ].join('\n'),
    account.planType,
  );
}

export async function accountLeaveCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: { yes?: boolean },
): Promise<void> {
  const config = await runtime.globalConfig.read();
  const apiOrigin = apiUrlFor(runtime, flags).displayUrl;
  const accountId = activeAccountFor(config, apiOrigin);
  if (!accountId) throw missingAccountError();
  const sdk = await sdkFor(runtime, flags);
  const current = await sdk.management.accounts.get({
    account: accountId,
    signal: runtime.signal,
  });
  if (current.account.type === 'PERSONAL') {
    throw usageError(
      'personal_account',
      'You cannot leave a personal account.',
    );
  }
  const listed = await sdk.management.accounts.list({ signal: runtime.signal });
  const personal = listed.accounts.find(
    (account) => account.type === 'PERSONAL',
  );
  if (!personal) {
    throw new CliError(
      'personal_account_not_found',
      'No personal account is available to switch to after leaving.',
    );
  }
  if (!options.yes) {
    if (!runtime.io.inputIsTty || flags.json) {
      throw usageError(
        'confirmation_required',
        'Leaving an account requires confirmation.',
        [renderCliCommand(flags, ['account', 'leave', '--yes'])],
      );
    }
    await runtime.prompts.confirmTyped(
      `Type ${accountId} to leave ${current.account.displayName}`,
      accountId,
    );
  }
  await sdk.management.accounts.leave({
    account: accountId,
    signal: runtime.signal,
  });
  try {
    await runtime.globalConfig.write(
      withActiveAccount(config, apiOrigin, personal.id),
    );
  } catch (error) {
    const failure = normalizeError(error);
    throw new CliError(
      'account_leave_partial_failure',
      `Left ${current.account.displayName}, but the active account could not be switched to ${personal.displayName}.`,
      {
        details: {
          status: 'partial',
          leftAccount: {
            id: accountId,
            displayName: current.account.displayName,
          },
          activeAccount: {
            intendedId: personal.id,
            status: 'update_failed',
          },
          configPath: runtime.globalConfig.path,
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
          renderCliCommand(flags, ['account', 'switch', 'personal']),
        ],
        exitCode: failure.exitCode,
      },
    );
  }
  outputFor(runtime, flags).result(
    { left: accountId, activeAccount: personal.id },
    `Left ${current.account.displayName}. Switched to ${personal.displayName}.`,
    personal.id,
  );
}

function findAccount(
  accounts: Account[],
  selector: string,
): Account | undefined {
  if (selector === 'personal') {
    return accounts.find((account) => account.type === 'PERSONAL');
  }
  return accounts.find((account) => account.id === selector);
}

function missingAccountError() {
  return usageError('account_context_required', 'No active account selected.', [
    'edgestore account list',
    'edgestore account switch <account-id>',
  ]);
}
