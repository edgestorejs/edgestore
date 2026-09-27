import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type RequestUploadParams } from '@edgestore/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initEdgeStore } from '../../core/router';
import { s3 } from './index';

vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }));
const partSize = 5 * 1024 ** 2;
function request(
  fileInfo: Partial<RequestUploadParams['fileInfo']> = {},
): RequestUploadParams {
  return {
    bucketName: 'documents',
    bucketType: 'FILE',
    fileInfo: {
      size: partSize + 3,
      type: 'text/plain',
      extension: 'txt',
      fileName: 'report.txt',
      isPublic: false,
      temporary: false,
      path: [],
      metadata: {},
      ...fileInfo,
    },
  };
}
function setup(options: Parameters<typeof s3>[0] = {}) {
  const client = new S3Client({
    region: 'us-east-1',
    requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
  const send =
    vi.fn<
      (
        command: { input: unknown },
        options?: unknown,
      ) => Promise<Record<string, unknown>>
    >();
  vi.spyOn(client, 'send').mockImplementation(send);
  const provider = s3({
    client,
    bucketName: 'storage',
    region: 'us-east-1',
    jwtSecret: 'test-secret',
    multipart: { thresholdBytes: partSize, partSizeBytes: partSize },
    ...options,
  });
  return { provider, send };
}
async function start(provider: ReturnType<typeof s3>) {
  const response = await provider.uploads.request(request());
  if (!('multipart' in response)) throw new Error('Expected multipart upload');
  return response.multipart;
}
beforeEach(() => {
  vi.mocked(getSignedUrl).mockResolvedValue('https://signed.example/file');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('S3 multipart uploads', () => {
  it('creates, refreshes, completes and aborts only the authorized upload', async () => {
    const { provider, send } = setup();
    send.mockResolvedValue({ UploadId: 'aws-upload-id' });
    const session = await start(provider);
    expect(session).toMatchObject({
      key: 'documents/report.txt',
      partSize,
      totalParts: 2,
    });
    expect(session.uploadId).not.toBe('aws-upload-id');
    expect(send).toHaveBeenCalledWith(expect.any(CreateMultipartUploadCommand));
    expect(
      vi
        .mocked(getSignedUrl)
        .mock.calls.map((call) => (call[1] as UploadPartCommand).input),
    ).toEqual([
      {
        Bucket: 'storage',
        Key: session.key,
        UploadId: 'aws-upload-id',
        PartNumber: 1,
        ContentLength: partSize,
      },
      {
        Bucket: 'storage',
        Key: session.key,
        UploadId: 'aws-upload-id',
        PartNumber: 2,
        ContentLength: 3,
      },
    ]);
    await expect(
      provider.uploads.multipart.requestParts({
        uploadId: session.uploadId,
        key: session.key,
        parts: [2],
      }),
    ).resolves.toEqual({
      parts: [{ partNumber: 2, uploadUrl: 'https://signed.example/file' }],
    });
    await provider.uploads.multipart.complete({
      ...session,
      parts: [
        { partNumber: 2, eTag: 'two' },
        { partNumber: 1, eTag: 'one' },
      ],
    });
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        input: {
          Bucket: 'storage',
          Key: session.key,
          UploadId: 'aws-upload-id',
          MultipartUpload: {
            Parts: [
              { PartNumber: 1, ETag: 'one' },
              { PartNumber: 2, ETag: 'two' },
            ],
          },
        },
      }),
    );
    await provider.uploads.multipart.abort!({
      uploadId: session.uploadId,
      key: session.key,
    });
    expect(send).toHaveBeenLastCalledWith(
      expect.any(AbortMultipartUploadCommand),
    );
  });

  it('rejects tampered tokens, different keys, buckets, expired sessions and invalid parts before contacting S3', async () => {
    const { provider, send } = setup();
    send.mockResolvedValue({ UploadId: 'aws-upload-id' });
    const session = await start(provider);
    send.mockClear();
    vi.mocked(getSignedUrl).mockClear();
    for (const uploadId of ['raw-id', session.uploadId + 'tampered']) {
      await expect(
        provider.uploads.multipart.abort!({ uploadId, key: session.key }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
    await expect(
      provider.uploads.multipart.complete({
        ...session,
        key: 'avatars/other.txt',
        parts: [],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    for (const parts of [[], [0], [3], [1, 1], [1.5]]) {
      await expect(
        provider.uploads.multipart.requestParts({
          uploadId: session.uploadId,
          key: session.key,
          parts,
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
    await expect(
      provider.uploads.multipart.complete({
        ...session,
        parts: [{ partNumber: 1, eTag: 'one' }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    const other = setup({ bucketName: 'other' });
    await expect(
      other.provider.uploads.multipart.abort!(session),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(other.send).not.toHaveBeenCalled();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25 * 3600 * 1000);
    await expect(
      provider.uploads.multipart.abort!(session),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(send).not.toHaveBeenCalled();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('signs the first part URLs up front and honors the session lifetime', async () => {
    const { provider, send } = setup({
      multipart: {
        thresholdBytes: partSize,
        partSizeBytes: partSize,
        sessionExpiresIn: 60,
      },
    });
    send.mockResolvedValue({ UploadId: 'aws-upload-id' });
    const response = await provider.uploads.request(
      request({ size: partSize * 25 }),
    );
    if (!('multipart' in response)) throw new Error('Expected multipart');
    const session = response.multipart;
    expect(session.totalParts).toBe(25);
    expect(session.parts.map((part) => part.partNumber)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
    await expect(
      provider.uploads.multipart.requestParts({ ...session, parts: [25] }),
    ).resolves.toMatchObject({ parts: [{ partNumber: 25 }] });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61 * 1000);
    await expect(
      provider.uploads.multipart.requestParts({ ...session, parts: [11] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('validates the secret before initiation and aborts when part signing fails', async () => {
    vi.stubEnv('EDGE_STORE_JWT_SECRET', '');
    vi.stubEnv('EDGE_STORE_SECRET_KEY', '');
    const missing = setup({ jwtSecret: undefined });
    await expect(start(missing.provider)).rejects.toThrow('require jwtSecret');
    expect(missing.send).not.toHaveBeenCalled();
    const { provider, send } = setup();
    send.mockResolvedValue({ UploadId: 'aws-upload-id' });
    vi.mocked(getSignedUrl).mockRejectedValue(new Error('signing failed'));
    await expect(start(provider)).rejects.toThrow('signing failed');
    expect(send).toHaveBeenLastCalledWith(
      expect.any(AbortMultipartUploadCommand),
    );
  });
});

describe('S3 backend and private files', () => {
  it('uses canonical backend URLs in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { provider, send } = setup();
    send.mockResolvedValue({ ContentLength: 3, LastModified: new Date() });
    const es = initEdgeStore.create();
    const configured = es
      .router({
        documents: es.fileBucket().accessControl('private'),
      })
      .provider(provider);
    const result = await configured.client.documents.upload({ content: 'abc' });
    expect(result.url).toMatch(
      /^https:\/\/storage.s3.us-east-1.amazonaws.com\/documents\//,
    );
    const file = await configured.client.documents.get({ key: result.key });
    expect(file.url).toBe(result.url);
  });

  it('uploads a small backend file using the same paths and object settings', async () => {
    const now = new Date();
    const { provider, send } = setup({
      path: () => 'custom/report.txt',
      objectOptions: { CacheControl: 'private', Metadata: { tenant: 'acme' } },
    });
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ContentLength: 3, LastModified: now });
    const result = await provider.uploads.upload({
      ...request({ size: 3 }),
      source: new Blob(['abc'], { type: 'text/plain' }),
      autoSignedUrls: { expiresIn: 300 },
    });
    expect(send).toHaveBeenNthCalledWith(1, expect.any(PutObjectCommand), {
      abortSignal: undefined,
    });
    expect(send.mock.calls[0]![0]).toMatchObject({
      input: {
        Key: 'documents/custom/report.txt',
        ContentLength: 3,
        ContentType: 'text/plain',
        CacheControl: 'private',
        Metadata: { tenant: 'acme' },
      },
    });
    expect(result).toMatchObject({
      file: {
        key: 'documents/custom/report.txt',
        sizeBytes: 3,
        uploadedAt: now,
      },
      signedReadUrl: { expiresIn: 300 },
    });
  });

  it('uploads backend parts concurrently and reports byte progress', async () => {
    const { provider, send } = setup();
    send
      .mockResolvedValueOnce({ UploadId: 'backend-id' })
      .mockResolvedValueOnce({ ETag: 'one' })
      .mockResolvedValueOnce({ ETag: 'two' })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        ContentLength: partSize + 3,
        LastModified: new Date(),
      });
    const onProgress = vi.fn();
    await provider.uploads.upload({
      ...request(),
      source: new Blob([new Uint8Array(partSize + 3)]),
      onProgress,
    });
    expect(send.mock.calls.map((call) => call[0].constructor)).toEqual([
      CreateMultipartUploadCommand,
      UploadPartCommand,
      UploadPartCommand,
      CompleteMultipartUploadCommand,
      HeadObjectCommand,
    ]);
    expect(onProgress.mock.calls.map(([p]) => p.transferredBytes)).toEqual([
      0,
      partSize,
      partSize + 3,
    ]);
  });

  it('aborts a failed backend transfer without hiding its original error', async () => {
    const { provider, send } = setup();
    send.mockImplementation(async (command) => {
      if (command instanceof CreateMultipartUploadCommand)
        return { UploadId: 'backend-id' };
      if (command instanceof UploadPartCommand)
        throw new Error('transfer failed');
      throw new Error('cleanup failed');
    });
    await expect(
      provider.uploads.upload({
        ...request(),
        source: new Blob([new Uint8Array(partSize + 3)]),
      }),
    ).rejects.toThrow('transfer failed');
    expect(send).toHaveBeenLastCalledWith(
      expect.any(AbortMultipartUploadCommand),
    );
  });

  it('cancels a backend transfer and performs cleanup without the canceled signal', async () => {
    const { provider, send } = setup();
    const controller = new AbortController();
    send.mockImplementation(async (command) => {
      if (command instanceof CreateMultipartUploadCommand)
        return { UploadId: 'backend-id' };
      if (command instanceof UploadPartCommand) {
        controller.abort();
        return { ETag: 'part' };
      }
      return {};
    });
    await expect(
      provider.uploads.upload({
        ...request(),
        source: new Blob([new Uint8Array(partSize + 3)]),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(send).toHaveBeenLastCalledWith(
      expect.any(AbortMultipartUploadCommand),
    );
  });

  it('returns a committed upload even if canceled during the metadata lookup', async () => {
    const { provider, send } = setup();
    const controller = new AbortController();
    const lastModified = new Date();
    send.mockImplementation(async (command, options) => {
      if (command instanceof PutObjectCommand) {
        controller.abort();
        return {};
      }
      expect(options).toBeUndefined();
      return { ContentLength: 3, LastModified: lastModified };
    });

    await expect(
      provider.uploads.upload({
        ...request({ size: 3 }),
        source: new Blob(['abc']),
        signal: controller.signal,
      }),
    ).resolves.toMatchObject({ file: { sizeBytes: 3 } });
  });

  it('signs private reads from keys or URLs and rejects cross-bucket references', async () => {
    const { provider } = setup({ baseUrl: 'https://cdn.example/assets' });
    const result = await provider.files.getSignedUrls({
      bucketName: 'documents',
      files: [{ key: 'documents/a b.txt' }],
      expiresIn: 900,
    });
    expect(result[0]).toMatchObject({
      url: 'https://cdn.example/assets/documents/a%20b.txt',
      expiresIn: 900,
    });
    expect(getSignedUrl).toHaveBeenLastCalledWith(
      expect.any(S3Client),
      expect.any(GetObjectCommand),
      { expiresIn: 900 },
    );
    for (const file of [
      { key: 'avatars/other.txt' },
      { url: 'https://evil.example/documents/file.txt' },
    ]) {
      await expect(
        provider.files.getSignedUrls({
          bucketName: 'documents',
          files: [file],
        }),
      ).rejects.toThrow();
    }
    await expect(
      provider.files.getSignedUrls({
        bucketName: 'documents',
        files: [{ key: 'documents/file.txt' }],
        expiresIn: 604801,
      }),
    ).rejects.toThrow('expiration');
  });

  it('declares unsupported lifecycle options and rejects cookie-based access control', async () => {
    const { provider, send } = setup();
    expect(provider.uploads.supportedOptions).toEqual({
      temporary: false,
      replaceTargetUrl: false,
    });
    const es = initEdgeStore.create();
    await expect(
      provider.init({
        ctx: {},
        router: es.router({
          documents: es.fileBucket().accessControl({ user: 'someone' }),
        }),
      }),
    ).rejects.toThrow('cookie-based');
    await expect(
      provider.init({
        ctx: {},
        router: es.router({
          documents: es.fileBucket().accessControl('private'),
        }),
      }),
    ).resolves.toEqual({});
    expect(send).not.toHaveBeenCalled();
  });
});
