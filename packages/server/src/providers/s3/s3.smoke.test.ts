import {
  AbortMultipartUploadCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import type { RequestUploadParams } from '@edgestore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { s3 } from './index';

// Opt-in against an isolated MinIO/S3-compatible endpoint. Never uses AWS defaults.
const endpoint = process.env.ES_S3_SMOKE_ENDPOINT;
const bucketName = `edgestore-smoke-${crypto.randomUUID()}`;
const credentials = {
  accessKeyId: process.env.ES_S3_SMOKE_ACCESS_KEY ?? 'edgestore-test',
  secretAccessKey:
    process.env.ES_S3_SMOKE_SECRET_KEY ?? 'edgestore-test-password',
};
const client = new S3Client({
  endpoint,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials,
});
const provider = s3({
  endpoint,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials,
  bucketName,
  baseUrl: `${endpoint}/${bucketName}`,
  jwtSecret: 'isolated-smoke-test-secret',
  multipart: { thresholdBytes: 5 * 1024 ** 2, partSizeBytes: 5 * 1024 ** 2 },
  path: ({ defaultPath }) => `custom/${defaultPath}`,
  objectOptions: {
    CacheControl: 'private, max-age=60',
    Metadata: { tenant: 'acme' },
  },
});
function request(size: number): RequestUploadParams {
  return {
    bucketName: 'documents',
    bucketType: 'FILE',
    autoSignedUrls: { expiresIn: 300 },
    fileInfo: {
      size,
      type: 'text/plain',
      extension: 'txt',
      fileName: `${crypto.randomUUID()}.txt`,
      isPublic: false,
      temporary: false,
      path: [],
      metadata: {},
    },
  };
}

describe.skipIf(!endpoint)('S3 live storage contract', () => {
  let created = false;
  beforeAll(async () => {
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
    created = true;
  });
  afterAll(async () => {
    if (!created) return;
    const { Uploads } = await client.send(
      new ListMultipartUploadsCommand({ Bucket: bucketName }),
    );
    for (const upload of Uploads ?? []) {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: upload.Key,
          UploadId: upload.UploadId,
        }),
      );
    }
    const { Contents } = await client.send(
      new ListObjectsV2Command({ Bucket: bucketName }),
    );
    for (const object of Contents ?? [])
      await client.send(
        new DeleteObjectCommand({ Bucket: bucketName, Key: object.Key }),
      );
    await client.send(new DeleteBucketCommand({ Bucket: bucketName }));
    client.destroy();
  });

  it('uploads with signed browser headers and reads privately by stable key', async () => {
    const result = await provider.uploads.request(request(3));
    if (!('uploadUrl' in result)) throw new Error('Expected single upload');
    const upload = await fetch(result.uploadUrl, {
      method: 'PUT',
      headers: result.uploadHeaders,
      body: 'abc',
    });
    expect(upload.status, await upload.text()).toBe(200);
    expect((await fetch(result.accessUrl)).status).toBe(403);
    expect(await (await fetch(result.accessSignedUrl!)).text()).toBe('abc');
    const file = await provider.files.get({
      bucketName: 'documents',
      file: { key: result.key! },
    });
    expect(file.sizeBytes).toBe(3);
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucketName, Key: result.key }),
    );
    expect(head).toMatchObject({
      ContentType: 'text/plain',
      CacheControl: 'private, max-age=60',
      Metadata: { tenant: 'acme' },
    });
    const wrongSize = await fetch(result.uploadUrl, {
      method: 'PUT',
      headers: result.uploadHeaders,
      body: 'different-size',
    });
    expect(wrongSize.ok).toBe(false);
    await provider.files.delete({
      bucketName: 'documents',
      files: [{ key: result.key! }],
    });
  });

  it('transfers signed parts, completes them and aborts abandoned uploads', async () => {
    const body = new Uint8Array(5 * 1024 ** 2 + 3).fill(97);
    const result = await provider.uploads.request(request(body.length));
    if (!('multipart' in result)) throw new Error('Expected multipart upload');
    const { multipart } = result;
    const parts = [];
    for (const part of multipart.parts) {
      const upload = await fetch(part.uploadUrl, {
        method: 'PUT',
        body: body.slice(
          (part.partNumber - 1) * multipart.partSize,
          part.partNumber * multipart.partSize,
        ),
      });
      expect(upload.status, await upload.text()).toBe(200);
      parts.push({
        partNumber: part.partNumber,
        eTag: upload.headers.get('etag')!,
      });
    }
    await provider.uploads.multipart.complete({ ...multipart, parts });
    const read = await fetch(result.accessSignedUrl!);
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(body);
    const abandoned = await provider.uploads.request(request(body.length));
    if (!('multipart' in abandoned))
      throw new Error('Expected multipart upload');
    await provider.uploads.multipart.abort!(abandoned.multipart);
    const { Uploads } = await client.send(
      new ListMultipartUploadsCommand({ Bucket: bucketName }),
    );
    expect(Uploads ?? []).toHaveLength(0);
  });

  it('uploads backend multipart content with the same configuration', async () => {
    const source = new Blob([new Uint8Array(5 * 1024 ** 2 + 1).fill(98)], {
      type: 'text/plain',
    });
    const result = await provider.uploads.upload({
      ...request(source.size),
      source,
    });
    expect(result.file.key).toMatch(/^documents\/custom\//);
    expect(result.file.sizeBytes).toBe(source.size);
    const read = await fetch(result.signedReadUrl!.signedUrl);
    expect(await read.arrayBuffer()).toEqual(await source.arrayBuffer());
  });
});
