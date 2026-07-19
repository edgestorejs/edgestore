import { EdgeStoreError } from '@edgestore/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EdgeStoreProvider } from '.';
import { initEdgeStoreSdk, type EdgeStoreSdk } from '../../core/sdk';

vi.mock('../../core/sdk', () => ({
  initEdgeStoreSdk: vi.fn(),
}));

type MockSdk = {
  [K in keyof EdgeStoreSdk]: ReturnType<typeof vi.fn>;
};

const initEdgeStoreSdkMock = vi.mocked(initEdgeStoreSdk);

const fileInfo = {
  size: 1024,
  extension: 'txt',
  isPublic: true,
  path: [{ key: 'org', value: 'acme' }],
  metadata: { owner: 'user-1' },
  temporary: false,
};

function createMockSdk(overrides: Partial<MockSdk> = {}) {
  const sdk = {
    getToken: vi.fn(),
    getFile: vi.fn(),
    requestUpload: vi.fn(),
    requestUploadParts: vi.fn(),
    completeMultipartUpload: vi.fn(),
    confirmUpload: vi.fn(),
    deleteFile: vi.fn(),
    getSignedUrls: vi.fn(),
    listFiles: vi.fn(),
    ...overrides,
  } satisfies MockSdk;
  initEdgeStoreSdkMock.mockReturnValue(sdk as unknown as EdgeStoreSdk);
  return sdk;
}

describe('EdgeStoreProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps signedUrl to uploadUrl below the multipart threshold', async () => {
    const sdk = createMockSdk({
      requestUpload: vi.fn(async () => ({
        signedUrl: 'https://upload.example.com/file.txt',
        accessUrl: 'https://files.example.com/file.txt',
        path: 'documents/file.txt',
        thumbnailUrl: 'https://files.example.com/thumb.jpg',
      })),
    });
    const provider = EdgeStoreProvider({
      accessKey: 'access-key',
      secretKey: 'secret-key',
    });

    await expect(
      provider.requestUpload({
        bucketName: 'documents',
        bucketType: 'FILE',
        fileInfo,
      }),
    ).resolves.toEqual({
      uploadUrl: 'https://upload.example.com/file.txt',
      accessUrl: 'https://files.example.com/file.txt',
      thumbnailUrl: 'https://files.example.com/thumb.jpg',
    });
    expect(sdk.requestUpload).toHaveBeenCalledWith({
      bucketName: 'documents',
      bucketType: 'FILE',
      fileInfo,
    });
  });

  it('requests multipart parts and maps signedUrl to uploadUrl above the threshold', async () => {
    const size = 11 * 1024 * 1024;
    const sdk = createMockSdk({
      requestUpload: vi.fn(async () => ({
        multipart: {
          key: 'documents/file.bin',
          uploadId: 'upload-id',
          parts: [
            { partNumber: 1, signedUrl: 'https://upload.example.com/part-1' },
            { partNumber: 2, signedUrl: 'https://upload.example.com/part-2' },
            { partNumber: 3, signedUrl: 'https://upload.example.com/part-3' },
          ],
        },
        accessUrl: 'https://files.example.com/file.bin',
        path: 'documents/file.bin',
        thumbnailUrl: null,
      })),
    });
    const provider = EdgeStoreProvider({
      accessKey: 'access-key',
      secretKey: 'secret-key',
    });

    await expect(
      provider.requestUpload({
        bucketName: 'documents',
        bucketType: 'FILE',
        fileInfo: {
          ...fileInfo,
          size,
          extension: 'bin',
        },
      }),
    ).resolves.toEqual({
      accessUrl: 'https://files.example.com/file.bin',
      thumbnailUrl: null,
      multipart: {
        key: 'documents/file.bin',
        uploadId: 'upload-id',
        partSize: 5 * 1024 * 1024,
        totalParts: 3,
        parts: [
          { partNumber: 1, uploadUrl: 'https://upload.example.com/part-1' },
          { partNumber: 2, uploadUrl: 'https://upload.example.com/part-2' },
          { partNumber: 3, uploadUrl: 'https://upload.example.com/part-3' },
        ],
      },
    });
    expect(sdk.requestUpload).toHaveBeenCalledWith({
      bucketName: 'documents',
      bucketType: 'FILE',
      fileInfo: {
        ...fileInfo,
        size,
        extension: 'bin',
      },
      multipart: {
        parts: [1, 2, 3],
      },
    });
  });

  it('caps multipart uploads at 1000 parts and increases partSize', async () => {
    const size = 1001 * 5 * 1024 * 1024;
    const sdk = createMockSdk({
      requestUpload: vi.fn(async () => ({
        multipart: {
          key: 'documents/large.bin',
          uploadId: 'upload-id',
          parts: [{ partNumber: 1, signedUrl: 'https://upload.example.com/1' }],
        },
        accessUrl: 'https://files.example.com/large.bin',
        path: 'documents/large.bin',
        thumbnailUrl: null,
      })),
    });
    const provider = EdgeStoreProvider({
      accessKey: 'access-key',
      secretKey: 'secret-key',
    });

    const res = await provider.requestUpload({
      bucketName: 'documents',
      bucketType: 'FILE',
      fileInfo: {
        ...fileInfo,
        size,
        extension: 'bin',
      },
    });

    const request = sdk.requestUpload.mock.calls[0]?.[0];
    expect(request.multipart.parts).toHaveLength(1000);
    expect(request.multipart.parts[0]).toBe(1);
    expect(request.multipart.parts[999]).toBe(1000);
    expect(res).toMatchObject({
      multipart: {
        partSize: Math.ceil(size / 1000),
        totalParts: 1000,
      },
    });
  });

  it('throws when the upload response has neither signedUrl nor multipart', async () => {
    createMockSdk({
      requestUpload: vi.fn(async () => ({
        accessUrl: 'https://files.example.com/file.txt',
        path: 'documents/file.txt',
        thumbnailUrl: null,
      })),
    });
    const provider = EdgeStoreProvider({
      accessKey: 'access-key',
      secretKey: 'secret-key',
    });

    await expect(
      provider.requestUpload({
        bucketName: 'documents',
        bucketType: 'FILE',
        fileInfo,
      }),
    ).rejects.toThrow(EdgeStoreError);
  });

  it('maps requestUploadParts signedUrl values to uploadUrl values', async () => {
    createMockSdk({
      requestUploadParts: vi.fn(async () => ({
        multipart: {
          uploadId: 'upload-id',
          parts: [
            { partNumber: 1, signedUrl: 'https://upload.example.com/part-1' },
            { partNumber: 2, signedUrl: 'https://upload.example.com/part-2' },
          ],
        },
      })),
    });
    const provider = EdgeStoreProvider({
      accessKey: 'access-key',
      secretKey: 'secret-key',
    });

    await expect(
      provider.requestUploadParts({
        path: 'documents/file.bin',
        multipart: {
          uploadId: 'upload-id',
          parts: [1, 2],
        },
      }),
    ).resolves.toEqual({
      multipart: {
        uploadId: 'upload-id',
        parts: [
          { partNumber: 1, uploadUrl: 'https://upload.example.com/part-1' },
          { partNumber: 2, uploadUrl: 'https://upload.example.com/part-2' },
        ],
      },
    });
  });
});
