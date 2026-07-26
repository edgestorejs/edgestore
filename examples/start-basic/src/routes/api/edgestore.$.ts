import { createEdgeStore, initEdgeStore } from '@edgestore/server';
import { createEdgeStoreStartHandler } from '@edgestore/server/adapters/start';
import { edgestore } from '@edgestore/server/providers/edgestore';
import { createFileRoute } from '@tanstack/react-router';

const es = initEdgeStore.create();
const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

const edgeStore = createEdgeStore({
  router: edgeStoreRouter,
  provider: edgestore(),
});
const handler = createEdgeStoreStartHandler({ edgeStore });

export const Route = createFileRoute('/api/edgestore/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
