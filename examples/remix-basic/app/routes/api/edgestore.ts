import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreRemixHandler } from '@edgestore/server/adapters/remix';

const es = initEdgeStore.create();

const router = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof router;

const handler = createEdgeStoreRemixHandler({ router });

export { handler as loader, handler as action };
