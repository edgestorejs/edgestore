import type {
  ResponseObjectMap,
  SuccessResponse,
} from 'openapi-typescript-helpers';
import type { operations } from '../generated/api-v2';
import type { ApiData } from './transport';

export type OperationId = keyof operations;

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
