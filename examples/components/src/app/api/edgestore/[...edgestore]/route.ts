import { createEdgeStore, initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app';
import { edgestore } from '@edgestore/server/providers/edgestore';

const es = initEdgeStore.create();

/**
 * This is the main router for the edgestore buckets.
 */
const edgeStoreRouter = es.router({
  /**
   * A public image bucket with no validation.
   */
  myPublicImages: es.imageBucket(),

  /**
   * This accepts any file type.
   */
  myPublicFiles: es.fileBucket(),
});

/**
 * This is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;

/**
 * The next handler is used to create the API route.
 */
const edgeStore = createEdgeStore({
  router: edgeStoreRouter,
  provider: edgestore(),
});
const handler = createEdgeStoreNextHandler({ edgeStore });

export { handler as GET, handler as POST };
