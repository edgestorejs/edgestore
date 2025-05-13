import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreRemixHandler } from '@edgestore/server/adapters/remix';

const es = initEdgeStore.create();

const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

const handler = createEdgeStoreRemixHandler({
  router: edgeStoreRouter,
});

export { handler as loader, handler as action };
