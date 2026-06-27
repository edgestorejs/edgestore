import {
  initEdgeStore,
  type EdgeStoreRouter,
  type Provider,
} from '@edgestore/shared';
import { expect, vi } from 'vitest';
import { z } from 'zod';

export type AdapterTestContext = {
  userId: string;
};

export const testCtx: AdapterTestContext = {
  userId: 'user-1',
};

export const testCookieConfig = {
  ctx: {
    name: 'edgestore-test-ctx',
    options: {
      path: '/api/edgestore',
      sameSite: 'lax' as const,
    },
  },
  token: {
    name: 'edgestore-test-token',
  },
};

export const requestUploadBody = {
  bucketName: 'documents',
  input: {
    label: 'invoice',
  },
  fileInfo: {
    size: 10,
    type: 'text/plain',
    extension: 'txt',
    temporary: false,
  },
};

export const completeMultipartUploadBody = {
  bucketName: 'documents',
  uploadId: 'upload-id',
  key: 'uploads/file.txt',
  parts: [
    {
      partNumber: 1,
      eTag: 'etag-1',
    },
  ],
};

type TestLogger = Record<
  'debug' | 'info' | 'warn' | 'error',
  (...args: unknown[]) => void
>;

export const logger: TestLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

export function setupAdapterTestEnv() {
  vi.stubEnv('EDGE_STORE_JWT_SECRET', 'test-secret');
  vi.stubEnv('NODE_ENV', 'test');
  vi.clearAllMocks();
  (globalThis as any)._EDGE_STORE_LOGGER = logger;
}

export function createConformanceProvider(
  overrides: Partial<Provider> = {},
): Provider {
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

export function createConformanceRouter(): EdgeStoreRouter<AdapterTestContext> {
  const es = initEdgeStore.context<AdapterTestContext>().create();

  return es.router({
    documents: es
      .fileBucket()
      .input(z.object({ label: z.string() }))
      .path(({ ctx }) => [{ author: ctx.userId }])
      .metadata(({ ctx, input }) => ({
        userId: ctx.userId,
        label: input.label,
      })),
  });
}

export function extractCookieValue(
  setCookie: string | string[] | null | undefined,
  name = testCookieConfig.ctx.name,
) {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
  const cookie = cookies.find((value) => value.includes(`${name}=`));
  return cookie?.match(new RegExp(`${name}=([^;,]+)`))?.[1];
}

export function expectRequestUploadCalledWithContext(provider: Provider) {
  expect(provider.requestUpload).toHaveBeenCalledWith({
    bucketName: 'documents',
    bucketType: 'FILE',
    fileInfo: {
      ...requestUploadBody.fileInfo,
      path: [{ key: 'author', value: testCtx.userId }],
      isPublic: true,
      metadata: {
        userId: testCtx.userId,
        label: requestUploadBody.input.label,
      },
    },
  });
}

export function stubProxyFetch() {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    return new Response('proxied body', {
      status: 202,
      headers: {
        'Content-Type': 'text/custom',
        'X-Received-Url': String(url),
      },
    });
  });

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

export function asJsonRequestInit(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

export function createContextCookieHeader(token: string) {
  return `${testCookieConfig.ctx.name}=${token}; unrelated=value`;
}
