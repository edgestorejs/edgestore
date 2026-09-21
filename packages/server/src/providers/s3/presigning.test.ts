import { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { s3 } from './index';

// Real AWS serialization and signing, with static credentials and no network.
describe('S3 presigning contract', () => {
  it('returns all required browser headers and avoids an empty-body checksum', async () => {
    const provider = s3({
      bucketName: 'storage',
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      objectOptions: {
        CacheControl: 'private, max-age=60',
        ContentDisposition: 'attachment; filename="report.txt"',
        Metadata: { tenant: 'acme' },
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: 'test-key',
        StorageClass: 'STANDARD_IA',
        Tagging: 'type=report',
      },
    });
    const response = await provider.uploads.request({
      bucketName: 'documents',
      bucketType: 'FILE',
      fileInfo: {
        size: 3,
        type: 'text/plain',
        extension: 'txt',
        isPublic: false,
        fileName: 'report.txt',
        path: [],
        metadata: {},
        temporary: false,
      },
    });
    if (!('uploadUrl' in response))
      throw new Error('Expected single-part upload');
    const url = new URL(response.uploadUrl);
    expect(url.searchParams.has('x-amz-checksum-crc32')).toBe(false);
    const headers = Object.fromEntries(
      Object.entries(response.uploadHeaders ?? {}).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
    expect(headers).toMatchObject({
      'content-type': 'text/plain',
      'cache-control': 'private, max-age=60',
      'x-amz-meta-tenant': 'acme',
    });
    for (const header of url.searchParams
      .get('X-Amz-SignedHeaders')!
      .split(';')) {
      if (header !== 'host' && header !== 'content-length')
        expect(headers[header]).toBeDefined();
    }
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
      'content-length',
    );
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
      'content-type',
    );
  });

  it('rejects an injected client that would sign an empty-body checksum', async () => {
    const provider = s3({
      bucketName: 'storage',
      client: new S3Client({ region: 'us-east-1' }),
    });
    await expect(
      provider.uploads.request({
        bucketName: 'documents',
        bucketType: 'FILE',
        fileInfo: {
          size: 3,
          type: 'text/plain',
          extension: 'txt',
          isPublic: true,
          path: [],
          metadata: {},
          temporary: false,
        },
      }),
    ).rejects.toThrow('WHEN_REQUIRED');
  });

  it('derives the default URL from the injected client region', async () => {
    const provider = s3({
      bucketName: 'storage',
      client: new S3Client({
        region: 'eu-west-1',
        credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      }),
    });
    const [result] = await provider.files.getSignedUrls({
      bucketName: 'documents',
      files: [{ key: 'documents/file.txt' }],
    });
    expect(result?.url).toBe(
      'https://storage.s3.eu-west-1.amazonaws.com/documents/file.txt',
    );
  });
});
