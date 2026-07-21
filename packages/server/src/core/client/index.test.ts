import { initEdgeStore } from '@edgestore/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createEdgeStoreClient } from './index';

const provider = {
  name: 'test',
  init: vi.fn(),
  getBaseUrl: vi.fn(),
  getFile: vi.fn(),
  requestUpload: vi.fn(),
  requestUploadParts: vi.fn(),
  completeMultipartUpload: vi.fn(),
  confirmUpload: vi.fn(),
  deleteFile: vi.fn(),
  listFiles: vi.fn(),
  getSignedUrls: vi.fn(),
};

const fetchMock = vi.fn();

function createRouter() {
  const es = initEdgeStore.context<{ userId: string }>().create();
  return es.router({
    documents: es
      .fileBucket()
      .input(z.object({ type: z.string() }))
      .path(({ ctx, input }) => [{ author: ctx.userId }, { type: input.type }])
      .metadata(({ ctx, input }) => ({
        userId: ctx.userId,
        type: input.type,
      }))
      .accessControl({
        userId: { path: 'author' },
      }),
    publicFiles: es.fileBucket(),
  });
}

function createClient(config: { baseUrl?: string } = {}) {
  return createEdgeStoreClient({
    router: createRouter(),
    provider,
    ...config,
  }) as any;
}

async function expectPutBodyBlob(params: {
  expectedText: string;
  expectedType: string;
  callIndex?: number;
}) {
  const call = fetchMock.mock.calls[params.callIndex ?? 0];
  expect(call?.[1]).toMatchObject({
    method: 'PUT',
  });
  const body = call?.[1]?.body as Blob;
  expect(body).toBeInstanceOf(Blob);
  expect(body.type).toBe(params.expectedType);
  expect(await body.text()).toBe(params.expectedText);
}

describe('createEdgeStoreClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });
    provider.requestUpload.mockResolvedValue({
      uploadUrl: 'https://upload.example.com/file',
      accessUrl: 'https://files.example.com/_public/file.txt',
      thumbnailUrl: null,
    });
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uploads string content as a text/plain txt blob via signed PUT', async () => {
    const client = createClient();

    await client.publicFiles.upload({
      content: 'plain text',
    });

    expect(provider.requestUpload).toHaveBeenCalledWith({
      bucketName: 'publicFiles',
      bucketType: 'FILE',
      fileInfo: expect.objectContaining({
        type: 'text/plain',
        size: 10,
        extension: 'txt',
        isPublic: true,
      }),
    });
    expect(fetchMock).toHaveBeenCalledWith('https://upload.example.com/file', {
      method: 'PUT',
      body: expect.any(Blob),
      signal: undefined,
    });
    await expectPutBodyBlob({
      expectedText: 'plain text',
      expectedType: 'text/plain',
    });
  });

  it('preserves blob MIME type, size, and explicit extension', async () => {
    const client = createClient();
    const blob = new Blob(['a,b,c'], { type: 'text/csv' });

    await client.publicFiles.upload({
      content: {
        blob,
        extension: 'csv',
      },
    });

    expect(provider.requestUpload).toHaveBeenCalledWith({
      bucketName: 'publicFiles',
      bucketType: 'FILE',
      fileInfo: expect.objectContaining({
        type: 'text/csv',
        size: blob.size,
        extension: 'csv',
      }),
    });
    await expectPutBodyBlob({
      expectedText: 'a,b,c',
      expectedType: 'text/csv',
    });
  });

  it('fetches URL content as a blob before requesting an upload', async () => {
    const client = createClient();
    const sourceBlob = new Blob(['from url'], { type: 'application/json' });
    let sourceBlobRead = false;

    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (!init) {
        return {
          ok: true,
          status: 200,
          blob: vi.fn(async () => {
            sourceBlobRead = true;
            return sourceBlob;
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
      };
    });
    provider.requestUpload.mockImplementation(async () => {
      expect(sourceBlobRead).toBe(true);
      return {
        uploadUrl: 'https://upload.example.com/file',
        accessUrl: 'https://files.example.com/_public/file.json',
        thumbnailUrl: null,
      };
    });

    await client.publicFiles.upload({
      content: {
        url: 'https://source.example.com/file.json',
        extension: 'json',
      },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://source.example.com/file.json',
    );
    expect(provider.requestUpload).toHaveBeenCalledWith({
      bucketName: 'publicFiles',
      bucketType: 'FILE',
      fileInfo: expect.objectContaining({
        type: 'application/json',
        size: sourceBlob.size,
        extension: 'json',
      }),
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://upload.example.com/file',
    );
    await expectPutBodyBlob({
      expectedText: 'from url',
      expectedType: 'application/json',
      callIndex: 1,
    });
  });

  it('allows options.transform to replace the blob and extension', async () => {
    const client = createClient();
    const transform = vi.fn(async () => ({
      blob: new Blob(['transformed'], { type: 'application/octet-stream' }),
      extension: 'bin',
    }));

    await client.publicFiles.upload({
      content: 'original',
      options: {
        transform,
      },
    });

    expect(transform).toHaveBeenCalledWith({
      blob: expect.any(Blob),
      extension: 'txt',
      type: 'text/plain',
    });
    expect(provider.requestUpload).toHaveBeenCalledWith({
      bucketName: 'publicFiles',
      bucketType: 'FILE',
      fileInfo: expect.objectContaining({
        type: 'application/octet-stream',
        size: 11,
        extension: 'bin',
      }),
    });
    await expectPutBodyBlob({
      expectedText: 'transformed',
      expectedType: 'application/octet-stream',
    });
  });

  it('computes path and metadata from ctx and input before requesting an upload', async () => {
    const client = createClient();

    const res = await client.documents.upload({
      content: 'invoice',
      ctx: {
        userId: 'user-1',
      },
      input: {
        type: 'invoice',
      },
      options: {
        temporary: true,
        manualFileName: 'invoice.txt',
        replaceTargetUrl: 'https://files.example.com/_protected/old.txt',
      },
    });

    expect(provider.requestUpload).toHaveBeenCalledWith({
      bucketName: 'documents',
      bucketType: 'FILE',
      fileInfo: {
        fileName: 'invoice.txt',
        replaceTargetUrl: 'https://files.example.com/_protected/old.txt',
        type: 'text/plain',
        size: 7,
        extension: 'txt',
        isPublic: false,
        temporary: true,
        path: [
          { key: 'author', value: 'user-1' },
          { key: 'type', value: 'invoice' },
        ],
        metadata: {
          userId: 'user-1',
          type: 'invoice',
        },
      },
    });
    expect(res).toMatchObject({
      url: 'https://files.example.com/_public/file.txt',
      size: 7,
      metadata: {
        userId: 'user-1',
        type: 'invoice',
      },
      path: {
        author: 'user-1',
        type: 'invoice',
      },
      pathOrder: ['author', 'type'],
    });
  });

  it('throws a useful error when the signed upload PUT fails', async () => {
    const client = createClient();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    await expect(
      client.publicFiles.upload({
        content: 'plain text',
      }),
    ).rejects.toThrow('Upload failed with status 403: Forbidden');
  });

  it('enforces input and file rules without running authorization hooks', async () => {
    const beforeUpload = vi.fn(() => false);
    const beforeDelete = vi.fn(() => false);
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es
        .fileBucket({ accept: ['application/json'], maxSize: 20 })
        .input(z.object({ category: z.literal('invoice') }))
        .beforeUpload(beforeUpload)
        .beforeDelete(beforeDelete),
    });
    const client = createEdgeStoreClient({ router, provider });

    await expect(
      client.documents.upload({
        content: {
          blob: new Blob(['not json'], { type: 'text/plain' }),
          extension: 'txt',
        },
        ctx: { userId: 'user-1' },
        input: { category: 'invoice' },
      }),
    ).rejects.toMatchObject({ code: 'MIME_TYPE_NOT_ALLOWED' });
    await expect(
      client.documents.upload({
        content: {
          blob: new Blob(['{}'], { type: 'application/json' }),
          extension: 'json',
        },
        ctx: { userId: 'user-1' },
        input: { category: 'wrong' } as never,
      }),
    ).rejects.toThrow();
    expect(beforeUpload).not.toHaveBeenCalled();

    provider.deleteFile.mockResolvedValueOnce({ success: true });
    await client.documents.deleteFile({ url: 'https://files.example/file' });
    expect(beforeDelete).not.toHaveBeenCalled();
  });

  it('uploads and completes multipart files through the provider contract', async () => {
    const blob = new Blob(['abcdef'], { type: 'application/octet-stream' });
    provider.requestUpload.mockResolvedValueOnce({
      accessUrl: 'https://files.example/file',
      multipart: {
        key: 'files/file',
        uploadId: 'upload-1',
        partSize: 3,
        totalParts: 2,
        parts: [
          { partNumber: 1, uploadUrl: 'https://upload.example/1' },
          { partNumber: 2, uploadUrl: 'https://upload.example/2' },
        ],
      },
    });
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ etag: url.endsWith('/1') ? 'etag-1' : 'etag-2' }),
    }));
    const onProgress = vi.fn();
    const client = createClient();

    await client.publicFiles.upload({
      content: { blob, extension: 'bin' },
      onProgress,
    });

    expect(provider.completeMultipartUpload).toHaveBeenCalledWith({
      uploadId: 'upload-1',
      key: 'files/file',
      parts: [
        { partNumber: 1, eTag: 'etag-1' },
        { partNumber: 2, eTag: 'etag-2' },
      ],
    });
    expect(onProgress).toHaveBeenLastCalledWith({
      transferredBytes: 6,
      totalBytes: 6,
      percentage: 100,
    });
  });

  it('converts uploadedAt to Date and proxies protected dev file URLs', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const client = createClient({
      baseUrl: 'http://localhost:3000/api/edgestore',
    });
    provider.getFile.mockResolvedValue({
      url: 'https://files.example.com/_protected/file.txt',
      size: 10,
      uploadedAt: '2024-01-02T03:04:05.000Z',
      metadata: { kind: 'file' },
      path: { author: 'user-1' },
    });
    provider.listFiles.mockResolvedValue({
      data: [
        {
          url: 'https://files.example.com/_public/public.txt',
          thumbnailUrl: null,
          size: 1,
          uploadedAt: '2024-02-03T04:05:06.000Z',
          metadata: {},
          path: {},
        },
        {
          url: 'https://files.example.com/_protected/private.txt',
          thumbnailUrl: null,
          size: 2,
          uploadedAt: '2024-03-04T05:06:07.000Z',
          metadata: {},
          path: { author: 'user-1' },
        },
      ],
      pagination: {
        limit: 20,
        nextCursor: null,
        hasMore: false,
      },
    });

    const file = await client.documents.getFile({
      url: 'https://files.example.com/_protected/file.txt',
    });
    const files = await client.documents.listFiles();

    expect(file.uploadedAt).toEqual(new Date('2024-01-02T03:04:05.000Z'));
    expect(file.url).toBe(
      'http://localhost:3000/api/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example.com%2F_protected%2Ffile.txt',
    );
    expect(files.data[0].uploadedAt).toEqual(
      new Date('2024-02-03T04:05:06.000Z'),
    );
    expect(files.data[0].url).toBe(
      'https://files.example.com/_public/public.txt',
    );
    expect(files.data[1].uploadedAt).toEqual(
      new Date('2024-03-04T05:06:07.000Z'),
    );
    expect(files.data[1].url).toBe(
      'http://localhost:3000/api/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example.com%2F_protected%2Fprivate.txt',
    );
    expect(provider.listFiles).toHaveBeenCalledWith({
      bucketName: 'documents',
      filter: undefined,
      pagination: undefined,
    });
  });

  it('iterates through cursor pages with listAllFiles', async () => {
    provider.listFiles
      .mockResolvedValueOnce({
        data: [
          {
            url: 'https://files.example/_public/first',
            size: 1,
            uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
            metadata: {},
            path: {},
          },
        ],
        pagination: { limit: 1, nextCursor: 'next', hasMore: true },
      })
      .mockResolvedValueOnce({
        data: [
          {
            url: 'https://files.example/_public/second',
            size: 2,
            uploadedAt: new Date('2026-01-02T00:00:00.000Z'),
            metadata: {},
            path: {},
          },
        ],
        pagination: { limit: 1, nextCursor: null, hasMore: false },
      });
    const client = createClient();

    const files = [];
    for await (const file of client.publicFiles.listAllFiles({ limit: 1 })) {
      files.push(file.url);
    }

    expect(files).toEqual([
      'https://files.example/_public/first',
      'https://files.example/_public/second',
    ]);
    expect(provider.listFiles).toHaveBeenNthCalledWith(2, {
      bucketName: 'publicFiles',
      filter: undefined,
      pagination: { cursor: 'next', limit: 1 },
    });
  });

  it('throws for protected dev file URLs when baseUrl is missing', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const client = createClient();
    provider.getFile.mockResolvedValue({
      url: 'https://files.example.com/_protected/file.txt',
      size: 10,
      uploadedAt: '2024-01-02T03:04:05.000Z',
      metadata: {},
      path: {},
    });

    await expect(
      client.documents.getFile({
        url: 'https://files.example.com/_protected/file.txt',
      }),
    ).rejects.toThrow(
      'Missing baseUrl. You need to pass the baseUrl to `createEdgeStoreClient` to get protected files in development.',
    );
  });

  it('throws for unknown buckets', () => {
    const client = createClient();

    expect(() => client.unknownBucket).toThrow(
      'Bucket unknownBucket not found',
    );
  });
});
