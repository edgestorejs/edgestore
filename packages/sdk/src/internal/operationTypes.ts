import type { operations } from '../generated/api-v2';
import type { ApiData } from './transport';

export type OperationId = keyof operations;
type SuccessStatus = 200 | 201 | 202 | 204;

export type Mutable<TValue> = {
  -readonly [TKey in keyof TValue]: TValue[TKey];
};

export type OperationBody<TOperation extends OperationId> =
  operations[TOperation] extends {
    requestBody: { content: { 'application/json': infer TBody } };
  }
    ? Mutable<TBody>
    : never;

export type OperationQuery<TOperation extends OperationId> =
  operations[TOperation] extends {
    parameters: { query?: infer TQuery };
  }
    ? Mutable<NonNullable<TQuery>>
    : never;

type SuccessBody<TOperation extends OperationId> =
  operations[TOperation] extends { responses: infer TResponses }
    ? TResponses[SuccessStatus & keyof TResponses] extends {
        content: { 'application/json': infer TBody };
      }
      ? TBody
      : undefined
    : never;

export type OperationResult<TOperation extends OperationId> = ApiData<
  SuccessBody<TOperation>
>;
