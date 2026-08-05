import {
  initEdgeStore,
  type AnyContext,
  type EdgeStoreProvider,
  type EdgeStoreRouter,
} from '@edgestore/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { getCookieConfig, init, requestUpload } from './shared';
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
  provider?: EdgeStoreProvider;
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
    logger,
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

describe('init', () => {
  beforeEach(() => {
    vi.stubEnv('EDGE_STORE_JWT_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'test');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('runs init for the built-in S3 provider without setting a token cookie', async () => {
    const provider = createProvider({
      name: 's3',
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
      logger,
    });

    expect(provider.init).toHaveBeenCalledWith({
      ctx: {},
      router,
    });
    expect(res).toMatchObject({
      providerName: 's3',
    });
    expect(res.clientInit).toBeUndefined();
    expect(
      res.newCookies.some((value) => value.startsWith('edgestore-ctx=')),
    ).toBe(true);
    expect(
      res.newCookies.some((value) => value.startsWith('edgestore-token=')),
    ).toBe(false);
  });

  it('runs init for the built-in Azure Blob provider without setting a token cookie', async () => {
    const provider = createProvider({
      name: 'azure-blob',
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
      logger,
    });

    expect(provider.init).toHaveBeenCalledWith({
      ctx: {},
      router,
    });
    expect(res).toMatchObject({
      providerName: 'azure-blob',
    });
    expect(res.clientInit).toBeUndefined();
  });

  it('always runs init even when the provider is named edgestore', async () => {
    const provider = createProvider({
      name: 'edgestore',
      init: vi.fn(() => ({})),
    });
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
      avatars: es.imageBucket(),
    });

    const res = await init({
      provider,
      router,
      ctx: {},
      logger,
    });

    expect(provider.init).toHaveBeenCalledWith({ ctx: {}, router });
    expect(res).toMatchObject({
      providerName: 'edgestore',
    });
    expect(res.clientInit).toBeUndefined();
    expect(
      res.newCookies.some((value) => value.startsWith('edgestore-ctx=')),
    ).toBe(true);
  });

  it('returns an explicit provider client-init instruction', async () => {
    const provider = createProvider({
      name: 'custom-provider',
      init: vi.fn(() => ({
        token: 'provider-token',
        clientInit: {
          path: '/_init',
          headers: { 'x-provider-token': 'provider-token' },
        },
      })),
    });
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
      logger,
    });

    expect(provider.init).toHaveBeenCalledWith({
      ctx: { userId: 'user-1' },
      router,
    });
    expect(res).toMatchObject({
      providerName: 'custom-provider',
      clientInit: {
        path: '/_init',
        headers: { 'x-provider-token': 'provider-token' },
      },
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
      logger,
    });

    expect(provider.init).toHaveBeenCalledWith({
      ctx: {},
      router,
    });
    expect(res).toMatchObject({
      providerName: 'custom-provider',
    });
    expect(res.clientInit).toBeUndefined();
  });
});

describe('requestUpload', () => {
  beforeEach(() => {
    vi.stubEnv('EDGE_STORE_JWT_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'test');
    vi.clearAllMocks();
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
        logger,
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
        .input(
          z.object({
            type: z.string().transform((value) => value.trim().toUpperCase()),
          }),
        )
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
          type: ' invoice ',
        },
        fileInfo: {
          temporary: true,
          fileName: 'invoice.txt',
        },
      }),
      logger,
    });

    expect(beforeUpload).toHaveBeenCalledWith({
      ctx: expect.objectContaining({ userId: 'user-1' }),
      input: { type: 'INVOICE' },
      fileInfo: {
        size: 10,
        type: 'text/plain',
        extension: 'txt',
        temporary: true,
        fileName: 'invoice.txt',
        replaceTargetUrl: undefined,
      },
    });

    expect(provider.uploads.request).toHaveBeenCalledWith({
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
          { key: 'type', value: 'INVOICE' },
        ],
        metadata: {
          userId: 'user-1',
          type: 'INVOICE',
        },
        isPublic: false,
      },
    });
    expect(res).toMatchObject({
      accessUrl: 'https://files.example.com/file.txt',
      size: 10,
      path: {
        author: 'user-1',
        type: 'INVOICE',
      },
      pathOrder: ['author', 'type'],
      metadata: {
        userId: 'user-1',
        type: 'INVOICE',
      },
    });
  });

  it('rejects invalid async input before hooks and provider calls', async () => {
    const provider = createProvider();
    const beforeUpload = vi.fn(() => true);
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      documents: es
        .fileBucket()
        .input(
          z.object({ token: z.string() }).refine(async ({ token }) => {
            await Promise.resolve();
            return token === 'allowed';
          }, 'Token is not allowed'),
        )
        .beforeUpload(beforeUpload),
    });

    await expect(
      uploadWithContext({
        provider,
        router,
        ctx: { userId: 'user-1' },
        body: { input: { token: 'denied' } },
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Invalid input: Token is not allowed',
    });

    expect(beforeUpload).not.toHaveBeenCalled();
    expect(provider.uploads.request).not.toHaveBeenCalled();
  });

  it('preserves application context keys that match registered JWT claims', async () => {
    const beforeUpload = vi.fn(() => true);
    const ctx = {
      iat: 'application-iat',
      exp: 'application-exp',
      jti: 'application-jti',
    };
    const es = initEdgeStore.context<typeof ctx>().create();
    const router = es.router({
      documents: es.fileBucket().beforeUpload(beforeUpload),
    });

    await uploadWithContext({ router, ctx });

    expect(beforeUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx,
      }),
    );
  });

  it('rejects non-flat application context from the encrypted cookie', async () => {
    const es = initEdgeStore.create();
    const router = es.router({
      documents: es.fileBucket(),
    });
    const ctxToken = await createContextToken({
      router,
      ctx: { nested: { value: 'not-flat' } } as never,
    });
    const provider = createProvider();

    await expect(
      requestUpload({
        provider,
        router,
        ctxToken,
        body: uploadBody(),
        logger,
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid edgestore-ctx cookie',
    });
    expect(provider.uploads.request).not.toHaveBeenCalled();
  });
});
