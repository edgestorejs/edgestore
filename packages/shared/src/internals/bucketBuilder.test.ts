import { describe, expect, it } from 'vitest';
import { EdgeStoreError } from '../errors';
import { initEdgeStore } from './bucketBuilder';
import { type AnySchema } from './schema';

describe('bucketBuilder path validation', () => {
  it('rejects path params with multiple keys', () => {
    const es = initEdgeStore
      .context<{ author: string; type: string; userId: string }>()
      .create();

    expect(() =>
      es.fileBucket().path(({ ctx }) => [
        {
          author: ctx.author,
          type: ctx.type,
        },
      ]),
    ).toThrow(/Found keys: author, type/);
  });

  it('rejects duplicate path param keys', () => {
    const es = initEdgeStore
      .context<{ author: string; type: string; userId: string }>()
      .create();

    expect(() =>
      es
        .fileBucket()
        .path(({ ctx }) => [{ author: ctx.author }, { author: ctx.userId }]),
    ).toThrow(EdgeStoreError);
  });
});

describe('bucketBuilder input validation', () => {
  it('rejects unsupported Standard Schema versions when configured', () => {
    const es = initEdgeStore.create();
    const unsupportedSchema = {
      '~standard': {
        version: 2,
        vendor: 'test',
        validate: () => ({ value: {} }),
      },
    } as unknown as AnySchema;

    let error: unknown;
    try {
      es.fileBucket().input(unsupportedSchema);
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: 'SERVER_ERROR',
      message: 'Bucket input schemas must implement Standard Schema V1',
    });
  });
});
