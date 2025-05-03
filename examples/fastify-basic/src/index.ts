import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreFastifyHandler } from '@edgestore/server/adapters/fastify';
import fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';

// --- FASTIFY CONFIG ---

const PORT = process.env.PORT ?? 3001;

const app = fastify();

async function configureApp() {
  /**
   * Your fastify app is probably running in a different port than your frontend app.
   * To avoid CORS issues, we should use the cors plugin.
   */
  await app.register(fastifyCors, {
    credentials: true,
    origin: true,
  });

  /**
   * EdgeStore uses cookies to store the context token.
   * We need to use the cookie plugin to parse the cookies.
   */
  await app.register(fastifyCookie);
}

// --- EDGESTORE ROUTER CONFIG ---

const es = initEdgeStore.create();

const edgeStoreRouter = es.router({
  publicImages: es
    .imageBucket()
    /**
     * return `true` to allow upload
     * By default every upload from your app is allowed.
     */
    .beforeUpload(({ ctx, input, fileInfo }) => {
      console.log('beforeUpload', ctx, input, fileInfo);
      return true; // allow upload
    })
    /**
     * return `true` to allow delete
     * This function must be defined if you want to delete files directly from the client.
     */
    .beforeDelete(({ ctx, fileInfo }) => {
      console.log('beforeDelete', ctx, fileInfo);
      return true; // allow delete
    }),
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

const handler = createEdgeStoreFastifyHandler({
  router: edgeStoreRouter,
});

// --- FASTIFY ROUTES ---

app.get('/', async (req, reply) => {
  console.log(req);
  await reply.send('Hello from server!');
});

// set the route for the edgestore handler
app.route({
  method: ['GET', 'POST'],
  url: '/edgestore/*',
  handler,
});

const start = async () => {
  try {
    await configureApp(); // Configure plugins before starting the server
    await app.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`⚡Server is running here 👉 http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Handle the promise properly
start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});