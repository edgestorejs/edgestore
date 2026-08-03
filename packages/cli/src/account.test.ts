import { EdgeStoreAbortError } from '@edgestore/sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { runCli } from './cli';
import { account, createFixture, teamAccount } from './testFixture';

describe('account', () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
  });

  it('renders account lists and marks the active account', async () => {
    const exitCode = await runCli(
      ['account', 'list'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.stdout()).toContain('CURRENT');
    expect(fixture.stdout()).toContain('acc_123');
    expect(fixture.stdout()).toContain('personal');
    expect(fixture.stderr()).toBe('');
  });

  it('preserves SDK response casing in JSON', async () => {
    await runCli(['--json', 'account', 'list'], fixture.runtime, '0.0.0');

    expect(JSON.parse(fixture.stdout())).toEqual({ accounts: [account] });
  });

  it('switches to the personal account without changing remote state', async () => {
    fixture.globalConfig.activeAccount = undefined;

    await runCli(
      ['account', 'switch', 'personal', '--plain'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.globalConfig.activeAccount).toBe('acc_123');
    expect(fixture.stdout()).toBe('acc_123\n');
  });

  it('shows usage for the active account', async () => {
    await runCli(['account', 'usage'], fixture.runtime, '0.0.0');

    expect(fixture.stdout()).toContain('Storage: 0/1000 bytes');
    expect(fixture.stdout()).toContain('Projects: 1/3');
  });

  it('leaves a team and switches back to the personal account', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    await runCli(
      ['account', 'leave', '--yes', '--plain'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.accountLeave).toHaveBeenCalledWith({
      account: teamAccount.id,
      signal: fixture.runtime.signal,
    });
    expect(fixture.globalConfig.activeAccount).toBe(account.id);
    expect(fixture.stdout()).toBe(`${account.id}\n`);
  });

  it('preserves API and output context in the account leave confirmation', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;
    fixture.runtime.io.inputIsTty = false;

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'account',
        'leave',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.accountLeave).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error.suggestions).toEqual([
      'edgestore --json --api-url https://api-dev.edgestore.dev account leave --yes',
    ]);
  });

  it('does not leave when the personal fallback cannot be resolved', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;
    fixture.listAccounts.mockRejectedValueOnce(
      new Error('accounts unavailable'),
    );

    const exitCode = await runCli(
      ['account', 'leave', '--yes'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.accountLeave).not.toHaveBeenCalled();
    expect(fixture.globalConfig.activeAccount).toBe(teamAccount.id);
  });

  it('explains that personal accounts do not have members', async () => {
    await runCli(['member', 'list'], fixture.runtime, '0.0.0');

    expect(fixture.stdout()).toContain('Current account is personal.');
    expect(fixture.memberList).not.toHaveBeenCalled();
  });

  it('returns command-specific unavailable results for a personal account', async () => {
    await runCli(['--json', 'member', 'list'], fixture.runtime, '0.0.0');
    expect(JSON.parse(fixture.stdout())).toEqual({
      members: [],
      available: false,
      account,
    });

    fixture = createFixture();
    await runCli(
      ['--json', 'member', 'invitation', 'list'],
      fixture.runtime,
      '0.0.0',
    );
    expect(JSON.parse(fixture.stdout())).toEqual({
      invitations: [],
      available: false,
      account,
    });
    expect(fixture.invitationList).not.toHaveBeenCalled();
  });

  it('describes an empty invitation history without pending-only wording', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    await runCli(['member', 'invitation', 'list'], fixture.runtime, '0.0.0');

    expect(fixture.stdout()).toContain('No invitations found.');
    expect(fixture.stdout()).not.toContain('pending');
  });

  it.each([
    {
      name: 'invite',
      argv: ['member', 'invite', 'friend@example.com'],
      mutation: 'invitationCreate' as const,
    },
    {
      name: 'role',
      argv: ['member', 'role', 'user_123', 'member'],
      mutation: 'memberUpdate' as const,
    },
    {
      name: 'remove',
      argv: ['member', 'remove', 'user_123', '--yes'],
      mutation: 'memberRemove' as const,
    },
    {
      name: 'invitation revoke',
      argv: ['member', 'invitation', 'revoke', 'inv_123', '--yes'],
      mutation: 'invitationRevoke' as const,
    },
    {
      name: 'invitation resend',
      argv: ['member', 'invitation', 'resend', 'inv_123'],
      mutation: 'invitationResend' as const,
    },
  ])(
    'rejects personal-account $name without output or mutation',
    async (test) => {
      const exitCode = await runCli(
        ['--json', ...test.argv],
        fixture.runtime,
        '0.0.0',
      );

      expect(exitCode).toBe(2);
      expect(fixture.stdout()).toBe('');
      expect(JSON.parse(fixture.stderr()).error).toMatchObject({
        code: 'team_account_required',
      });
      expect(fixture[test.mutation]).not.toHaveBeenCalled();
    },
  );

  it('invites a member to the active team', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    await runCli(
      ['member', 'invite', 'friend@example.com', '--role', 'viewer'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.invitationCreate).toHaveBeenCalledWith({
      account: teamAccount.id,
      email: 'friend@example.com',
      role: 'VIEWER',
      allowOverage: false,
      signal: fixture.runtime.signal,
    });
    expect(fixture.stdout()).toContain('invited');
    expect(fixture.confirmTyped).not.toHaveBeenCalled();
  });

  it('rejects plain member invitations before remote work', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    const exitCode = await runCli(
      ['--plain', 'member', 'invite', 'friend@example.com', '--role', 'viewer'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.listAccounts).not.toHaveBeenCalled();
    expect(fixture.invitationCreate).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('--json');
  });

  it('stops a member invitation batch when canceled', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;
    fixture.invitationCreate.mockImplementationOnce(async () => {
      fixture.abortController.abort();
      throw new EdgeStoreAbortError();
    });

    const exitCode = await runCli(
      [
        '--json',
        'member',
        'invite',
        'one@example.com',
        'two@example.com',
        'three@example.com',
        '--role',
        'viewer',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(130);
    expect(fixture.invitationCreate).toHaveBeenCalledTimes(1);
    expect(fixture.stdout()).toBe('');
    expect(JSON.parse(fixture.stderr()).error.code).toBe('interrupted');
  });

  it('requires --yes for noninteractive owner invitations', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'member',
        'invite',
        'one@example.com',
        'two@example.com',
        '--role',
        'owner',
        '--allow-overage',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.invitationCreate).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error.suggestions).toEqual([
      'edgestore --json --api-url https://api-dev.edgestore.dev member invite one@example.com two@example.com --role owner --allow-overage --yes',
    ]);
  });

  it('uses one --yes to confirm a multi-email owner invitation', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    const exitCode = await runCli(
      [
        'member',
        'invite',
        'one@example.com',
        'two@example.com',
        '--role',
        'owner',
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.invitationCreate).toHaveBeenCalledTimes(2);
    expect(fixture.confirmTyped).not.toHaveBeenCalled();
  });

  it('requires --yes for a noninteractive owner role change', async () => {
    fixture.availableAccounts.push(teamAccount);
    fixture.globalConfig.activeAccount = teamAccount.id;

    const exitCode = await runCli(
      ['--json', 'member', 'role', 'user_123', 'owner'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.memberUpdate).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error.suggestions).toEqual([
      'edgestore --json member role user_123 owner --yes',
    ]);
  });
});
