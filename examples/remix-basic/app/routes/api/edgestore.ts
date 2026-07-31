import { createEdgeStore, initEdgeStore } from '@edgestore/server';
import { createEdgeStoreRemixHandler } from '@edgestore/server/adapters/remix';
import { edgestore } from '@edgestore/server/providers/edgestore';

const es = initEdgeStore.create();

const router = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof router;

const configuredEdgeStore = createEdgeStore({
  router,
  provider: edgestore(),
});
const handler = createEdgeStoreRemixHandler({ edgestore: configuredEdgeStore });

export { handler as loader, handler as action };
