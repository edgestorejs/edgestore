import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreExpressHandler } from '@edgestore/server/adapters/express';
import cors from 'cors';
import express from 'express';

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
app.use(cors());

const PORT = process.env.PORT ?? 3001;

app.get('/', (req, res) => {
  console.log(req), res.send('Hello from server!');
});

app.get('/edgestore/*', handler);
app.post('/edgestore/*', handler);

app.listen(PORT, () => {
  console.log(`⚡Server is running here 👉 https://localhost:${PORT}`);
});
