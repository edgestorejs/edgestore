import type { OperationId } from './internal/operationTypes';

export type SystemOperationId = Extract<OperationId, 'v2.health' | 'v2.whoami'>;

export type RuntimeOperationId = Extract<OperationId, `v2.runtime.${string}`>;

type ManagementOperationId = Extract<OperationId, `v2.management.${string}`>;

type ManagementAccessResource =
  'accounts' | 'projectKeys' | 'members' | 'invitations' | 'tokens';

export type ManagementAccessOperationId = Extract<
  ManagementOperationId,
  `v2.management.${ManagementAccessResource}.${string}`
>;

export type ManagementResourceOperationId = Exclude<
  ManagementOperationId,
  ManagementAccessOperationId
>;

type GroupedOperationId =
  | SystemOperationId
  | RuntimeOperationId
  | ManagementResourceOperationId
  | ManagementAccessOperationId;

type AssertNever<TValue extends never> = TValue;

export type UnclassifiedOperationIdMustBeNever = AssertNever<
  Exclude<OperationId, GroupedOperationId>
>;
