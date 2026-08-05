import { EdgeStoreError, initEdgeStore } from '@edgestore/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildPath, parsePath } from './routerRules';

describe('router path rules', () => {
  it('builds and parses ordered path values from context and input', () => {
    const es = initEdgeStore.context<{ userId: string }>().create();
    const bucket = es
      .fileBucket()
      .input(
        z.object({ org: z.object({ slug: z.string() }), type: z.string() }),
      )
      .path(({ ctx, input }) => [
        { author: ctx.userId },
        { org: input.org.slug },
        { type: input.type },
      ]);

    const path = buildPath({
      bucket,
      pathAttrs: {
        ctx: { userId: 'user-1' },
        input: { org: { slug: 'acme' }, type: 'avatar' },
      },
    });

    expect(path).toEqual([
      { key: 'author', value: 'user-1' },
      { key: 'org', value: 'acme' },
      { key: 'type', value: 'avatar' },
    ]);
    expect(parsePath<typeof bucket>(path)).toEqual({
      parsedPath: {
        author: 'user-1',
        org: 'acme',
        type: 'avatar',
      },
      pathOrder: ['author', 'org', 'type'],
    });
  });

  it('throws an EdgeStoreError when a path value is missing', () => {
    const es = initEdgeStore.context<{ userId: string }>().create();
    const bucket = es.fileBucket().path(({ ctx }) => [{ author: ctx.userId }]);

    expect(() =>
      buildPath({
        bucket,
        pathAttrs: { ctx: {}, input: {} },
      }),
    ).toThrow(EdgeStoreError);
  });
});
