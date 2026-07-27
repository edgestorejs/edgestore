import { type MaybePromise } from '@edgestore/shared';
import type { APIContext } from 'astro';
import Logger, { type LogLevel } from '../../libs/logger';
import { dispatchEdgeStoreRequest } from '../dispatcher';
import type { CookieConfig, HandlerEdgeStore } from '../shared';

export type Config<TCtx> = {
  edgeStore: HandlerEdgeStore<TCtx>;
  logLevel?: LogLevel;
  cookieConfig?: CookieConfig;
} & (TCtx extends Record<string, never>
  ? object
  : {
      edgeStore: HandlerEdgeStore<TCtx>;
      createContext: (opts: APIContext) => MaybePromise<TCtx>;
      cookieConfig?: CookieConfig;
    });

declare const globalThis: {
  _EDGE_STORE_LOGGER: Logger;
};

export function createEdgeStoreAstroHandler<TCtx>(config: Config<TCtx>) {
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Astro handler');

  return async (context: APIContext) => {
    const { request } = context;
    const url = new URL(request.url);
    return await dispatchEdgeStoreRequest({
      edgeStore: config.edgeStore,
      logger: log,
      cookieConfig: config.cookieConfig,
      request: {
        pathname: url.pathname,
        readJson: () => request.json(),
        getQuery: (name) => url.searchParams.get(name) ?? undefined,
        cookieHeader: request.headers.get('cookie') ?? undefined,
        createContext: () =>
          'createContext' in config
            ? config.createContext(context)
            : ({} as TCtx),
      },
    });
  };
}
