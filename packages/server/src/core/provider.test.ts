import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  defineProvider,
  referenceFromUrl,
  validateProviderCursor,
  validateProviderReference,
} from './provider';

function createProvider() {
  return defineProvider({
    name: 'custom',
    baseUrl: 'https://files.example.com',
    init: async () => ({}),
    reference: {
      schema: z
        .union([z.string().url(), z.object({ objectKey: z.string() })])
        .transform((value) =>
          typeof value === 'string'
            ? { objectKey: new URL(value).pathname.slice(1) }
            : value,
        ),
      fromUrl: (url) => url,
    },
    uploads: {
      request: vi.fn(),
    },
    files: {
      cursorSchema: z.number().int().nonnegative(),
      get: vi.fn(async ({ file }) => ({
        url: `https://files.example.com/${file.objectKey}`,
        sizeBytes: 1,
        path: {},
        metadata: {},
        uploadedAt: new Date(),
        updatedAt: new Date(),
      })),
    },
  });
}

describe('defineProvider validation', () => {
  it('normalizes URL inputs through the provider reference schema', async () => {
    const provider = createProvider();

    await expect(
      referenceFromUrl(provider, 'https://files.example.com/folder/file.txt'),
    ).resolves.toEqual({ objectKey: 'folder/file.txt' });
    await expect(
      validateProviderReference(provider, {
        objectKey: 'folder/file.txt',
      }),
    ).resolves.toEqual({ objectKey: 'folder/file.txt' });
  });

  it('rejects invalid references and cursors before provider operations run', async () => {
    const provider = createProvider();

    await expect(validateProviderReference(provider, 42)).rejects.toThrow(
      'Invalid provider file reference',
    );
    await expect(validateProviderCursor(provider, -1)).rejects.toThrow(
      'Invalid provider list cursor',
    );
  });
});
