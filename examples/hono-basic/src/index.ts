import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreHonoHandler } from '@edgestore/server/adapters/hono';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// --- HONO CONFIG ---

const PORT = process.env.PORT ?? 3001;
const app = new Hono();

/**
 * Your Hono app is probably running in a different port than your frontend app.
 * To avoid CORS issues, we should use the cors middleware.
 */
app.use(
  '*',
  cors({
    // Change this to your frontend origin for better security
    origin: (origin) => origin,
    credentials: true,
  }),
);

// --- EDGESTORE ROUTER CONFIG ---

const es = initEdgeStore.create();

const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

const handler = createEdgeStoreHonoHandler({
  router: edgeStoreRouter,
});

// --- HONO ROUTES ---

app.get('/', (c) => {
  return c.text('Hello from Hono server!');
});

// Route for EdgeStore
app.all('/edgestore/*', handler);

// Start the server
serve(
  {
    fetch: app.fetch,
    port: Number(PORT),
  },
  (info) => {
    console.log(`⚡Server is running here 👉 http://localhost:${info.port}`);
  },
);
