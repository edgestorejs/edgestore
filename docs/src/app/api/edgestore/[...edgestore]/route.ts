import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app';

const es = initEdgeStore.create();

/**
 * This is the main router for the EdgeStore buckets.
 */
const router = es.router({
  myPublicFiles: es.fileBucket(),
});

const handler = createEdgeStoreNextHandler({
  router,
});

export { handler as GET, handler as POST };

/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof router;
