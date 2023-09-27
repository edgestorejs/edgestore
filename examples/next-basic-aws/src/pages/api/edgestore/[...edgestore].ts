import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/pages';
import { AWSProvider } from '@edgestore/server/providers/aws';

const es = initEdgeStore.create();

const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

export default createEdgeStoreNextHandler({
  provider: AWSProvider(),
  router: edgeStoreRouter,
});
