import { type RequestUploadParams } from '@edgestore/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AzureProvider } from './index';

const mocks = vi.hoisted(() => ({
  deleteBlob: vi.fn(),
  getBlobClient: vi.fn(),
  getContainerClient: vi.fn(),
  getProperties: vi.fn(),
  uuidv4: vi.fn(),
}));

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: vi.fn(
    class {
      getContainerClient = mocks.getContainerClient;
    },
  ),
}));

vi.mock('uuid', () => ({
  v4: mocks.uuidv4,
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

describe('AzureProvider', () => {
  const containerUrl = 'http://localhost:10000/devstoreaccount1/files';

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uuidv4.mockReturnValue('generated-id');
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
    const provider = AzureProvider({
      storageAccountName: 'storageacct',
      sasToken: 'sig=token',
      containerName: 'documents',
    });

    expect(provider.getBaseUrl()).toBe(
      'https://storageacct.blob.core.windows.net',
    );
    expect(mocks.getContainerClient).toHaveBeenCalledWith('documents');
  });

  it('uses a customBaseUrl when provided', () => {
    const provider = AzureProvider({
      storageAccountName: 'storageacct',
      sasToken: 'sig=token',
      containerName: 'documents',
      customBaseUrl: 'http://localhost:10000/devstoreaccount1',
    });

    expect(provider.getBaseUrl()).toBe(
      'http://localhost:10000/devstoreaccount1',
    );
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
      const provider = AzureProvider({
        containerName: 'files',
        customBaseUrl: 'http://localhost:10000/devstoreaccount1',
        sasToken: 'token',
        storageAccountName: 'devstoreaccount1',
      });

      const res = await provider.requestUpload(createUploadParams(fileInfo));

      expect(mocks.getBlobClient).toHaveBeenCalledWith(expectedBlobName);
      expect(mocks.uuidv4).toHaveBeenCalledTimes(expectedUuidCalls);
      expect(res).toEqual({
        accessUrl: `${containerUrl}/${encodeBlobName(expectedBlobName)}`,
        uploadUrl: `${containerUrl}/${encodeBlobName(expectedBlobName)}`,
      });
    },
  );

  it('normalizes an Azure access URL to a blob name for getFile', async () => {
    const provider = AzureProvider({
      containerName: 'files',
      customBaseUrl: 'http://localhost:10000/devstoreaccount1',
      sasToken: 'token',
      storageAccountName: 'devstoreaccount1',
    });

    const res = await provider.getFile({
      url: `${containerUrl}/documents/_public/a%20b/file.txt?sv=token`,
    });

    expect(mocks.getBlobClient).toHaveBeenCalledWith(
      'documents/_public/a b/file.txt',
    );
    expect(res).toEqual({
      metadata: {},
      path: {},
      size: 123,
      uploadedAt: new Date('2026-01-02T03:04:05.000Z'),
      url: `${containerUrl}/documents/_public/a%20b/file.txt?sv=token`,
    });
  });

  it('normalizes an Azure access URL to a blob name for deleteFile', async () => {
    const provider = AzureProvider({
      containerName: 'files',
      customBaseUrl: 'http://localhost:10000/devstoreaccount1',
      sasToken: 'token',
      storageAccountName: 'devstoreaccount1',
    });

    await expect(
      provider.deleteFile({
        bucket: {} as Parameters<typeof provider.deleteFile>[0]['bucket'],
        url: `${containerUrl}/documents/report.pdf`,
      }),
    ).resolves.toEqual({ success: true });

    expect(mocks.getBlobClient).toHaveBeenCalledWith('documents/report.pdf');
    expect(mocks.deleteBlob).toHaveBeenCalledOnce();
  });
});
