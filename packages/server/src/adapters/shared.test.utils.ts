import {
  type AnyContext,
  type AnyEdgeStoreProvider,
  type EdgeStoreRouter,
} from '@edgestore/shared';
import { vi } from 'vitest';
import { z } from 'zod';
import { init } from './shared';

type TestLogger = Record<'debug' | 'info' | 'warn' | 'error', () => void>;

export const logger: TestLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

export function createProvider(
  overrides: Partial<AnyEdgeStoreProvider> = {},
): AnyEdgeStoreProvider {
  const provider: AnyEdgeStoreProvider = {
    name: 'test-provider',
    baseUrl: 'https://files.example.com',
    init: vi.fn(() => ({ token: 'provider-token' })),
    reference: {
      schema: z.object({ url: z.string() }),
      fromUrl: (url) => ({ url }),
    },
    uploads: {
      request: vi.fn(() => ({
        uploadUrl: 'https://upload.example.com/file.txt',
        accessUrl: 'https://files.example.com/file.txt',
        thumbnailUrl: null,
      })),
      requestParts: vi.fn(() => ({
        multipart: {
          uploadId: 'upload-id',
          parts: [],
        },
      })),
      complete: vi.fn(() => ({ success: true })),
    },
    files: {
      get: vi.fn(({ file }) => ({
        url: file.url,
        sizeBytes: 10,
        uploadedAt: new Date(),
        updatedAt: new Date(),
        path: {},
        metadata: {},
      })),
      confirm: vi.fn(({ files }) => successfulMutation(files)),
      delete: vi.fn(({ files }) => successfulMutation(files)),
    },
  };
  return {
    ...provider,
    ...overrides,
    uploads: { ...provider.uploads, ...overrides.uploads },
    files: { ...provider.files, ...overrides.files },
  };
}

function successfulMutation(files: unknown[]) {
  return {
    results: files.map((fileRef) => ({ fileRef, success: true as const })),
    successCount: files.length,
    failureCount: 0,
  };
}

export async function createContextToken<TCtx extends AnyContext>({
  ctx,
  provider = createProvider(),
  router,
}: {
  ctx: TCtx;
  provider?: AnyEdgeStoreProvider;
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
