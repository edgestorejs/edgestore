import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveHandlerConfig } from '../adapters/config';
import { createConformanceProvider } from '../test-utils/adapterConformance.test.utils';
import { initEdgeStore } from './router';

afterEach(() => vi.unstubAllEnvs());

describe('configured routers', () => {
  const es = initEdgeStore.create();

  it('defers hosted credentials until the handler or backend client needs them', () => {
    vi.stubEnv('EDGE_STORE_ACCESS_KEY', '');
    vi.stubEnv('EDGE_STORE_SECRET_KEY', '');
    const router = es.router({ files: es.fileBucket() });

    expect(router.buckets.files).toBeDefined();
    expect(() => router.client).toThrow();
    expect(() => resolveHandlerConfig({ router })).toThrow();

    vi.stubEnv('EDGE_STORE_ACCESS_KEY', 'test-key');
    vi.stubEnv('EDGE_STORE_SECRET_KEY', 'test-secret');
    const config = resolveHandlerConfig({ router });
    expect(config.provider.name).toBe('edgestore');
    expect(resolveHandlerConfig({ router }).provider).toBe(config.provider);
    expect(router.client).toBe(router.client);
    expect(router.client.files.upload).toBeTypeOf('function');
  });

  it('shares a custom provider between handler and client without hosted credentials', async () => {
    vi.stubEnv('EDGE_STORE_ACCESS_KEY', '');
    vi.stubEnv('EDGE_STORE_SECRET_KEY', '');
    const provider = createConformanceProvider();
    const router = es.router({ files: es.fileBucket() }).provider(provider);

    expect(resolveHandlerConfig({ router }).provider).toBe(provider);
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
    const handlerConfig = resolveHandlerConfig({ router: first });
    const second = first.provider(secondProvider);
    const third = second.provider(thirdProvider);
    const ref = { url: 'https://files.example.com/_public/file' };

    await client.files.get(ref);
    await second.client.files.get(ref);
    await third.client.files.get(ref);

    expect(first.client).toBe(client);
    expect(second).not.toBe(first);
    expect(second.buckets).toBe(first.buckets);
    expect(handlerConfig.provider).toBe(firstProvider);
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
