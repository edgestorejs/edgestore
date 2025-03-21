import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreExpressHandler } from '@edgestore/server/adapters/express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';

// --- EXPRESS CONFIG ---

const PORT = process.env.PORT ?? 3001;

const app = express();

/**
 * Your express app is probably running in a different port than your frontend app.
 * To avoid CORS issues, we should use the cors middleware.
 */
app.use(
  cors({
    credentials: true,
    origin: true,
  }),
);
/**
 * EdgeStore uses cookies to store the context token.
 * We need to use the cookie parser middleware to parse the cookies.
 */
app.use(cookieParser());
/**
 * We need to have access to the json request body.
 * We can use the body parser middleware to parse the request.
 */
app.use(bodyParser.json());

// --- EDGESTORE ROUTER CONFIG ---

const es = initEdgeStore.create();

const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

const handler = createEdgeStoreExpressHandler({
  router: edgeStoreRouter,
});

// --- EXPRESS ROUTES ---

app.get('/', (req, res) => {
  console.log(req), res.send('Hello from server!');
});

// set the get and post routes for the edgestore router
app.get('/edgestore/*', handler);
app.post('/edgestore/*', handler);

app.listen(PORT, () => {
  console.log(`⚡Server is running here 👉 http://localhost:${PORT}`);
});
