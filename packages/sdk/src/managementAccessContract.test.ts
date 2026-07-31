import { describe, expect, it, vi } from 'vitest';
import type { ManagementAccessOperationId } from './operationGroups.test.helper';
import { createEdgeStoreSdk } from './sdk';

type MappingCase = {
  invoke: () => Promise<unknown>;
  method: string;
  path: string;
  body?: unknown;
};

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
    const cases = {
      'v2.management.accounts.list': {
        invoke: () => sdk.management.accounts.list(),
        method: 'GET',
        path: '/v2/management/accounts',
      },
      'v2.management.accounts.get': {
        invoke: () => sdk.management.accounts.get({ account }),
        method: 'GET',
        path: `/v2/management/accounts/${account}`,
      },
      'v2.management.accounts.leave': {
        invoke: () => sdk.management.accounts.leave({ account }),
        method: 'POST',
        path: `/v2/management/accounts/${account}/leave`,
      },
      'v2.management.projectKeys.list': {
        invoke: () => sdk.management.projectKeys.list({ project }),
        method: 'GET',
        path: `/v2/management/projects/${project}/keys`,
      },
      'v2.management.projectKeys.create': {
        invoke: () =>
          sdk.management.projectKeys.create({ project, name: 'Deploy key' }),
        method: 'POST',
        path: `/v2/management/projects/${project}/keys`,
        body: { name: 'Deploy key' },
      },
      'v2.management.projectKeys.revoke': {
        invoke: () =>
          sdk.management.projectKeys.revoke({ project, keyId: 'key-id' }),
        method: 'DELETE',
        path: `/v2/management/projects/${project}/keys/key-id`,
      },
      'v2.management.members.list': {
        invoke: () =>
          sdk.management.members.list({ account, page: 2, pageSize: 10 }),
        method: 'GET',
        path: `/v2/management/accounts/${account}/members?page=2&pageSize=10`,
      },
      'v2.management.members.update': {
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
      'v2.management.members.remove': {
        invoke: () =>
          sdk.management.members.remove({ account, userId: 'user-id' }),
        method: 'DELETE',
        path: `/v2/management/accounts/${account}/members/user-id`,
      },
      'v2.management.invitations.list': {
        invoke: () =>
          sdk.management.invitations.list({ account, page: 2, pageSize: 10 }),
        method: 'GET',
        path: `/v2/management/accounts/${account}/invitations?page=2&pageSize=10`,
      },
      'v2.management.invitations.create': {
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
      'v2.management.invitations.revoke': {
        invoke: () =>
          sdk.management.invitations.revoke({
            account,
            invitationId: 'invitation-id',
          }),
        method: 'DELETE',
        path: `/v2/management/accounts/${account}/invitations/invitation-id`,
      },
      'v2.management.invitations.resend': {
        invoke: () =>
          sdk.management.invitations.resend({
            account,
            invitationId: 'invitation-id',
          }),
        method: 'POST',
        path: `/v2/management/accounts/${account}/invitations/invitation-id/resend`,
      },
      'v2.management.tokens.listAccount': {
        invoke: () =>
          sdk.management.tokens.listAccount({
            account,
            page: 2,
            pageSize: 10,
          }),
        method: 'GET',
        path: `/v2/management/accounts/${account}/tokens?page=2&pageSize=10`,
      },
      'v2.management.tokens.createAccount': {
        invoke: () =>
          sdk.management.tokens.createAccount({
            account,
            name: 'CI token',
            scopes: ['bucket:delete', 'bucket:empty'],
          }),
        method: 'POST',
        path: `/v2/management/accounts/${account}/tokens`,
        body: {
          name: 'CI token',
          scopes: ['bucket:delete', 'bucket:empty'],
        },
      },
      'v2.management.tokens.listUser': {
        invoke: () => sdk.management.tokens.listUser({ page: 2, pageSize: 10 }),
        method: 'GET',
        path: '/v2/management/users/me/tokens?page=2&pageSize=10',
      },
      'v2.management.tokens.createUser': {
        invoke: () =>
          sdk.management.tokens.createUser({
            name: 'CLI token',
            scopes: ['account:read'],
          }),
        method: 'POST',
        path: '/v2/management/users/me/tokens',
        body: { name: 'CLI token', scopes: ['account:read'] },
      },
      'v2.management.tokens.revoke': {
        invoke: () => sdk.management.tokens.revoke({ tokenId: 'token-id' }),
        method: 'DELETE',
        path: '/v2/management/tokens/token-id',
      },
    } satisfies Record<ManagementAccessOperationId, MappingCase>;

    for (const [operationId, testCase] of Object.entries(cases)) {
      requests.length = 0;
      await testCase.invoke();
      expect(requests, operationId).toHaveLength(1);
      const request = requests[0]!;
      expect(request.method, operationId).toBe(testCase.method);
      const url = new URL(request.url);
      expect(`${url.pathname}${url.search}`, operationId).toBe(testCase.path);
      if ('body' in testCase) {
        await expect(request.json(), operationId).resolves.toEqual(
          testCase.body,
        );
      }
    }
  });
});
