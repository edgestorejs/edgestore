import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/pages';

const es = initEdgeStore.create();

const filesBucket = es.fileBucket;

const edgeStoreRouter = es.router({
  publicFiles: filesBucket,
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

export default createEdgeStoreNextHandler({
  router: edgeStoreRouter,
});
