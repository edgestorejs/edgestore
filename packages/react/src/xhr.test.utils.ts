import { expect, vi } from 'vitest';

export type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

export class MockXMLHttpRequest extends EventTarget {
  static instances: MockXMLHttpRequest[] = [];

  method?: string;
  url?: string;
  body?: BodyInit | null;
  status = 200;
  responseXML: Document | null = null;
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

  fail() {
    this.dispatchEvent(new Event('error'));
    this.dispatchEvent(new Event('loadend'));
  }

  abort() {
    this.dispatchEvent(new Event('abort'));
    this.dispatchEvent(new Event('loadend'));
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

  load(status = 200, eTag?: string, xml?: string) {
    this.status = status;
    if (xml) {
      this.responseXML = new DOMParser().parseFromString(xml, 'text/xml');
    }
    if (eTag) {
      this.responseHeaders.set('ETag', eTag);
    }
    this.dispatchEvent(new Event('load'));
    this.dispatchEvent(new Event('loadend'));
  }
}

export function jsonResponse(body: unknown, status = 200) {
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

export function createFetchMock(responses: Response[]) {
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

export function getBody(call: FetchCall) {
  return JSON.parse(call.init?.body as string);
}

export async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

export async function waitForXhrs(count: number) {
  for (let i = 0; i < 20; i++) {
    if (MockXMLHttpRequest.instances.length >= count) {
      return;
    }
    await flushMicrotasks();
  }
  expect(MockXMLHttpRequest.instances).toHaveLength(count);
}
