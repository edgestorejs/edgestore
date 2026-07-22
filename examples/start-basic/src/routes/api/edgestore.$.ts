import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreStartHandler } from '@edgestore/server/adapters/start';
import { createFileRoute } from '@tanstack/react-router';

const es = initEdgeStore.create();
const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

const handler = createEdgeStoreStartHandler({
  router: edgeStoreRouter,
});

export const Route = createFileRoute('/api/edgestore/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
