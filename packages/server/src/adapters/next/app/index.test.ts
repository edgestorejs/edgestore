import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completeMultipartUploadBody,
  createConformanceProvider,
  createConformanceRouter,
  createContextCookieHeader,
  expectRequestUploadCalledWithContext,
  extractCookieValue,
  requestUploadBody,
  setupAdapterTestEnv,
  stubProxyFetch,
  testCookieConfig,
  testCtx,
} from '../../../test-utils/adapterConformance';
import { createEdgeStoreNextHandler } from './index';

const baseUrl = 'https://app.example.com/api/edgestore';
type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

function createRequest(path: string, init?: NextRequestInit) {
  return new NextRequest(`${baseUrl}${path}`, init);
}

function jsonRequestInit(body: unknown, cookie?: string): NextRequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  };
}

describe('Next app adapter conformance', () => {
  beforeEach(setupAdapterTestEnv);

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function createHandler(createContext = vi.fn(() => testCtx)) {
    const provider = createConformanceProvider();
    const router = createConformanceRouter();
    const handler = createEdgeStoreNextHandler({
      provider,
      router,
      cookieConfig: testCookieConfig,
      createContext,
    });

    return { createContext, handler, provider };
  }

  it('/health returns OK', async () => {
    const { handler } = createHandler();

    const res = await handler(createRequest('/health'));

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe('OK');
  });

  it('/init calls createContext, returns JSON, and sets the ctx cookie', async () => {
    const { createContext, handler, provider } = createHandler();
    const req = createRequest('/init');

    const res = await handler(req);

    expect(createContext).toHaveBeenCalledWith({ req });
    expect(provider.init).toHaveBeenCalledWith(
      expect.objectContaining({ ctx: testCtx }),
    );
    await expect(res.json()).resolves.toMatchObject({
      baseUrl: 'https://files.example.com',
      providerName: 'test-provider',
      token: 'provider-token',
    });
    expect(extractCookieValue(res.headers.get('set-cookie'))).toBeTruthy();
  });

  it('/request-upload reads the configured ctx cookie and calls through successfully', async () => {
    const { handler, provider } = createHandler();
    const initRes = await handler(createRequest('/init'));
    const ctxToken = extractCookieValue(initRes.headers.get('set-cookie'));

    const uploadRes = await handler(
      createRequest(
        '/request-upload',
        jsonRequestInit(
          requestUploadBody,
          createContextCookieHeader(ctxToken!),
        ),
      ),
    );

    expect(uploadRes.status).toBe(200);
    await expect(uploadRes.json()).resolves.toMatchObject({
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
    const initRes = await handler(createRequest('/init'));
    const ctxToken = extractCookieValue(initRes.headers.get('set-cookie'));

    const res = await handler(
      createRequest('/complete-multipart-upload', {
        ...jsonRequestInit(
          completeMultipartUploadBody,
          createContextCookieHeader(ctxToken!),
        ),
      }),
    );

    expect(res.status).toBe(200);
    expect(provider.completeMultipartUpload).toHaveBeenCalledWith({
      uploadId: 'upload-id',
      key: 'uploads/file.txt',
      parts: completeMultipartUploadBody.parts,
    });
  });

  it('/proxy-file forwards request cookies and preserves content type/status', async () => {
    const fetchMock = stubProxyFetch();
    const { handler } = createHandler();

    const res = await handler(
      createRequest('/proxy-file?url=https://target.example/file', {
        headers: {
          cookie: 'session=abc; theme=dark',
        },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith('https://target.example/file', {
      headers: {
        cookie: 'session=abc; theme=dark',
      },
    });
    expect(res.status).toBe(202);
    expect(res.headers.get('content-type')).toBe('text/custom');
    await expect(res.text()).resolves.toBe('proxied body');
  });

  it('createContext failure maps to CREATE_CONTEXT_ERROR status/body', async () => {
    const { handler } = createHandler(
      vi.fn(() => {
        throw new Error('context failed');
      }),
    );

    const res = await handler(createRequest('/init'));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      code: 'CREATE_CONTEXT_ERROR',
      message: 'Error creating context',
    });
  });

  it('unknown route returns 404', async () => {
    const { handler } = createHandler();

    const res = await handler(createRequest('/missing'));

    expect(res.status).toBe(404);
  });
});
