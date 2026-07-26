import { createEdgeStore, initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app';
import { edgestore } from '@edgestore/server/providers/edgestore';

const es = initEdgeStore.create();

/**
 * This is the main router for the EdgeStore buckets.
 */
const edgeStoreRouter = es.router({
  myPublicFiles: es.fileBucket(),
});

const edgeStore = createEdgeStore({
  router: edgeStoreRouter,
  provider: edgestore(),
});

const handler = createEdgeStoreNextHandler({
  edgeStore,
});

export { handler as GET, handler as POST };

/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;
