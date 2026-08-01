import type { AnyEdgeStoreProvider, AnyRouter } from '@edgestore/shared';
import { createBackendClient, type EdgeStoreClient } from './client';

export * from './client';
export {
  defineProvider,
  getProviderBaseUrl,
  referenceFromUrl,
  validateProviderCursor,
  validateProviderReference,
} from './provider';

export type ConfiguredEdgeStore<
  TRouter extends AnyRouter,
  TProvider extends AnyEdgeStoreProvider,
> = {
  router: TRouter;
  provider: TProvider;
  baseUrl?: string;
  client: EdgeStoreClient<TRouter, TProvider>;
};

export function createEdgeStore<
  TRouter extends AnyRouter,
  TProvider extends AnyEdgeStoreProvider,
>(config: {
  router: TRouter;
  provider: TProvider;
  /**
   * Application EdgeStore handler URL used to proxy protected files during
   * local development.
   *
   * @example http://localhost:3000/api/edgestore
   */
  baseUrl?: string;
}): ConfiguredEdgeStore<TRouter, TProvider> {
  return {
    router: config.router,
    provider: config.provider,
    baseUrl: config.baseUrl,
    client: createBackendClient(config.router, config.provider, config.baseUrl),
  };
}
