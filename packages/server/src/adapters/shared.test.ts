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
  getCookieConfig,
  init,
  parsePath,
  requestUpload,
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
        body: {
          bucketName: 'documents',
          input: {},
          fileInfo: {
            size: 10,
            type: 'text/plain',
            extension: 'txt',
            temporary: false,
          },
        },
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
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    await expect(
      requestUpload({
        provider: createProvider(),
        router,
        ctxToken,
        body: {
          bucketName: 'avatars',
          input: {},
          fileInfo: {
            size: 10,
            type: 'text/plain',
            extension: 'txt',
            temporary: false,
          },
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
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    await expect(
      requestUpload({
        provider: createProvider(),
        router,
        ctxToken,
        body: {
          bucketName: 'avatars',
          input: {},
          fileInfo: {
            size: 10,
            type: 'text/plain',
            extension: 'txt',
            temporary: false,
          },
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
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    await expect(
      requestUpload({
        provider: createProvider(),
        router,
        ctxToken,
        body: {
          bucketName: 'documents',
          input: {},
          fileInfo: {
            size: 10,
            type: 'text/plain',
            extension: 'txt',
            temporary: false,
          },
        },
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
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    await expect(
      requestUpload({
        provider: createProvider(),
        router,
        ctxToken,
        body: {
          bucketName: 'documents',
          input: {},
          fileInfo: {
            size: 10,
            type: 'image/png',
            extension: 'png',
            temporary: false,
          },
        },
      }),
    ).rejects.toMatchObject({
      code: 'MIME_TYPE_NOT_ALLOWED',
    });

    await expect(
      requestUpload({
        provider: createProvider(),
        router,
        ctxToken,
        body: {
          bucketName: 'documents',
          input: {},
          fileInfo: {
            size: 10,
            type: 'text/markdown',
            extension: 'md',
            temporary: false,
          },
        },
      }),
    ).resolves.toMatchObject({
      path: {},
      metadata: {},
    });

    await expect(
      requestUpload({
        provider: createProvider(),
        router,
        ctxToken,
        body: {
          bucketName: 'documents',
          input: {},
          fileInfo: {
            size: 10,
            type: 'application/json',
            extension: 'json',
            temporary: false,
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
    const ctxToken = await createContextToken({
      router,
      ctx: { userId: 'user-1' },
    });

    await expect(
      requestUpload({
        provider: createProvider(),
        router,
        ctxToken,
        body: {
          bucketName: 'documents',
          input: {},
          fileInfo: {
            size: 10,
            type: 'text/plain',
            extension: 'txt',
            temporary: false,
          },
        },
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
      body: {
        bucketName: 'documents',
        input: {
          type: 'invoice',
        },
        fileInfo: {
          size: 10,
          type: 'text/plain',
          extension: 'txt',
          temporary: true,
          fileName: 'invoice.txt',
        },
      },
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
