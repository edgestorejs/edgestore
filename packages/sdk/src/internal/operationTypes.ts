import type {
  ResponseObjectMap,
  SuccessResponse,
} from 'openapi-typescript-helpers';
import type { operations } from '../generated/api-v2';
import type { ApiData } from './transport';

export type OperationId = keyof operations;

export type SystemOperationId = 'v2.health' | 'v2.whoami';

export type RuntimeOperationId =
  | 'v2.runtime.accessToken.create'
  | 'v2.runtime.projects.get'
  | 'v2.runtime.buckets.list'
  | 'v2.runtime.buckets.get'
  | 'v2.runtime.files.search'
  | 'v2.runtime.files.lookup'
  | 'v2.runtime.files.signedUrls.create'
  | 'v2.runtime.files.confirm'
  | 'v2.runtime.files.delete'
  | 'v2.runtime.files.restore'
  | 'v2.runtime.uploads.request'
  | 'v2.runtime.uploads.get'
  | 'v2.runtime.uploads.cancel'
  | 'v2.runtime.uploads.parts.create'
  | 'v2.runtime.uploads.multipart.complete';

export type ManagementResourceOperationId =
  | 'v2.management.projects.list'
  | 'v2.management.projects.create'
  | 'v2.management.projects.get'
  | 'v2.management.projects.delete'
  | 'v2.management.buckets.list'
  | 'v2.management.buckets.create'
  | 'v2.management.buckets.get'
  | 'v2.management.buckets.delete'
  | 'v2.management.buckets.update'
  | 'v2.management.buckets.empty'
  | 'v2.management.buckets.emptyJobs.latest'
  | 'v2.management.buckets.emptyJobs.get'
  | 'v2.management.buckets.emptyJobs.retry'
  | 'v2.management.files.list'
  | 'v2.management.files.lookup'
  | 'v2.management.files.downloadUrls.create'
  | 'v2.management.files.delete'
  | 'v2.management.uploads.request'
  | 'v2.management.uploads.get'
  | 'v2.management.uploads.cancel'
  | 'v2.management.uploads.parts.create'
  | 'v2.management.uploads.multipart.complete';

export type ManagementAccessOperationId =
  | 'v2.management.accounts.list'
  | 'v2.management.accounts.get'
  | 'v2.management.accounts.leave'
  | 'v2.management.projectKeys.list'
  | 'v2.management.projectKeys.create'
  | 'v2.management.projectKeys.revoke'
  | 'v2.management.members.list'
  | 'v2.management.members.remove'
  | 'v2.management.members.update'
  | 'v2.management.invitations.list'
  | 'v2.management.invitations.create'
  | 'v2.management.invitations.revoke'
  | 'v2.management.invitations.resend'
  | 'v2.management.tokens.listAccount'
  | 'v2.management.tokens.createAccount'
  | 'v2.management.tokens.listUser'
  | 'v2.management.tokens.createUser'
  | 'v2.management.tokens.revoke';

type GroupedOperationId =
  | SystemOperationId
  | RuntimeOperationId
  | ManagementResourceOperationId
  | ManagementAccessOperationId;

type IsNever<TValue> = [TValue] extends [never] ? true : false;
type AssertTrue<TValue extends true> = TValue;
type AreDisjoint<TLeft, TRight> = IsNever<Extract<TLeft, TRight>>;
type OperationGroupsArePairwiseDisjoint =
  AreDisjoint<SystemOperationId, RuntimeOperationId> extends true
    ? AreDisjoint<SystemOperationId, ManagementResourceOperationId> extends true
      ? AreDisjoint<SystemOperationId, ManagementAccessOperationId> extends true
        ? AreDisjoint<
            RuntimeOperationId,
            ManagementResourceOperationId
          > extends true
          ? AreDisjoint<
              RuntimeOperationId,
              ManagementAccessOperationId
            > extends true
            ? AreDisjoint<
                ManagementResourceOperationId,
                ManagementAccessOperationId
              >
            : false
          : false
        : false
      : false
    : false;

export type OperationGroupsAreExhaustive = AssertTrue<
  IsNever<Exclude<OperationId, GroupedOperationId>>
>;
export type OperationGroupsContainOnlyOperations = AssertTrue<
  IsNever<Exclude<GroupedOperationId, OperationId>>
>;
export type OperationGroupsDoNotOverlap =
  AssertTrue<OperationGroupsArePairwiseDisjoint>;

export type OperationBody<TOperation extends OperationId> =
  operations[TOperation] extends {
    requestBody: { content: { 'application/json': infer TBody } };
  }
    ? TBody
    : never;

export type SuccessBody<TResponses extends Record<string | number, unknown>> =
  SuccessResponse<TResponses, 'application/json'>;

export type OperationResult<TOperation extends OperationId> = ApiData<
  SuccessBody<ResponseObjectMap<operations[TOperation]>>
>;
