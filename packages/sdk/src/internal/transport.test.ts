import { describe, expect, it, vi } from 'vitest';
import { classifyCredentials } from '../credentials';
import { EdgeStoreAbortError, EdgeStoreNetworkError } from '../errors';
import type { EdgeStoreApiError } from '../errors';
import {
  EDGE_STORE_PACKAGE_NAME,
  EDGE_STORE_PACKAGE_VERSION,
} from '../version';
import { createTransport } from './transport';

describe('createTransport', () => {
  it('sends project authentication and normalizes the base URL', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe('https://example.com/v2/health');
      expect(request.headers.get('authorization')).toBe(
        'Basic cHJvamVjdDpzZWNyZXQ=',
      );
      expect(request.headers.get('user-agent')).toBe(
        `${EDGE_STORE_PACKAGE_NAME}/${EDGE_STORE_PACKAGE_VERSION}`,
      );
      return Response.json({ data: { ok: true, version: 'v2' } });
    });
    const transport = createTransport({
      credentials: classifyCredentials({
        accessKey: 'project',
        secretKey: 'secret',
      }),
      apiUrl: 'https://example.com/v2/',
      fetch,
    });

    await expect(
      transport.execute((client) => client.GET('/health')),
    ).resolves.toEqual({ ok: true, version: 'v2' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('turns API failures into structured errors', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json(
        {
          error: {
            code: 'rate_limited',
            message: 'Try again later',
            status: 429,
            details: { limit: 10 },
          },
        },
        {
          status: 429,
          headers: { 'retry-after': '3', 'x-request-id': 'request-123' },
        },
      ),
    );
    const transport = createTransport({
      credentials: classifyCredentials({ token: 'management-token' }),
      fetch,
    });

    const request = transport.execute((client) => client.GET('/health'));

    await expect(request).rejects.toMatchObject({
      name: 'EdgeStoreApiError',
      status: 429,
      code: 'rate_limited',
      message: 'Try again later',
      details: { limit: 10 },
      requestId: 'request-123',
      retryAfterSeconds: 3,
    } satisfies Partial<EdgeStoreApiError>);
  });

  it('distinguishes aborted and failed network requests', async () => {
    const aborted = createTransport({
      credentials: classifyCredentials({ token: 'management-token' }),
      fetch: async () => {
        throw new DOMException('aborted', 'AbortError');
      },
    });
    const failed = createTransport({
      credentials: classifyCredentials({ token: 'management-token' }),
      fetch: async () => {
        throw new TypeError('offline');
      },
    });

    await expect(
      aborted.execute((client) => client.GET('/health')),
    ).rejects.toBeInstanceOf(EdgeStoreAbortError);
    await expect(
      failed.execute((client) => client.GET('/health')),
    ).rejects.toBeInstanceOf(EdgeStoreNetworkError);
  });
});
