import { initEdgeStore } from '@edgestore/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completeMultipartUpload,
  confirmUpload,
  deleteFile,
  requestUploadParts,
} from './shared';
import {
  createContextToken,
  createProvider,
  logger,
} from './shared.test.utils';

type RequestUploadPartsBody = Parameters<typeof requestUploadParts>[0]['body'];
type CompleteMultipartUploadBody = Parameters<
  typeof completeMultipartUpload
>[0]['body'];
type ConfirmUploadBody = Parameters<typeof confirmUpload>[0]['body'];
type DeleteFileBody = Parameters<typeof deleteFile>[0]['body'];

const originalUrl = 'https://files.example.com/protected/file.txt';
const proxiedUrl = `http://localhost:3000/api/edgestore/proxy-file?${new URLSearchParams(
  { url: originalUrl },
).toString()}`;

function requestUploadPartsBody(
  overrides: Partial<RequestUploadPartsBody> = {},
): RequestUploadPartsBody {
  return {
    multipart: {
      uploadId: 'upload-id',
      parts: [1, 2, 3],
    },
    path: 'documents/file.txt',
    ...overrides,
  };
}

function completeMultipartUploadBody(
  overrides: Partial<CompleteMultipartUploadBody> = {},
): CompleteMultipartUploadBody {
  return {
    bucketName: 'documents',
    uploadId: 'upload-id',
    key: 'documents/file.txt',
    parts: [
      {
        partNumber: 1,
        eTag: 'etag-1',
      },
    ],
    ...overrides,
  };
}

function confirmUploadBody(
  overrides: Partial<ConfirmUploadBody> = {},
): ConfirmUploadBody {
  return {
    bucketName: 'documents',
    url: proxiedUrl,
    ...overrides,
  };
}

function deleteFileBody(
  overrides: Partial<DeleteFileBody> = {},
): DeleteFileBody {
  return {
    bucketName: 'documents',
    url: proxiedUrl,
    ...overrides,
  };
}

describe('confirmUpload', () => {
  beforeEach(() => {
    vi.stubEnv('EDGE_STORE_JWT_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'development');
    vi.clearAllMocks();
    (globalThis as any)._EDGE_STORE_LOGGER = logger;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects missing context tokens', async () => {
    const provider = createProvider();
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
    });

    await expect(
      confirmUpload({
        provider,
        router,
        ctxToken: undefined,
        body: confirmUploadBody(),
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(provider.confirmUpload).not.toHaveBeenCalled();
  });

  it('rejects unknown buckets', async () => {
    const provider = createProvider();
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket(),
    });
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    await expect(
      confirmUpload({
        provider,
        router,
        ctxToken,
        body: confirmUploadBody({
          bucketName: 'avatars',
        }),
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(provider.confirmUpload).not.toHaveBeenCalled();
  });

  it('calls the provider with the bucket and unproxied URL, then returns success', async () => {
    const provider = createProvider();
    const es = initEdgeStore.context<{ userId: string }>().create();
    const bucket = es.fileBucket();
    const router = es.router({
      documents: bucket,
    });
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    const res = await confirmUpload({
      provider,
      router,
      ctxToken,
      body: confirmUploadBody(),
    });

    expect(provider.confirmUpload).toHaveBeenCalledWith({
      bucket,
      url: originalUrl,
    });
    expect(res).toEqual({ success: true });
  });

  it('rejects tampered context tokens before calling the provider', async () => {
    const provider = createProvider();
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
    });

    await expect(
      confirmUpload({
        provider,
        router,
        ctxToken: 'tampered-token',
        body: confirmUploadBody(),
      }),
    ).rejects.toThrow();
    expect(provider.confirmUpload).not.toHaveBeenCalled();
  });
});

describe('deleteFile', () => {
  beforeEach(() => {
    vi.stubEnv('EDGE_STORE_JWT_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'development');
    vi.clearAllMocks();
    (globalThis as any)._EDGE_STORE_LOGGER = logger;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects missing context tokens', async () => {
    const provider = createProvider();
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket().beforeDelete(() => true),
    });

    await expect(
      deleteFile({
        provider,
        router,
        ctxToken: undefined,
        body: deleteFileBody(),
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(provider.getFile).not.toHaveBeenCalled();
    expect(provider.deleteFile).not.toHaveBeenCalled();
  });

  it('rejects unknown buckets', async () => {
    const provider = createProvider();
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket().beforeDelete(() => true),
    });
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    await expect(
      deleteFile({
        provider,
        router,
        ctxToken,
        body: deleteFileBody({
          bucketName: 'avatars',
        }),
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(provider.getFile).not.toHaveBeenCalled();
    expect(provider.deleteFile).not.toHaveBeenCalled();
  });

  it('rejects buckets without beforeDelete', async () => {
    const provider = createProvider();
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket(),
    });
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    await expect(
      deleteFile({
        provider,
        router,
        ctxToken,
        body: deleteFileBody(),
      }),
    ).rejects.toMatchObject({
      code: 'SERVER_ERROR',
    });
    expect(provider.getFile).not.toHaveBeenCalled();
    expect(provider.deleteFile).not.toHaveBeenCalled();
  });

  it('rejects deletes when beforeDelete returns false', async () => {
    const provider = createProvider();
    const beforeDelete = vi.fn(() => false);
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket().beforeDelete(beforeDelete),
    });
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    await expect(
      deleteFile({
        provider,
        router,
        ctxToken,
        body: deleteFileBody(),
      }),
    ).rejects.toMatchObject({
      code: 'DELETE_NOT_ALLOWED',
    });
    expect(provider.getFile).toHaveBeenCalledWith({
      url: originalUrl,
    });
    expect(beforeDelete).toHaveBeenCalledWith({
      ctx: expect.objectContaining({ userId: 'user-1' }),
      fileInfo: expect.objectContaining({
        url: 'https://files.example.com/file.txt',
      }),
    });
    expect(provider.deleteFile).not.toHaveBeenCalled();
  });

  it('calls getFile, beforeDelete, then deleteFile with ctx/fileInfo and unproxied URL', async () => {
    const provider = createProvider();
    const beforeDelete = vi.fn(() => true);
    const es = initEdgeStore.context<{ userId: string }>().create();
    const bucket = es.fileBucket().beforeDelete(beforeDelete);
    const router = es.router({
      documents: bucket,
    });
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    const res = await deleteFile({
      provider,
      router,
      ctxToken,
      body: deleteFileBody(),
    });

    expect(provider.getFile).toHaveBeenCalledWith({
      url: originalUrl,
    });
    expect(beforeDelete).toHaveBeenCalledWith({
      ctx: expect.objectContaining({ userId: 'user-1' }),
      fileInfo: expect.objectContaining({
        url: 'https://files.example.com/file.txt',
      }),
    });
    expect(provider.deleteFile).toHaveBeenCalledWith({
      bucket,
      url: originalUrl,
    });
    const getFileCallOrder = vi.mocked(provider.getFile).mock
      .invocationCallOrder[0];
    const beforeDeleteCallOrder = beforeDelete.mock.invocationCallOrder[0];
    const deleteFileCallOrder = vi.mocked(provider.deleteFile).mock
      .invocationCallOrder[0];

    if (
      getFileCallOrder === undefined ||
      beforeDeleteCallOrder === undefined ||
      deleteFileCallOrder === undefined
    ) {
      throw new Error('Expected getFile, beforeDelete, and deleteFile calls');
    }

    expect(getFileCallOrder).toBeLessThan(beforeDeleteCallOrder);
    expect(beforeDeleteCallOrder).toBeLessThan(deleteFileCallOrder);
    expect(res).toEqual({ success: true });
  });

  it('rejects tampered context tokens before calling the provider', async () => {
    const provider = createProvider();
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket().beforeDelete(() => true),
    });

    await expect(
      deleteFile({
        provider,
        router,
        ctxToken: 'tampered-token',
        body: deleteFileBody(),
      }),
    ).rejects.toThrow();
    expect(provider.getFile).not.toHaveBeenCalled();
    expect(provider.deleteFile).not.toHaveBeenCalled();
  });
});

describe('requestUploadParts', () => {
  beforeEach(() => {
    vi.stubEnv('EDGE_STORE_JWT_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'test');
    vi.clearAllMocks();
    (globalThis as any)._EDGE_STORE_LOGGER = logger;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects missing context tokens', async () => {
    const provider = createProvider();
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
    });

    await expect(
      requestUploadParts({
        provider,
        router,
        ctxToken: undefined,
        body: requestUploadPartsBody(),
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(provider.requestUploadParts).not.toHaveBeenCalled();
  });

  it('passes multipart request details to the provider', async () => {
    const provider = createProvider();
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket(),
    });
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });
    const body = requestUploadPartsBody();

    const res = await requestUploadParts({
      provider,
      router,
      ctxToken,
      body,
    });

    expect(provider.requestUploadParts).toHaveBeenCalledWith({
      multipart: body.multipart,
      path: body.path,
    });
    expect(res).toEqual({
      multipart: {
        uploadId: 'upload-id',
        parts: [],
      },
    });
  });

  it('rejects tampered context tokens before calling the provider', async () => {
    const provider = createProvider();
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
    });

    await expect(
      requestUploadParts({
        provider,
        router,
        ctxToken: 'tampered-token',
        body: requestUploadPartsBody(),
      }),
    ).rejects.toThrow();
    expect(provider.requestUploadParts).not.toHaveBeenCalled();
  });
});

describe('completeMultipartUpload', () => {
  beforeEach(() => {
    vi.stubEnv('EDGE_STORE_JWT_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'test');
    vi.clearAllMocks();
    (globalThis as any)._EDGE_STORE_LOGGER = logger;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects missing context tokens', async () => {
    const provider = createProvider();
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
    });

    await expect(
      completeMultipartUpload({
        provider,
        router,
        ctxToken: undefined,
        body: completeMultipartUploadBody(),
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(provider.completeMultipartUpload).not.toHaveBeenCalled();
  });

  it('rejects unknown buckets', async () => {
    const provider = createProvider();
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket(),
    });
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    await expect(
      completeMultipartUpload({
        provider,
        router,
        ctxToken,
        body: completeMultipartUploadBody({
          bucketName: 'avatars',
        }),
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(provider.completeMultipartUpload).not.toHaveBeenCalled();
  });

  it('passes completion details to the provider', async () => {
    const provider = createProvider();
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket(),
    });
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });
    const body = completeMultipartUploadBody();

    const res = await completeMultipartUpload({
      provider,
      router,
      ctxToken,
      body,
    });

    expect(provider.completeMultipartUpload).toHaveBeenCalledWith({
      uploadId: body.uploadId,
      key: body.key,
      parts: body.parts,
    });
    expect(res).toEqual({ success: true });
  });

  it('rejects tampered context tokens before calling the provider', async () => {
    const provider = createProvider();
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
    });

    await expect(
      completeMultipartUpload({
        provider,
        router,
        ctxToken: 'tampered-token',
        body: completeMultipartUploadBody(),
      }),
    ).rejects.toThrow();
    expect(provider.completeMultipartUpload).not.toHaveBeenCalled();
  });
});
