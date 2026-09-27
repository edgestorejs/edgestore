import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use(
  '/api/*',
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:4010',
    credentials: true,
  }),
);
app.get('/health', (c) => c.json({ ok: true }));
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 4011) });
