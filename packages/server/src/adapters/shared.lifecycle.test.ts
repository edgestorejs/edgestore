import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initEdgeStore } from '../core/router';
import {
  abortMultipartUpload,
  completeMultipartUpload,
  confirmUploads,
  deleteFiles,
  requestUploadParts,
} from './shared';
import {
  createContextToken,
  createProvider,
  logger,
} from './shared.test.utils';

const originalUrls = [
  'https://files.example.com/protected/one.txt',
  'https://files.example.com/protected/two.txt',
];

describe('frontend file mutations', () => {
  beforeEach(() => {
    vi.stubEnv('EDGESTORE_JWT_SECRET', 'test-secret');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects confirmation without a context token', async () => {
    const es = initEdgeStore.create();
    const provider = createProvider();

    await expect(
      confirmUploads({
        provider,
        router: es.router({ documents: es.fileBucket() }),
        ctxToken: undefined,
        body: { bucketName: 'documents', urls: originalUrls },
        logger,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(provider.files.confirm).not.toHaveBeenCalled();
  });

  it('confirms all references in one provider call and preserves failures', async () => {
    const es = initEdgeStore.create();
    const router = es.router({ documents: es.fileBucket() });
    const provider = createProvider();
    const ctxToken = await createContextToken({ router, ctx: {} });
    vi.mocked(provider.files.confirm!).mockResolvedValue({
      results: [
        { success: true },
        {
          success: false,
          error: { code: 'NOT_CONFIRMABLE', message: 'Already permanent' },
        },
      ],
    });

    await expect(
      confirmUploads({
        provider,
        router,
        ctxToken,
        body: { bucketName: 'documents', urls: originalUrls },
        logger,
      }),
    ).resolves.toEqual({
      succeeded: [originalUrls[0]],
      failed: [
        {
          url: originalUrls[1],
          error: { code: 'NOT_CONFIRMABLE', message: 'Already permanent' },
        },
      ],
    });
    expect(provider.files.confirm).toHaveBeenCalledOnce();
    expect(provider.files.confirm).toHaveBeenCalledWith({
      bucketName: 'documents',
      files: originalUrls.map((url) => ({ url })),
    });
  });

  it('rejects provider mutation results with the wrong cardinality', async () => {
    const es = initEdgeStore.create();
    const router = es.router({ documents: es.fileBucket() });
    const provider = createProvider();
    const ctxToken = await createContextToken({ router, ctx: {} });
    vi.mocked(provider.files.confirm!).mockResolvedValue({
      results: [{ success: true }],
    });

    await expect(
      confirmUploads({
        provider,
        router,
        ctxToken,
        body: { bucketName: 'documents', urls: originalUrls },
        logger,
      }),
    ).rejects.toThrow('The provider returned 1 mutation results for 2 files.');
  });

  it('requires beforeDelete for frontend deletion', async () => {
    const es = initEdgeStore.create();
    const router = es.router({ documents: es.fileBucket() });
    const provider = createProvider();
    const ctxToken = await createContextToken({ router, ctx: {} });

    await expect(
      deleteFiles({
        provider,
        router,
        ctxToken,
        body: { bucketName: 'documents', urls: originalUrls },
        logger,
      }),
    ).rejects.toMatchObject({ code: 'SERVER_ERROR' });
    expect(provider.files.get).not.toHaveBeenCalled();
    expect(provider.files.delete).not.toHaveBeenCalled();
  });

  it('uses empty router fields when none are configured', async () => {
    const beforeDelete = vi.fn(() => true);
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket().beforeDelete(beforeDelete),
    });
    const provider = createProvider();
    const ctxToken = await createContextToken({ router, ctx: {} });
    vi.mocked(provider.files.get!).mockResolvedValue({
      url: originalUrls[0]!,
      sizeBytes: 10,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      deleteFiles({
        provider,
        router,
        ctxToken,
        body: { bucketName: 'documents', urls: [originalUrls[0]!] },
        logger,
      }),
    ).resolves.toEqual({ succeeded: [originalUrls[0]], failed: [] });
    expect(beforeDelete).toHaveBeenCalledWith({
      ctx: {},
      fileInfo: {
        url: originalUrls[0],
        size: 10,
        uploadedAt: expect.any(Date),
        path: {},
        metadata: {},
      },
    });
    expect(provider.files.delete).toHaveBeenCalledOnce();
  });

  it('requires stored path when the router configures path fields', async () => {
    const beforeDelete = vi.fn(() => true);
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es
        .fileBucket()
        .path(({ ctx }) => [{ author: ctx.userId }])
        .beforeDelete(beforeDelete),
    });
    const provider = createProvider();
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });
    vi.mocked(provider.files.get!).mockResolvedValue({
      url: originalUrls[0]!,
      sizeBytes: 10,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      deleteFiles({
        provider,
        router,
        ctxToken,
        body: { bucketName: 'documents', urls: [originalUrls[0]!] },
        logger,
      }),
    ).rejects.toThrow(
      'Provider test-provider must return path from files.get to authorize frontend deletion for a bucket with configured path fields.',
    );
    expect(beforeDelete).not.toHaveBeenCalled();
    expect(provider.files.delete).not.toHaveBeenCalled();
  });

  it('requires stored metadata when the router configures metadata fields', async () => {
    const beforeDelete = vi.fn(() => true);
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es
        .fileBucket()
        .metadata(({ ctx }) => ({ author: ctx.userId }))
        .beforeDelete(beforeDelete),
    });
    const provider = createProvider();
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });
    vi.mocked(provider.files.get!).mockResolvedValue({
      url: originalUrls[0]!,
      sizeBytes: 10,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      deleteFiles({
        provider,
        router,
        ctxToken,
        body: { bucketName: 'documents', urls: [originalUrls[0]!] },
        logger,
      }),
    ).rejects.toThrow(
      'Provider test-provider must return metadata from files.get to authorize frontend deletion for a bucket with configured metadata fields.',
    );
    expect(beforeDelete).not.toHaveBeenCalled();
    expect(provider.files.delete).not.toHaveBeenCalled();
  });

  it('authorizes every file before attempting a batch delete', async () => {
    const beforeDelete = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket().beforeDelete(beforeDelete),
    });
    const provider = createProvider();
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    await expect(
      deleteFiles({
        provider,
        router,
        ctxToken,
        body: { bucketName: 'documents', urls: originalUrls },
        logger,
      }),
    ).rejects.toMatchObject({ code: 'DELETE_NOT_ALLOWED' });
    expect(beforeDelete).toHaveBeenCalledTimes(2);
    expect(provider.files.get).toHaveBeenCalledTimes(2);
    expect(provider.files.delete).not.toHaveBeenCalled();
  });

  it('deletes once after authorization and maps partial provider failures', async () => {
    const beforeDelete = vi.fn(() => true);
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket().beforeDelete(beforeDelete),
    });
    const provider = createProvider();
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });
    vi.mocked(provider.files.delete!).mockResolvedValue({
      results: [
        { success: true },
        {
          success: false,
          error: { code: 'DELETE_FAILED', message: 'Storage unavailable' },
        },
      ],
    });

    await expect(
      deleteFiles({
        provider,
        router,
        ctxToken,
        body: { bucketName: 'documents', urls: originalUrls },
        logger,
      }),
    ).resolves.toEqual({
      succeeded: [originalUrls[0]],
      failed: [
        {
          url: originalUrls[1],
          error: { code: 'DELETE_FAILED', message: 'Storage unavailable' },
        },
      ],
    });
    expect(beforeDelete).toHaveBeenCalledTimes(2);
    expect(provider.files.delete).toHaveBeenCalledOnce();
    expect(provider.files.delete).toHaveBeenCalledWith({
      bucketName: 'documents',
      files: originalUrls.map((url) => ({ url })),
    });
  });
});

describe('multipart lifecycle', () => {
  beforeEach(() => {
    vi.stubEnv('EDGESTORE_JWT_SECRET', 'test-secret');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const session = {
    bucketName: 'documents',
    uploadId: 'upload-id',
    key: 'documents/file.txt',
  };
  const operations = [
    {
      name: 'requestParts',
      run: requestUploadParts,
      body: { ...session, parts: [1, 2] },
      forwarded: { uploadId: 'upload-id', key: session.key, parts: [1, 2] },
    },
    {
      name: 'complete',
      run: completeMultipartUpload,
      body: { ...session, parts: [{ partNumber: 1, eTag: 'etag-1' }] },
      forwarded: {
        uploadId: 'upload-id',
        key: session.key,
        parts: [{ partNumber: 1, eTag: 'etag-1' }],
      },
    },
    {
      name: 'abort',
      run: abortMultipartUpload,
      body: session,
      forwarded: { uploadId: 'upload-id', key: session.key },
    },
  ] as const;

  function setup(provider = createProvider()) {
    const es = initEdgeStore.create();
    const router = es.router({ documents: es.fileBucket() });
    return { provider, router };
  }

  it.each(operations)(
    '$name forwards the session after context and bucket checks',
    async ({ name, run, body, forwarded }) => {
      const { provider, router } = setup();
      const ctxToken = await createContextToken({ router, ctx: {} });
      const operation = provider.uploads.multipart![name];

      await expect(
        run({
          provider,
          router,
          ctxToken: undefined,
          body: body as never,
          logger,
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      await expect(
        run({
          provider,
          router,
          ctxToken,
          body: { ...body, bucketName: 'missing' } as never,
          logger,
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(operation).not.toHaveBeenCalled();

      await run({ provider, router, ctxToken, body: body as never, logger });

      expect(operation).toHaveBeenCalledWith(forwarded);
    },
  );

  it.each(operations)(
    'rejects $name for single-part providers',
    async ({ run, body }) => {
      const { provider, router } = setup(
        createProvider({
          uploads: {
            request: vi.fn(() => ({
              uploadUrl: 'https://upload.example.com/file.txt',
              url: 'https://files.example.com/file.txt',
            })),
          },
        }),
      );
      const ctxToken = await createContextToken({ router, ctx: {} });

      await expect(
        run({ provider, router, ctxToken, body: body as never, logger }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Provider test-provider does not support multipart uploads.',
      });
    },
  );
});
