import { createEdgeStore, initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreNextHandler,
  type CreateContextOptions,
} from '@edgestore/server/adapters/next/app';
import { edgestore } from '@edgestore/server/providers/edgestore';
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
 * This is the main router for the EdgeStore buckets.
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
  publicImages: es.imageBucket(),
});

export const edgeStore = createEdgeStore({
  router: edgeStoreRouter,
  provider: edgestore(),
});

export const handler = createEdgeStoreNextHandler({
  edgeStore,
  createContext,
});

/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;

export const backendClient = edgeStore.client;
