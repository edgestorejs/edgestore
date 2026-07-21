import { describe, expect, it, vi } from 'vitest';
import { EdgeStoreAbortError, EdgeStoreNetworkError } from '../errors';
import type { EdgeStoreApiError } from '../errors';
import { createTransport } from './transport';

describe('createTransport', () => {
  it('sends project authentication and normalizes the base URL', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe('https://example.com/v2/health');
      expect(request.headers.get('authorization')).toBe(
        'Basic cHJvamVjdDpzZWNyZXQ=',
      );
      expect(request.headers.get('user-agent')).toBe('@edgestore/sdk/0.7.0');
      return Response.json({ data: { ok: true, version: 'v2' } });
    });
    const transport = createTransport({
      credentials: { accessKey: 'project', secretKey: 'secret' },
      baseUrl: 'https://example.com/v2/',
      fetch,
    });

    await expect(
      transport.execute(() => transport.client.GET('/health')),
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
      credentials: { token: 'management-token' },
      fetch,
    });

    const request = transport.execute(() => transport.client.GET('/health'));

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
      credentials: { token: 'management-token' },
      fetch: async () => {
        throw new DOMException('aborted', 'AbortError');
      },
    });
    const failed = createTransport({
      credentials: { token: 'management-token' },
      fetch: async () => {
        throw new TypeError('offline');
      },
    });

    await expect(
      aborted.execute(() => aborted.client.GET('/health')),
    ).rejects.toBeInstanceOf(EdgeStoreAbortError);
    await expect(
      failed.execute(() => failed.client.GET('/health')),
    ).rejects.toBeInstanceOf(EdgeStoreNetworkError);
  });
});
