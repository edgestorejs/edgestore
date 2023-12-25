import { initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreNextHandler,
  type CreateContextOptions,
} from '@edgestore/server/adapters/next/app';
import { initEdgeStoreClient } from '@edgestore/server/core';
import { z } from 'zod';

type Context = {
  userId: string;
  userRole: 'admin' | 'visitor';
};

function createContext(_opts: CreateContextOptions): Context {
  return {
    userId: '123',
    userRole: 'admin',
  };
}

const es = initEdgeStore.context<Context>().create();

/**
 * This is the main router for the Edge Store buckets.
 */
const edgeStoreRouter = es.router({
  publicFiles: es
    .fileBucket({
      maxSize: 1 * 1024 * 1024, // 1MB
      accept: ['image/jpeg', 'image/png'],
    })
    .input(z.object({ type: z.enum(['post', 'article']) }))
    .path(({ ctx, input }) => [{ type: input.type }, { author: ctx.userId }])
    .metadata(({ ctx }) => ({
      role: ctx.userRole,
    }))
    .beforeUpload(({ ctx, input, fileInfo }) => {
      // forbid 50% of the time (for demo purposes)
      return Math.random() < 0.5;
    })
    .beforeDelete(({ ctx, fileInfo }) => {
      // forbid 50% of the time (for demo purposes)
      return Math.random() < 0.5;
    }),
});

const handler = createEdgeStoreNextHandler({
  router: edgeStoreRouter,
  createContext,
});

export { handler as GET, handler as POST };

/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;

export const backendClient = initEdgeStoreClient({
  router: edgeStoreRouter,
});
