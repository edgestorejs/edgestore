import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEdgeStoreStartHandler } from '../adapters/start';
import { createConformanceProvider } from '../test-utils/adapterConformance.test.utils';
import { initEdgeStore } from './router';

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => vi.stubEnv('EDGE_STORE_JWT_SECRET', 'test-secret'));

function initRequest() {
  return { request: new Request('https://app.example.com/api/edgestore/init') };
}

describe('configured routers', () => {
  const es = initEdgeStore.create();

  it('defers hosted credentials until a request or backend client needs them', async () => {
    vi.stubEnv('EDGE_STORE_ACCESS_KEY', '');
    vi.stubEnv('EDGE_STORE_SECRET_KEY', '');
    const router = es.router({ files: es.fileBucket() });
    const handler = createEdgeStoreStartHandler({ router, logLevel: 'none' });

    expect(router.buckets.files).toBeDefined();
    expect(() => router.client).toThrow();
    expect((await handler(initRequest())).status).toBe(500);

    vi.stubEnv('EDGE_STORE_ACCESS_KEY', 'test-key');
    vi.stubEnv('EDGE_STORE_SECRET_KEY', 'test-secret');
    expect((await handler(initRequest())).status).toBe(200);
    const provider = router._def.provider;
    expect(provider.name).toBe('edgestore');
    expect((await handler(initRequest())).status).toBe(200);
    expect(router._def.provider).toBe(provider);
    expect(router.client).toBe(router.client);
    expect(router.client.files.upload).toBeTypeOf('function');
  });

  it('shares a custom provider between handler and client without hosted credentials', async () => {
    vi.stubEnv('EDGE_STORE_ACCESS_KEY', '');
    vi.stubEnv('EDGE_STORE_SECRET_KEY', '');
    const provider = createConformanceProvider();
    const router = es.router({ files: es.fileBucket() }).provider(provider);

    const handler = createEdgeStoreStartHandler({ router });
    expect((await handler(initRequest())).status).toBe(200);
    expect(provider.init).toHaveBeenCalledTimes(1);
    await router.client.files.get({
      url: 'https://files.example.com/_public/file',
    });
    expect(provider.files.get).toHaveBeenCalledWith({
      bucketName: 'files',
      file: { url: 'https://files.example.com/_public/file' },
    });
  });

  it('keeps existing clients and handlers bound to their original provider', async () => {
    const firstProvider = createConformanceProvider();
    const secondProvider = createConformanceProvider();
    const thirdProvider = createConformanceProvider();
    const first = es.router({ files: es.fileBucket() }).provider(firstProvider);
    const client = first.client;
    const handler = createEdgeStoreStartHandler({ router: first });
    const second = first.provider(secondProvider);
    const third = second.provider(thirdProvider);
    const ref = { url: 'https://files.example.com/_public/file' };

    await client.files.get(ref);
    await second.client.files.get(ref);
    await third.client.files.get(ref);
    expect((await handler(initRequest())).status).toBe(200);

    expect(first.client).toBe(client);
    expect(second).not.toBe(first);
    expect(second.buckets).toBe(first.buckets);
    expect(firstProvider.init).toHaveBeenCalledTimes(1);
    expect(secondProvider.init).not.toHaveBeenCalled();
    expect(thirdProvider.init).not.toHaveBeenCalled();
    for (const provider of [firstProvider, secondProvider, thirdProvider]) {
      expect(provider.files.get).toHaveBeenCalledTimes(1);
    }
  });

  it('preserves development proxy options across provider overrides', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const options = { baseUrl: 'http://localhost:3000/api/edgestore' };
    const router = es.router({ files: es.fileBucket() }, options);
    options.baseUrl = 'http://different.example/api/edgestore';
    const configured = router
      .provider(createConformanceProvider())
      .provider(createConformanceProvider());
    const url = 'https://files.example.com/protected/file';

    const file = await configured.client.files.get({ url });

    expect(file.url).toBe(
      `http://localhost:3000/api/edgestore/proxy-file?${new URLSearchParams({ url })}`,
    );
  });
});
