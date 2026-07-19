import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEdgeStoreProvider } from './contextProvider';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

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

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let i = 0; i < 20; i++) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }
  throw lastError;
}

describe('createEdgeStoreProvider initialization', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it('skips _init for public EdgeStore responses', async () => {
    const { calls } = createFetchMock([
      jsonResponse({
        providerName: 'edgestore',
        requiresFileAccessCookie: false,
      }),
    ]);
    const { EdgeStoreProvider, useEdgeStore } = createEdgeStoreProvider<any>();
    const states: unknown[] = [];

    function Consumer() {
      states.push(useEdgeStore().state);
      return null;
    }

    await act(async () => {
      root.render(
        <EdgeStoreProvider>
          <Consumer />
        </EdgeStoreProvider>,
      );
    });

    await waitFor(() => {
      expect(states.at(-1)).toEqual({
        loading: false,
        initialized: true,
        error: false,
      });
    });

    expect(calls.map((call) => call.url)).toEqual(['/api/edgestore/init']);
  });

  it('calls _init for older or protected EdgeStore responses', async () => {
    const { calls } = createFetchMock([
      jsonResponse({
        providerName: 'edgestore',
        token: 'token_1',
      }),
      jsonResponse({ success: true }),
    ]);
    const { EdgeStoreProvider, useEdgeStore } = createEdgeStoreProvider<any>();

    function Consumer() {
      useEdgeStore();
      return null;
    }

    await act(async () => {
      root.render(
        <EdgeStoreProvider>
          <Consumer />
        </EdgeStoreProvider>,
      );
    });

    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });

    expect(calls[0]).toMatchObject({
      url: '/api/edgestore/init',
      init: {
        method: 'POST',
        credentials: 'include',
      },
    });
    expect(calls[1]).toMatchObject({
      url: 'https://files.edgestore.dev/_init',
      init: {
        method: 'GET',
        credentials: 'include',
        headers: {
          'x-edgestore-token': 'token_1',
        },
      },
    });
  });

  it('skips _init for non-EdgeStore providers', async () => {
    const { calls } = createFetchMock([
      jsonResponse({
        providerName: 's3',
      }),
    ]);
    const { EdgeStoreProvider, useEdgeStore } = createEdgeStoreProvider<any>();

    function Consumer() {
      useEdgeStore();
      return null;
    }

    await act(async () => {
      root.render(
        <EdgeStoreProvider>
          <Consumer />
        </EdgeStoreProvider>,
      );
    });

    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0]?.url).toBe('/api/edgestore/init');
  });

  it('reset reruns initialization', async () => {
    const { calls } = createFetchMock([
      jsonResponse({
        providerName: 'edgestore',
        requiresFileAccessCookie: false,
      }),
      jsonResponse({
        providerName: 'edgestore',
        requiresFileAccessCookie: false,
      }),
    ]);
    const { EdgeStoreProvider, useEdgeStore } = createEdgeStoreProvider<any>();
    let reset: (() => Promise<void>) | undefined;

    function Consumer() {
      reset = useEdgeStore().reset;
      return null;
    }

    await act(async () => {
      root.render(
        <EdgeStoreProvider>
          <Consumer />
        </EdgeStoreProvider>,
      );
    });
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });

    await act(async () => {
      await reset?.();
    });

    expect(calls.map((call) => call.url)).toEqual([
      '/api/edgestore/init',
      '/api/edgestore/init',
    ]);
  });
});
