import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  asJsonRequestInit,
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
} from '../../test-utils/adapterConformance';
import { createEdgeStoreHonoHandler } from './index';

const baseUrl = 'https://app.example.com/api/edgestore';

describe('Hono adapter conformance', () => {
  beforeEach(setupAdapterTestEnv);

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function createApp(createContext = vi.fn(() => testCtx)) {
    const provider = createConformanceProvider();
    const router = createConformanceRouter();
    const handler = createEdgeStoreHonoHandler({
      provider,
      router,
      cookieConfig: testCookieConfig,
      createContext,
    });
    const app = new Hono();
    app.all('/api/edgestore/*', handler);

    return { app, createContext, provider };
  }

  it('/health returns OK', async () => {
    const { app } = createApp();

    const res = await app.request(`${baseUrl}/health`);

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe('OK');
  });

  it('/init calls createContext, returns JSON, and sets the ctx cookie', async () => {
    const { app, createContext, provider } = createApp();

    const res = await app.request(`${baseUrl}/init`);

    expect(createContext).toHaveBeenCalledWith({
      c: expect.objectContaining({ req: expect.any(Object) }),
    });
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
    const { app, provider } = createApp();
    const initRes = await app.request(`${baseUrl}/init`);
    const ctxToken = extractCookieValue(initRes.headers.get('set-cookie'));

    const uploadRes = await app.request(`${baseUrl}/request-upload`, {
      ...asJsonRequestInit(requestUploadBody),
      headers: {
        ...asJsonRequestInit(requestUploadBody).headers,
        cookie: createContextCookieHeader(ctxToken!),
      },
    });

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
    const { app, provider } = createApp();
    const initRes = await app.request(`${baseUrl}/init`);
    const ctxToken = extractCookieValue(initRes.headers.get('set-cookie'));

    const res = await app.request(`${baseUrl}/complete-multipart-upload`, {
      ...asJsonRequestInit(completeMultipartUploadBody),
      headers: {
        ...asJsonRequestInit(completeMultipartUploadBody).headers,
        cookie: createContextCookieHeader(ctxToken!),
      },
    });

    expect(res.status).toBe(200);
    expect(provider.completeMultipartUpload).toHaveBeenCalledWith({
      uploadId: 'upload-id',
      key: 'uploads/file.txt',
      parts: completeMultipartUploadBody.parts,
    });
  });

  it('/proxy-file forwards request cookies and preserves content type', async () => {
    const fetchMock = stubProxyFetch();
    const { app } = createApp();

    const res = await app.request(
      `${baseUrl}/proxy-file?url=https://target.example/file`,
      {
        headers: {
          cookie: 'session=abc; theme=dark',
        },
      },
    );

    expect(fetchMock).toHaveBeenCalledWith('https://target.example/file', {
      headers: {
        cookie: 'session=abc; theme=dark',
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/custom');
    await expect(res.text()).resolves.toBe('proxied body');
  });

  it('createContext failure maps to CREATE_CONTEXT_ERROR status/body', async () => {
    const { app } = createApp(
      vi.fn(() => {
        throw new Error('context failed');
      }),
    );

    const res = await app.request(`${baseUrl}/init`);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      code: 'CREATE_CONTEXT_ERROR',
      message: 'Error creating context',
    });
  });

  it('unknown route returns 404', async () => {
    const { app } = createApp();

    const res = await app.request(`${baseUrl}/missing`);

    expect(res.status).toBe(404);
  });
});
