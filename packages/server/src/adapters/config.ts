import type {
  AnyContext,
  AnyEdgeStoreProvider,
  EdgeStoreRouter,
} from '@edgestore/shared';
import type { HandlerEdgeStore } from './shared';

export type HandlerConfig<TCtx extends AnyContext> =
  | {
      router: EdgeStoreRouter<TCtx> & {
        readonly _def: { readonly provider: AnyEdgeStoreProvider };
      };
      edgestore?: never;
    }
  | {
      edgestore: HandlerEdgeStore<TCtx>;
      router?: never;
    };

export function resolveHandlerConfig<TCtx extends AnyContext>(
  config: HandlerConfig<TCtx>,
): HandlerEdgeStore<TCtx> {
  if (config.edgestore) return config.edgestore;
  return { router: config.router, provider: config.router._def.provider };
}
