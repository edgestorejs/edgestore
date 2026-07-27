import { initEdgeStore } from '@edgestore/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
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
const proxiedUrls = originalUrls.map(
  (url) =>
    `http://localhost:3000/api/edgestore/proxy-file?${new URLSearchParams({
      url,
    }).toString()}`,
);

describe('frontend file mutations', () => {
  beforeEach(() => {
    vi.stubEnv('EDGE_STORE_JWT_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'development');
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
        body: { bucketName: 'documents', urls: proxiedUrls },
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
        body: { bucketName: 'documents', urls: proxiedUrls },
        logger,
      }),
    ).resolves.toEqual({
      succeeded: [proxiedUrls[0]],
      failed: [
        {
          url: proxiedUrls[1],
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
        body: { bucketName: 'documents', urls: proxiedUrls },
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
        body: { bucketName: 'documents', urls: proxiedUrls },
        logger,
      }),
    ).rejects.toMatchObject({ code: 'SERVER_ERROR' });
    expect(provider.files.get).not.toHaveBeenCalled();
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
        body: { bucketName: 'documents', urls: proxiedUrls },
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
        body: { bucketName: 'documents', urls: proxiedUrls },
        logger,
      }),
    ).resolves.toEqual({
      succeeded: [proxiedUrls[0]],
      failed: [
        {
          url: proxiedUrls[1],
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
    vi.stubEnv('EDGE_STORE_JWT_SECRET', 'test-secret');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('checks context before requesting parts', async () => {
    const es = initEdgeStore.create();
    const provider = createProvider();

    await expect(
      requestUploadParts({
        provider,
        router: es.router({ documents: es.fileBucket() }),
        ctxToken: undefined,
        body: {
          multipart: { uploadId: 'upload-id', parts: [1, 2] },
          path: 'documents/file.txt',
        },
        logger,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(provider.uploads.multipart?.requestParts).not.toHaveBeenCalled();
  });

  it('forwards part requests after context validation', async () => {
    const es = initEdgeStore.create();
    const router = es.router({ documents: es.fileBucket() });
    const provider = createProvider();
    const ctxToken = await createContextToken({ router, ctx: {} });
    const body = {
      multipart: { uploadId: 'upload-id', parts: [1, 2] },
      path: 'documents/file.txt',
    };

    await requestUploadParts({ provider, router, ctxToken, body, logger });

    expect(provider.uploads.multipart?.requestParts).toHaveBeenCalledWith(body);
  });

  it('rejects multipart routes for single-part providers', async () => {
    const es = initEdgeStore.create();
    const router = es.router({ documents: es.fileBucket() });
    const provider = createProvider({
      uploads: {
        request: vi.fn(() => ({
          uploadUrl: 'https://upload.example.com/file.txt',
          accessUrl: 'https://files.example.com/file.txt',
        })),
      },
    });
    const ctxToken = await createContextToken({ router, ctx: {} });

    await expect(
      requestUploadParts({
        provider,
        router,
        ctxToken,
        body: {
          multipart: { uploadId: 'upload-id', parts: [1] },
          path: 'documents/file.txt',
        },
        logger,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Provider test-provider does not support multipart uploads.',
    });
  });

  it('checks context and bucket before completing multipart uploads', async () => {
    const es = initEdgeStore.create();
    const router = es.router({ documents: es.fileBucket() });
    const provider = createProvider();
    const ctxToken = await createContextToken({ router, ctx: {} });
    const body = {
      bucketName: 'documents',
      uploadId: 'upload-id',
      key: 'documents/file.txt',
      parts: [{ partNumber: 1, eTag: 'etag-1' }],
    };

    await completeMultipartUpload({
      provider,
      router,
      ctxToken,
      body,
      logger,
    });

    expect(provider.uploads.multipart?.complete).toHaveBeenCalledWith({
      uploadId: body.uploadId,
      key: body.key,
      parts: body.parts,
    });
  });
});
