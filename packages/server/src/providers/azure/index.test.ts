import type { RequestUploadParams } from '@edgestore/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AzureProvider } from './index';

const azureMocks = vi.hoisted(() => {
  const deleteBlob = vi.fn();
  const getProperties = vi.fn();
  const getBlobClient = vi.fn((blobName: string) => ({
    url: `https://files.example.com/container/${blobName}`,
    delete: deleteBlob,
    getProperties,
  }));
  const getContainerClient = vi.fn(() => ({
    getBlobClient,
  }));

  class BlobServiceClient {
    url: string;

    constructor(url: string) {
      this.url = url;
    }

    getContainerClient = getContainerClient;
  }

  return {
    deleteBlob,
    getBlobClient,
    getContainerClient,
    getProperties,
    uuidv4: vi.fn(),
    BlobServiceClient,
  };
});

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: azureMocks.BlobServiceClient,
}));

vi.mock('uuid', () => ({
  v4: azureMocks.uuidv4,
}));

function uploadParams(
  fileInfo: Partial<RequestUploadParams['fileInfo']> = {},
): RequestUploadParams {
  return {
    bucketName: 'documents',
    bucketType: 'FILE',
    fileInfo: {
      size: 10,
      extension: 'txt',
      isPublic: false,
      path: [],
      metadata: {},
      temporary: false,
      ...fileInfo,
    },
  };
}

describe('AzureProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    azureMocks.uuidv4.mockReturnValue('generated-uuid');
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
    expect(azureMocks.getContainerClient).toHaveBeenCalledWith('documents');
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
    expect(azureMocks.getContainerClient).toHaveBeenCalledWith('documents');
  });

  it('uses manual file names for requestUpload', async () => {
    const provider = AzureProvider({
      storageAccountName: 'storageacct',
      sasToken: 'sig=token',
      containerName: 'documents',
    });

    const result = await provider.requestUpload(
      uploadParams({ fileName: 'manual.pdf', extension: 'txt' }),
    );

    expect(azureMocks.getBlobClient).toHaveBeenCalledWith('manual.pdf');
    expect(result).toEqual({
      uploadUrl: 'https://files.example.com/container/manual.pdf',
      accessUrl: 'https://files.example.com/container/manual.pdf',
    });
  });

  it('uses generated UUID names with normalized extensions for requestUpload', async () => {
    const provider = AzureProvider({
      storageAccountName: 'storageacct',
      sasToken: 'sig=token',
      containerName: 'documents',
    });

    const result = await provider.requestUpload(
      uploadParams({ extension: '.png' }),
    );

    expect(azureMocks.getBlobClient).toHaveBeenCalledWith('generated-uuid.png');
    expect(result).toEqual({
      uploadUrl: 'https://files.example.com/container/generated-uuid.png',
      accessUrl: 'https://files.example.com/container/generated-uuid.png',
    });
  });

  it('maps blob properties to provider getFile response', async () => {
    const uploadedAt = new Date('2026-01-02T03:04:05.000Z');
    azureMocks.getProperties.mockResolvedValue({
      contentLength: 123,
      lastModified: uploadedAt,
    });
    const provider = AzureProvider({
      storageAccountName: 'storageacct',
      sasToken: 'sig=token',
      containerName: 'documents',
    });

    await expect(
      provider.getFile({
        url: 'https://files.example.com/container/file.txt',
      }),
    ).resolves.toEqual({
      url: 'https://files.example.com/container/file.txt',
      metadata: {},
      path: {},
      size: 123,
      uploadedAt,
    });
    expect(azureMocks.getBlobClient).toHaveBeenCalledWith(
      'https://files.example.com/container/file.txt',
    );
  });

  it('deletes a blob and returns success', async () => {
    const provider = AzureProvider({
      storageAccountName: 'storageacct',
      sasToken: 'sig=token',
      containerName: 'documents',
    });

    await expect(
      provider.deleteFile({
        bucket: {} as Parameters<typeof provider.deleteFile>[0]['bucket'],
        url: 'https://files.example.com/container/file.txt',
      }),
    ).resolves.toEqual({ success: true });

    expect(azureMocks.getBlobClient).toHaveBeenCalledWith(
      'https://files.example.com/container/file.txt',
    );
    expect(azureMocks.deleteBlob).toHaveBeenCalledOnce();
  });
});
