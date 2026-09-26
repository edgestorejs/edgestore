import { type AnyContext } from '@edgestore/shared';
import { type Context as HonoContext } from 'hono';
import Logger, { type LogLevel } from '../../libs/logger';
import {
  dispatchEdgeStoreRequest,
  resolveContext,
  type CreateContextConfig,
} from '../dispatcher';
import { type CookieConfig, type HandlerRouter } from '../shared';

export type CreateContextOptions = {
  c: HonoContext;
};

export type Config<TCtx extends AnyContext> = {
  router: HandlerRouter<TCtx>;
  logLevel?: LogLevel;
  cookieConfig?: CookieConfig;
} & CreateContextConfig<TCtx, CreateContextOptions>;

export function createEdgeStoreHonoHandler<TCtx extends AnyContext>(
  config: Config<TCtx>,
) {
  const { cookieConfig } = config;
  const log = new Logger(config.logLevel);
  log.debug('Creating EdgeStore Hono handler');

  return async (c: HonoContext): Promise<Response> =>
    await dispatchEdgeStoreRequest<TCtx>({
      router: config.router,
      logger: log,
      cookieConfig,
      request: {
        pathname: new URL(c.req.url).pathname,
        readJson: () => c.req.json(),
        getQuery: (name) => c.req.query(name),
        cookieHeader: c.req.header('cookie'),
        createContext: () =>
          resolveContext<TCtx, CreateContextOptions>(config, {
            c,
          }),
      },
    });
}
