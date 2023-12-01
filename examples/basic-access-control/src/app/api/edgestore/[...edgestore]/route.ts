import { initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreNextHandler,
  type CreateContextOptions,
} from '@edgestore/server/adapters/next/app';
import { initEdgeStoreClient } from '@edgestore/server/core';
import { cookies } from 'next/headers';
import { z } from 'zod';

type Context = {
  signedIn: 'true' | 'false';
};

function createContext(_opts: CreateContextOptions): Context {
  const signedIn = cookies().get('signedIn')?.value ?? 'false';
  return {
    signedIn: signedIn === 'true' ? 'true' : 'false',
  };
}

const es = initEdgeStore.context<Context>().create();

/**
 * This is the main router for the Edge Store buckets.
 */
const edgeStoreRouter = es.router({
  privateFiles: es
    .fileBucket({
      accept: ['image/*'],
    })
    .input(z.object({ type: z.enum(['post', 'article']) }))
    .path(({ input }) => [{ type: input.type }])
    .accessControl({
      signedIn: { not: 'false' },
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
  baseUrl: 'http://localhost:3000/api/edgestore',
});
