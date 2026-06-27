import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completeMultipartUploadBody,
  createConformanceProvider,
  createConformanceRouter,
  expectRequestUploadCalledWithContext,
  extractCookieValue,
  requestUploadBody,
  setupAdapterTestEnv,
  stubProxyFetch,
  testCookieConfig,
  testCtx,
} from '../../test-utils/adapterConformance';
import { createEdgeStoreExpressHandler } from './index';

type MockResponse = Response & {
  body?: unknown;
  headers: Record<string, string | string[]>;
  statusCode: number;
};

type MockResponseShape = {
  body?: unknown;
  headers: Record<string, string | string[]>;
  statusCode: number;
  setHeader: (name: string, value: string | string[]) => MockResponseShape;
  status: (statusCode: number) => MockResponseShape;
  send: (body?: unknown) => MockResponseShape;
  json: (body: unknown) => MockResponseShape;
  end: (body?: unknown) => MockResponseShape;
};

function createMockResponse(): MockResponse {
  const res: MockResponseShape = {
    headers: {},
    statusCode: 200,
    setHeader: vi.fn((name: string, value: string | string[]) => {
      res.headers[name] = value;
      return res;
    }),
    status: vi.fn((statusCode: number) => {
      res.statusCode = statusCode;
      return res;
    }),
    send: vi.fn((body?: unknown) => {
      res.body = body;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
    end: vi.fn((body?: unknown) => {
      res.body = body;
      return res;
    }),
  };

  return res as unknown as MockResponse;
}

function createRequest(url: string, overrides: Partial<Request> = {}): Request {
  return {
    url,
    headers: {},
    cookies: {},
    query: {},
    body: undefined,
    ...overrides,
  } as Request;
}

describe('Express adapter conformance', () => {
  beforeEach(setupAdapterTestEnv);

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function createHandler(createContext = vi.fn(() => testCtx)) {
    const provider = createConformanceProvider();
    const router = createConformanceRouter();
    const handler = createEdgeStoreExpressHandler({
      provider,
      router,
      cookieConfig: testCookieConfig,
      createContext,
    });

    return { createContext, handler, provider };
  }

  it('/health returns OK', async () => {
    const { handler } = createHandler();
    const res = createMockResponse();

    await handler(createRequest('/api/edgestore/health'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('OK');
  });

  it('/init calls createContext, returns JSON, and sets the ctx cookie', async () => {
    const { createContext, handler, provider } = createHandler();
    const req = createRequest('/api/edgestore/init');
    const res = createMockResponse();

    await handler(req, res);

    expect(createContext).toHaveBeenCalledWith({ req, res });
    expect(provider.init).toHaveBeenCalledWith(
      expect.objectContaining({ ctx: testCtx }),
    );
    expect(res.body).toMatchObject({
      baseUrl: 'https://files.example.com',
      providerName: 'test-provider',
      token: 'provider-token',
    });
    expect(extractCookieValue(res.headers['Set-Cookie'])).toBeTruthy();
  });

  it('/request-upload reads the configured ctx cookie and calls through successfully', async () => {
    const { handler, provider } = createHandler();
    const initRes = createMockResponse();
    await handler(createRequest('/api/edgestore/init'), initRes);
    const ctxToken = extractCookieValue(initRes.headers['Set-Cookie']);

    const uploadRes = createMockResponse();
    await handler(
      createRequest('/api/edgestore/request-upload', {
        body: requestUploadBody,
        cookies: {
          [testCookieConfig.ctx.name]: ctxToken,
        },
      }),
      uploadRes,
    );

    expect(uploadRes.statusCode).toBe(200);
    expect(uploadRes.body).toMatchObject({
      accessUrl: 'https://files.example.com/file.txt',
      path: { author: testCtx.userId },
      metadata: {
        userId: testCtx.userId,
        label: requestUploadBody.input.label,
      },
    });
    expectRequestUploadCalledWithContext(provider);
  });

  it('/complete-multipart-upload returns 200', async () => {
    const { handler, provider } = createHandler();
    const initRes = createMockResponse();
    await handler(createRequest('/api/edgestore/init'), initRes);
    const ctxToken = extractCookieValue(initRes.headers['Set-Cookie']);
    const completeRes = createMockResponse();

    await handler(
      createRequest('/api/edgestore/complete-multipart-upload', {
        body: completeMultipartUploadBody,
        cookies: {
          [testCookieConfig.ctx.name]: ctxToken,
        },
      }),
      completeRes,
    );

    expect(completeRes.statusCode).toBe(200);
    expect(provider.completeMultipartUpload).toHaveBeenCalledWith({
      uploadId: 'upload-id',
      key: 'uploads/file.txt',
      parts: completeMultipartUploadBody.parts,
    });
  });

  it('/proxy-file forwards request cookies and preserves content type', async () => {
    const fetchMock = stubProxyFetch();
    const { handler } = createHandler();
    const res = createMockResponse();

    await handler(
      createRequest(
        '/api/edgestore/proxy-file?url=https://target.example/file',
        {
          headers: {
            cookie: 'session=abc; theme=dark',
          },
          query: {
            url: 'https://target.example/file',
          },
        },
      ),
      res,
    );

    expect(fetchMock).toHaveBeenCalledWith('https://target.example/file', {
      headers: {
        cookie: 'session=abc; theme=dark',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/custom');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect((res.body as Buffer).toString()).toBe('proxied body');
  });

  it('createContext failure maps to CREATE_CONTEXT_ERROR status/body', async () => {
    const { handler } = createHandler(
      vi.fn(() => {
        throw new Error('context failed');
      }),
    );
    const res = createMockResponse();

    await handler(createRequest('/api/edgestore/init'), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      code: 'CREATE_CONTEXT_ERROR',
      message: 'Error creating context',
    });
  });

  it('unknown route returns 404', async () => {
    const { handler } = createHandler();
    const res = createMockResponse();

    await handler(createRequest('/api/edgestore/missing'), res);

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for /proxy-file without a url', async () => {
    const { handler } = createHandler();
    const res = createMockResponse();

    await handler(createRequest('/api/edgestore/proxy-file'), res);

    expect(res.statusCode).toBe(400);
  });
});
