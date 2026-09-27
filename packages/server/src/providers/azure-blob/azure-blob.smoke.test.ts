import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import type { RequestUploadParams } from '@edgestore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { azureBlob } from './index';

// Opt-in against an isolated Azurite endpoint. Azurite accepts some requests
// Azure rejects, so this does not prove Azure compatibility.
const endpoint = process.env.ES_AZURE_SMOKE_ENDPOINT;
// Azurite's documented development account.
const storageAccountName = 'devstoreaccount1';
const storageAccountKey =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
const containerName = `edgestore-smoke-${crypto.randomUUID()}`;
const partSize = 5 * 1024 ** 2;

const container = new BlobServiceClient(
  endpoint ?? 'http://127.0.0.1:10000/devstoreaccount1',
  new StorageSharedKeyCredential(storageAccountName, storageAccountKey),
).getContainerClient(containerName);
const provider = azureBlob({
  storageAccountName,
  storageAccountKey,
  containerName,
  endpoint,
  jwtSecret: 'isolated-smoke-test-secret',
  multipart: { thresholdBytes: partSize, partSizeBytes: partSize },
  path: ({ defaultPath }) => `custom/${defaultPath}`,
  objectOptions: {
    cacheControl: 'private, max-age=60',
    metadata: { tenant: 'acme' },
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

async function startMultipart(body: Uint8Array<ArrayBuffer>) {
  const result = await provider.uploads.request(request(body.length));
  if (!('multipart' in result)) throw new Error('Expected multipart upload');
  return result;
}

function putPart(url: string, body: Uint8Array<ArrayBuffer>) {
  return fetch(url, { method: 'PUT', body });
}

describe.skipIf(!endpoint)('Azure Blob live storage contract', () => {
  beforeAll(async () => {
    await container.create();
  });
  afterAll(async () => {
    await container.deleteIfExists();
  });

  it('uploads with the required browser headers and reads privately by key', async () => {
    const result = await provider.uploads.request(request(3));
    if (!('uploadUrl' in result)) throw new Error('Expected single upload');
    const upload = await fetch(result.uploadUrl, {
      method: 'PUT',
      headers: result.uploadHeaders,
      body: 'abc',
    });
    expect(upload.status, await upload.text()).toBe(201);
    expect(result.key).toMatch(/^documents\/custom\//);
    expect(await (await fetch(result.signedReadUrl!.signedUrl)).text()).toBe(
      'abc',
    );
    expect((await fetch(result.url)).ok).toBe(false);

    const properties = await container
      .getBlobClient(result.key!)
      .getProperties();
    expect(properties).toMatchObject({
      contentType: 'text/plain',
      cacheControl: 'private, max-age=60',
      metadata: { tenant: 'acme' },
    });
    await expect(
      provider.files.get({
        bucketName: 'documents',
        file: { key: result.key! },
      }),
    ).resolves.toMatchObject({ sizeBytes: 3 });
  });

  it('stages browser blocks, refreshes part URLs, and commits without ETags', async () => {
    const body = new Uint8Array(partSize + 3).fill(97);
    const { multipart, signedReadUrl } = await startMultipart(body);
    expect(multipart.totalParts).toBe(2);
    const [first] = multipart.parts;
    const { parts: refreshed } = await provider.uploads.multipart.requestParts({
      uploadId: multipart.uploadId,
      key: multipart.key,
      parts: [2],
    });

    for (const [part, bytes] of [
      [first!, body.slice(0, partSize)],
      [refreshed[0]!, body.slice(partSize)],
    ] as const) {
      const response = await putPart(part.uploadUrl, bytes);
      expect(response.status, await response.text()).toBe(201);
    }
    await provider.uploads.multipart.complete({
      uploadId: multipart.uploadId,
      key: multipart.key,
      parts: [{ partNumber: 1 }, { partNumber: 2 }],
    });

    const read = await fetch(signedReadUrl!.signedUrl);
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(body);
    const properties = await container
      .getBlobClient(multipart.key)
      .getProperties();
    expect(properties).toMatchObject({
      contentType: 'text/plain',
      cacheControl: 'private, max-age=60',
      metadata: { tenant: 'acme' },
    });
  });

  it('refuses to commit missing or resized blocks', async () => {
    const body = new Uint8Array(partSize + 3).fill(98);
    const { multipart } = await startMultipart(body);
    const [first, second] = multipart.parts;
    await putPart(first!.uploadUrl, body.slice(0, partSize));
    const session = {
      uploadId: multipart.uploadId,
      key: multipart.key,
      parts: [{ partNumber: 1 }, { partNumber: 2 }],
    };

    await expect(
      provider.uploads.multipart.complete(session),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await putPart(second!.uploadUrl, new Uint8Array(partSize).fill(98));
    await expect(
      provider.uploads.multipart.complete(session),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await container.getBlobClient(multipart.key).exists()).toBe(false);
  });

  it('uploads backend blocks and deletes by URL or key', async () => {
    const source = new Blob([new Uint8Array(partSize * 2 + 1).fill(99)], {
      type: 'text/plain',
    });
    const progress: number[] = [];
    const result = await provider.uploads.upload({
      ...request(source.size),
      source,
      onProgress: ({ transferredBytes }) => progress.push(transferredBytes),
    });
    expect(result.file.sizeBytes).toBe(source.size);
    expect(progress.at(-1)).toBe(source.size);
    const read = await fetch(result.signedReadUrl!.signedUrl);
    expect(await read.arrayBuffer()).toEqual(await source.arrayBuffer());

    await expect(
      provider.files.delete({
        bucketName: 'documents',
        files: [{ url: result.file.url }, { key: 'documents/missing.txt' }],
      }),
    ).resolves.toEqual({ results: [{ success: true }, { success: true }] });
    expect(await container.getBlobClient(result.file.key).exists()).toBe(false);
  });
});
