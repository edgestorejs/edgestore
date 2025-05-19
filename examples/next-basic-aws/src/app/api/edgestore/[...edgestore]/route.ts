import { initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreNextHandler,
  type CreateContextOptions,
} from '@edgestore/server/adapters/next/app';
import { AWSProvider } from '@edgestore/server/providers/aws';

type MyContext = {
  userId: string;
};

const es = initEdgeStore.context<MyContext>().create();

function createContext(opts: CreateContextOptions) {
  return {
    userId: '123',
  };
}

/**
 * This is the main router for the EdgeStore buckets.
 */
const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket().path(({ ctx }) => [{ author: ctx.userId }]),
});

const handler = createEdgeStoreNextHandler({
  createContext,
  provider: AWSProvider({
    overwritePath: ({ defaultAccessPath }) => {
      // `publicFiles/_public/123/test.png` -> `123/test.png`
      return defaultAccessPath.split('/_public/')[1];
    },
  }),
  router: edgeStoreRouter,
});

export { handler as GET, handler as POST };

/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;
