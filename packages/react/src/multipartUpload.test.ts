import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadAbortedError } from './libs/errors/uploadAbortedError';
import { multipartUpload } from './multipartUpload';
import {
  flushMicrotasks,
  jsonResponse,
  MockXMLHttpRequest,
} from './xhr.test.utils';

type Route = (body: any) => Response | Promise<Response>;

const session = { bucketName: 'assets', uploadId: 'upload_1', key: 'k' };

function routeFetch(routes: Record<string, Route>) {
  const calls: { path: string; body: any }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace('/api/edgestore/', '');
      const body = JSON.parse(init?.body as string);
      calls.push({ path, body });
      const route = routes[path];
      if (!route) throw new Error(`Unexpected fetch: ${path}`);
      return Promise.race([
        route(body),
        new Promise<never>((_, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          ),
        ),
      ]);
    }),
  );
  return (path: string) =>
    calls.filter((call) => call.path === path).map((call) => call.body);
}

function partUrls(parts: number[]) {
  return parts.map((partNumber) => ({
    partNumber,
    uploadUrl: `https://uploads.example/${partNumber}`,
  }));
}

function start({
  totalParts,
  initialParts = [1],
  signal,
}: {
  totalParts: number;
  initialParts?: number[];
  signal?: AbortSignal;
}) {
  return multipartUpload({
    apiPath: '/api/edgestore',
    bucketName: session.bucketName,
    multipart: {
      uploadId: session.uploadId,
      key: session.key,
      partSize: 1,
      totalParts,
      parts: partUrls(initialParts),
    },
    file: new Blob(['x'.repeat(totalParts)]),
    signal,
  });
}

const handled = new Set<MockXMLHttpRequest>();

/** Completes every started part request that has not been answered yet. */
async function answerParts(
  respond: (xhr: MockXMLHttpRequest) => void = (xhr) =>
    xhr.load(200, `etag-${xhr.url}`),
) {
  for (let i = 0; i < 20; i++) {
    await flushMicrotasks();
    for (const xhr of MockXMLHttpRequest.instances) {
      if (handled.has(xhr)) continue;
      handled.add(xhr);
      respond(xhr);
    }
  }
}

const ok = () => new Response(null, { status: 200 });

beforeEach(() => {
  MockXMLHttpRequest.instances = [];
  handled.clear();
  vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('multipartUpload', () => {
  it('requests missing part URLs in batches and completes in part order', async () => {
    const calls = routeFetch({
      'request-upload-parts': (body) =>
        jsonResponse({ parts: partUrls(body.parts) }),
      'complete-multipart-upload': ok,
    });

    const upload = start({ totalParts: 12, initialParts: [1, 2] });
    await answerParts();
    await upload;

    expect(calls('request-upload-parts')).toEqual([
      { ...session, parts: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    ]);
    expect(calls('complete-multipart-upload')).toEqual([
      {
        ...session,
        parts: Array.from({ length: 12 }, (_, index) => ({
          partNumber: index + 1,
          eTag: `etag-https://uploads.example/${index + 1}`,
        })),
      },
    ]);
  });

  it('refreshes a rejected part URL once', async () => {
    const calls = routeFetch({
      'request-upload-parts': () =>
        jsonResponse({
          parts: [{ partNumber: 1, uploadUrl: 'https://uploads.example/new' }],
        }),
      'complete-multipart-upload': ok,
    });

    const upload = start({ totalParts: 1 });
    await answerParts((xhr) =>
      xhr.url === 'https://uploads.example/new'
        ? xhr.load(200, 'etag-new')
        : xhr.load(403),
    );
    await upload;

    expect(calls('request-upload-parts')).toEqual([{ ...session, parts: [1] }]);
    expect(calls('complete-multipart-upload')[0].parts).toEqual([
      { partNumber: 1, eTag: 'etag-new' },
    ]);
  });

  it('fails and aborts the session when a refreshed URL is rejected again', async () => {
    const calls = routeFetch({
      'request-upload-parts': (body) =>
        jsonResponse({ parts: partUrls(body.parts) }),
      'abort-multipart-upload': ok,
    });

    const upload = start({ totalParts: 1 });
    const result = expect(upload).rejects.toThrow('HTTP 403');
    await answerParts((xhr) => xhr.load(403));
    await result;

    expect(MockXMLHttpRequest.instances).toHaveLength(2);
    expect(calls('abort-multipart-upload')).toEqual([session]);
  });

  it.each([
    {
      name: 'server errors',
      respond: (xhr: MockXMLHttpRequest) => xhr.load(503),
    },
    {
      name: 'network errors',
      respond: (xhr: MockXMLHttpRequest) => xhr.fail(),
    },
    {
      name: 'S3 request timeouts',
      respond: (xhr: MockXMLHttpRequest) =>
        xhr.load(
          400,
          undefined,
          '<Error><Code>RequestTimeout</Code><Message>Idle</Message></Error>',
        ),
    },
  ])('retries $name after a backoff', async ({ respond }) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    routeFetch({ 'complete-multipart-upload': ok });

    const upload = start({ totalParts: 1 });
    await answerParts(respond);
    expect(MockXMLHttpRequest.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    await answerParts();
    await upload;

    expect(MockXMLHttpRequest.instances).toHaveLength(2);
  });

  it.each([
    {
      name: 'permanent HTTP errors',
      respond: (xhr: MockXMLHttpRequest) =>
        xhr.load(
          400,
          undefined,
          '<Error><Code>InvalidArgument</Code><Message>RequestTimeout</Message></Error>',
        ),
      error: 'HTTP 400',
    },
    {
      name: 'missing ETags',
      respond: (xhr: MockXMLHttpRequest) => xhr.load(200),
      error: 'exposes the ETag header',
    },
  ])('fails without retrying on $name', async ({ respond, error }) => {
    const calls = routeFetch({ 'abort-multipart-upload': ok });

    const upload = start({ totalParts: 1 });
    const result = expect(upload).rejects.toThrow(error);
    await answerParts(respond);
    await result;

    expect(MockXMLHttpRequest.instances).toHaveLength(1);
    expect(calls('abort-multipart-upload')).toEqual([session]);
  });

  it('stops active and queued parts when canceled', async () => {
    const calls = routeFetch({
      'request-upload-parts': (body) =>
        jsonResponse({ parts: partUrls(body.parts) }),
      'abort-multipart-upload': ok,
    });
    const controller = new AbortController();

    const upload = start({ totalParts: 8, signal: controller.signal });
    const result = expect(upload).rejects.toBeInstanceOf(UploadAbortedError);
    await answerParts(() => undefined);
    expect(MockXMLHttpRequest.instances).toHaveLength(5);
    controller.abort();
    await result;

    await answerParts(() => undefined);
    expect(MockXMLHttpRequest.instances).toHaveLength(5);
    expect(calls('complete-multipart-upload')).toEqual([]);
    expect(calls('abort-multipart-upload')).toEqual([session]);
  });

  it('cancels while waiting to retry without starting another part', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    routeFetch({ 'abort-multipart-upload': ok });
    const controller = new AbortController();

    const upload = start({ totalParts: 1, signal: controller.signal });
    const result = expect(upload).rejects.toBeInstanceOf(UploadAbortedError);
    await answerParts((xhr) => xhr.load(503));
    controller.abort();
    await result;
    await vi.advanceTimersByTimeAsync(60_000);

    expect(MockXMLHttpRequest.instances).toHaveLength(1);
  });

  it('gives up on cleanup after its deadline and keeps the original error', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    routeFetch({
      'complete-multipart-upload': () =>
        jsonResponse({ code: 'SERVER_ERROR', message: 'complete failed' }, 500),
      'abort-multipart-upload': () => new Promise<Response>(() => undefined),
    });

    const upload = start({ totalParts: 1 });
    let error: unknown;
    upload.catch((reason) => (error = reason));
    await answerParts();
    expect(error).toBeUndefined();

    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();

    expect(error).toMatchObject({ message: 'complete failed' });
  });
});
