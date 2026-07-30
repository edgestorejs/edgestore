import type { RequestUploadParams } from '@edgestore/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AWSProvider } from './index';

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

describe('AWSProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomUUID').mockImplementation(awsMocks.randomUUID);
    awsMocks.getSignedUrl.mockResolvedValue(
      'https://signed-upload.example.com',
    );
  });

  it('uses the default S3 key format for private files', async () => {
    const provider = AWSProvider({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
    });

    const result = await provider.requestUpload(uploadParams());

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
    const provider = AWSProvider({
      bucketName: 'storage-bucket',
      region: 'eu-west-1',
    });

    const result = await provider.requestUpload(
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
    const provider = AWSProvider({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
    });

    await provider.requestUpload(
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
    const provider = AWSProvider({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
    });

    const result = await provider.requestUpload(
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
    const provider = AWSProvider({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
    });

    await provider.requestUpload(uploadParams({ extension: '.png' }));

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

  it('allows overwritePath to control the final URL and key', async () => {
    const overwritePath = vi.fn(() => '/custom/key.bin');
    const fileInfo = uploadParams({
      path: [{ key: 'tenant', value: 'tenant-1' }],
    }).fileInfo;
    const provider = AWSProvider({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
      overwritePath,
    });

    const result = await provider.requestUpload({
      bucketName: 'documents',
      bucketType: 'FILE',
      fileInfo,
    });

    expect(overwritePath).toHaveBeenCalledWith({
      esBucketName: 'documents',
      fileInfo,
      defaultAccessPath: 'documents/tenant-1/generated-uuid.txt',
    });
    expect(result.accessUrl).toBe(
      'https://storage-bucket.s3.us-east-1.amazonaws.com/custom/key.bin',
    );
    expect(awsMocks.getSignedUrl).toHaveBeenCalledWith(
      expect.any(awsMocks.S3Client),
      expect.objectContaining({
        input: {
          Bucket: 'storage-bucket',
          Key: 'custom/key.bin',
        },
      }),
      { expiresIn: 60 * 60 },
    );
  });

  it('uses custom endpoint and baseUrl settings', async () => {
    const provider = AWSProvider({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
      baseUrl: 'https://cdn.example.com/assets',
    });

    const result = await provider.requestUpload(uploadParams());

    expect(provider.getBaseUrl()).toBe('https://cdn.example.com/assets');
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

  it('uses endpoint-derived baseUrl when no custom baseUrl is provided', () => {
    const provider = AWSProvider({
      bucketName: 'storage-bucket',
      endpoint: 'http://localhost:9000',
    });

    expect(provider.getBaseUrl()).toBe('http://localhost:9000/storage-bucket');
  });

  it('maps access URLs back to S3 keys on delete', async () => {
    const provider = AWSProvider({
      bucketName: 'storage-bucket',
      region: 'us-east-1',
      baseUrl: 'https://cdn.example.com',
    });

    await expect(
      provider.deleteFile({
        bucket: {} as Parameters<typeof provider.deleteFile>[0]['bucket'],
        url: 'https://cdn.example.com/documents/path/file.txt',
      }),
    ).resolves.toEqual({ success: true });

    expect(awsMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: 'storage-bucket',
          Key: 'documents/path/file.txt',
        },
      }),
    );
  });

  it('throws a clear error when bucketName is missing for requestUpload', async () => {
    const provider = AWSProvider({ region: 'us-east-1' });

    await expect(provider.requestUpload(uploadParams())).rejects.toThrow(
      'S3 bucketName is not configured in AWSProviderOptions.',
    );
  });

  it('throws a clear error when bucketName is missing for deleteFile', async () => {
    const provider = AWSProvider({ region: 'us-east-1' });

    await expect(
      provider.deleteFile({
        bucket: {} as Parameters<typeof provider.deleteFile>[0]['bucket'],
        url: 'https://example.com/documents/file.txt',
      }),
    ).rejects.toThrow(
      'S3 bucketName is not configured in AWSProviderOptions for deleteFile.',
    );
  });
});
