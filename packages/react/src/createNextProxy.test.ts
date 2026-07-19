import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNextProxy } from './createNextProxy';
import EdgeStoreClientError from './libs/errors/EdgeStoreClientError';
import { UploadAbortedError } from './libs/errors/uploadAbortedError';

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

class MockXMLHttpRequest extends EventTarget {
  static instances: MockXMLHttpRequest[] = [];

  method?: string;
  url?: string;
  body?: BodyInit | null;
  status = 200;
  upload = new EventTarget();
  headers = new Map<string, string>();
  responseHeaders = new Map<string, string>();

  constructor() {
    super();
    MockXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

  getResponseHeader(name: string) {
    return this.responseHeaders.get(name) ?? null;
  }

  send(body?: BodyInit | null) {
    this.body = body;
    this.dispatchEvent(new Event('loadstart'));
  }

  abort() {
    this.dispatchEvent(new Event('abort'));
  }

  progress(loaded: number, total: number) {
    this.upload.dispatchEvent(
      new ProgressEvent('progress', {
        lengthComputable: true,
        loaded,
        total,
      }),
    );
  }

  load(status = 200, eTag?: string) {
    this.status = status;
    if (eTag) {
      this.responseHeaders.set('ETag', eTag);
    }
    this.dispatchEvent(new Event('load'));
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function urlToString(url: string | URL | Request) {
  return typeof url === 'string'
    ? url
    : url instanceof Request
      ? url.url
      : url.toString();
}

function createFetchMock(responses: Response[]) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: urlToString(url),
        init,
      });
      const response = responses.shift();
      if (!response) {
        throw new Error(`Unexpected fetch: ${urlToString(url)}`);
      }
      return response;
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

function uploadResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    uploadUrl: 'https://uploads.example/file',
    accessUrl: 'https://files.example/protected/file.txt',
    thumbnailUrl: null,
    size: 12,
    uploadedAt: '2024-01-02T03:04:05.000Z',
    path: {},
    pathOrder: [],
    metadata: {},
    ...overrides,
  };
}

function createProxy(opts?: {
  uploadingCount?: number;
  maxConcurrentUploads?: number;
  disableDevProxy?: boolean;
}) {
  const uploadingCountRef = { current: opts?.uploadingCount ?? 0 };
  const edgestore = createNextProxy<any>({
    apiPath: '/api/edgestore',
    uploadingCountRef,
    maxConcurrentUploads: opts?.maxConcurrentUploads,
    disableDevProxy: opts?.disableDevProxy,
  });
  return { assets: edgestore.assets!, edgestore, uploadingCountRef };
}

function getBody(call: FetchCall) {
  return JSON.parse(call.init?.body as string);
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForXhrs(count: number) {
  for (let i = 0; i < 20; i++) {
    if (MockXMLHttpRequest.instances.length >= count) {
      return;
    }
    await flushMicrotasks();
  }
  expect(MockXMLHttpRequest.instances).toHaveLength(count);
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
    const { calls } = createFetchMock([jsonResponse(uploadResponse())]);
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
    expect(xhr.headers.get('x-ms-blob-type')).toBe('BlockBlob');
    expect(xhr.body).toBe(file);

    xhr.progress(3, 12);
    xhr.load();

    await expect(upload).resolves.toMatchObject({
      url: 'https://files.example/protected/file.txt',
      size: 12,
      path: {},
      pathOrder: [],
      metadata: {},
    });
    expect((await upload).uploadedAt).toEqual(
      new Date('2024-01-02T03:04:05.000Z'),
    );
    expect(progress).toHaveBeenCalledWith(25);
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
    xhr.progress(1, 4);
    controller.abort();

    await expect(upload).rejects.toBeInstanceOf(UploadAbortedError);
    expect(progress).toHaveBeenCalledWith(25);
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

  it('rewrites protected URLs in development, but not public URLs or disabled proxies', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const cases = [
      {
        response: uploadResponse({
          accessUrl: 'https://files.example/protected/file.txt',
        }),
        disableDevProxy: false,
        expected:
          'http://localhost/api/edgestore/proxy-file?url=https%3A%2F%2Ffiles.example%2Fprotected%2Ffile.txt',
      },
      {
        response: uploadResponse({
          accessUrl: 'https://files.example/_public/file.txt',
        }),
        disableDevProxy: false,
        expected: 'https://files.example/_public/file.txt',
      },
      {
        response: uploadResponse({
          accessUrl: 'https://files.example/protected/file.txt',
        }),
        disableDevProxy: true,
        expected: 'https://files.example/protected/file.txt',
      },
    ];

    for (const testCase of cases) {
      createFetchMock([jsonResponse(testCase.response)]);
      const { assets } = createProxy({
        disableDevProxy: testCase.disableDevProxy,
      });
      const upload = assets.upload({
        file: new File(['hello'], 'hello.txt'),
      });

      await waitForXhrs(MockXMLHttpRequest.instances.length + 1);
      MockXMLHttpRequest.instances.at(-1)!.load();

      await expect(upload).resolves.toMatchObject({
        url: testCase.expected,
      });
      vi.unstubAllGlobals();
      vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
    }
  });
});

describe('createNextProxy confirmUpload/delete', () => {
  it('throws when confirmUpload returns success false', async () => {
    createFetchMock([jsonResponse({ success: false })]);
    const { assets } = createProxy();

    await expect(
      assets.confirmUpload({ url: 'https://files.example/file.txt' }),
    ).rejects.toBeInstanceOf(EdgeStoreClientError);
  });

  it('throws when delete returns success false', async () => {
    createFetchMock([jsonResponse({ success: false })]);
    const { assets } = createProxy();

    await expect(
      assets.delete({ url: 'https://files.example/file.txt' }),
    ).rejects.toBeInstanceOf(EdgeStoreClientError);
  });
});
