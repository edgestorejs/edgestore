import { createEdgeStore, initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app';
import { edgestore } from '@edgestore/server/providers/edgestore';

const es = initEdgeStore.create();

/**
 * This is the main router for the edgestore buckets.
 */
const router = es.router({
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
export type EdgeStoreRouter = typeof router;

/**
 * The next handler is used to create the API route.
 */
const configuredEdgeStore = createEdgeStore({
  router,
  provider: edgestore(),
});
const handler = createEdgeStoreNextHandler({ edgestore: configuredEdgeStore });

export { handler as GET, handler as POST };
