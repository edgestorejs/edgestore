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

function createBucketScopedProvider() {
  function assertBucketOwnership(
    bucketName: string,
    file: { bucketName: string; key: string },
  ) {
    if (file.bucketName !== bucketName) {
      throw new Error(`File does not belong to bucket "${bucketName}".`);
    }
  }

  return defineProvider({
    name: 'bucket-scoped',
    baseUrl: 'https://files.example.com',
    init: async () => ({}),
    reference: {
      schema: z.object({
        bucketName: z.string(),
        key: z.string(),
      }),
      fromUrl(url) {
        const [bucketName = '', ...keyParts] = new URL(url).pathname
          .slice(1)
          .split('/');
        return { bucketName, key: keyParts.join('/') };
      },
    },
    uploads: {
      request: vi.fn(),
    },
    files: {
      async get({ bucketName, file }) {
        assertBucketOwnership(bucketName, file);
        return {
          url: `https://files.example.com/${file.bucketName}/${file.key}`,
          sizeBytes: 1,
          path: {},
          metadata: {},
          uploadedAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async confirm({ bucketName, files }) {
        files.forEach((file) => {
          assertBucketOwnership(bucketName, file);
        });
        return { results: files.map(() => ({ success: true as const })) };
      },
      async delete({ bucketName, files }) {
        files.forEach((file) => {
          assertBucketOwnership(bucketName, file);
        });
        return { results: files.map(() => ({ success: true as const })) };
      },
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

  it.each(['get', 'confirm', 'delete'] as const)(
    'keeps custom-provider %s operations inside the requested logical bucket',
    async (operation) => {
      const provider = createBucketScopedProvider();
      const file = await referenceFromUrl(
        provider,
        'https://files.example.com/avatars/profile.png',
      );
      const params = {
        bucketName: 'documents',
        files: [file],
      };

      const result =
        operation === 'get'
          ? provider.files.get({
              bucketName: params.bucketName,
              file,
            })
          : provider.files[operation](params);

      await expect(result).rejects.toThrow(
        'File does not belong to bucket "documents".',
      );
    },
  );
});
