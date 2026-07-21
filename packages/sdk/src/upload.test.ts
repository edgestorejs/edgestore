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
          mimeType: 'application/pdf',
          sizeBytes: 7,
          metadata: { invoiceId: '42', paid: 'false' },
        });
        expect(request.headers.get('idempotency-key')).toBe('upload-request');
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
      source: new Blob(['content'], { type: 'application/pdf' }),
      fileName: 'invoice.pdf',
      idempotencyKey: 'upload-request',
      metadata: { invoiceId: 42, paid: false, ignored: null },
      onProgress: progress,
    });

    expect(result.file.id).toBe('file-id');
    expect(progress.mock.calls).toEqual([
      [{ transferredBytes: 0, totalBytes: 7 }],
      [{ transferredBytes: 7, totalBytes: 7 }],
    ]);
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
      source: new Blob(['abcdef']),
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

  it('retries upload creation with the same idempotency key', async () => {
    const idempotencyKeys: (string | null)[] = [];
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
        idempotencyKeys.push(request.headers.get('idempotency-key'));
        if (requestAttempts === 1) {
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
        return new Response(null, { status: 200 });
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
      retry: { maxAttempts: 2, baseDelayMs: 0 },
    });

    expect(requestAttempts).toBe(2);
    expect(idempotencyKeys[0]).toBeTruthy();
    expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
  });
});
