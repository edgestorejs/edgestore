import { initEdgeStore } from '@edgestore/server';
import express from 'express';
import { createEdgeStoreExpressHandler } from '../../../packages/server/dist/adapters/express';

const es = initEdgeStore.create();

/**
 * This is the main router for the Edge Store buckets.
 */
const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

const handler = createEdgeStoreExpressHandler({
  router: edgeStoreRouter,
});

const app = express();

const PORT = process.env.PORT ?? 3001;
app.use(handler);

app.get('/', (req, res) => {
  console.log(req), res.send('Hello from server!');
});

app.listen(PORT, () => {
  console.log(`⚡Server is running here 👉 https://localhost:${PORT}`);
});
