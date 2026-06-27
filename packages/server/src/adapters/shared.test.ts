import {
  EdgeStoreError,
  initEdgeStore,
  type AnyContext,
  type EdgeStoreRouter,
  type Provider,
} from '@edgestore/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  buildPath,
  completeMultipartUpload,
  confirmUpload,
  deleteFile,
  getCookieConfig,
  init,
  parsePath,
  requestUpload,
  requestUploadParts,
} from './shared';

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function createProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    name: 'test-provider',
    init: vi.fn(() => ({ token: 'provider-token' })),
    getBaseUrl: vi.fn(() => 'https://files.example.com'),
    getFile: vi.fn(() => ({
      url: 'https://files.example.com/file.txt',
      size: 10,
      uploadedAt: new Date(),
      path: {},
      metadata: {},
    })),
    requestUpload: vi.fn(() => ({
      uploadUrl: 'https://upload.example.com/file.txt',
      accessUrl: 'https://files.example.com/file.txt',
      thumbnailUrl: null,
    })),
    requestUploadParts: vi.fn(() => ({
      multipart: {
        uploadId: 'upload-id',
        parts: [],
      },
    })),
    completeMultipartUpload: vi.fn(() => ({ success: true })),
    confirmUpload: vi.fn(() => ({ success: true })),
    deleteFile: vi.fn(() => ({ success: true })),
    ...overrides,
  };
}

async function createContextToken<TCtx extends AnyContext>({
  ctx,
  provider = createProvider(),
  router,
}: {
  ctx: TCtx;
  provider?: Provider;
  router: EdgeStoreRouter<TCtx>;
}) {
  const res = await init({
    provider,
    router,
    ctx,
  });
  const cookie = res.newCookies.find((value) =>
    value.startsWith('edgestore-ctx='),
  );

  return cookie?.split(';')[0]?.replace('edgestore-ctx=', '');
}

type RequestUploadParams = Parameters<typeof requestUpload>[0];
type RequestUploadBody = RequestUploadParams['body'];
type RequestUploadPartsBody = Parameters<typeof requestUploadParts>[0]['body'];
type CompleteMultipartUploadBody = Parameters<
  typeof completeMultipartUpload
>[0]['body'];
type ConfirmUploadBody = Parameters<typeof confirmUpload>[0]['body'];
type DeleteFileBody = Parameters<typeof deleteFile>[0]['body'];
type UploadBodyOverrides = Omit<Partial<RequestUploadBody>, 'fileInfo'> & {
  fileInfo?: Partial<RequestUploadBody['fileInfo']>;
};

const defaultFileInfo: RequestUploadBody['fileInfo'] = {
  size: 10,
  type: 'text/plain',
  extension: 'txt',
  temporary: false,
};

function uploadBody(overrides: UploadBodyOverrides = {}): RequestUploadBody {
  return {
    bucketName: 'documents',
    input: {},
    ...overrides,
    fileInfo: {
      ...defaultFileInfo,
      ...overrides.fileInfo,
    },
  };
}

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

async function uploadWithContext<TCtx extends AnyContext>({
  ctx,
  provider = createProvider(),
  router,
  body,
}: {
  ctx: TCtx;
  provider?: Provider;
  router: EdgeStoreRouter<TCtx>;
  body?: UploadBodyOverrides;
}) {
  const ctxToken = await createContextToken({
    router,
    ctx,
  });

  return requestUpload({
    provider,
    router,
    ctxToken,
    body: uploadBody(body),
  });
}

describe('getCookieConfig', () => {
  it('returns the default cookie names and options', () => {
    expect(getCookieConfig()).toEqual({
      ctx: {
        name: 'edgestore-ctx',
        options: {
          path: '/',
          maxAge: 30 * 24 * 60 * 60,
        },
      },
      token: {
        name: 'edgestore-token',
        options: {
          path: '/',
          maxAge: 30 * 24 * 60 * 60,
        },
      },
    });
  });

  it('merges custom names and defined options with defaults', () => {
    expect(
      getCookieConfig({
        ctx: {
          name: 'custom-ctx',
          options: {
            domain: 'example.com',
            sameSite: 'lax',
            secure: true,
            httpOnly: undefined,
          },
        },
        token: {
          name: 'custom-token',
          options: {
            path: '/app',
            maxAge: 60,
          },
        },
      }),
    ).toEqual({
      ctx: {
        name: 'custom-ctx',
        options: {
          path: '/',
          maxAge: 30 * 24 * 60 * 60,
          domain: 'example.com',
          sameSite: 'lax',
          secure: true,
        },
      },
      token: {
        name: 'custom-token',
        options: {
          path: '/app',
          maxAge: 60,
        },
      },
    });
  });
});

describe('path helpers', () => {
  it('builds and parses ordered path values from context and input', () => {
    const es = initEdgeStore.context<{ userId: string }>().create();
    const bucket = es
      .fileBucket()
      .input(
        z.object({ org: z.object({ slug: z.string() }), type: z.string() }),
      )
      .path(({ ctx, input }) => [
        { author: ctx.userId },
        { org: input.org.slug },
        { type: input.type },
      ]);

    const path = buildPath({
      bucket,
      pathAttrs: {
        ctx: {
          userId: 'user-1',
        },
        input: {
          org: {
            slug: 'acme',
          },
          type: 'avatar',
        },
      },
      fileInfo: {
        size: 10,
        type: 'text/plain',
        extension: 'txt',
        temporary: false,
      },
    });

    expect(path).toEqual([
      { key: 'author', value: 'user-1' },
      { key: 'org', value: 'acme' },
      { key: 'type', value: 'avatar' },
    ]);
    expect(parsePath(path)).toEqual({
      parsedPath: {
        author: 'user-1',
        org: 'acme',
        type: 'avatar',
      },
      pathOrder: ['author', 'org', 'type'],
    });
  });

  it('throws an EdgeStoreError when a path value is missing', () => {
    const es = initEdgeStore.context<{ userId: string }>().create();
    const bucket = es.fileBucket().path(({ ctx }) => [{ author: ctx.userId }]);

    expect(() =>
      buildPath({
        bucket,
        pathAttrs: {
          ctx: {},
          input: {},
        },
        fileInfo: {
          size: 10,
          type: 'text/plain',
          extension: 'txt',
          temporary: false,
        },
      }),
    ).toThrow(EdgeStoreError);
  });
});

describe('init', () => {
  beforeEach(() => {
    vi.stubEnv('EDGE_STORE_JWT_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'test');
    vi.clearAllMocks();
    (globalThis as any)._EDGE_STORE_LOGGER = logger;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('runs init for the built-in AWS provider without setting a token cookie', async () => {
    const provider = createProvider({
      name: 'aws',
      init: vi.fn(() => ({})),
    });
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
    });

    const res = await init({
      provider,
      router,
      ctx: {},
    });

    expect(provider.init).toHaveBeenCalledWith({
      ctx: {},
      router,
    });
    expect(res).toMatchObject({
      token: undefined,
      providerName: 'aws',
      requiresFileAccessCookie: false,
    });
    expect(
      res.newCookies.some((value) => value.startsWith('edgestore-ctx=')),
    ).toBe(true);
    expect(
      res.newCookies.some((value) => value.startsWith('edgestore-token=')),
    ).toBe(false);
  });

  it('runs init for the built-in Azure provider without setting a token cookie', async () => {
    const provider = createProvider({
      name: 'azure',
      init: vi.fn(() => ({})),
    });
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
    });

    const res = await init({
      provider,
      router,
      ctx: {},
    });

    expect(provider.init).toHaveBeenCalledWith({
      ctx: {},
      router,
    });
    expect(res).toMatchObject({
      token: undefined,
      providerName: 'azure',
      requiresFileAccessCookie: false,
    });
  });

  it('does not mint a token for public-only EdgeStore buckets', async () => {
    const provider = createProvider({ name: 'edgestore' });
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
      avatars: es.imageBucket(),
    });

    const res = await init({
      provider,
      router,
      ctx: {},
    });

    expect(provider.init).not.toHaveBeenCalled();
    expect(res).toMatchObject({
      token: undefined,
      providerName: 'edgestore',
      requiresFileAccessCookie: false,
    });
    expect(
      res.newCookies.some((value) => value.startsWith('edgestore-ctx=')),
    ).toBe(true);
  });

  it('mints a token for EdgeStore buckets with access control', async () => {
    const provider = createProvider({ name: 'edgestore' });
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket().accessControl({
        userId: 'user-1',
      }),
    });

    const res = await init({
      provider,
      router,
      ctx: { userId: 'user-1' },
    });

    expect(provider.init).toHaveBeenCalledWith({
      ctx: { userId: 'user-1' },
      router,
    });
    expect(res).toMatchObject({
      token: 'provider-token',
      providerName: 'edgestore',
      requiresFileAccessCookie: true,
    });
    expect(
      res.newCookies.some((value) => value.startsWith('edgestore-token=')),
    ).toBe(true);
  });

  it('keeps running init for custom providers', async () => {
    const provider = createProvider({ name: 'custom-provider' });
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
    });

    const res = await init({
      provider,
      router,
      ctx: {},
    });

    expect(provider.init).toHaveBeenCalledWith({
      ctx: {},
      router,
    });
    expect(res).toMatchObject({
      token: 'provider-token',
      providerName: 'custom-provider',
      requiresFileAccessCookie: false,
    });
  });
});

describe('requestUpload', () => {
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
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
    });

    await expect(
      requestUpload({
        provider: createProvider(),
        router,
        ctxToken: undefined,
        body: uploadBody(),
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects unknown buckets', async () => {
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket(),
    });

    await expect(
      uploadWithContext({
        router,
        ctx: { userId: 'user-1' },
        body: {
          bucketName: 'avatars',
        },
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects non-image MIME types for image buckets', async () => {
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      avatars: es.imageBucket(),
    });

    await expect(
      uploadWithContext({
        router,
        ctx: { userId: 'user-1' },
        body: {
          bucketName: 'avatars',
        },
      }),
    ).rejects.toMatchObject({
      code: 'MIME_TYPE_NOT_ALLOWED',
    });
  });

  it('rejects files larger than the bucket max size', async () => {
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket({ maxSize: 5 }),
    });

    await expect(
      uploadWithContext({
        router,
        ctx: { userId: 'user-1' },
      }),
    ).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });

  it('enforces exact and wildcard accept rules', async () => {
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket({ accept: ['text/*', 'application/json'] }),
    });

    await expect(
      uploadWithContext({
        router,
        ctx: { userId: 'user-1' },
        body: {
          fileInfo: {
            type: 'image/png',
            extension: 'png',
          },
        },
      }),
    ).rejects.toMatchObject({
      code: 'MIME_TYPE_NOT_ALLOWED',
    });

    await expect(
      uploadWithContext({
        router,
        ctx: { userId: 'user-1' },
        body: {
          fileInfo: {
            type: 'text/markdown',
            extension: 'md',
          },
        },
      }),
    ).resolves.toMatchObject({
      path: {},
      metadata: {},
    });

    await expect(
      uploadWithContext({
        router,
        ctx: { userId: 'user-1' },
        body: {
          fileInfo: {
            type: 'application/json',
            extension: 'json',
          },
        },
      }),
    ).resolves.toMatchObject({
      path: {},
      metadata: {},
    });
  });

  it('rejects uploads when beforeUpload returns false', async () => {
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es.fileBucket().beforeUpload(() => false),
    });

    await expect(
      uploadWithContext({
        router,
        ctx: { userId: 'user-1' },
      }),
    ).rejects.toMatchObject({
      code: 'UPLOAD_NOT_ALLOWED',
    });
  });

  it('passes computed upload info to the provider', async () => {
    const provider = createProvider();
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es
        .fileBucket()
        .input(z.object({ type: z.string() }))
        .path(({ ctx, input }) => [
          { author: ctx.userId },
          { type: input.type },
        ])
        .metadata(({ ctx, input }) => ({
          userId: ctx.userId,
          type: input.type,
        }))
        .accessControl({
          userId: { path: 'author' },
        }),
    });
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    const res = await requestUpload({
      provider,
      router,
      ctxToken,
      body: uploadBody({
        input: {
          type: 'invoice',
        },
        fileInfo: {
          temporary: true,
          fileName: 'invoice.txt',
        },
      }),
    });

    expect(provider.requestUpload).toHaveBeenCalledWith({
      bucketName: 'documents',
      bucketType: 'FILE',
      fileInfo: {
        size: 10,
        type: 'text/plain',
        extension: 'txt',
        temporary: true,
        fileName: 'invoice.txt',
        path: [
          { key: 'author', value: 'user-1' },
          { key: 'type', value: 'invoice' },
        ],
        metadata: {
          userId: 'user-1',
          type: 'invoice',
        },
        isPublic: false,
      },
    });
    expect(res).toMatchObject({
      accessUrl: 'https://files.example.com/file.txt',
      size: 10,
      path: {
        author: 'user-1',
        type: 'invoice',
      },
      pathOrder: ['author', 'type'],
      metadata: {
        userId: 'user-1',
        type: 'invoice',
      },
    });
  });
});

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
