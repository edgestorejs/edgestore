import { type RequestUploadParams } from '@edgestore/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { azureBlob } from './index';

const mocks = vi.hoisted(() => ({
  blobServiceClient: vi.fn(),
  blobSasPermissionsParse: vi.fn((value: string) => ({ value })),
  deleteBlob: vi.fn(),
  generateBlobSASQueryParameters: vi.fn(
    (options: { permissions: { value: string } }) => ({
      toString: () => `sig=${options.permissions.value}`,
    }),
  ),
  getBlobClient: vi.fn(),
  getContainerClient: vi.fn(),
  getProperties: vi.fn(),
  randomUUID: vi.fn(
    () => 'generated-id' as ReturnType<typeof crypto.randomUUID>,
  ),
  storageSharedKeyCredential: vi.fn(),
}));

vi.mock('@azure/storage-blob', () => ({
  BlobSASPermissions: {
    parse: mocks.blobSasPermissionsParse,
  },
  BlobServiceClient: class {
    getContainerClient = mocks.getContainerClient;

    constructor(...args: unknown[]) {
      mocks.blobServiceClient(...args);
    }
  },
  generateBlobSASQueryParameters: mocks.generateBlobSASQueryParameters,
  SASProtocol: {
    Https: 'https',
    HttpsAndHttp: 'https,http',
  },
  StorageSharedKeyCredential: class {
    constructor(...args: unknown[]) {
      mocks.storageSharedKeyCredential(...args);
    }
  },
}));

function encodeBlobName(blobName: string) {
  return blobName.split('/').map(encodeURIComponent).join('/');
}

function createUploadParams(
  overrides: Partial<RequestUploadParams['fileInfo']> = {},
): RequestUploadParams {
  return {
    bucketName: 'documents',
    bucketType: 'file',
    fileInfo: {
      extension: 'txt',
      fileName: undefined,
      isPublic: false,
      metadata: {},
      path: [],
      size: 10,
      temporary: false,
      ...overrides,
    },
  };
}

describe('azureBlob', () => {
  const containerUrl = 'http://localhost:10000/devstoreaccount1/files';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomUUID').mockImplementation(mocks.randomUUID);
    mocks.getProperties.mockResolvedValue({
      contentLength: 123,
      lastModified: new Date('2026-01-02T03:04:05.000Z'),
    });
    mocks.deleteBlob.mockResolvedValue(undefined);
    mocks.getContainerClient.mockImplementation((containerName: string) => ({
      getBlobClient: mocks.getBlobClient,
      url: `http://localhost:10000/devstoreaccount1/${containerName}`,
    }));
    mocks.getBlobClient.mockImplementation((blobName: string) => ({
      delete: mocks.deleteBlob,
      getProperties: mocks.getProperties,
      url: `${containerUrl}/${encodeBlobName(blobName)}`,
    }));
  });

  it('constructs a base URL from the storage account', () => {
    const provider = azureBlob({
      storageAccountName: 'storageacct',
      storageAccountKey: 'account-key',
      containerName: 'documents',
    });

    expect(provider.baseUrl).toBe('https://storageacct.blob.core.windows.net');
    expect(mocks.storageSharedKeyCredential).toHaveBeenCalledWith(
      'storageacct',
      'account-key',
    );
    expect(mocks.blobServiceClient).toHaveBeenCalledWith(
      'https://storageacct.blob.core.windows.net',
      expect.anything(),
    );
    expect(mocks.getContainerClient).toHaveBeenCalledWith('documents');
  });

  it('uses a customBaseUrl when provided', () => {
    const provider = azureBlob({
      storageAccountName: 'storageacct',
      storageAccountKey: 'account-key',
      containerName: 'documents',
      customBaseUrl: 'http://localhost:10000/devstoreaccount1',
    });

    expect(provider.baseUrl).toBe('http://localhost:10000/devstoreaccount1');
    expect(mocks.getContainerClient).toHaveBeenCalledWith('documents');
  });

  it.each([
    {
      expectedUuidCalls: 0,
      fileInfo: {
        extension: 'png',
        fileName: 'avatar.png',
        isPublic: true,
        path: [
          { key: 'org', value: 'acme' },
          { key: 'user', value: 'ravi' },
        ],
      },
      expectedBlobName: 'documents/_public/acme/ravi/avatar.png',
    },
    {
      expectedUuidCalls: 0,
      fileInfo: {
        extension: 'pdf',
        fileName: 'report.pdf',
        isPublic: false,
        path: [],
      },
      expectedBlobName: 'documents/report.pdf',
    },
    {
      expectedUuidCalls: 1,
      fileInfo: {
        extension: '.pdf',
        fileName: undefined,
        isPublic: false,
        path: [{ key: 'year', value: '2026' }],
      },
      expectedBlobName: 'documents/2026/generated-id.pdf',
    },
  ])(
    'uses the EdgeStore path shape as the Azure blob name',
    async ({ fileInfo, expectedBlobName, expectedUuidCalls }) => {
      const provider = azureBlob({
        containerName: 'files',
        customBaseUrl: 'http://localhost:10000/devstoreaccount1',
        storageAccountKey: 'account-key',
        storageAccountName: 'devstoreaccount1',
      });

      const res = await provider.uploads.request(createUploadParams(fileInfo));

      expect(mocks.getBlobClient).toHaveBeenCalledWith(expectedBlobName);
      expect(mocks.randomUUID).toHaveBeenCalledTimes(expectedUuidCalls);
      expect(res).toEqual({
        accessUrl: `${containerUrl}/${encodeBlobName(expectedBlobName)}`,
        accessSignedUrl: fileInfo.isPublic
          ? undefined
          : expect.stringContaining('?sig=r'),
        accessSignedUrlExpiresAt: fileInfo.isPublic
          ? undefined
          : expect.any(Date),
        accessSignedUrlExpiresIn: fileInfo.isPublic ? undefined : 60 * 60,
        uploadUrl: `${containerUrl}/${encodeBlobName(expectedBlobName)}?sig=cw`,
      });
      expect(mocks.blobSasPermissionsParse).toHaveBeenCalledWith('cw');
      if (fileInfo.isPublic) {
        expect(mocks.blobSasPermissionsParse).not.toHaveBeenCalledWith('r');
      } else {
        expect(mocks.blobSasPermissionsParse).toHaveBeenCalledWith('r');
      }
    },
  );

  it('uses write-only upload credentials and canonical public URLs', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));
    const provider = azureBlob({
      containerName: 'files',
      customBaseUrl: 'https://storage.example.com',
      storageAccountKey: 'account-key',
      storageAccountName: 'storageacct',
      uploadUrlExpiresIn: 900,
    });

    const res = await provider.uploads.request(
      createUploadParams({ fileName: 'public.txt', isPublic: true }),
    );

    expect(res).toEqual({
      accessUrl: `${containerUrl}/documents/_public/public.txt`,
      accessSignedUrl: undefined,
      accessSignedUrlExpiresAt: undefined,
      accessSignedUrlExpiresIn: undefined,
      uploadUrl: `${containerUrl}/documents/_public/public.txt?sig=cw`,
    });
    expect(mocks.generateBlobSASQueryParameters).toHaveBeenCalledWith(
      {
        blobName: 'documents/_public/public.txt',
        containerName: 'files',
        expiresOn: new Date('2026-01-02T03:19:05.000Z'),
        permissions: { value: 'cw' },
        protocol: 'https',
        startsOn: new Date('2026-01-02T02:59:05.000Z'),
      },
      expect.anything(),
    );
    expect(mocks.blobSasPermissionsParse).not.toHaveBeenCalledWith('r');
    vi.useRealTimers();
  });

  it('normalizes an Azure access URL to a blob name for getFile', async () => {
    const provider = azureBlob({
      containerName: 'files',
      customBaseUrl: 'http://localhost:10000/devstoreaccount1',
      storageAccountKey: 'account-key',
      storageAccountName: 'devstoreaccount1',
    });

    const res = await provider.files.get({
      bucketName: 'documents',
      file: {
        url: `${containerUrl}/documents/_public/a%20b/file.txt?sv=token`,
      },
    });

    expect(mocks.getBlobClient).toHaveBeenCalledWith(
      'documents/_public/a b/file.txt',
    );
    expect(res).toEqual({
      metadata: {},
      path: {},
      sizeBytes: 123,
      uploadedAt: new Date('2026-01-02T03:04:05.000Z'),
      updatedAt: new Date('2026-01-02T03:04:05.000Z'),
      url: `${containerUrl}/documents/_public/a%20b/file.txt`,
    });
  });

  it('creates separate blob-scoped read URLs with the requested expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));
    const provider = azureBlob({
      containerName: 'files',
      customBaseUrl: 'http://localhost:10000/devstoreaccount1',
      storageAccountKey: 'account-key',
      storageAccountName: 'devstoreaccount1',
    });

    await expect(
      provider.files.getSignedUrls?.({
        bucketName: 'documents',
        files: [
          { url: `${containerUrl}/documents/private.txt?old=credential` },
        ],
        expiresIn: 120,
      }),
    ).resolves.toEqual([
      {
        url: `${containerUrl}/documents/private.txt`,
        signedUrl: `${containerUrl}/documents/private.txt?sig=r`,
        expiresAt: new Date('2026-01-02T03:06:05.000Z'),
        expiresIn: 120,
      },
    ]);
    expect(mocks.generateBlobSASQueryParameters).toHaveBeenLastCalledWith(
      expect.objectContaining({
        blobName: 'documents/private.txt',
        permissions: { value: 'r' },
        expiresOn: new Date('2026-01-02T03:06:05.000Z'),
      }),
      expect.anything(),
    );
    vi.useRealTimers();
  });

  it('normalizes an Azure access URL to a blob name for deleteFile', async () => {
    const provider = azureBlob({
      containerName: 'files',
      customBaseUrl: 'http://localhost:10000/devstoreaccount1',
      storageAccountKey: 'account-key',
      storageAccountName: 'devstoreaccount1',
    });

    await expect(
      provider.files.delete?.({
        bucketName: 'documents',
        files: [{ url: `${containerUrl}/documents/report.pdf` }],
      }),
    ).resolves.toEqual({ results: [{ success: true }] });

    expect(mocks.getBlobClient).toHaveBeenCalledWith('documents/report.pdf');
    expect(mocks.deleteBlob).toHaveBeenCalledOnce();
  });

  it('rejects cross-bucket deletion before contacting Azure', async () => {
    const provider = azureBlob({
      containerName: 'files',
      customBaseUrl: 'http://localhost:10000/devstoreaccount1',
      storageAccountKey: 'account-key',
      storageAccountName: 'devstoreaccount1',
    });

    await expect(
      provider.files.delete?.({
        bucketName: 'documents',
        files: [{ url: `${containerUrl}/avatars/report.pdf` }],
      }),
    ).rejects.toThrow('File does not belong to EdgeStore bucket "documents".');
    expect(mocks.deleteBlob).not.toHaveBeenCalled();
  });

  it('rejects cross-bucket lookup before contacting Azure', async () => {
    const provider = azureBlob({
      containerName: 'files',
      customBaseUrl: 'http://localhost:10000/devstoreaccount1',
      storageAccountKey: 'account-key',
      storageAccountName: 'devstoreaccount1',
    });

    await expect(
      provider.files.get({
        bucketName: 'documents',
        file: { url: `${containerUrl}/avatars/report.pdf` },
      }),
    ).rejects.toThrow('File does not belong to EdgeStore bucket "documents".');
    expect(mocks.getProperties).not.toHaveBeenCalled();
  });
});
