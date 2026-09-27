import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app';

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
const handler = createEdgeStoreNextHandler({ router });

export { handler as GET, handler as POST };
