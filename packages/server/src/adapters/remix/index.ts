import { type MaybePromise } from '@edgestore/shared';
import Logger, { type LogLevel } from '../../libs/logger';
import { dispatchEdgeStoreRequest } from '../dispatcher';
import type { CookieConfig, HandlerEdgeStore } from '../shared';

export type CreateContextOptions = {
  req: Request;
};

export type Config<TCtx> = {
  edgeStore: HandlerEdgeStore<TCtx>;
  logLevel?: LogLevel;
  cookieConfig?: CookieConfig;
} & (TCtx extends Record<string, never>
  ? object
  : {
      edgeStore: HandlerEdgeStore<TCtx>;
      createContext: (opts: CreateContextOptions) => MaybePromise<TCtx>;
      cookieConfig?: CookieConfig;
    });

declare const globalThis: {
  _EDGE_STORE_LOGGER: Logger;
};

export function createEdgeStoreRemixHandler<TCtx>(config: Config<TCtx>) {
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Remix handler');

  return async ({ request: req }: { request: Request }) => {
    const url = new URL(req.url);
    return await dispatchEdgeStoreRequest({
      edgeStore: config.edgeStore,
      logger: log,
      cookieConfig: config.cookieConfig,
      request: {
        pathname: url.pathname,
        readJson: () => req.json(),
        getQuery: (name) => url.searchParams.get(name) ?? undefined,
        cookieHeader: req.headers.get('cookie') ?? undefined,
        createContext: () =>
          'createContext' in config
            ? config.createContext({ req })
            : ({} as TCtx),
      },
    });
  };
}
