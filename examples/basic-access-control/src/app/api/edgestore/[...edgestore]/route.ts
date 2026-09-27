import { initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreNextHandler,
  type CreateContextOptions,
} from '@edgestore/server/adapters/next/app';
import { cookies } from 'next/headers';
import { z } from 'zod';

type Context = {
  signedIn: 'true' | 'false';
};

async function createContext(_opts: CreateContextOptions): Promise<Context> {
  const signedIn = (await cookies()).get('signedIn')?.value ?? 'false';
  return {
    signedIn: signedIn === 'true' ? 'true' : 'false',
  };
}

const es = initEdgeStore.context<Context>().create();

/**
 * This is the main router for the EdgeStore buckets.
 */
const router = es.router(
  {
    privateImages: es
      .imageBucket()
      .input(z.object({ type: z.enum(['post', 'article']) }))
      .path(({ input }) => [{ type: input.type }])
      .accessControl({
        signedIn: { not: 'false' },
      }),
  },
  {
    baseUrl: 'http://localhost:3000/api/edgestore',
  },
);

const handler = createEdgeStoreNextHandler({
  router,
  createContext,
});

export { handler as GET, handler as POST };

/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof router;

export const backendClient = router.client;
