import { type StandardSchemaV1 } from '@standard-schema/spec';
import { EdgeStoreError } from '../errors';

/** @internal */
export const NO_INPUT = Symbol('edgestore.no-input');

/** @internal */
export type NoInput = typeof NO_INPUT;

export type AnySchema = StandardSchemaV1<any, Record<string, unknown>>;

/** @internal */
export type AnyInput = AnySchema | NoInput;

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
export async function parseBucketInput<TSchema extends AnyInput>(
  schema: TSchema,
  input: unknown,
): Promise<
  TSchema extends NoInput ? Record<string, never> : InferSchemaOutput<TSchema>
> {
  if (schema === NO_INPUT) {
    return {} as TSchema extends NoInput
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

  return result.value as TSchema extends NoInput
    ? Record<string, never>
    : InferSchemaOutput<TSchema>;
}
