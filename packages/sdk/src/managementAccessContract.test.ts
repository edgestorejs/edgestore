import { describe, expect, it, vi } from 'vitest';
import { createEdgeStoreSdk } from './sdk';

describe('management access request mappings', () => {
  it('maps every access operation to its HTTP contract', async () => {
    const requests: Request[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      requests.push(input instanceof Request ? input : new Request(input));
      return Response.json({ data: {} });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { token: 'management-token' },
      baseUrl: 'https://example.com/v2',
      fetch,
    });
    const account = 'account-id';
    const project = 'project-id';
    const cases: {
      name: string;
      invoke: () => Promise<unknown>;
      method: string;
      path: string;
      body?: unknown;
    }[] = [
      {
        name: 'accounts.list',
        invoke: () => sdk.management.accounts.list(),
        method: 'GET',
        path: '/v2/management/accounts',
      },
      {
        name: 'accounts.get',
        invoke: () => sdk.management.accounts.get({ account }),
        method: 'GET',
        path: `/v2/management/accounts/${account}`,
      },
      {
        name: 'accounts.leave',
        invoke: () => sdk.management.accounts.leave({ account }),
        method: 'POST',
        path: `/v2/management/accounts/${account}/leave`,
      },
      {
        name: 'projectKeys.list',
        invoke: () => sdk.management.projectKeys.list({ project }),
        method: 'GET',
        path: `/v2/management/projects/${project}/keys`,
      },
      {
        name: 'projectKeys.create',
        invoke: () =>
          sdk.management.projectKeys.create({ project, name: 'Deploy key' }),
        method: 'POST',
        path: `/v2/management/projects/${project}/keys`,
        body: { name: 'Deploy key' },
      },
      {
        name: 'projectKeys.revoke',
        invoke: () =>
          sdk.management.projectKeys.revoke({ project, keyId: 'key-id' }),
        method: 'DELETE',
        path: `/v2/management/projects/${project}/keys/key-id`,
      },
      {
        name: 'members.list',
        invoke: () =>
          sdk.management.members.list({ account, page: 2, pageSize: 10 }),
        method: 'GET',
        path: `/v2/management/accounts/${account}/members?page=2&pageSize=10`,
      },
      {
        name: 'members.update',
        invoke: () =>
          sdk.management.members.update({
            account,
            userId: 'user-id',
            role: 'MEMBER',
          }),
        method: 'PATCH',
        path: `/v2/management/accounts/${account}/members/user-id`,
        body: { role: 'MEMBER' },
      },
      {
        name: 'members.remove',
        invoke: () =>
          sdk.management.members.remove({ account, userId: 'user-id' }),
        method: 'DELETE',
        path: `/v2/management/accounts/${account}/members/user-id`,
      },
      {
        name: 'invitations.list',
        invoke: () =>
          sdk.management.invitations.list({ account, page: 2, pageSize: 10 }),
        method: 'GET',
        path: `/v2/management/accounts/${account}/invitations?page=2&pageSize=10`,
      },
      {
        name: 'invitations.create',
        invoke: () =>
          sdk.management.invitations.create({
            account,
            email: 'dev@example.com',
            role: 'MEMBER',
          }),
        method: 'POST',
        path: `/v2/management/accounts/${account}/invitations`,
        body: { email: 'dev@example.com', role: 'MEMBER' },
      },
      {
        name: 'invitations.revoke',
        invoke: () =>
          sdk.management.invitations.revoke({
            account,
            invitationId: 'invitation-id',
          }),
        method: 'DELETE',
        path: `/v2/management/accounts/${account}/invitations/invitation-id`,
      },
      {
        name: 'invitations.resend',
        invoke: () =>
          sdk.management.invitations.resend({
            account,
            invitationId: 'invitation-id',
          }),
        method: 'POST',
        path: `/v2/management/accounts/${account}/invitations/invitation-id/resend`,
      },
      {
        name: 'tokens.listAccount',
        invoke: () =>
          sdk.management.tokens.listAccount({
            account,
            page: 2,
            pageSize: 10,
          }),
        method: 'GET',
        path: `/v2/management/accounts/${account}/tokens?page=2&pageSize=10`,
      },
      {
        name: 'tokens.createAccount',
        invoke: () =>
          sdk.management.tokens.createAccount({
            account,
            name: 'CI token',
            scopes: ['project:read'],
          }),
        method: 'POST',
        path: `/v2/management/accounts/${account}/tokens`,
        body: { name: 'CI token', scopes: ['project:read'] },
      },
      {
        name: 'tokens.listUser',
        invoke: () => sdk.management.tokens.listUser({ page: 2, pageSize: 10 }),
        method: 'GET',
        path: '/v2/management/users/me/tokens?page=2&pageSize=10',
      },
      {
        name: 'tokens.createUser',
        invoke: () =>
          sdk.management.tokens.createUser({
            name: 'CLI token',
            scopes: ['account:read'],
          }),
        method: 'POST',
        path: '/v2/management/users/me/tokens',
        body: { name: 'CLI token', scopes: ['account:read'] },
      },
      {
        name: 'tokens.revoke',
        invoke: () => sdk.management.tokens.revoke({ tokenId: 'token-id' }),
        method: 'DELETE',
        path: '/v2/management/tokens/token-id',
      },
    ];

    for (const testCase of cases) {
      requests.length = 0;
      await testCase.invoke();
      expect(requests, testCase.name).toHaveLength(1);
      const request = requests[0]!;
      expect(request.method, testCase.name).toBe(testCase.method);
      const url = new URL(request.url);
      expect(`${url.pathname}${url.search}`, testCase.name).toBe(testCase.path);
      if (testCase.body !== undefined) {
        await expect(request.json(), testCase.name).resolves.toEqual(
          testCase.body,
        );
      }
    }
  });
});
