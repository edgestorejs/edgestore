import { initEdgeStore, type EdgeStoreRouter } from '@edgestore/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import Logger, { type LoggerLike } from '../libs/logger';
import {
  completeMultipartUploadBody,
  createConformanceProvider,
  createConformanceRouter,
  extractCookieValue,
  requestUploadBody,
  setupAdapterTestEnv,
  testCookieConfig,
  testCtx,
} from '../test-utils/adapterConformance.test.utils';
import { dispatchEdgeStoreRequest } from './dispatcher';

describe('adapter dispatcher', () => {
  beforeEach(setupAdapterTestEnv);

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function createDispatcher(
    logger: LoggerLike = new Logger(),
    router: EdgeStoreRouter<typeof testCtx> = createConformanceRouter(),
  ) {
    const provider = createConformanceProvider();
    const edgeStore = {
      provider,
      router,
    };
    const dispatch = (
      pathname: string,
      options: {
        body?: unknown;
        cookieHeader?: string;
        createContext?: () => typeof testCtx;
        query?: Record<string, string>;
      } = {},
    ) =>
      dispatchEdgeStoreRequest({
        edgeStore,
        logger,
        cookieConfig: testCookieConfig,
        request: {
          pathname,
          readJson: async () => options.body,
          getQuery: (name) => options.query?.[name],
          cookieHeader: options.cookieHeader,
          createContext: options.createContext ?? (() => testCtx),
        },
      });

    return { dispatch, provider };
  }

  function createSilentLogger(): LoggerLike {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  }

  it('handles health and unknown routes centrally', async () => {
    const { dispatch } = createDispatcher();

    const health = await dispatch('/api/edgestore/health');
    expect(health.status).toBe(200);
    await expect(health.text()).resolves.toBe('OK');

    const missing = await dispatch('/api/edgestore/missing');
    expect(missing.status).toBe(404);
  });

  it('creates context and dispatches authenticated lifecycle routes', async () => {
    const { dispatch, provider } = createDispatcher();
    const init = await dispatch('/api/edgestore/init');
    const token = extractCookieValue(init.headers.getSetCookie());
    const cookieHeader = `${testCookieConfig.ctx.name}=${token}`;

    const upload = await dispatch('/api/edgestore/request-upload', {
      body: requestUploadBody,
      cookieHeader,
    });
    expect(upload.status).toBe(200);
    expect(provider.uploads.request).toHaveBeenCalledOnce();

    const complete = await dispatch(
      '/api/edgestore/complete-multipart-upload',
      {
        body: completeMultipartUploadBody,
        cookieHeader,
      },
    );
    expect(complete.status).toBe(200);
    expect(provider.uploads.multipart?.complete).toHaveBeenCalledOnce();
  });

  it('normalizes context creation failures', async () => {
    const { dispatch } = createDispatcher();

    const response = await dispatch('/api/edgestore/init', {
      createContext: () => {
        throw new Error('context failed');
      },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      code: 'CREATE_CONTEXT_ERROR',
      message: 'Error creating context',
    });
  });

  it.each([
    '/api/edgestore/request-upload',
    '/api/edgestore/request-upload-parts',
    '/api/edgestore/complete-multipart-upload',
    '/api/edgestore/confirm-uploads',
    '/api/edgestore/delete-files',
  ])('rejects malformed bodies for %s', async (pathname) => {
    const { dispatch, provider } = createDispatcher(createSilentLogger());

    const response = await dispatch(pathname, { body: {} });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Invalid request body',
    });
    expect(provider.uploads.request).not.toHaveBeenCalled();
    expect(provider.uploads.multipart?.requestParts).not.toHaveBeenCalled();
    expect(provider.uploads.multipart?.complete).not.toHaveBeenCalled();
    expect(provider.files.confirm).not.toHaveBeenCalled();
    expect(provider.files.delete).not.toHaveBeenCalled();
  });

  it('rejects invalid bucket input before hooks or providers run', async () => {
    const beforeUpload = vi.fn(() => true);
    const es = initEdgeStore.context<typeof testCtx>().create();
    const router = es.router({
      documents: es
        .fileBucket()
        .input(z.object({ label: z.string() }))
        .beforeUpload(beforeUpload),
    });
    const { dispatch, provider } = createDispatcher(
      createSilentLogger(),
      router,
    );
    const init = await dispatch('/api/edgestore/init');
    const token = extractCookieValue(init.headers.getSetCookie());

    const response = await dispatch('/api/edgestore/request-upload', {
      body: {
        ...requestUploadBody,
        input: { label: 123 },
      },
      cookieHeader: `${testCookieConfig.ctx.name}=${token}`,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Invalid bucket input',
    });
    expect(beforeUpload).not.toHaveBeenCalled();
    expect(provider.uploads.request).not.toHaveBeenCalled();
  });

  it('keeps operation logging scoped to the selected handler', async () => {
    const firstLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const secondLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const first = createDispatcher(firstLogger);
    createDispatcher(secondLogger);

    await first.dispatch('/api/edgestore/init');

    expect(firstLogger.debug).toHaveBeenCalledWith('Running [init]', {
      ctx: testCtx,
    });
    expect(secondLogger.debug).not.toHaveBeenCalled();
  });

  it('rejects proxy requests without a URL', async () => {
    const { dispatch } = createDispatcher();

    const response = await dispatch('/api/edgestore/proxy-file');

    expect(response.status).toBe(400);
  });
});
