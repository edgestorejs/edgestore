import { type MaybePromise } from '@edgestore/shared';
import { type Context as HonoContext } from 'hono';
import Logger, { type LogLevel } from '../../libs/logger';
import { dispatchEdgeStoreRequest } from '../dispatcher';
import { type CookieConfig, type HandlerEdgeStore } from '../shared';

export type CreateContextOptions = {
  c: HonoContext;
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

export function createEdgeStoreHonoHandler<TCtx>(config: Config<TCtx>) {
  const { cookieConfig } = config;
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Hono handler');

  return async (c: HonoContext): Promise<Response> =>
    await dispatchEdgeStoreRequest({
      edgeStore: config.edgeStore,
      logger: log,
      cookieConfig,
      request: {
        pathname: new URL(c.req.url).pathname,
        readJson: () => c.req.json(),
        getQuery: (name) => c.req.query(name),
        cookieHeader: c.req.header('cookie'),
        createContext: () =>
          'createContext' in config
            ? config.createContext({ c })
            : ({} as TCtx),
      },
    });
}
