import {
  type AnyContext,
  type EdgeStoreRouter,
  type Provider,
} from '@edgestore/shared';
import { vi } from 'vitest';
import { init } from './shared';

type TestLogger = Record<'debug' | 'info' | 'warn' | 'error', () => void>;

export const logger: TestLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

export function createProvider(overrides: Partial<Provider> = {}): Provider {
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

export async function createContextToken<TCtx extends AnyContext>({
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
