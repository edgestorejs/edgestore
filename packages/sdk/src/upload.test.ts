import { describe, expect, it, vi } from 'vitest';
import type { EdgeStoreUploadProcessingTimeoutError } from './errors';
import { createEdgeStoreSdk } from './sdk';

function createSdk(fetch: typeof globalThis.fetch) {
  return createEdgeStoreSdk({
    credentials: { accessKey: 'project', secretKey: 'secret' },
    baseUrl: 'https://api.example/v2',
    fetch,
  });
}

function toRequest(input: URL | RequestInfo, init?: RequestInit) {
  return input instanceof Request ? input : new Request(input, init);
}

describe('runtime upload orchestration', () => {
  it('uploads a single file, normalizes metadata, and waits for processing', async () => {
    const progress = vi.fn();
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = toRequest(input, init);
      if (request.url.endsWith('/buckets/documents')) {
        return Response.json({
          data: { bucket: { type: 'file', visibility: 'protected' } },
        });
      }
      if (request.url.endsWith('/buckets/documents/uploads')) {
        await expect(request.json()).resolves.toMatchObject({
          bucketType: 'file',
          visibility: 'protected',
          fileName: 'invoice.pdf',
          mimeType: 'text/plain',
          sizeBytes: 7,
          metadata: { invoiceId: '42', paid: 'false' },
        });
        expect(request.headers.has('idempotency-key')).toBe(false);
        return Response.json({
          data: {
            file: { id: 'upload-id' },
            upload: {
              kind: 'single',
              id: 'upload-id',
              signedUrl: 'https://storage.example/upload',
            },
          },
        });
      }
      if (request.url === 'https://storage.example/upload') {
        expect(request.method).toBe('PUT');
        await expect(request.text()).resolves.toBe('content');
        return new Response(null, { status: 200 });
      }
      if (request.url.endsWith('/uploads/upload-id')) {
        return Response.json({
          data: {
            upload: { id: 'upload-id', status: 'completed' },
            file: { id: 'file-id', url: 'https://cdn.example/file' },
          },
        });
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });
    const sdk = createSdk(fetch);

    const result = await sdk.runtime.uploads.upload({
      bucket: 'documents',
      source: 'content',
      fileName: 'invoice.pdf',
      metadata: { invoiceId: 42, paid: false, ignored: null },
      onProgress: progress,
    });

    expect(result.file.id).toBe('file-id');
    expect(progress.mock.calls).toEqual([
      [
        {
          transferredBytes: 0,
          totalBytes: 7,
          percentage: 0,
          phase: 'preparing',
        },
      ],
      [
        {
          transferredBytes: 0,
          totalBytes: 7,
          percentage: 0,
          phase: 'uploading',
        },
      ],
      [
        {
          transferredBytes: 7,
          totalBytes: 7,
          percentage: 100,
          phase: 'uploading',
        },
      ],
      [
        {
          transferredBytes: 7,
          totalBytes: 7,
          percentage: 100,
          phase: 'processing',
        },
      ],
    ]);
  });

  it('closes signed storage responses before retrying or completing', async () => {
    let transferAttempts = 0;
    const closedResponses: number[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = toRequest(input, init);
      if (request.url.endsWith('/buckets/documents')) {
        return Response.json({
          data: { bucket: { type: 'file', visibility: 'protected' } },
        });
      }
      if (request.url.endsWith('/buckets/documents/uploads')) {
        return Response.json({
          data: {
            file: { id: 'retry-id' },
            upload: {
              kind: 'single',
              id: 'retry-id',
              signedUrl: 'https://storage.example/retry',
            },
          },
        });
      }
      if (request.url === 'https://storage.example/retry') {
        transferAttempts++;
        const attempt = transferAttempts;
        return new Response(
          new ReadableStream({
            async cancel() {
              await Promise.resolve();
              closedResponses.push(attempt);
            },
          }),
          {
            status: attempt < 3 ? 503 : 200,
            headers: attempt < 3 ? { 'retry-after': '0' } : undefined,
          },
        );
      }
      if (request.url.endsWith('/uploads/retry-id')) {
        return Response.json({
          data: {
            upload: { id: 'retry-id', status: 'completed' },
            file: { id: 'file-id' },
          },
        });
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });
    const sdk = createSdk(fetch);

    await sdk.runtime.uploads.upload({
      bucket: 'documents',
      source: new Blob(['content']),
    });

    expect(transferAttempts).toBe(3);
    expect(closedResponses).toEqual([1, 2, 3]);
  });

  it('uploads multipart chunks concurrently and completes with ETags', async () => {
    const uploadedParts: string[] = [];
    let completionBody: unknown;
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = toRequest(input, init);
      if (request.url.endsWith('/buckets/videos')) {
        return Response.json({
          data: { bucket: { type: 'file', visibility: 'protected' } },
        });
      }
      if (request.url.endsWith('/buckets/videos/uploads')) {
        return Response.json({
          data: {
            file: { id: 'multipart-id' },
            upload: {
              kind: 'multipart',
              id: 'multipart-id',
              parts: [
                { partNumber: 1, signedUrl: 'https://storage.example/part-1' },
                { partNumber: 2, signedUrl: 'https://storage.example/part-2' },
              ],
            },
          },
        });
      }
      if (request.url.includes('storage.example/part-')) {
        uploadedParts.push(await request.text());
        const partNumber = request.url.endsWith('1') ? 1 : 2;
        return new Response(null, {
          status: 200,
          headers: { etag: `etag-${partNumber}` },
        });
      }
      if (request.url.endsWith('/uploads/multipart-id/complete')) {
        completionBody = await request.json();
        return Response.json({
          data: { upload: { id: 'multipart-id', status: 'processing' } },
        });
      }
      if (request.url.endsWith('/uploads/multipart-id')) {
        return Response.json({
          data: {
            upload: { id: 'multipart-id', status: 'completed' },
            file: { id: 'file-id' },
          },
        });
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });
    const sdk = createSdk(fetch);

    await sdk.runtime.uploads.upload({
      bucket: 'videos',
      source: {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('ab'));
            controller.enqueue(new TextEncoder().encode('cdef'));
            controller.close();
          },
        }),
        sizeBytes: 6,
      },
      multipart: { partSizeBytes: 3, concurrency: 2 },
    });

    expect(uploadedParts.sort()).toEqual(['abc', 'def']);
    expect(completionBody).toEqual({
      parts: [
        { partNumber: 1, eTag: 'etag-1' },
        { partNumber: 2, eTag: 'etag-2' },
      ],
    });
  });

  it('aborts a stalled stream read and cancels the upload', async () => {
    const controller = new AbortController();
    let markPullStarted: (() => void) | undefined;
    const pullStarted = new Promise<void>((resolve) => {
      markPullStarted = resolve;
    });
    let uploadCanceled = false;
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = toRequest(input, init);
      if (request.url.endsWith('/buckets/videos')) {
        return Response.json({
          data: { bucket: { type: 'file', visibility: 'protected' } },
        });
      }
      if (request.url.endsWith('/buckets/videos/uploads')) {
        return Response.json({
          data: {
            file: { id: 'stalled-id' },
            upload: {
              kind: 'multipart',
              id: 'stalled-id',
              parts: [
                {
                  partNumber: 1,
                  signedUrl: 'https://storage.example/stalled',
                },
              ],
            },
          },
        });
      }
      if (
        request.method === 'DELETE' &&
        request.url.endsWith('/uploads/stalled-id')
      ) {
        uploadCanceled = true;
        return Response.json({
          data: { upload: { id: 'stalled-id', status: 'canceled' } },
        });
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });
    const sdk = createSdk(fetch);
    const upload = sdk.runtime.uploads.upload({
      bucket: 'videos',
      source: {
        stream: new ReadableStream({
          pull() {
            markPullStarted?.();
            return new Promise<void>(() => undefined);
          },
          cancel() {
            return new Promise<void>(() => undefined);
          },
        }),
        sizeBytes: 3,
      },
      multipart: { partSizeBytes: 3 },
      signal: controller.signal,
    });

    await pullStarted;
    controller.abort();

    const result = Promise.race([
      upload,
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Upload did not abort promptly.'));
        }, 100);
      }),
    ]);
    await expect(result).rejects.toBeInstanceOf(EdgeStoreAbortError);
    expect(uploadCanceled).toBe(true);
  });

  it('aborts sibling multipart transfers before canceling the upload', async () => {
    const events: string[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = toRequest(input, init);
      if (request.url.endsWith('/buckets/videos')) {
        return Response.json({
          data: { bucket: { type: 'file', visibility: 'protected' } },
        });
      }
      if (request.url.endsWith('/buckets/videos/uploads')) {
        return Response.json({
          data: {
            file: { id: 'race-id' },
            upload: {
              kind: 'multipart',
              id: 'race-id',
              parts: [
                { partNumber: 1, signedUrl: 'https://storage.example/fail' },
                { partNumber: 2, signedUrl: 'https://storage.example/blocked' },
              ],
            },
          },
        });
      }
      if (request.url === 'https://storage.example/fail') {
        return new Response(null, { status: 400 });
      }
      if (request.url === 'https://storage.example/blocked') {
        return await new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener(
            'abort',
            () => {
              events.push('sibling-aborted');
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        });
      }
      if (
        request.method === 'DELETE' &&
        request.url.endsWith('/uploads/race-id')
      ) {
        events.push('upload-canceled');
        return Response.json({
          data: { upload: { id: 'race-id', status: 'canceled' } },
        });
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });
    const sdk = createSdk(fetch);

    await expect(
      sdk.runtime.uploads.upload({
        bucket: 'videos',
        source: new Blob(['abcdef']),
        multipart: { partSizeBytes: 3, concurrency: 2 },
      }),
    ).rejects.toMatchObject({ name: 'EdgeStoreUploadError' });

    expect(events).toEqual(['sibling-aborted', 'upload-canceled']);
  });

  it('uploads remote URLs through the explicit streaming helper', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = toRequest(input, init);
      if (request.url === 'https://source.example/report.txt') {
        return new Response('remote', {
          headers: { 'content-length': '6', 'content-type': 'text/plain' },
        });
      }
      if (request.url.endsWith('/buckets/documents')) {
        return Response.json({
          data: { bucket: { type: 'file', visibility: 'protected' } },
        });
      }
      if (request.url.endsWith('/buckets/documents/uploads')) {
        await expect(request.json()).resolves.toMatchObject({
          fileName: 'report.txt',
          mimeType: 'text/plain',
          sizeBytes: 6,
          multipart: { partNumbers: [1] },
        });
        return Response.json({
          data: {
            file: { id: 'remote-id' },
            upload: {
              kind: 'multipart',
              id: 'remote-id',
              parts: [
                { partNumber: 1, signedUrl: 'https://storage.example/remote' },
              ],
            },
          },
        });
      }
      if (request.url === 'https://storage.example/remote') {
        await expect(request.text()).resolves.toBe('remote');
        return new Response(null, { headers: { etag: 'remote-etag' } });
      }
      if (request.url.endsWith('/uploads/remote-id/complete')) {
        return Response.json({
          data: { upload: { id: 'remote-id', status: 'processing' } },
        });
      }
      if (request.url.endsWith('/uploads/remote-id')) {
        return Response.json({
          data: {
            upload: { id: 'remote-id', status: 'completed' },
            file: { id: 'remote-file' },
          },
        });
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });
    const sdk = createSdk(fetch);

    const result = await sdk.runtime.uploads.uploadFromUrl({
      bucket: 'documents',
      url: 'https://source.example/report.txt',
    });

    expect(result.file.id).toBe('remote-file');
  });

  it('cancels a rejected remote response body', async () => {
    let canceled = false;
    const remoteBody = new ReadableStream({
      async cancel() {
        await new Promise((resolve) => setTimeout(resolve, 0));
        canceled = true;
      },
    });
    const sdk = createSdk(
      vi.fn<typeof globalThis.fetch>(async () => {
        return new Response(remoteBody, {
          status: 503,
          headers: { 'content-length': '6' },
        });
      }),
    );

    await expect(
      sdk.runtime.uploads.uploadFromUrl({
        bucket: 'documents',
        url: 'https://source.example/unavailable.txt',
      }),
    ).rejects.toMatchObject({
      name: 'EdgeStoreNetworkError',
    });
    expect(canceled).toBe(true);
  });

  it.each([undefined, 'invalid', '-1'])(
    'cancels a remote response with invalid Content-Length %s',
    async (contentLength) => {
      let canceled = false;
      const remoteBody = new ReadableStream({
        cancel() {
          canceled = true;
        },
      });
      const headers = new Headers();
      if (contentLength !== undefined) {
        headers.set('content-length', contentLength);
      }
      const sdk = createSdk(
        vi.fn<typeof globalThis.fetch>(async () => {
          return new Response(remoteBody, { headers });
        }),
      );

      await expect(
        sdk.runtime.uploads.uploadFromUrl({
          bucket: 'documents',
          url: 'https://source.example/invalid-length.txt',
        }),
      ).rejects.toThrow(
        'Remote uploads require a valid Content-Length response header.',
      );
      expect(canceled).toBe(true);
    },
  );

  it('rejects a missing non-empty remote response body', async () => {
    const sdk = createSdk(
      vi.fn<typeof globalThis.fetch>(async () => {
        return new Response(null, {
          headers: { 'content-length': '6' },
        });
      }),
    );

    await expect(
      sdk.runtime.uploads.uploadFromUrl({
        bucket: 'documents',
        url: 'https://source.example/missing-body.txt',
      }),
    ).rejects.toThrow('The remote upload source returned no response body.');
  });

  it('accepts a missing body for a zero-byte remote source', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = toRequest(input, init);
      if (request.url === 'https://source.example/empty.txt') {
        return new Response(null, {
          headers: { 'content-length': '0' },
        });
      }
      throw new Error('Bucket lookup reached.');
    });
    const sdk = createSdk(fetch);

    await expect(
      sdk.runtime.uploads.uploadFromUrl({
        bucket: 'documents',
        url: 'https://source.example/empty.txt',
      }),
    ).rejects.toMatchObject({
      name: 'EdgeStoreNetworkError',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('cancels the remote body when setup fails before transfer', async () => {
    let canceled = false;
    const remoteBody = new ReadableStream({
      cancel() {
        canceled = true;
      },
    });
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = toRequest(input, init);
      if (request.url === 'https://source.example/report.txt') {
        return new Response(remoteBody, {
          headers: { 'content-length': '6' },
        });
      }
      throw new Error('Bucket lookup failed.');
    });
    const sdk = createSdk(fetch);

    await expect(
      sdk.runtime.uploads.uploadFromUrl({
        bucket: 'documents',
        url: 'https://source.example/report.txt',
      }),
    ).rejects.toMatchObject({
      name: 'EdgeStoreNetworkError',
    });
    expect(canceled).toBe(true);
  });

  it('retains the pending upload when processing times out', async () => {
    const methods: string[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = toRequest(input, init);
      methods.push(request.method);
      if (request.url.endsWith('/buckets/documents')) {
        return Response.json({
          data: { bucket: { type: 'file', visibility: 'protected' } },
        });
      }
      if (request.url.endsWith('/buckets/documents/uploads')) {
        return Response.json({
          data: {
            file: { id: 'pending-id' },
            upload: {
              kind: 'single',
              id: 'pending-id',
              signedUrl: 'https://storage.example/pending',
            },
          },
        });
      }
      if (request.url === 'https://storage.example/pending') {
        return new Response(null, { status: 200 });
      }
      if (request.url.endsWith('/uploads/pending-id')) {
        return Response.json(
          { data: { upload: { id: 'pending-id', status: 'processing' } } },
          { status: 202, headers: { 'retry-after': '1' } },
        );
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });
    const sdk = createSdk(fetch);

    const upload = sdk.runtime.uploads.upload({
      bucket: 'documents',
      source: new Blob(['content']),
      processingTimeoutMs: 0,
    });

    await expect(upload).rejects.toMatchObject({
      name: 'EdgeStoreUploadProcessingTimeoutError',
      uploadId: 'pending-id',
    } satisfies Partial<EdgeStoreUploadProcessingTimeoutError>);
    expect(methods).not.toContain('DELETE');
  });

  it('aborts an in-flight processing check at the processing deadline', async () => {
    let processingCheckAborted = false;
    const methods: string[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = toRequest(input, init);
      methods.push(request.method);
      if (request.url.endsWith('/buckets/documents')) {
        return Response.json({
          data: { bucket: { type: 'file', visibility: 'protected' } },
        });
      }
      if (request.url.endsWith('/buckets/documents/uploads')) {
        return Response.json({
          data: {
            file: { id: 'stalled-id' },
            upload: {
              kind: 'single',
              id: 'stalled-id',
              signedUrl: 'https://storage.example/stalled',
            },
          },
        });
      }
      if (request.url === 'https://storage.example/stalled') {
        return new Response(null, { status: 200 });
      }
      if (request.url.endsWith('/uploads/stalled-id')) {
        return await new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener(
            'abort',
            () => {
              processingCheckAborted = true;
              reject(
                request.signal.reason instanceof Error
                  ? request.signal.reason
                  : new Error('Processing check aborted', {
                      cause: request.signal.reason,
                    }),
              );
            },
            { once: true },
          );
        });
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });
    const sdk = createSdk(fetch);

    await expect(
      sdk.runtime.uploads.upload({
        bucket: 'documents',
        source: new Blob(['content']),
        processingTimeoutMs: 20,
      }),
    ).rejects.toMatchObject({
      name: 'EdgeStoreUploadProcessingTimeoutError',
      uploadId: 'stalled-id',
    } satisfies Partial<EdgeStoreUploadProcessingTimeoutError>);

    expect(processingCheckAborted).toBe(true);
    expect(methods).not.toContain('DELETE');
  });

  it('does not retry upload creation', async () => {
    let requestAttempts = 0;
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = toRequest(input, init);
      if (request.url.endsWith('/buckets/documents')) {
        return Response.json({
          data: { bucket: { type: 'file', visibility: 'protected' } },
        });
      }
      if (request.url.endsWith('/buckets/documents/uploads')) {
        requestAttempts++;
        return Response.json(
          {
            error: {
              code: 'temporarily_unavailable',
              message: 'Try again',
              status: 503,
            },
          },
          { status: 503 },
        );
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });
    const sdk = createSdk(fetch);

    await expect(
      sdk.runtime.uploads.upload({
        bucket: 'documents',
        source: new Blob(['content']),
      }),
    ).rejects.toMatchObject({ status: 503 });

    expect(requestAttempts).toBe(1);
  });
});
