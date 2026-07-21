import { initEdgeStore, type ProviderFile } from '@edgestore/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createEdgeStoreClient, EdgeStoreFileMutationError } from './index';

const backend = {
  upload: vi.fn(),
  getFile: vi.fn(),
  listFiles: vi.fn(),
  confirmFiles: vi.fn(),
  deleteFiles: vi.fn(),
  restoreFiles: vi.fn(),
};

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
  backend,
};

const fetchMock = vi.fn();

function createFile(overrides: Partial<ProviderFile> = {}): ProviderFile {
  return {
    id: 'file-id',
    url: 'https://files.example.com/_public/file.txt',
    key: 'files/file.txt',
    thumbnailUrl: null,
    thumbnailKey: null,
    bucketId: 'bucket-id',
    bucketName: 'publicFiles',
    projectId: 'project-id',
    accountId: 'account-id',
    name: 'file.txt',
    path: {},
    metadata: {},
    sizeBytes: 10,
    mimeType: 'text/plain',
    state: 'uploaded',
    temporary: false,
    uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

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

describe('createEdgeStoreClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });
    backend.upload.mockResolvedValue({ file: createFile() });
    backend.confirmFiles.mockResolvedValue({
      results: [],
      successCount: 0,
      failureCount: 0,
    });
    backend.deleteFiles.mockResolvedValue({
      results: [],
      successCount: 0,
      failureCount: 0,
    });
    backend.restoreFiles.mockResolvedValue({
      results: [],
      successCount: 0,
      failureCount: 0,
    });
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('eagerly creates an inspectable client with stable bucket objects', async () => {
    const client = createClient();

    expect(Object.keys(client)).toEqual(['documents', 'publicFiles']);
    expect(client.documents).toBe(client.documents);
    expect(client.then).toBeUndefined();
    await expect(Promise.resolve(client)).resolves.toBe(client);
  });

  it('uploads string content as a text/plain txt blob', async () => {
    const client = createClient();

    await client.publicFiles.upload({
      content: 'plain text',
    });

    expect(backend.upload).toHaveBeenCalledWith({
      bucketName: 'publicFiles',
      bucketType: 'FILE',
      autoSignedUrls: undefined,
      source: expect.any(Blob),
      signal: undefined,
      onProgress: undefined,
      fileInfo: expect.objectContaining({
        type: 'text/plain',
        size: 10,
        extension: 'txt',
        isPublic: true,
      }),
    });
    const source = backend.upload.mock.calls[0]?.[0].source as Blob;
    expect(source.type).toBe('text/plain');
    await expect(source.text()).resolves.toBe('plain text');
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

    expect(backend.upload).toHaveBeenCalledWith({
      bucketName: 'publicFiles',
      bucketType: 'FILE',
      autoSignedUrls: undefined,
      source: blob,
      signal: undefined,
      onProgress: undefined,
      fileInfo: expect.objectContaining({
        type: 'text/csv',
        size: blob.size,
        extension: 'csv',
      }),
    });
  });

  it('fetches URL content as a blob before requesting an upload', async () => {
    const client = createClient();
    const sourceBlob = new Blob(['from url'], { type: 'application/json' });
    let sourceBlobRead = false;

    fetchMock.mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        blob: vi.fn(async () => {
          sourceBlobRead = true;
          return sourceBlob;
        }),
      };
    });
    backend.upload.mockImplementation(async () => {
      expect(sourceBlobRead).toBe(true);
      return { file: createFile({ mimeType: 'application/json' }) };
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
    expect(backend.upload).toHaveBeenCalledWith({
      bucketName: 'publicFiles',
      bucketType: 'FILE',
      autoSignedUrls: undefined,
      source: sourceBlob,
      signal: undefined,
      onProgress: undefined,
      fileInfo: expect.objectContaining({
        type: 'application/json',
        size: sourceBlob.size,
        extension: 'json',
      }),
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
    expect(backend.upload).toHaveBeenCalledWith({
      bucketName: 'publicFiles',
      bucketType: 'FILE',
      autoSignedUrls: undefined,
      source: expect.any(Blob),
      signal: undefined,
      onProgress: undefined,
      fileInfo: expect.objectContaining({
        type: 'application/octet-stream',
        size: 11,
        extension: 'bin',
      }),
    });
    const source = backend.upload.mock.calls[0]?.[0].source as Blob;
    await expect(source.text()).resolves.toBe('transformed');
  });

  it('computes path and metadata from ctx and input before requesting an upload', async () => {
    const client = createClient();
    backend.upload.mockResolvedValueOnce({
      file: createFile({
        bucketName: 'documents',
        sizeBytes: 7,
        path: { author: 'user-1', type: 'invoice' },
        metadata: { userId: 'user-1', type: 'invoice' },
      }),
    });

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

    expect(backend.upload).toHaveBeenCalledWith({
      bucketName: 'documents',
      bucketType: 'FILE',
      autoSignedUrls: undefined,
      source: expect.any(Blob),
      signal: undefined,
      onProgress: undefined,
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
      id: 'file-id',
      sizeBytes: 7,
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

  it('preserves upload failures from the provider capability', async () => {
    const client = createClient();
    backend.upload.mockRejectedValueOnce(new Error('upload failed'));

    await expect(
      client.publicFiles.upload({
        content: 'plain text',
      }),
    ).rejects.toThrow('upload failed');
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

    backend.deleteFiles.mockResolvedValueOnce({
      results: [
        {
          fileRef: { url: 'https://files.example/file' },
          success: true,
        },
      ],
      successCount: 1,
      failureCount: 0,
    });
    await client.documents.deleteFile({ url: 'https://files.example/file' });
    expect(beforeDelete).not.toHaveBeenCalled();
  });

  it('delegates upload orchestration and forwards progress', async () => {
    const blob = new Blob(['abcdef'], { type: 'application/octet-stream' });
    const onProgress = vi.fn();
    backend.upload.mockImplementationOnce(async (params) => {
      params.onProgress?.({
        transferredBytes: 6,
        totalBytes: 6,
        percentage: 100,
        phase: 'processing',
      });
      return { file: createFile({ sizeBytes: 6 }) };
    });
    const client = createClient();

    await client.publicFiles.upload({
      content: { blob, extension: 'bin' },
      onProgress,
    });

    expect(onProgress).toHaveBeenLastCalledWith({
      transferredBytes: 6,
      totalBytes: 6,
      percentage: 100,
      phase: 'processing',
    });
  });

  it('converts uploadedAt to Date and proxies protected dev file URLs', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const client = createClient({
      baseUrl: 'http://localhost:3000/api/edgestore',
    });
    backend.getFile.mockResolvedValue(
      createFile({
        url: 'https://files.example.com/_protected/file.txt',
        uploadedAt: new Date('2024-01-02T03:04:05.000Z'),
        updatedAt: new Date('2024-01-02T03:04:05.000Z'),
        metadata: { kind: 'file' },
        path: { author: 'user-1' },
      }),
    );
    backend.listFiles.mockResolvedValue({
      items: [
        createFile({
          url: 'https://files.example.com/_public/public.txt',
          sizeBytes: 1,
          uploadedAt: new Date('2024-02-03T04:05:06.000Z'),
          updatedAt: new Date('2024-02-03T04:05:06.000Z'),
        }),
        createFile({
          url: 'https://files.example.com/_protected/private.txt',
          sizeBytes: 2,
          uploadedAt: new Date('2024-03-04T05:06:07.000Z'),
          updatedAt: new Date('2024-03-04T05:06:07.000Z'),
          path: { author: 'user-1' },
        }),
      ],
      limit: 20,
      nextCursor: null,
      hasMore: false,
    });

    const file = await client.documents.getFile({
      url: 'https://files.example.com/_protected/file.txt',
    });
    const files = await client.documents.listFiles();

    expect(file.uploadedAt).toEqual(new Date('2024-01-02T03:04:05.000Z'));
    expect(file.url).toBe(
      'http://localhost:3000/api/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example.com%2F_protected%2Ffile.txt',
    );
    expect(files.items[0]?.uploadedAt).toEqual(
      new Date('2024-02-03T04:05:06.000Z'),
    );
    expect(files.items[0]?.url).toBe(
      'https://files.example.com/_public/public.txt',
    );
    expect(files.items[1]?.uploadedAt).toEqual(
      new Date('2024-03-04T05:06:07.000Z'),
    );
    expect(files.items[1]?.url).toBe(
      'http://localhost:3000/api/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example.com%2F_protected%2Fprivate.txt',
    );
    expect(backend.listFiles).toHaveBeenCalledWith({
      bucketName: 'documents',
      filter: undefined,
      cursor: undefined,
      limit: undefined,
    });
  });

  it('accepts id, key, and URL references and preserves batch failures', async () => {
    const client = createClient();
    backend.getFile.mockResolvedValueOnce(createFile());
    backend.confirmFiles.mockResolvedValueOnce({
      results: [
        {
          fileRef: { id: 'file-id' },
          success: false,
          error: {
            code: 'FILE_NOT_CONFIRMABLE',
            message: 'Already confirmed',
          },
        },
      ],
      successCount: 0,
      failureCount: 1,
    });
    backend.deleteFiles.mockResolvedValueOnce({
      results: [
        { fileRef: { key: 'files/one' }, success: true },
        {
          fileRef: { url: 'https://files.example/missing' },
          success: false,
          error: { code: 'INVALID_FILE_REF', message: 'Missing file' },
        },
      ],
      successCount: 1,
      failureCount: 1,
    });

    await client.publicFiles.getFile({ key: 'files/file.txt' });
    await expect(
      client.publicFiles.confirmUpload({ id: 'file-id' }),
    ).rejects.toBeInstanceOf(EdgeStoreFileMutationError);
    await expect(
      client.publicFiles.deleteFiles({
        refs: [{ key: 'files/one' }, { url: 'https://files.example/missing' }],
      }),
    ).resolves.toEqual({
      succeeded: [{ key: 'files/one' }],
      failed: [
        {
          ref: { url: 'https://files.example/missing' },
          error: { code: 'INVALID_FILE_REF', message: 'Missing file' },
        },
      ],
    });
    expect(backend.getFile).toHaveBeenCalledWith({
      file: { key: 'files/file.txt' },
    });
  });

  it('iterates through cursor pages with flat pagination inputs', async () => {
    backend.listFiles
      .mockResolvedValueOnce({
        items: [createFile({ id: 'first' })],
        limit: 1,
        nextCursor: 'next',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [createFile({ id: 'second' })],
        limit: 1,
        nextCursor: null,
        hasMore: false,
      });
    const client = createClient();

    const ids = [];
    for await (const file of client.publicFiles.listAllFiles({ limit: 1 })) {
      ids.push(file.id);
    }

    expect(ids).toEqual(['first', 'second']);
    expect(backend.listFiles).toHaveBeenNthCalledWith(2, {
      bucketName: 'publicFiles',
      filter: undefined,
      cursor: 'next',
      limit: 1,
    });
  });

  it('throws for protected dev file URLs when baseUrl is missing', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const client = createClient();
    backend.getFile.mockResolvedValue(
      createFile({
        url: 'https://files.example.com/_protected/file.txt',
      }),
    );

    await expect(
      client.documents.getFile({
        url: 'https://files.example.com/_protected/file.txt',
      }),
    ).rejects.toThrow(
      'Missing baseUrl. You need to pass the baseUrl to `createEdgeStoreClient` to get protected files in development.',
    );
  });

  it('leaves unknown buckets undefined', () => {
    const client = createClient();

    expect(client.unknownBucket).toBeUndefined();
  });
});
