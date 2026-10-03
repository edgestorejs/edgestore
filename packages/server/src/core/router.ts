import {
  initBucket,
  type AnyContext,
  type AnyEdgeStoreProvider,
  type AnyRouter,
  type BucketConfig,
  type EdgeStoreRouter,
} from '@edgestore/shared';
import {
  edgestore,
  type EdgeStoreBackendProvider,
} from '../providers/edgestore';
import { createBackendClient } from './client';

export type ConfiguredRouter<
  TRouter extends AnyRouter,
  TProvider extends AnyEdgeStoreProvider,
> = TRouter & {
  /** Return a new router bound to this provider. */
  provider<TNewProvider extends AnyEdgeStoreProvider>(
    provider: TNewProvider,
  ): ConfiguredRouter<TRouter, TNewProvider>;
  /** The backend client, with methods supported by this router's provider. */
  readonly client: ReturnType<typeof createBackendClient<TRouter, TProvider>>;
  /** @internal */
  readonly _def: { readonly provider: TProvider };
};

function configureRouter<
  TRouter extends AnyRouter,
  TProvider extends AnyEdgeStoreProvider,
>(
  router: TRouter,
  createProvider: () => TProvider,
): ConfiguredRouter<TRouter, TProvider> {
  let provider: TProvider | undefined;
  let client:
    ReturnType<typeof createBackendClient<TRouter, TProvider>> | undefined;
  const definition = {
    get provider() {
      return (provider ??= createProvider());
    },
  };

  return {
    ...router,
    _def: definition,
    provider(newProvider) {
      return configureRouter(router, () => newProvider);
    },
    get client() {
      return (client ??= createBackendClient(router, definition.provider));
    },
  };
}

type RouterBuilder<TCtx extends AnyContext> = {
  imageBucket(
    config?: BucketConfig,
  ): ReturnType<typeof initBucket<TCtx, 'IMAGE'>>;
  fileBucket(
    config?: BucketConfig,
  ): ReturnType<typeof initBucket<TCtx, 'FILE'>>;
  router<TBuckets extends EdgeStoreRouter<TCtx>['buckets']>(
    buckets: TBuckets,
  ): ConfiguredRouter<
    EdgeStoreRouter<TCtx, TBuckets>,
    EdgeStoreBackendProvider
  >;
};

class EdgeStoreBuilder<TCtx extends AnyContext = Record<string, never>> {
  context<TNewContext extends AnyContext>() {
    return new EdgeStoreBuilder<TNewContext>();
  }

  create(): RouterBuilder<TCtx> {
    return {
      imageBucket(config) {
        return initBucket<TCtx, 'IMAGE'>('IMAGE', config);
      },
      fileBucket(config) {
        return initBucket<TCtx, 'FILE'>('FILE', config);
      },
      router<TBuckets extends EdgeStoreRouter<TCtx>['buckets']>(
        buckets: TBuckets,
      ) {
        return configureRouter(
          { $config: { ctx: undefined as unknown as TCtx }, buckets },
          edgestore,
        );
      },
    };
  }
}

export const initEdgeStore = new EdgeStoreBuilder();
