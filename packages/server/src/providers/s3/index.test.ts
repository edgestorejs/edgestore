import type { RequestUploadParams } from '@edgestore/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { s3 } from './index';

const awsMocks = vi.hoisted(() => {
  const send = vi.fn();

  class S3Client {
    config: unknown;

    constructor(config: unknown) {
      this.config = config;
    }

    send = send;
  }

  class PutObjectCommand {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  }

  class DeleteObjectCommand {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  }

  class HeadObjectCommand {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  }

  return {
    send,
    getSignedUrl: vi.fn(),
    randomUUID: vi.fn(
      () => 'generated-uuid' as ReturnType<typeof crypto.randomUUID>,
    ),
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
  };
});

vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: awsMocks.DeleteObjectCommand,
  HeadObjectCommand: awsMocks.HeadObjectCommand,
  PutObjectCommand: awsMocks.PutObjectCommand,
  S3Client: awsMocks.S3Client,
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: awsMocks.getSignedUrl,
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

describe('s3', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomUUID').mockImplementation(awsMocks.randomUUID);
    awsMocks.getSignedUrl.mockResolvedValue(
      'https://signed-upload.example.com',
    );
  });

  it('uses the default S3 key format for private files', async () => {
    const provider = s3({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
    });

    const result = await provider.uploads.request(uploadParams());

    expect(result).toEqual({
      uploadUrl: 'https://signed-upload.example.com',
      accessUrl:
        'https://storage-bucket.s3.us-east-1.amazonaws.com/documents/generated-uuid.txt',
    });
    expect(awsMocks.getSignedUrl).toHaveBeenCalledWith(
      expect.any(awsMocks.S3Client),
      expect.objectContaining({
        input: {
          Bucket: 'storage-bucket',
          Key: 'documents/generated-uuid.txt',
        },
      }),
      { expiresIn: 60 * 60 },
    );
  });

  it('uses the default S3 key format for public files', async () => {
    const provider = s3({
      bucketName: 'storage-bucket',
      region: 'eu-west-1',
    });

    const result = await provider.uploads.request(
      uploadParams({ isPublic: true }),
    );

    expect(result.accessUrl).toBe(
      'https://storage-bucket.s3.eu-west-1.amazonaws.com/documents/_public/generated-uuid.txt',
    );
    expect(awsMocks.getSignedUrl).toHaveBeenCalledWith(
      expect.any(awsMocks.S3Client),
      expect.objectContaining({
        input: {
          Bucket: 'storage-bucket',
          Key: 'documents/_public/generated-uuid.txt',
        },
      }),
      { expiresIn: 60 * 60 },
    );
  });

  it('includes path segments in the generated key', async () => {
    const provider = s3({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
    });

    await provider.uploads.request(
      uploadParams({
        path: [
          { key: 'org', value: 'acme' },
          { key: 'folder', value: 'invoices' },
        ],
      }),
    );

    expect(awsMocks.getSignedUrl).toHaveBeenCalledWith(
      expect.any(awsMocks.S3Client),
      expect.objectContaining({
        input: {
          Bucket: 'storage-bucket',
          Key: 'documents/acme/invoices/generated-uuid.txt',
        },
      }),
      { expiresIn: 60 * 60 },
    );
  });

  it('uses manual file names instead of generated UUID names', async () => {
    const provider = s3({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
    });

    const result = await provider.uploads.request(
      uploadParams({ fileName: 'manual-name.pdf', extension: 'txt' }),
    );

    expect(result.accessUrl).toBe(
      'https://storage-bucket.s3.us-east-1.amazonaws.com/documents/manual-name.pdf',
    );
    expect(awsMocks.randomUUID).not.toHaveBeenCalled();
    expect(awsMocks.getSignedUrl).toHaveBeenCalledWith(
      expect.any(awsMocks.S3Client),
      expect.objectContaining({
        input: {
          Bucket: 'storage-bucket',
          Key: 'documents/manual-name.pdf',
        },
      }),
      { expiresIn: 60 * 60 },
    );
  });

  it('normalizes extensions by stripping leading dots', async () => {
    const provider = s3({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
    });

    await provider.uploads.request(uploadParams({ extension: '.png' }));

    expect(awsMocks.getSignedUrl).toHaveBeenCalledWith(
      expect.any(awsMocks.S3Client),
      expect.objectContaining({
        input: {
          Bucket: 'storage-bucket',
          Key: 'documents/generated-uuid.png',
        },
      }),
      { expiresIn: 60 * 60 },
    );
  });

  it('customizes the path beneath the logical bucket prefix', async () => {
    const path = vi.fn(({ defaultPath }: { defaultPath: string }) =>
      defaultPath.replace(/^_public\//, 'custom/'),
    );
    const fileInfo = uploadParams({
      isPublic: true,
      path: [{ key: 'tenant', value: 'tenant-1' }],
    }).fileInfo;
    const provider = s3({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
      path,
    });

    const result = await provider.uploads.request({
      bucketName: 'documents',
      bucketType: 'FILE',
      fileInfo,
    });

    expect(path).toHaveBeenCalledWith({
      edgestoreBucketName: 'documents',
      fileInfo,
      defaultPath: '_public/tenant-1/generated-uuid.txt',
    });
    expect(result.accessUrl).toBe(
      'https://storage-bucket.s3.us-east-1.amazonaws.com/documents/custom/tenant-1/generated-uuid.txt',
    );
    expect(awsMocks.getSignedUrl).toHaveBeenCalledWith(
      expect.any(awsMocks.S3Client),
      expect.objectContaining({
        input: {
          Bucket: 'storage-bucket',
          Key: 'documents/custom/tenant-1/generated-uuid.txt',
        },
      }),
      { expiresIn: 60 * 60 },
    );
  });

  it('uses custom endpoint and baseUrl settings', async () => {
    const provider = s3({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
      baseUrl: 'https://cdn.example.com/assets',
    });

    const result = await provider.uploads.request(uploadParams());

    expect(provider.baseUrl).toBe('https://cdn.example.com/assets');
    expect(result.accessUrl).toBe(
      'https://cdn.example.com/assets/documents/generated-uuid.txt',
    );
    expect(awsMocks.getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          endpoint: 'http://localhost:9000',
          forcePathStyle: true,
          region: 'us-east-1',
        }),
      }),
      expect.objectContaining({
        input: {
          Bucket: 'storage-bucket',
          Key: 'documents/generated-uuid.txt',
        },
      }),
      { expiresIn: 60 * 60 },
    );
  });

  it.each([
    ['spaces', 'quarter 1.pdf', 'quarter%201.pdf'],
    ['URL delimiters', 'quarter #1?.pdf', 'quarter%20%231%3F.pdf'],
    ['percent signs', '100%.txt', '100%25.txt'],
    [
      'Unicode',
      'こんにちは 世界.txt',
      '%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF%20%E4%B8%96%E7%95%8C.txt',
    ],
  ])(
    'round-trips S3 keys containing %s through access URLs',
    async (_label, fileName, encodedFileName) => {
      const provider = s3({
        bucketName: 'storage-bucket',
        region: 'us-east-1',
        baseUrl: 'https://cdn.example.com/assets',
      });
      const result = await provider.uploads.request(
        uploadParams({ fileName, extension: '' }),
      );
      const objectKey = `documents/${fileName}`;

      expect(result.accessUrl).toBe(
        `https://cdn.example.com/assets/documents/${encodedFileName}`,
      );
      expect(awsMocks.getSignedUrl).toHaveBeenCalledWith(
        expect.any(awsMocks.S3Client),
        expect.objectContaining({
          input: {
            Bucket: 'storage-bucket',
            Key: objectKey,
          },
        }),
        { expiresIn: 60 * 60 },
      );

      const lastModified = new Date('2026-01-01T00:00:00.000Z');
      awsMocks.send
        .mockResolvedValueOnce({
          ContentLength: 10,
          LastModified: lastModified,
        })
        .mockResolvedValueOnce({});

      await provider.files.get({
        bucketName: 'documents',
        file: { url: result.accessUrl },
      });
      await provider.files.delete?.({
        bucketName: 'documents',
        files: [{ url: result.accessUrl }],
      });

      expect(awsMocks.send).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          input: {
            Bucket: 'storage-bucket',
            Key: objectKey,
          },
        }),
      );
      expect(awsMocks.send).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          input: {
            Bucket: 'storage-bucket',
            Key: objectKey,
          },
        }),
      );
    },
  );

  it('uses endpoint-derived baseUrl when no custom baseUrl is provided', () => {
    const provider = s3({
      bucketName: 'storage-bucket',
      endpoint: 'http://localhost:9000',
    });

    expect(provider.baseUrl).toBe('http://localhost:9000/storage-bucket');
  });

  it('maps access URLs back to S3 keys on delete', async () => {
    const provider = s3({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
      baseUrl: 'https://cdn.example.com',
    });

    await expect(
      provider.files.delete?.({
        bucketName: 'documents',
        files: [{ url: 'https://cdn.example.com/documents/path/file.txt' }],
      }),
    ).resolves.toEqual({ results: [{ success: true }] });

    expect(awsMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: 'storage-bucket',
          Key: 'documents/path/file.txt',
        },
      }),
    );
  });

  it('does not claim to retrieve router fields', async () => {
    const provider = s3({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
      baseUrl: 'https://cdn.example.com',
    });
    const lastModified = new Date('2026-01-01T00:00:00.000Z');
    awsMocks.send.mockResolvedValueOnce({
      ContentLength: 10,
      LastModified: lastModified,
    });

    await expect(
      provider.files.get({
        bucketName: 'documents',
        file: { url: 'https://cdn.example.com/documents/path/file.txt' },
      }),
    ).resolves.toEqual({
      url: 'https://cdn.example.com/documents/path/file.txt',
      sizeBytes: 10,
      uploadedAt: lastModified,
      updatedAt: lastModified,
    });
  });

  it('rejects cross-bucket deletion before contacting S3', async () => {
    const provider = s3({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
      baseUrl: 'https://cdn.example.com',
    });

    await expect(
      provider.files.delete?.({
        bucketName: 'documents',
        files: [{ url: 'https://cdn.example.com/avatars/file.txt' }],
      }),
    ).rejects.toThrow('File does not belong to EdgeStore bucket "documents".');
    expect(awsMocks.send).not.toHaveBeenCalled();
  });

  it('rejects cross-bucket lookup before contacting S3', async () => {
    const provider = s3({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
      baseUrl: 'https://cdn.example.com',
    });

    await expect(
      provider.files.get({
        bucketName: 'documents',
        file: { url: 'https://cdn.example.com/avatars/file.txt' },
      }),
    ).rejects.toThrow('File does not belong to EdgeStore bucket "documents".');
    expect(awsMocks.send).not.toHaveBeenCalled();
  });

  it('throws a clear error when bucketName is missing for requestUpload', async () => {
    const provider = s3({ region: 'us-east-1' });

    await expect(provider.uploads.request(uploadParams())).rejects.toThrow(
      'S3 bucketName is not configured in S3ProviderOptions.',
    );
  });

  it('throws a clear error when bucketName is missing for deleteFile', async () => {
    const provider = s3({ region: 'us-east-1' });

    await expect(
      provider.files.delete?.({
        bucketName: 'documents',
        files: [{ url: 'https://example.com/documents/file.txt' }],
      }),
    ).rejects.toThrow(
      'S3 bucketName is not configured in S3ProviderOptions for deleteFile.',
    );
  });
});
