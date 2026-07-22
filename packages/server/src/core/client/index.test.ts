import { initEdgeStore } from '@edgestore/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { initEdgeStoreClient } from './index';

const sdk = vi.hoisted(() => ({
  getFile: vi.fn(),
  requestUpload: vi.fn(),
  confirmUpload: vi.fn(),
  deleteFile: vi.fn(),
  listFiles: vi.fn(),
}));

vi.mock('../sdk', () => ({
  initEdgeStoreSdk: vi.fn(() => sdk),
}));

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
  return initEdgeStoreClient({
    router: createRouter(),
    accessKey: 'test-access-key',
    secretKey: 'test-secret-key',
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

describe('initEdgeStoreClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });
    sdk.requestUpload.mockResolvedValue({
      signedUrl: 'https://upload.example.com/file',
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

    expect(sdk.requestUpload).toHaveBeenCalledWith({
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

    expect(sdk.requestUpload).toHaveBeenCalledWith({
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
    sdk.requestUpload.mockImplementation(async () => {
      expect(sourceBlobRead).toBe(true);
      return {
        signedUrl: 'https://upload.example.com/file',
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
    expect(sdk.requestUpload).toHaveBeenCalledWith({
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
    expect(sdk.requestUpload).toHaveBeenCalledWith({
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

    expect(sdk.requestUpload).toHaveBeenCalledWith({
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

  it('validates and transforms input before computing upload data', async () => {
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es
        .fileBucket()
        .input(
          z.object({
            type: z.string().transform((value) => value.trim().toUpperCase()),
          }),
        )
        .path(({ input }) => [{ type: input.type }])
        .metadata(({ input }) => ({ type: input.type })),
    });
    const client = initEdgeStoreClient({
      router,
      accessKey: 'test-access-key',
      secretKey: 'test-secret-key',
    });

    await client.documents.upload({
      content: 'invoice',
      ctx: { userId: 'user-1' },
      input: { type: ' invoice ' },
    });

    expect(sdk.requestUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        fileInfo: expect.objectContaining({
          path: [{ key: 'type', value: 'INVOICE' }],
          metadata: { type: 'INVOICE' },
        }),
      }),
    );
  });

  it('awaits async validation and rejects invalid input before upload', async () => {
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket().input(
        z.object({ token: z.string() }).refine(async ({ token }) => {
          await Promise.resolve();
          return token === 'allowed';
        }, 'Token is not allowed'),
      ),
    });
    const client = initEdgeStoreClient({
      router,
      accessKey: 'test-access-key',
      secretKey: 'test-secret-key',
    });

    await expect(
      client.documents.upload({
        content: 'invoice',
        ctx: { userId: 'user-1' },
        input: { token: 'denied' },
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Invalid input: Token is not allowed',
    });
    expect(sdk.requestUpload).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('converts uploadedAt to Date and proxies protected dev file URLs', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const client = createClient({
      baseUrl: 'http://localhost:3000/api/edgestore',
    });
    sdk.getFile.mockResolvedValue({
      url: 'https://files.example.com/_protected/file.txt',
      size: 10,
      uploadedAt: '2024-01-02T03:04:05.000Z',
      metadata: { kind: 'file' },
      path: { author: 'user-1' },
    });
    sdk.listFiles.mockResolvedValue({
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
        currentPage: 1,
        totalPages: 1,
        totalCount: 2,
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
    expect(sdk.listFiles).toHaveBeenCalledWith({
      bucketName: 'documents',
    });
  });

  it('throws for protected dev file URLs when baseUrl is missing', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const client = createClient();
    sdk.getFile.mockResolvedValue({
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
      'Missing baseUrl. You need to pass the baseUrl to `initEdgeStoreClient` to get protected files in development.',
    );
  });

  it('throws for unknown buckets', () => {
    const client = createClient();

    expect(() => client.unknownBucket).toThrow(
      'Bucket unknownBucket not found',
    );
  });
});
