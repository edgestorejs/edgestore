import { createEdgeStore, initEdgeStore } from '@edgestore/server';
import { createEdgeStoreStartHandler } from '@edgestore/server/adapters/start';
import { edgestore } from '@edgestore/server/providers/edgestore';
import { createFileRoute } from '@tanstack/react-router';

const es = initEdgeStore.create();
const router = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof router;

const configuredEdgeStore = createEdgeStore({
  router,
  provider: edgestore(),
});
const handler = createEdgeStoreStartHandler({ edgestore: configuredEdgeStore });

export const Route = createFileRoute('/api/edgestore/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
