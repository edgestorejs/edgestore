import { createEdgeStore, initEdgeStore } from '@edgestore/server';
import { createEdgeStoreRemixHandler } from '@edgestore/server/adapters/remix';
import { edgestore } from '@edgestore/server/providers/edgestore';

const es = initEdgeStore.create();

const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

const edgeStore = createEdgeStore({
  router: edgeStoreRouter,
  provider: edgestore(),
});
const handler = createEdgeStoreRemixHandler({ edgeStore });

export { handler as loader, handler as action };
