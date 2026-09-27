import { describe, expect, it, vi } from 'vitest';
import { classifyCredentials } from '../credentials';
import { createTransport } from './transport';
import { putWithRetry } from './uploadTransfer';

describe('putWithRetry', () => {
  it('reports uploaded bytes while preserving Blob request headers', async () => {
    const onProgress = vi.fn();
    const body = chunkedBlob();
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init);
      expect(request.headers.get('content-length')).toBe('5');
      expect(request.headers.get('content-type')).toBe('text/plain');
      await expect(request.text()).resolves.toBe('hello');
      return new Response(null, { status: 200 });
    });
    const transport = createTransport({
      credentials: classifyCredentials({ token: 'management-token' }),
      fetch,
    });

    await putWithRetry(transport, {
      url: 'https://storage.example/upload',
      body,
      uploadId: 'upload_123',
      onProgress,
    });

    expect(onProgress.mock.calls).toEqual([[2], [5]]);
  });

  it('keeps progress monotonic across retry attempts', async () => {
    const onProgress = vi.fn();
    const body = chunkedBlob();
    let attempts = 0;
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init);
      await expect(request.text()).resolves.toBe('hello');
      attempts++;
      return new Response(null, {
        status: attempts === 1 ? 503 : 200,
        headers: { 'retry-after': '0' },
      });
    });
    const transport = createTransport({
      credentials: classifyCredentials({ token: 'management-token' }),
      fetch,
    });

    await putWithRetry(transport, {
      url: 'https://storage.example/upload',
      body,
      uploadId: 'upload_123',
      onProgress,
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onProgress.mock.calls).toEqual([[2], [5]]);
  });

  it('preserves progress callback errors without retrying', async () => {
    const progressError = new Error('Progress handler failed.');
    const onProgress = vi.fn(() => {
      throw progressError;
    });
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init);
      await request.text();
      return new Response(null, { status: 200 });
    });
    const transport = createTransport({
      credentials: classifyCredentials({ token: 'management-token' }),
      fetch,
    });

    await expect(
      putWithRetry(transport, {
        url: 'https://storage.example/upload',
        body: chunkedBlob(),
        uploadId: 'upload_123',
        onProgress,
      }),
    ).rejects.toBe(progressError);
    expect(fetch).toHaveBeenCalledOnce();
    expect(onProgress).toHaveBeenCalledOnce();
  });

  it('preserves nested Blob read errors without retrying', async () => {
    const blobReadError = new DOMException(
      'The source changed while being read.',
      'NotReadableError',
    );
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('fetch failed', { cause: blobReadError });
    });
    const transport = createTransport({
      credentials: classifyCredentials({ token: 'management-token' }),
      fetch,
    });

    await expect(
      putWithRetry(transport, {
        url: 'https://storage.example/upload',
        body: new Blob(['content']),
        uploadId: 'upload_123',
      }),
    ).rejects.toBe(blobReadError);
    expect(fetch).toHaveBeenCalledOnce();
  });
});

function chunkedBlob(): Blob {
  const body = new Blob(['hello'], { type: 'text/plain' });
  Object.defineProperty(body, 'stream', {
    value: () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('he'));
          controller.enqueue(new TextEncoder().encode('llo'));
          controller.close();
        },
      }),
  });
  return body;
}
