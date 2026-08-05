import type {
  AnyEdgeStoreProvider,
  EdgeStoreProvider,
  ProviderCursor,
  ProviderReference,
} from '@edgestore/shared';
import type { StandardSchemaV1 } from '@standard-schema/spec';

export function defineProvider<
  const TReferenceSchema extends StandardSchemaV1,
  const TCursorSchema extends StandardSchemaV1 = StandardSchemaV1<
    unknown,
    string
  >,
  const TProvider extends EdgeStoreProvider<
    TReferenceSchema,
    StandardSchemaV1.InferOutput<TCursorSchema>
  > = EdgeStoreProvider<
    TReferenceSchema,
    StandardSchemaV1.InferOutput<TCursorSchema>
  >,
>(
  provider: TProvider & {
    reference: { schema: TReferenceSchema };
    files: { cursorSchema?: TCursorSchema };
  },
): TProvider {
  return provider;
}

export async function getProviderBaseUrl(
  provider: AnyEdgeStoreProvider,
): Promise<string> {
  return typeof provider.baseUrl === 'function'
    ? await provider.baseUrl()
    : provider.baseUrl;
}

export async function referenceFromUrl<TProvider extends AnyEdgeStoreProvider>(
  provider: TProvider,
  url: string,
): Promise<ProviderReference<TProvider>> {
  return await validateProviderValue(
    provider.reference.schema,
    await provider.reference.fromUrl(url),
    'file reference',
  );
}

export async function validateProviderReference<
  TProvider extends AnyEdgeStoreProvider,
>(
  provider: TProvider,
  reference: unknown,
): Promise<ProviderReference<TProvider>> {
  return await validateProviderValue(
    provider.reference.schema,
    reference,
    'file reference',
  );
}

export async function validateProviderCursor<
  TProvider extends AnyEdgeStoreProvider,
>(provider: TProvider, cursor: unknown): Promise<ProviderCursor<TProvider>> {
  const schema = provider.files.cursorSchema;
  if (!schema) return cursor as ProviderCursor<TProvider>;
  return await validateProviderValue(schema, cursor, 'list cursor');
}

async function validateProviderValue<TSchema extends StandardSchemaV1>(
  schema: TSchema,
  value: unknown,
  label: string,
): Promise<StandardSchemaV1.InferOutput<TSchema>> {
  const result = await schema['~standard'].validate(value);
  if (!result.issues) return result.value;
  const detail = result.issues.map((issue) => issue.message).join('; ');
  throw new TypeError(`Invalid provider ${label}: ${detail}`);
}
