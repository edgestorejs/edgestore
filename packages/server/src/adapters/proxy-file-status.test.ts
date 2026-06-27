import { createServer, request as httpRequest, type Server } from 'node:http';
import { type EdgeStoreRouter, type Provider } from '@edgestore/shared';
import express from 'express';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEdgeStoreExpressHandler } from './express';
import { createEdgeStoreHonoHandler } from './hono';

function createProvider(): Provider {
  return {
    name: 'test-provider',
    init: vi.fn(() => ({ token: 'provider-token' })),
    getBaseUrl: vi.fn(() => 'https://files.example.com'),
    getFile: vi.fn(),
    requestUpload: vi.fn(),
    requestUploadParts: vi.fn(),
    completeMultipartUpload: vi.fn(),
    confirmUpload: vi.fn(),
    deleteFile: vi.fn(),
  };
}

function createRouter() {
  return {} as EdgeStoreRouter<Record<string, never>>;
}

function mockProxyFetch({
  body,
  contentType,
  status,
}: {
  body: string;
  contentType: string;
  status: number;
}) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body, {
      status,
      headers: {
        'Content-Type': contentType,
      },
    }),
  );
}

async function createExpressServer() {
  const handler = createEdgeStoreExpressHandler({
    provider: createProvider(),
    router: createRouter(),
  });
  const app = express();
  app.use('/edgestore', handler);

  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine test server address');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/edgestore`,
    close: () => closeServer(server),
  };
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function request({ cookie, url }: { cookie: string; url: string }) {
  return new Promise<{
    body: string;
    contentType: string | undefined;
    status: number | undefined;
  }>((resolve, reject) => {
    const req = createServerRequest(url, {
      Cookie: cookie,
    });

    req.on('response', (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      res.on('end', () => {
        resolve({
          body: Buffer.concat(chunks).toString('utf8'),
          contentType: res.headers['content-type'],
          status: res.statusCode,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function createServerRequest(url: string, headers: Record<string, string>) {
  return httpRequest(url, {
    headers,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Express proxy-file', () => {
  it('returns the upstream status while preserving body and Content-Type', async () => {
    const fetchMock = mockProxyFetch({
      body: 'upstream denied',
      contentType: 'text/plain',
      status: 403,
    });
    const server = await createExpressServer();

    try {
      const res = await request({
        cookie: 'session=abc',
        url: `${server.baseUrl}/proxy-file?url=${encodeURIComponent(
          'https://files.example.com/private.txt',
        )}`,
      });

      expect(res.status).toBe(403);
      expect(res.contentType).toBe('text/plain');
      expect(res.body).toBe('upstream denied');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://files.example.com/private.txt',
        {
          headers: {
            cookie: 'session=abc',
          },
        },
      );
    } finally {
      await server.close();
    }
  });
});

describe('Hono proxy-file', () => {
  it('returns the upstream status while preserving body and Content-Type', async () => {
    const fetchMock = mockProxyFetch({
      body: 'rate limited',
      contentType: 'application/json',
      status: 429,
    });
    const handler = createEdgeStoreHonoHandler({
      provider: createProvider(),
      router: createRouter(),
    });
    const app = new Hono();
    app.all('/edgestore/*', handler);

    const res = await app.request(
      '/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example.com%2Fblocked.json',
      {
        headers: {
          Cookie: 'session=abc',
        },
      },
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.text()).toBe('rate limited');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://files.example.com/blocked.json',
      {
        headers: {
          cookie: 'session=abc',
        },
      },
    );
  });
});
