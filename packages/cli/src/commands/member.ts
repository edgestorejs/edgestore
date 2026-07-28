import { usageError } from '../core/errors';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor, sdkFor } from '../core/runtime';
import { activeAccount } from './account';

type Role = 'OWNER' | 'MEMBER' | 'VIEWER';

export async function memberListCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: { page?: number; limit?: number; all?: boolean },
): Promise<void> {
  const account = await teamAccount(runtime, flags);
  if (!account) return;
  const sdk = await sdkFor(runtime, flags);
  const members = [];
  const pageSize = options.limit ?? 50;
  let page = options.page ?? 1;
  do {
    const result = await sdk.management.members.list({
      account: account.id,
      page,
      pageSize,
      signal: runtime.signal,
    });
    members.push(...result.members);
    if (!options.all || result.members.length < pageSize) break;
    page += 1;
  } while (true);
  outputFor(runtime, flags).result(
    { members },
    members.length
      ? renderTable(
          ['USER ID', 'EMAIL', 'ROLE', 'JOINED'],
          members.map((member) => [
            member.userId,
            member.email,
            member.role.toLowerCase(),
            member.createdAt,
          ]),
        )
      : 'No members found.',
  );
}

export async function memberInviteCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: {
    emails: string[];
    role: string;
    allowOverage?: boolean;
  },
): Promise<void> {
  const account = await requireTeamAccount(runtime, flags);
  const role = parseRole(input.role);
  if (role === 'OWNER') {
    await runtime.prompts.confirmTyped(
      'Owners can manage billing, projects, keys, and members. Type owner to confirm',
      'owner',
    );
  }
  const sdk = await sdkFor(runtime, flags);
  const results = [];
  for (const email of input.emails) {
    try {
      const result = await sdk.management.invitations.create({
        account: account.id,
        email,
        role,
        allowOverage: Boolean(input.allowOverage),
        signal: runtime.signal,
      });
      results.push({
        email,
        success: true as const,
        invitation: result.invitation,
      });
    } catch (error) {
      results.push({
        email,
        success: false as const,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  outputFor(runtime, flags).result(
    { results },
    renderTable(
      ['EMAIL', 'STATUS'],
      results.map((result) => [
        result.email,
        result.success ? 'invited' : `failed: ${result.error}`,
      ]),
    ),
  );
  if (results.some((result) => !result.success)) runtime.exitCode = 1;
}

export async function memberRoleCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { userId: string; role: string },
): Promise<void> {
  const account = await requireTeamAccount(runtime, flags);
  const role = parseRole(input.role);
  if (role === 'OWNER') {
    await runtime.prompts.confirmTyped(
      'Owners can manage billing, projects, keys, and members. Type owner to confirm',
      'owner',
    );
  }
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.members.update({
    account: account.id,
    userId: input.userId,
    role,
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    result,
    `Updated ${result.member.email} to ${result.member.role.toLowerCase()}.`,
    result.member.role.toLowerCase(),
  );
}

export async function memberRemoveCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { userId: string; yes?: boolean },
): Promise<void> {
  const account = await requireTeamAccount(runtime, flags);
  await confirmDestructive(runtime, flags, {
    expected: input.userId,
    yes: input.yes,
  });
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.members.remove({
    account: account.id,
    userId: input.userId,
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    result,
    `Removed member ${input.userId}.`,
    input.userId,
  );
}

export async function invitationListCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: { page?: number; limit?: number; all?: boolean },
): Promise<void> {
  const account = await teamAccount(runtime, flags);
  if (!account) return;
  const sdk = await sdkFor(runtime, flags);
  const invitations = [];
  const pageSize = options.limit ?? 50;
  let page = options.page ?? 1;
  do {
    const result = await sdk.management.invitations.list({
      account: account.id,
      page,
      pageSize,
      signal: runtime.signal,
    });
    invitations.push(...result.invitations);
    if (!options.all || result.invitations.length < pageSize) break;
    page += 1;
  } while (true);
  outputFor(runtime, flags).result(
    { invitations },
    invitations.length
      ? renderTable(
          ['ID', 'EMAIL', 'ROLE', 'STATUS'],
          invitations.map((invitation) => [
            invitation.id,
            invitation.email,
            invitation.role.toLowerCase(),
            invitation.status.toLowerCase(),
          ]),
        )
      : 'No pending invitations found.',
  );
}

export async function invitationActionCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { invitationId: string; action: 'revoke' | 'resend'; yes?: boolean },
): Promise<void> {
  const account = await requireTeamAccount(runtime, flags);
  if (input.action === 'revoke') {
    await confirmDestructive(runtime, flags, {
      expected: input.invitationId,
      yes: input.yes,
    });
  }
  const sdk = await sdkFor(runtime, flags);
  const result =
    input.action === 'revoke'
      ? await sdk.management.invitations.revoke({
          account: account.id,
          invitationId: input.invitationId,
          signal: runtime.signal,
        })
      : await sdk.management.invitations.resend({
          account: account.id,
          invitationId: input.invitationId,
          signal: runtime.signal,
        });
  outputFor(runtime, flags).result(
    result,
    `${input.action === 'revoke' ? 'Revoked' : 'Resent'} invitation ${input.invitationId}.`,
    input.invitationId,
  );
}

async function teamAccount(runtime: CliRuntime, flags: GlobalFlags) {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.accounts.get({
    account: await activeAccount(runtime),
    signal: runtime.signal,
  });
  if (result.account.type === 'PERSONAL') {
    outputFor(runtime, flags).result(
      { membersAvailable: false, account: result.account },
      'Current account is personal.\nMembers are only available for team accounts.',
    );
    return undefined;
  }
  return result.account;
}

async function requireTeamAccount(runtime: CliRuntime, flags: GlobalFlags) {
  const account = await teamAccount(runtime, flags);
  if (!account) {
    throw usageError(
      'team_account_required',
      'This command requires a team account.',
    );
  }
  return account;
}

function parseRole(value: string): Role {
  const role = value.toUpperCase();
  if (role === 'OWNER' || role === 'MEMBER' || role === 'VIEWER') return role;
  throw usageError('invalid_member_role', `Unsupported member role: ${value}.`);
}

async function confirmDestructive(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { expected: string; yes?: boolean },
): Promise<void> {
  if (input.yes) return;
  if (!runtime.io.inputIsTty || flags.json) {
    throw usageError('confirmation_required', 'This operation requires --yes.');
  }
  await runtime.prompts.confirmTyped(
    `Type ${input.expected} to confirm`,
    input.expected,
  );
}
