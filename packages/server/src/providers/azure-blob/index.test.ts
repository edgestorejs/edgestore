import type { RequestUploadParams } from '@edgestore/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initEdgeStore } from '../../core/router';
import { blockId } from './blocks';
import { azureBlob, type AzureBlobProviderOptions } from './index';

// SAS signing is local, so these tests use the real SDK without a network.
const config = {
  storageAccountName: 'account',
  storageAccountKey: Buffer.from('test-key').toString('base64'),
  containerName: 'files',
  jwtSecret: 'test-secret',
} satisfies AzureBlobProviderOptions;
const partSize = 5 * 1024 ** 2;

function request(
  fileInfo: Partial<RequestUploadParams['fileInfo']> = {},
  autoSignedUrls?: RequestUploadParams['autoSignedUrls'],
): RequestUploadParams {
  return {
    bucketName: 'documents',
    bucketType: 'FILE',
    autoSignedUrls,
    fileInfo: {
      size: 3,
      type: 'text/plain',
      extension: 'txt',
      fileName: 'a b.txt',
      isPublic: false,
      temporary: false,
      path: [],
      metadata: {},
      ...fileInfo,
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('azureBlob', () => {
  it('defers credential checks until the provider is used', async () => {
    vi.stubEnv('ES_AZURE_ACCOUNT_NAME', '');
    const provider = azureBlob();
    const es = initEdgeStore.create();

    await expect(
      provider.init({ ctx: {}, router: es.router({ files: es.fileBucket() }) }),
    ).rejects.toThrow('requires storageAccountName');
  });

  it('derives file URLs from the endpoint, or from a separate base URL', async () => {
    const hosted = azureBlob(config);
    const cdn = azureBlob({
      ...config,
      endpoint: 'http://127.0.0.1:10000/devstoreaccount1/',
      baseUrl: 'https://cdn.example.com/assets',
    });

    expect(hosted.baseUrl).toBe('https://account.blob.core.windows.net/files');
    const res = await cdn.uploads.request(request({}, { expiresIn: 60 }));
    expect(res).toMatchObject({
      key: 'documents/a b.txt',
      accessUrl: 'https://cdn.example.com/assets/documents/a%20b.txt',
    });
    expect(res.accessSignedUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:10000\/devstoreaccount1\/files\/documents\/a%20b\.txt\?.*sp=r/,
    );
  });

  it('signs single uploads with the headers Azure applies to the blob', async () => {
    const provider = azureBlob({
      ...config,
      path: ({ defaultPath }) => `tenant/${defaultPath}`,
      objectOptions: {
        cacheControl: 'private',
        contentDisposition: 'attachment',
        metadata: { tenant: 'acme' },
      },
    });

    const res = await provider.uploads.request(request());

    if (!('uploadUrl' in res)) throw new Error('Expected single upload');
    expect(new URL(res.uploadUrl).searchParams.get('sp')).toBe('cw');
    expect(res.uploadHeaders).toEqual({
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-blob-content-type': 'text/plain',
      'x-ms-blob-cache-control': 'private',
      'x-ms-blob-content-disposition': 'attachment',
      'x-ms-meta-tenant': 'acme',
    });
    expect(res.key).toBe('documents/tenant/a b.txt');
  });

  it('returns signed read URLs only for private buckets that ask for them', async () => {
    const provider = azureBlob(config);

    const plain = await provider.uploads.request(request());
    const signed = await provider.uploads.request(
      request({}, { expiresIn: 60 }),
    );
    const publicFile = await provider.uploads.request(
      request({ isPublic: true }, { expiresIn: 60 }),
    );

    expect(plain.accessSignedUrl).toBeUndefined();
    expect(signed).toMatchObject({ accessSignedUrlExpiresIn: 60 });
    expect(publicFile.accessSignedUrl).toBeUndefined();
    expect(publicFile.key).toBe('documents/_public/a b.txt');
  });

  it('starts block uploads with scoped sessions and part URLs', async () => {
    const provider = azureBlob({
      ...config,
      multipart: { thresholdBytes: partSize, partSizeBytes: partSize },
    });

    const res = await provider.uploads.request(
      request({ size: partSize * 12 }),
    );

    if (!('multipart' in res)) throw new Error('Expected multipart upload');
    const { multipart } = res;
    expect(multipart).toMatchObject({ totalParts: 12, partSize });
    expect(multipart.parts.map((part) => part.partNumber)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
    const url = new URL(multipart.parts[0]!.uploadUrl);
    expect(url.searchParams.get('comp')).toBe('block');
    expect(url.searchParams.get('sp')).toBe('w');

    await expect(
      provider.uploads.multipart.requestParts({ ...multipart, parts: [12] }),
    ).resolves.toMatchObject({ parts: [{ partNumber: 12 }] });
    for (const session of [
      { ...multipart, key: 'documents/other.txt' },
      { ...multipart, uploadId: `${multipart.uploadId}x` },
    ]) {
      await expect(
        provider.uploads.multipart.requestParts({ ...session, parts: [1] }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
    await expect(
      provider.uploads.multipart.requestParts({ ...multipart, parts: [13] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      provider.uploads.multipart.abort(multipart),
    ).resolves.toBeUndefined();
  });

  it('uses equal-length block IDs that differ between sessions', () => {
    const ids = [
      blockId('aaaa', 1),
      blockId('aaaa', 10_000),
      blockId('bbbb', 1),
    ];

    expect(new Set(ids.map((id) => id.length)).size).toBe(1);
    expect(new Set(ids).size).toBe(3);
  });

  it('rejects block sizes and session lifetimes Azure cannot use', async () => {
    const provider = azureBlob({
      ...config,
      multipart: { partSizeBytes: 4001 * 1024 ** 2 },
    });

    await expect(
      provider.uploads.request(request({ size: 5001 * 1024 ** 2 })),
    ).rejects.toThrow('4000 MiB');
    await expect(
      provider.uploads.request(request({ size: 200 * 1024 ** 2 + 0.5 })),
    ).rejects.toThrow('safe integer');
    expect(() =>
      azureBlob({ ...config, multipart: { sessionExpiresIn: 0 } }),
    ).toThrow('positive integer');
  });

  it('accepts key and URL references within the logical bucket only', async () => {
    const provider = azureBlob(config);

    const [byKey, byUrl] = await provider.files.getSignedUrls({
      bucketName: 'documents',
      files: [
        { key: 'documents/a.txt' },
        {
          url: 'https://account.blob.core.windows.net/files/documents/b%20c.txt',
        },
      ],
      expiresIn: 120,
    });

    expect(byKey).toMatchObject({
      url: 'https://account.blob.core.windows.net/files/documents/a.txt',
      expiresIn: 120,
    });
    expect(byUrl!.url).toBe(
      'https://account.blob.core.windows.net/files/documents/b%20c.txt',
    );
    for (const [file, message] of [
      [{ key: 'avatars/a.txt' }, 'does not belong to EdgeStore bucket'],
      [{ key: 'documents/../avatars/a.txt' }, 'Azure Blob paths must stay'],
      [
        { url: 'https://evil.example.com/files/documents/a.txt' },
        'does not belong to this Azure Blob provider',
      ],
    ] as const) {
      await expect(
        provider.files.getSignedUrls({
          bucketName: 'documents',
          files: [file],
        }),
      ).rejects.toThrow(message);
    }
  });

  it('declares unsupported options and rejects cookie-based access control', async () => {
    const provider = azureBlob(config);
    const es = initEdgeStore.create();

    expect(provider.uploads.supportedOptions).toEqual({
      temporary: false,
      replaceTargetUrl: false,
    });
    await expect(
      provider.init({
        ctx: {},
        router: es.router({
          files: es.fileBucket().accessControl({ user: 'someone' }),
        }),
      }),
    ).rejects.toThrow('cookie-based');
    await expect(
      provider.init({
        ctx: {},
        router: es.router({ files: es.fileBucket().accessControl('private') }),
      }),
    ).resolves.toEqual({});
  });
});
