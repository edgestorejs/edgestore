import { type StandardSchemaV1 } from '@standard-schema/spec';
import { EdgeStoreError } from '../errors';

export type AnySchema = StandardSchemaV1<any, Record<string, unknown>>;

/** @internal */
export type AnyInput = AnySchema | undefined;

export type InferSchemaInput<TSchema extends AnyInput> =
  TSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferInput<TSchema>
    : never;

export type InferSchemaOutput<TSchema extends AnyInput> =
  TSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TSchema>
    : never;

function formatIssue(issue: StandardSchemaV1.Issue): string {
  const path = issue.path
    ?.map((segment) =>
      typeof segment === 'object' ? String(segment.key) : String(segment),
    )
    .join('.');

  return path ? `${path}: ${issue.message}` : issue.message;
}

/** @internal */
export function assertStandardSchema(
  schema: unknown,
): asserts schema is AnySchema {
  const protocol =
    typeof schema === 'object' && schema !== null && '~standard' in schema
      ? schema['~standard']
      : undefined;

  if (
    typeof protocol !== 'object' ||
    protocol === null ||
    !('version' in protocol) ||
    protocol.version !== 1 ||
    !('validate' in protocol) ||
    typeof protocol.validate !== 'function'
  ) {
    throw new EdgeStoreError({
      code: 'SERVER_ERROR',
      message: 'Bucket input schemas must implement Standard Schema V1',
    });
  }
}

/** @internal */
export async function parseBucketInput<TSchema extends AnyInput>(
  schema: TSchema,
  input: unknown,
): Promise<
  TSchema extends undefined ? Record<string, never> : InferSchemaOutput<TSchema>
> {
  if (schema === undefined) {
    return {} as TSchema extends undefined
      ? Record<string, never>
      : InferSchemaOutput<TSchema>;
  }

  const result = await schema['~standard'].validate(input);
  if (result.issues !== undefined) {
    throw new EdgeStoreError({
      code: 'BAD_REQUEST',
      message: `Invalid input: ${result.issues.map(formatIssue).join('; ')}`,
    });
  }

  if (
    typeof result.value !== 'object' ||
    result.value === null ||
    Array.isArray(result.value)
  ) {
    throw new EdgeStoreError({
      code: 'SERVER_ERROR',
      message: 'Bucket input schemas must return an object',
    });
  }

  return result.value as TSchema extends undefined
    ? Record<string, never>
    : InferSchemaOutput<TSchema>;
}
