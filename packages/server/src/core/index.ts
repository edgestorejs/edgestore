import type {
  AnyRouter,
  BackendCapableEdgeStoreProvider,
  BackendProviderOperations,
  EdgeStoreProvider,
} from '@edgestore/shared';
import { createBackendClient, type EdgeStoreClient } from './client';

export * from './client';

export type ConfiguredEdgeStore<
  TRouter extends AnyRouter,
  TProvider extends EdgeStoreProvider,
> = {
  router: TRouter;
  provider: TProvider;
  baseUrl?: string;
} & (TProvider extends BackendCapableEdgeStoreProvider<BackendProviderOperations>
  ? { client: EdgeStoreClient<TRouter, TProvider> }
  : object);

export function createEdgeStore<
  TRouter extends AnyRouter,
  TProvider extends EdgeStoreProvider,
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
  const edgeStore = {
    router: config.router,
    provider: config.provider,
    baseUrl: config.baseUrl,
  };

  if (isBackendCapableProvider(config.provider)) {
    return {
      ...edgeStore,
      client: createBackendClient(
        config.router,
        config.provider,
        config.baseUrl,
      ),
    } as unknown as ConfiguredEdgeStore<TRouter, TProvider>;
  }

  return edgeStore as ConfiguredEdgeStore<TRouter, TProvider>;
}

function isBackendCapableProvider<TProvider extends EdgeStoreProvider>(
  provider: TProvider,
): provider is TProvider &
  BackendCapableEdgeStoreProvider<BackendProviderOperations> {
  return (
    'supportsBackendClient' in provider &&
    provider.supportsBackendClient === true
  );
}
