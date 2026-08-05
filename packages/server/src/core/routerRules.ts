import {
  EdgeStoreError,
  parseBucketInput as parseSchemaInput,
  type AnyBuilder,
  type InferBucketPathObject,
  type InferBucketPathOrder,
} from '@edgestore/shared';

export async function parseBucketInput<TBucket extends AnyBuilder>(
  bucket: TBucket,
  input: unknown,
) {
  return parseSchemaInput(bucket._def.input, input);
}

export function buildPath(params: {
  bucket: AnyBuilder;
  pathAttrs: {
    ctx: unknown;
    input: unknown;
  };
}) {
  const pathParams = params.bucket._def.path;
  return pathParams.map((param) => {
    const entry = Object.entries(param)[0];
    if (!entry) {
      throw new EdgeStoreError({
        message: `Empty path param found in: ${JSON.stringify(pathParams)}`,
        code: 'SERVER_ERROR',
      });
    }
    const [key, value] = entry;
    const pathValue = value()
      .split('.')
      .reduce<unknown>((current, segment) => {
        if (
          typeof current !== 'object' ||
          current === null ||
          !(segment in current)
        ) {
          throw new EdgeStoreError({
            message: `Missing key ${segment} in ${JSON.stringify(current)}`,
            code: 'BAD_REQUEST',
          });
        }
        return (current as Record<string, unknown>)[segment];
      }, params.pathAttrs);

    return { key, value: pathValue as string };
  });
}

export function parsePath<TBucket extends AnyBuilder>(
  path: { key: string; value: string }[],
) {
  return {
    parsedPath: Object.fromEntries(path.map(({ key, value }) => [key, value])),
    pathOrder: path.map(({ key }) => key),
  } as {
    parsedPath: InferBucketPathObject<TBucket>;
    pathOrder: InferBucketPathOrder<TBucket>;
  };
}
