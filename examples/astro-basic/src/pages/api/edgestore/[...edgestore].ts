import { createEdgeStore, initEdgeStore } from '@edgestore/server';
import { createEdgeStoreAstroHandler } from '@edgestore/server/adapters/astro';
import { edgestore } from '@edgestore/server/providers/edgestore';

export const prerender = false;

const es = initEdgeStore.create();

/**
 * This is the main router for the EdgeStore buckets.
 */
const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

const edgeStore = createEdgeStore({
  router: edgeStoreRouter,
  provider: edgestore(),
});
const handler = createEdgeStoreAstroHandler({ edgeStore });

export { handler as GET, handler as POST };

/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;
