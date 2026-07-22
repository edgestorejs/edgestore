import type {
  OperationBody,
  OperationQuery,
  OperationResult,
} from './internal/operationTypes';
import type { Transport } from './internal/transport';

type CallOptions = { signal?: AbortSignal };
type AccountInput = { account: string };
type ProjectInput = { project: string };
type UserInput = AccountInput & { userId: string };
type InvitationInput = AccountInput & { invitationId: string };
type Idempotent = { idempotencyKey?: string };

export type ManagementAccessClient = {
  accounts: {
    list(
      options?: CallOptions,
    ): Promise<OperationResult<'v2.management.accounts.list'>>;
    get(
      input: AccountInput & CallOptions,
    ): Promise<OperationResult<'v2.management.accounts.get'>>;
    leave(
      input: AccountInput & CallOptions,
    ): Promise<OperationResult<'v2.management.accounts.leave'>>;
  };
  projectKeys: {
    list(
      input: ProjectInput & CallOptions,
    ): Promise<OperationResult<'v2.management.projectKeys.list'>>;
    create(
      input: ProjectInput &
        OperationBody<'v2.management.projectKeys.create'> &
        Idempotent &
        CallOptions,
    ): Promise<OperationResult<'v2.management.projectKeys.create'>>;
    revoke(
      input: ProjectInput & { keyId: string } & CallOptions,
    ): Promise<OperationResult<'v2.management.projectKeys.revoke'>>;
  };
  members: {
    list(
      input: AccountInput &
        OperationQuery<'v2.management.members.list'> &
        CallOptions,
    ): Promise<OperationResult<'v2.management.members.list'>>;
    update(
      input: UserInput &
        OperationBody<'v2.management.members.update'> &
        CallOptions,
    ): Promise<OperationResult<'v2.management.members.update'>>;
    remove(
      input: UserInput & CallOptions,
    ): Promise<OperationResult<'v2.management.members.remove'>>;
  };
  invitations: {
    list(
      input: AccountInput &
        OperationQuery<'v2.management.invitations.list'> &
        CallOptions,
    ): Promise<OperationResult<'v2.management.invitations.list'>>;
    create(
      input: AccountInput &
        OperationBody<'v2.management.invitations.create'> &
        Idempotent &
        CallOptions,
    ): Promise<OperationResult<'v2.management.invitations.create'>>;
    revoke(
      input: InvitationInput & CallOptions,
    ): Promise<OperationResult<'v2.management.invitations.revoke'>>;
    resend(
      input: InvitationInput & CallOptions,
    ): Promise<OperationResult<'v2.management.invitations.resend'>>;
  };
  tokens: {
    listAccount(
      input: AccountInput &
        OperationQuery<'v2.management.tokens.listAccount'> &
        CallOptions,
    ): Promise<OperationResult<'v2.management.tokens.listAccount'>>;
    createAccount(
      input: AccountInput &
        OperationBody<'v2.management.tokens.createAccount'> &
        Idempotent &
        CallOptions,
    ): Promise<OperationResult<'v2.management.tokens.createAccount'>>;
    listUser(
      input?: OperationQuery<'v2.management.tokens.listUser'> & CallOptions,
    ): Promise<OperationResult<'v2.management.tokens.listUser'>>;
    createUser(
      input: OperationBody<'v2.management.tokens.createUser'> &
        Idempotent &
        CallOptions,
    ): Promise<OperationResult<'v2.management.tokens.createUser'>>;
    revoke(
      input: { tokenId: string } & CallOptions,
    ): Promise<OperationResult<'v2.management.tokens.revoke'>>;
  };
};

export function createManagementAccessClient(
  transport: Transport,
): ManagementAccessClient {
  return {
    accounts: {
      list: (options) =>
        transport.execute(() =>
          transport.client.GET('/management/accounts', {
            signal: options?.signal,
          }),
        ),
      get: ({ account, signal }) =>
        transport.execute(() =>
          transport.client.GET('/management/accounts/{accountId}', {
            params: { path: { accountId: account } },
            signal,
          }),
        ),
      leave: ({ account, signal }) =>
        transport.execute(() =>
          transport.client.POST('/management/accounts/{accountId}/leave', {
            params: { path: { accountId: account } },
            signal,
          }),
        ),
    },
    projectKeys: {
      list: ({ project, signal }) =>
        transport.execute(() =>
          transport.client.GET('/management/projects/{projectRef}/keys', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
      create: ({ project, idempotencyKey, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST('/management/projects/{projectRef}/keys', {
            params: {
              path: { projectRef: project },
              header: { 'idempotency-key': idempotencyKey },
            },
            body,
            signal,
          }),
        ),
      revoke: ({ project, keyId, signal }) =>
        transport.execute(() =>
          transport.client.DELETE(
            '/management/projects/{projectRef}/keys/{keyId}',
            {
              params: { path: { projectRef: project, keyId } },
              signal,
            },
          ),
        ),
    },
    members: {
      list: ({ account, page, pageSize, signal }) =>
        transport.execute(() =>
          transport.client.GET('/management/accounts/{accountId}/members', {
            params: {
              path: { accountId: account },
              query: { page, pageSize },
            },
            signal,
          }),
        ),
      update: ({ account, userId, signal, ...body }) =>
        transport.execute(() =>
          transport.client.PATCH(
            '/management/accounts/{accountId}/members/{userId}',
            {
              params: { path: { accountId: account, userId } },
              body,
              signal,
            },
          ),
        ),
      remove: ({ account, userId, signal }) =>
        transport.execute(() =>
          transport.client.DELETE(
            '/management/accounts/{accountId}/members/{userId}',
            {
              params: { path: { accountId: account, userId } },
              signal,
            },
          ),
        ),
    },
    invitations: {
      list: ({ account, page, pageSize, signal }) =>
        transport.execute(() =>
          transport.client.GET('/management/accounts/{accountId}/invitations', {
            params: {
              path: { accountId: account },
              query: { page, pageSize },
            },
            signal,
          }),
        ),
      create: ({ account, idempotencyKey, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/management/accounts/{accountId}/invitations',
            {
              params: {
                path: { accountId: account },
                header: { 'idempotency-key': idempotencyKey },
              },
              body,
              signal,
            },
          ),
        ),
      revoke: ({ account, invitationId, signal }) =>
        transport.execute(() =>
          transport.client.DELETE(
            '/management/accounts/{accountId}/invitations/{invitationId}',
            {
              params: { path: { accountId: account, invitationId } },
              signal,
            },
          ),
        ),
      resend: ({ account, invitationId, signal }) =>
        transport.execute(() =>
          transport.client.POST(
            '/management/accounts/{accountId}/invitations/{invitationId}/resend',
            {
              params: { path: { accountId: account, invitationId } },
              signal,
            },
          ),
        ),
    },
    tokens: {
      listAccount: ({ account, page, pageSize, signal }) =>
        transport.execute(() =>
          transport.client.GET('/management/accounts/{accountId}/tokens', {
            params: {
              path: { accountId: account },
              query: { page, pageSize },
            },
            signal,
          }),
        ),
      createAccount: ({ account, idempotencyKey, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST('/management/accounts/{accountId}/tokens', {
            params: {
              path: { accountId: account },
              header: { 'idempotency-key': idempotencyKey },
            },
            body,
            signal,
          }),
        ),
      listUser: (input) =>
        transport.execute(() =>
          transport.client.GET('/management/users/me/tokens', {
            params: { query: { page: input?.page, pageSize: input?.pageSize } },
            signal: input?.signal,
          }),
        ),
      createUser: ({ idempotencyKey, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST('/management/users/me/tokens', {
            params: { header: { 'idempotency-key': idempotencyKey } },
            body,
            signal,
          }),
        ),
      revoke: ({ tokenId, signal }) =>
        transport.execute(() =>
          transport.client.DELETE('/management/tokens/{tokenId}', {
            params: { path: { tokenId } },
            signal,
          }),
        ),
    },
  };
}
