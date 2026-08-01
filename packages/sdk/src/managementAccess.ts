import type {
  OperationBody,
  OperationQuery,
  OperationResult,
} from './internal/operationTypes';
import type { Transport } from './internal/transport';

type CallOptions = {
  /** Cancels the request. */
  signal?: AbortSignal;
};
type AccountInput = {
  /** Account ID. */
  account: string;
};
type ProjectInput = {
  /** Project ID or slug. */
  project: string;
};
type UserInput = AccountInput & {
  /** User ID. */
  userId: string;
};
type InvitationInput = AccountInput & {
  /** Invitation ID. */
  invitationId: string;
};

/** Management operations for account access and credentials. */
export type ManagementAccessClient = {
  accounts: {
    /** Lists accounts visible to the management token. */
    list(
      options?: CallOptions,
    ): Promise<OperationResult<'v2.management.accounts.list'>>;
    /** Gets an account by ID. */
    get(
      input: AccountInput & CallOptions,
    ): Promise<OperationResult<'v2.management.accounts.get'>>;
    /** Removes the current user from an account. */
    leave(
      input: AccountInput & CallOptions,
    ): Promise<OperationResult<'v2.management.accounts.leave'>>;
  };
  projectKeys: {
    /** Lists project credentials. */
    list(
      input: ProjectInput & CallOptions,
    ): Promise<OperationResult<'v2.management.projectKeys.list'>>;
    /** Creates project credentials. The secret is returned only once. */
    create(
      input: ProjectInput &
        OperationBody<'v2.management.projectKeys.create'> &
        CallOptions,
    ): Promise<OperationResult<'v2.management.projectKeys.create'>>;
    /** Revokes project credentials. */
    revoke(
      input: ProjectInput & { keyId: string } & CallOptions,
    ): Promise<OperationResult<'v2.management.projectKeys.revoke'>>;
  };
  members: {
    /** Lists account members using page-based pagination. */
    list(
      input: AccountInput &
        OperationQuery<'v2.management.members.list'> &
        CallOptions,
    ): Promise<OperationResult<'v2.management.members.list'>>;
    /** Updates an account member's role. */
    update(
      input: UserInput &
        OperationBody<'v2.management.members.update'> &
        CallOptions,
    ): Promise<OperationResult<'v2.management.members.update'>>;
    /** Removes a member from an account. */
    remove(
      input: UserInput & CallOptions,
    ): Promise<OperationResult<'v2.management.members.remove'>>;
  };
  invitations: {
    /** Lists pending account invitations. */
    list(
      input: AccountInput &
        OperationQuery<'v2.management.invitations.list'> &
        CallOptions,
    ): Promise<OperationResult<'v2.management.invitations.list'>>;
    /** Invites a member to an account. */
    create(
      input: AccountInput &
        OperationBody<'v2.management.invitations.create'> &
        CallOptions,
    ): Promise<OperationResult<'v2.management.invitations.create'>>;
    /** Revokes a pending invitation. */
    revoke(
      input: InvitationInput & CallOptions,
    ): Promise<OperationResult<'v2.management.invitations.revoke'>>;
    /** Resends a pending invitation. */
    resend(
      input: InvitationInput & CallOptions,
    ): Promise<OperationResult<'v2.management.invitations.resend'>>;
  };
  tokens: {
    /** Lists management tokens owned by an account. */
    listAccount(
      input: AccountInput &
        OperationQuery<'v2.management.tokens.listAccount'> &
        CallOptions,
    ): Promise<OperationResult<'v2.management.tokens.listAccount'>>;
    /** Creates an account-owned management token. */
    createAccount(
      input: AccountInput &
        OperationBody<'v2.management.tokens.createAccount'> &
        CallOptions,
    ): Promise<OperationResult<'v2.management.tokens.createAccount'>>;
    /** Lists management tokens owned by the current user. */
    listUser(
      input?: OperationQuery<'v2.management.tokens.listUser'> & CallOptions,
    ): Promise<OperationResult<'v2.management.tokens.listUser'>>;
    /** Creates a user-owned management token. */
    createUser(
      input: OperationBody<'v2.management.tokens.createUser'> & CallOptions,
    ): Promise<OperationResult<'v2.management.tokens.createUser'>>;
    /** Revokes a management token. */
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
        transport.execute((client) =>
          client.GET('/management/accounts', {
            signal: options?.signal,
          }),
        ),
      get: ({ account, signal }) =>
        transport.execute((client) =>
          client.GET('/management/accounts/{accountId}', {
            params: { path: { accountId: account } },
            signal,
          }),
        ),
      leave: ({ account, signal }) =>
        transport.execute((client) =>
          client.POST('/management/accounts/{accountId}/leave', {
            params: { path: { accountId: account } },
            signal,
          }),
        ),
    },
    projectKeys: {
      list: ({ project, signal }) =>
        transport.execute((client) =>
          client.GET('/management/projects/{projectRef}/keys', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
      create: ({ project, signal, ...body }) =>
        transport.execute((client) =>
          client.POST('/management/projects/{projectRef}/keys', {
            params: { path: { projectRef: project } },
            body,
            signal,
          }),
        ),
      revoke: ({ project, keyId, signal }) =>
        transport.execute((client) =>
          client.DELETE('/management/projects/{projectRef}/keys/{keyId}', {
            params: { path: { projectRef: project, keyId } },
            signal,
          }),
        ),
    },
    members: {
      list: ({ account, signal, ...query }) =>
        transport.execute((client) =>
          client.GET('/management/accounts/{accountId}/members', {
            params: {
              path: { accountId: account },
              query,
            },
            signal,
          }),
        ),
      update: ({ account, userId, signal, ...body }) =>
        transport.execute((client) =>
          client.PATCH('/management/accounts/{accountId}/members/{userId}', {
            params: { path: { accountId: account, userId } },
            body,
            signal,
          }),
        ),
      remove: ({ account, userId, signal }) =>
        transport.execute((client) =>
          client.DELETE('/management/accounts/{accountId}/members/{userId}', {
            params: { path: { accountId: account, userId } },
            signal,
          }),
        ),
    },
    invitations: {
      list: ({ account, signal, ...query }) =>
        transport.execute((client) =>
          client.GET('/management/accounts/{accountId}/invitations', {
            params: {
              path: { accountId: account },
              query,
            },
            signal,
          }),
        ),
      create: ({ account, signal, ...body }) =>
        transport.execute((client) =>
          client.POST('/management/accounts/{accountId}/invitations', {
            params: {
              path: { accountId: account },
            },
            body,
            signal,
          }),
        ),
      revoke: ({ account, invitationId, signal }) =>
        transport.execute((client) =>
          client.DELETE(
            '/management/accounts/{accountId}/invitations/{invitationId}',
            {
              params: { path: { accountId: account, invitationId } },
              signal,
            },
          ),
        ),
      resend: ({ account, invitationId, signal }) =>
        transport.execute((client) =>
          client.POST(
            '/management/accounts/{accountId}/invitations/{invitationId}/resend',
            {
              params: { path: { accountId: account, invitationId } },
              signal,
            },
          ),
        ),
    },
    tokens: {
      listAccount: ({ account, signal, ...query }) =>
        transport.execute((client) =>
          client.GET('/management/accounts/{accountId}/tokens', {
            params: {
              path: { accountId: account },
              query,
            },
            signal,
          }),
        ),
      createAccount: ({ account, signal, ...body }) =>
        transport.execute((client) =>
          client.POST('/management/accounts/{accountId}/tokens', {
            params: { path: { accountId: account } },
            body,
            signal,
          }),
        ),
      listUser: ({ signal, ...query } = {}) =>
        transport.execute((client) =>
          client.GET('/management/users/me/tokens', {
            params: { query },
            signal,
          }),
        ),
      createUser: ({ signal, ...body }) =>
        transport.execute((client) =>
          client.POST('/management/users/me/tokens', {
            body,
            signal,
          }),
        ),
      revoke: ({ tokenId, signal }) =>
        transport.execute((client) =>
          client.DELETE('/management/tokens/{tokenId}', {
            params: { path: { tokenId } },
            signal,
          }),
        ),
    },
  };
}
