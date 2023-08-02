import { initEdgeStore } from '@edge-store/server';
import { createEdgeStoreNextHandler } from '@edge-store/server/adapters/next/app';

const es = initEdgeStore.context().create();

/**
 * This is the main router for the edgestore buckets.
 */
const edgeStoreRouter = es.router({
  /**
   * A public image bucket with no validation.
   */
  myPublicImages: es.imageBucket,

  /**
   * This accepts any file type.
   */
  myPublicFiles: es.fileBucket,
});

/**
 * This is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;

/**
 * The next handler is used to create the API route.
 */
const handler = createEdgeStoreNextHandler({
  router: edgeStoreRouter,
  createContext: () => ({}),
});

export { handler as GET, handler as POST };
