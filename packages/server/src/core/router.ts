import {
  initEdgeStore as initSharedEdgeStore,
  type AnyContext,
  type AnyEdgeStoreProvider,
  type AnyRouter,
  type EdgeStoreRouter,
} from '@edgestore/shared';
import {
  edgestore,
  type EdgeStoreBackendProvider,
} from '../providers/edgestore';
import { createBackendClient, type EdgeStoreClient } from './client';

export type RouterOptions = {
  /** Application handler URL used to proxy protected files in development. */
  baseUrl?: string;
};

export type ConfiguredRouter<
  TRouter extends AnyRouter,
  TProvider extends AnyEdgeStoreProvider,
> = TRouter & {
  /** Return a new router bound to this provider. */
  provider<TNewProvider extends AnyEdgeStoreProvider>(
    provider: TNewProvider,
  ): ConfiguredRouter<TRouter, TNewProvider>;
  /** The backend client, with methods supported by this router's provider. */
  readonly client: EdgeStoreClient<TRouter, TProvider>;
  /** @internal */
  readonly _def: RouterOptions & { readonly provider: TProvider };
};

function configureRouter<
  TRouter extends AnyRouter,
  TProvider extends AnyEdgeStoreProvider,
>(
  router: TRouter,
  createProvider: () => TProvider,
  options: RouterOptions,
): ConfiguredRouter<TRouter, TProvider> {
  let provider: TProvider | undefined;
  let client: EdgeStoreClient<TRouter, TProvider> | undefined;
  const definition = {
    baseUrl: options.baseUrl,
    get provider() {
      return (provider ??= createProvider());
    },
  };

  return {
    ...router,
    _def: definition,
    provider(newProvider) {
      return configureRouter(router, () => newProvider, definition);
    },
    get client() {
      return (client ??= createBackendClient(
        router,
        definition.provider,
        definition.baseUrl,
      ));
    },
  };
}

type SharedBuilder<TCtx extends AnyContext> = ReturnType<
  ReturnType<typeof initSharedEdgeStore.context<TCtx>>['create']
>;

type RouterBuilder<TCtx extends AnyContext> = Omit<
  SharedBuilder<TCtx>,
  'router'
> & {
  router<TBuckets extends EdgeStoreRouter<TCtx>['buckets']>(
    buckets: TBuckets,
    options?: RouterOptions,
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
    const builder = initSharedEdgeStore.context<TCtx>().create();
    return {
      ...builder,
      router<TBuckets extends EdgeStoreRouter<TCtx>['buckets']>(
        buckets: TBuckets,
        options: RouterOptions = {},
      ) {
        return configureRouter(builder.router(buckets), edgestore, options);
      },
    };
  }
}

export const initEdgeStore = new EdgeStoreBuilder();
