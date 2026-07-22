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
import {
  createContextToken,
  createProvider,
  logger,
} from './shared.test.utils';

type RequestUploadParams = Parameters<typeof requestUpload>[0];
type RequestUploadBody = RequestUploadParams['body'];
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
    const beforeUpload = vi.fn(() => true);
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
        .beforeUpload(beforeUpload)
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

    expect(beforeUpload).toHaveBeenCalledWith({
      ctx: expect.objectContaining({ userId: 'user-1' }),
      input: { type: 'invoice' },
      fileInfo: {
        size: 10,
        type: 'text/plain',
        extension: 'txt',
        temporary: true,
        fileName: 'invoice.txt',
        replaceTargetUrl: undefined,
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
