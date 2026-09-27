import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreStartHandler } from '@edgestore/server/adapters/start';
import { createFileRoute } from '@tanstack/react-router';

const es = initEdgeStore.create();
const router = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof router;

const handler = createEdgeStoreStartHandler({ router });

export const Route = createFileRoute('/api/edgestore/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
