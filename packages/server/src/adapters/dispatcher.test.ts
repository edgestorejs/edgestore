import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Logger from '../libs/logger';
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

  function createDispatcher() {
    const provider = createConformanceProvider();
    const edgeStore = {
      provider,
      router: createConformanceRouter(),
    };
    const logger = new Logger();

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

  it('rejects proxy requests without a URL', async () => {
    const { dispatch } = createDispatcher();

    const response = await dispatch('/api/edgestore/proxy-file');

    expect(response.status).toBe(400);
  });
});
