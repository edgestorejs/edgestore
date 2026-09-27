import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNextProxy } from './createNextProxy';
import { EdgeStoreFileMutationError } from './errors';
import { UploadAbortedError } from './libs/errors/uploadAbortedError';
import {
  createFetchMock,
  flushMicrotasks,
  getBody,
  jsonResponse,
  MockXMLHttpRequest,
  waitForXhrs,
} from './xhr.test.utils';

function uploadResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    uploadUrl: 'https://uploads.example/file',
    url: 'https://files.example/protected/file.txt',
    thumbnailUrl: null,
    size: 12,
    path: {},
    pathOrder: [],
    metadata: {},
    ...overrides,
  };
}

function createProxy(opts?: {
  uploadingCount?: number;
  maxConcurrentUploads?: number;
}) {
  const uploadingCountRef = { current: opts?.uploadingCount ?? 0 };
  const edgestore = createNextProxy<any>({
    apiPath: '/api/edgestore',
    uploadingCountRef,
    maxConcurrentUploads: opts?.maxConcurrentUploads,
  });
  return { assets: edgestore.assets!, edgestore, uploadingCountRef };
}

beforeEach(() => {
  MockXMLHttpRequest.instances = [];
  vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
  vi.stubEnv('NODE_ENV', 'test');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('createNextProxy upload', () => {
  it('requests an upload with the expected body and uploads to the signed URL', async () => {
    const { calls } = createFetchMock([
      jsonResponse(
        uploadResponse({
          key: 'assets/avatar.jpg',
          uploadHeaders: {
            'x-ms-blob-type': 'BlockBlob',
            'Cache-Control': 'private',
          },
        }),
      ),
    ]);
    const { assets } = createProxy();
    const file = new File(['hello'], 'avatar.png', { type: 'image/png' });
    const progress = vi.fn();

    const upload = assets.upload({
      file,
      input: { userId: 'user_1' },
      options: {
        manualFileName: 'profile.jpg',
        replaceTargetUrl: 'https://files.example/old.png',
        temporary: true,
      },
      onProgressChange: progress,
    });

    await waitForXhrs(1);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/api/edgestore/request-upload');
    expect(calls[0]?.init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(getBody(calls[0]!)).toEqual({
      bucketName: 'assets',
      input: { userId: 'user_1' },
      fileInfo: {
        extension: 'jpg',
        type: 'image/png',
        size: file.size,
        fileName: 'profile.jpg',
        replaceTargetUrl: 'https://files.example/old.png',
        temporary: true,
      },
    });

    const xhr = MockXMLHttpRequest.instances[0]!;
    expect(xhr.method).toBe('PUT');
    expect(xhr.url).toBe('https://uploads.example/file');
    expect(Object.fromEntries(xhr.headers)).toEqual({
      'x-ms-blob-type': 'BlockBlob',
      'Cache-Control': 'private',
    });
    expect(xhr.body).toBe(file);

    xhr.progress(2, 5);
    xhr.load();

    await expect(upload).resolves.toMatchObject({
      key: 'assets/avatar.jpg',
      url: 'https://files.example/protected/file.txt',
      size: 12,
      path: {},
      pathOrder: [],
      metadata: {},
    });
    expect(await upload).not.toHaveProperty('uploadedAt');
    expect(progress).toHaveBeenCalledWith(40);
  });

  it.each([
    {
      name: 'File return uses returned file name extension',
      transform: () =>
        new File(['file'], 'converted.webp', { type: 'image/webp' }),
      expected: {
        extension: 'webp',
        type: 'image/webp',
        size: 4,
      },
    },
    {
      name: 'Blob return keeps original extension',
      transform: () => new Blob(['blob'], { type: 'text/plain' }),
      expected: {
        extension: 'txt',
        type: 'text/plain',
        size: 4,
      },
    },
    {
      name: 'object return uses explicit extension',
      transform: () => ({
        file: new Blob(['data'], { type: 'application/json' }),
        extension: 'json',
      }),
      expected: {
        extension: 'json',
        type: 'application/json',
        size: 4,
      },
    },
  ])('supports transform form: $name', async ({ transform, expected }) => {
    const { calls } = createFetchMock([jsonResponse(uploadResponse())]);
    const { assets } = createProxy();
    const upload = assets.upload({
      file: new File(['original'], 'original.txt', { type: 'text/plain' }),
      options: { transform },
    });

    await waitForXhrs(1);
    MockXMLHttpRequest.instances[0]!.load();
    await upload;

    expect(getBody(calls[0]!).fileInfo).toMatchObject(expected);
  });

  it('lets manualFileName extension override transform extension', async () => {
    const { calls } = createFetchMock([jsonResponse(uploadResponse())]);
    const { assets } = createProxy();
    const upload = assets.upload({
      file: new File(['original'], 'original.txt', { type: 'text/plain' }),
      options: {
        manualFileName: 'manual.csv',
        transform: () =>
          new File(['converted'], 'converted.webp', { type: 'image/webp' }),
      },
    });

    await waitForXhrs(1);
    MockXMLHttpRequest.instances[0]!.load();
    await upload;

    expect(getBody(calls[0]!).fileInfo).toMatchObject({
      extension: 'csv',
      fileName: 'manual.csv',
      type: 'image/webp',
    });
  });

  it('reports progress and aborts during upload', async () => {
    createFetchMock([jsonResponse(uploadResponse())]);
    const { assets } = createProxy();
    const controller = new AbortController();
    const progress = vi.fn();
    const upload = assets.upload({
      file: new File(['hello'], 'hello.txt'),
      signal: controller.signal,
      onProgressChange: progress,
    });

    await waitForXhrs(1);
    const xhr = MockXMLHttpRequest.instances[0]!;
    xhr.progress(1, 5);
    controller.abort();

    await expect(upload).rejects.toBeInstanceOf(UploadAbortedError);
    expect(progress).toHaveBeenCalledWith(20);
    expect(progress).toHaveBeenLastCalledWith(0);
  });

  it('rejects when aborted before the upload starts', async () => {
    createFetchMock([jsonResponse(uploadResponse())]);
    const { assets } = createProxy();
    const controller = new AbortController();
    controller.abort();

    await expect(
      assets.upload({
        file: new File(['hello'], 'hello.txt'),
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(UploadAbortedError);
  });

  it('queues uploads above maxConcurrentUploads', async () => {
    vi.useFakeTimers();
    createFetchMock([
      jsonResponse(
        uploadResponse({ uploadUrl: 'https://uploads.example/one' }),
      ),
      jsonResponse(
        uploadResponse({ uploadUrl: 'https://uploads.example/two' }),
      ),
    ]);
    const { assets } = createProxy({ maxConcurrentUploads: 1 });

    const first = assets.upload({
      file: new File(['one'], 'one.txt'),
    });
    await waitForXhrs(1);

    const second = assets.upload({
      file: new File(['two'], 'two.txt'),
    });
    await waitForXhrs(1);

    expect(MockXMLHttpRequest.instances).toHaveLength(1);
    MockXMLHttpRequest.instances[0]!.load();
    await first;

    await vi.advanceTimersByTimeAsync(300);
    await flushMicrotasks();

    expect(MockXMLHttpRequest.instances).toHaveLength(2);
    expect(MockXMLHttpRequest.instances[1]!.url).toBe(
      'https://uploads.example/two',
    );
    MockXMLHttpRequest.instances[1]!.load();
    await second;
  });

  it('uploads multipart parts and completes the multipart upload', async () => {
    const { calls } = createFetchMock([
      jsonResponse({
        ...uploadResponse({ uploadUrl: undefined }),
        multipart: {
          uploadId: 'upload_1',
          key: 'bucket/key',
          partSize: 2,
          totalParts: 2,
          parts: [
            { partNumber: 1, uploadUrl: 'https://uploads.example/part-1' },
            { partNumber: 2, uploadUrl: 'https://uploads.example/part-2' },
          ],
        },
      }),
      jsonResponse({ success: true }),
    ]);
    const { assets } = createProxy();
    const progress = vi.fn();
    const upload = assets.upload({
      file: new File(['abcd'], 'data.bin'),
      onProgressChange: progress,
    });

    await waitForXhrs(2);
    MockXMLHttpRequest.instances[0]!.progress(2, 2);
    MockXMLHttpRequest.instances[0]!.load(200, 'etag-1');
    MockXMLHttpRequest.instances[1]!.progress(2, 2);
    MockXMLHttpRequest.instances[1]!.load(200, 'etag-2');

    await upload;

    expect(calls[1]?.url).toBe('/api/edgestore/complete-multipart-upload');
    expect(getBody(calls[1]!)).toEqual({
      bucketName: 'assets',
      uploadId: 'upload_1',
      key: 'bucket/key',
      parts: [
        { partNumber: 1, eTag: 'etag-1' },
        { partNumber: 2, eTag: 'etag-2' },
      ],
    });
    expect(progress).toHaveBeenCalledWith(50);
    expect(progress).toHaveBeenCalledWith(100);
  });

  it('returns protected URLs unchanged in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const accessUrl = 'https://files.example/protected/file.txt';
    createFetchMock([jsonResponse(uploadResponse({ url: accessUrl }))]);
    const { assets } = createProxy();
    const upload = assets.upload({
      file: new File(['hello'], 'hello.txt'),
    });

    await waitForXhrs(1);
    MockXMLHttpRequest.instances[0]!.load();

    await expect(upload).resolves.toMatchObject({ url: accessUrl });
  });

  it('returns the signed read URL when the bucket requests one', async () => {
    createFetchMock([
      jsonResponse(
        uploadResponse({
          signedReadUrl: {
            signedUrl: 'https://files.example/protected/file.txt?sig=1',
            expiresAt: '2026-01-02T04:04:05.000Z',
            expiresIn: 3600,
          },
        }),
      ),
    ]);
    const { assets } = createProxy();
    const upload = assets.upload({
      file: new File(['hello'], 'hello.txt'),
    });

    await waitForXhrs(1);
    MockXMLHttpRequest.instances[0]!.load();

    await expect(upload).resolves.toMatchObject({
      signedUrl: 'https://files.example/protected/file.txt?sig=1',
      expiresAt: new Date('2026-01-02T04:04:05.000Z'),
      expiresIn: 3600,
      signedThumbnailUrl: null,
    });
  });
});

describe('createNextProxy file mutations', () => {
  it('throws when singular confirmation fails', async () => {
    createFetchMock([
      jsonResponse({
        succeeded: [],
        failed: [
          {
            url: 'https://files.example/file.txt',
            error: { code: 'NOT_CONFIRMABLE', message: 'Not confirmable' },
          },
        ],
      }),
    ]);
    const { assets } = createProxy();

    await expect(
      assets.confirm({ url: 'https://files.example/file.txt' }),
    ).rejects.toBeInstanceOf(EdgeStoreFileMutationError);
  });

  it('reports the failed file on singular confirmation', async () => {
    createFetchMock([
      jsonResponse({
        succeeded: [],
        failed: [
          {
            url: 'https://files.example/file.txt',
            error: { code: 'NOT_CONFIRMABLE', message: 'Not confirmable' },
          },
        ],
      }),
    ]);
    const { assets } = createProxy();

    await expect(
      assets.confirm({ url: 'https://files.example/file.txt' }),
    ).rejects.toMatchObject({
      name: 'EdgeStoreFileMutationError',
      code: 'NOT_CONFIRMABLE',
      message: 'Not confirmable',
      fileRef: { url: 'https://files.example/file.txt' },
    });
  });

  it('throws when singular deletion fails', async () => {
    createFetchMock([
      jsonResponse({
        succeeded: [],
        failed: [
          {
            url: 'https://files.example/file.txt',
            error: { code: 'DELETE_FAILED', message: 'Delete failed' },
          },
        ],
      }),
    ]);
    const { assets } = createProxy();

    await expect(
      assets.delete({ url: 'https://files.example/file.txt' }),
    ).rejects.toMatchObject({
      name: 'EdgeStoreFileMutationError',
      code: 'DELETE_FAILED',
      message: 'Delete failed',
      fileRef: { url: 'https://files.example/file.txt' },
    });
  });

  it('sends one request for plural deletion and preserves partial failures', async () => {
    const result = {
      succeeded: ['https://files.example/one.txt'],
      failed: [
        {
          url: 'https://files.example/two.txt',
          error: { code: 'DELETE_FAILED', message: 'Delete failed' },
        },
      ],
    };
    const { fetchMock } = createFetchMock([jsonResponse(result)]);
    const { assets } = createProxy();

    await expect(
      assets.deleteMany({
        urls: [
          'https://files.example/one.txt',
          'https://files.example/two.txt',
        ],
      }),
    ).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/edgestore/delete-files');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      bucketName: 'assets',
      urls: ['https://files.example/one.txt', 'https://files.example/two.txt'],
    });
  });
});
