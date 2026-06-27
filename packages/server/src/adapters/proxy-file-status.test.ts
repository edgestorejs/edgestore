import { createServer, request as httpRequest, type Server } from 'node:http';
import { type EdgeStoreRouter, type Provider } from '@edgestore/shared';
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { type NextApiRequest, type NextApiResponse } from 'next/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEdgeStoreAstroHandler } from './astro';
import { createEdgeStoreExpressHandler } from './express';
import { createEdgeStoreFastifyHandler } from './fastify';
import { createEdgeStoreHonoHandler } from './hono';
import { createEdgeStoreNextHandler as createEdgeStoreNextAppHandler } from './next/app';
import { createEdgeStoreNextHandler as createEdgeStoreNextPagesHandler } from './next/pages';
import { createEdgeStoreRemixHandler } from './remix';
import { createEdgeStoreStartHandler } from './start';

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
  body: string | null;
  contentType?: string;
  status: number;
}) {
  const headers = contentType ? { 'Content-Type': contentType } : undefined;

  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body, {
      status,
      headers,
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

async function createFastifyServer() {
  const handler = createEdgeStoreFastifyHandler({
    provider: createProvider(),
    router: createRouter(),
  });
  const app = fastify();
  app.all('/edgestore/*', handler);
  await app.listen({ host: '127.0.0.1', port: 0 });

  const address = app.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine test server address');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/edgestore`,
    close: () => app.close(),
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

function createNextPagesResponse() {
  const headers = new Map<string, string | number | readonly string[]>();
  let body: Buffer | undefined;
  let statusCode: number | undefined;

  const res = {
    end: vi.fn((data?: Buffer) => {
      body = data;
      return res;
    }),
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(
      (name: string, value: string | number | readonly string[]) => {
        headers.set(name.toLowerCase(), value);
        return res;
      },
    ),
    status: vi.fn((status: number) => {
      statusCode = status;
      return res;
    }),
  } as unknown as NextApiResponse;

  return {
    getBody: () => body?.toString('utf8'),
    getHeader: (name: string) => headers.get(name.toLowerCase()),
    getStatus: () => statusCode,
    res,
  };
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

  it('returns no body for upstream no-body statuses', async () => {
    const fetchMock = mockProxyFetch({
      body: null,
      status: 204,
    });
    const server = await createExpressServer();

    try {
      const res = await request({
        cookie: 'session=abc',
        url: `${server.baseUrl}/proxy-file?url=${encodeURIComponent(
          'https://files.example.com/no-content.txt',
        )}`,
      });

      expect(res.status).toBe(204);
      expect(res.body).toBe('');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://files.example.com/no-content.txt',
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

describe('Fastify proxy-file', () => {
  it('returns the upstream status while preserving body and Content-Type', async () => {
    const fetchMock = mockProxyFetch({
      body: 'missing file',
      contentType: 'text/plain',
      status: 404,
    });
    const server = await createFastifyServer();

    try {
      const res = await request({
        cookie: 'session=abc',
        url: `${server.baseUrl}/proxy-file?url=${encodeURIComponent(
          'https://files.example.com/missing.txt',
        )}`,
      });

      expect(res.status).toBe(404);
      expect(res.contentType).toBe('text/plain');
      expect(res.body).toBe('missing file');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://files.example.com/missing.txt',
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

describe('Remix proxy-file', () => {
  it('returns the upstream status while preserving body and Content-Type', async () => {
    const fetchMock = mockProxyFetch({
      body: 'remix denied',
      contentType: 'application/json',
      status: 401,
    });
    const handler = createEdgeStoreRemixHandler({
      provider: createProvider(),
      router: createRouter(),
    });

    const res = await handler({
      request: new Request(
        'https://app.example.com/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example.com%2Fremix.json',
        {
          headers: {
            Cookie: 'session=abc',
          },
        },
      ),
    });

    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.text()).toBe('remix denied');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://files.example.com/remix.json',
      {
        headers: {
          cookie: 'session=abc',
        },
      },
    );
  });
});

describe('Astro proxy-file', () => {
  it('returns the upstream status while preserving body and Content-Type', async () => {
    const fetchMock = mockProxyFetch({
      body: 'astro throttled',
      contentType: 'text/html',
      status: 503,
    });
    const handler = createEdgeStoreAstroHandler({
      provider: createProvider(),
      router: createRouter(),
    });

    const res = await handler({
      request: new Request(
        'https://app.example.com/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example.com%2Fastro.html',
        {
          headers: {
            Cookie: 'session=abc',
          },
        },
      ),
    } as Parameters<typeof handler>[0]);

    expect(res.status).toBe(503);
    expect(res.headers.get('Content-Type')).toBe('text/html');
    expect(await res.text()).toBe('astro throttled');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://files.example.com/astro.html',
      {
        headers: {
          cookie: 'session=abc',
        },
      },
    );
  });
});

describe('Next Pages proxy-file', () => {
  it('returns the upstream status while preserving body and Content-Type', async () => {
    const fetchMock = mockProxyFetch({
      body: 'next pages denied',
      contentType: 'application/octet-stream',
      status: 410,
    });
    const handler = createEdgeStoreNextPagesHandler({
      provider: createProvider(),
      router: createRouter(),
    });
    const response = createNextPagesResponse();

    await handler(
      {
        cookies: {},
        headers: {
          cookie: 'session=abc',
        },
        query: {
          url: 'https://files.example.com/next-pages.bin',
        },
        url: '/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example.com%2Fnext-pages.bin',
      } as unknown as NextApiRequest,
      response.res,
    );

    expect(response.getStatus()).toBe(410);
    expect(response.getHeader('Content-Type')).toBe('application/octet-stream');
    expect(response.getBody()).toBe('next pages denied');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://files.example.com/next-pages.bin',
      {
        headers: {
          cookie: 'session=abc',
        },
      },
    );
  });
});

describe('Next App proxy-file', () => {
  it('returns the upstream status while preserving body and Content-Type', async () => {
    const fetchMock = mockProxyFetch({
      body: 'next app denied',
      contentType: 'text/plain',
      status: 451,
    });
    const handler = createEdgeStoreNextAppHandler({
      provider: createProvider(),
      router: createRouter(),
    });
    const nextUrl = new URL(
      'https://app.example.com/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example.com%2Fnext-app.txt',
    );

    const res = await handler({
      cookies: {
        toString: () => 'session=abc',
      },
      nextUrl,
    } as Parameters<typeof handler>[0]);

    expect(res.status).toBe(451);
    expect(res.headers.get('Content-Type')).toBe('text/plain');
    expect(await res.text()).toBe('next app denied');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://files.example.com/next-app.txt',
      {
        headers: {
          cookie: 'session=abc',
        },
      },
    );
  });

  it('returns no body for upstream no-body statuses', async () => {
    const fetchMock = mockProxyFetch({
      body: null,
      status: 204,
    });
    const handler = createEdgeStoreNextAppHandler({
      provider: createProvider(),
      router: createRouter(),
    });
    const nextUrl = new URL(
      'https://app.example.com/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example.com%2Fnext-app-empty.txt',
    );

    const res = await handler({
      cookies: {
        toString: () => 'session=abc',
      },
      nextUrl,
    } as Parameters<typeof handler>[0]);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://files.example.com/next-app-empty.txt',
      {
        headers: {
          cookie: 'session=abc',
        },
      },
    );
  });
});

describe('Start proxy-file', () => {
  it('returns the upstream status while preserving body and Content-Type', async () => {
    const fetchMock = mockProxyFetch({
      body: 'start unavailable',
      contentType: 'application/json',
      status: 502,
    });
    const handler = createEdgeStoreStartHandler({
      provider: createProvider(),
      router: createRouter(),
    });

    const res = await handler({
      request: new Request(
        'https://app.example.com/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example.com%2Fstart.json',
        {
          headers: {
            Cookie: 'session=abc',
          },
        },
      ),
    });

    expect(res.status).toBe(502);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.text()).toBe('start unavailable');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://files.example.com/start.json',
      {
        headers: {
          cookie: 'session=abc',
        },
      },
    );
  });
});
