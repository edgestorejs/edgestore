import { describe, expect, it } from 'vitest';
import { EdgeStoreError } from '../errors';
import { initEdgeStore } from './bucketBuilder';

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
