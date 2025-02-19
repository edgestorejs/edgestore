import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreStartHandler } from '@edgestore/server/adapters/start';
import { createAPIFileRoute } from '@tanstack/start/api';

const es = initEdgeStore.create();
const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

const handler = createEdgeStoreStartHandler({
  router: edgeStoreRouter,
});

export const APIRoute = createAPIFileRoute('/api/edgestore/$')({
  GET: handler,
  POST: handler,
});
