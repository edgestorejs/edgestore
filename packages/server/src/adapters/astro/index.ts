import { type AnyContext } from '@edgestore/shared';
import type { APIContext } from 'astro';
import Logger, { type LogLevel } from '../../libs/logger';
import {
  dispatchEdgeStoreRequest,
  resolveContext,
  type CreateContextConfig,
} from '../dispatcher';
import type { CookieConfig, HandlerRouter } from '../shared';

export type Config<TCtx extends AnyContext> = {
  router: HandlerRouter<TCtx>;
  logLevel?: LogLevel;
  cookieConfig?: CookieConfig;
} & CreateContextConfig<TCtx, APIContext>;

export function createEdgeStoreAstroHandler<TCtx extends AnyContext>(
  config: Config<TCtx>,
) {
  const log = new Logger(config.logLevel);
  log.debug('Creating EdgeStore Astro handler');

  return async (context: APIContext) => {
    const { request } = context;
    const url = new URL(request.url);
    return await dispatchEdgeStoreRequest<TCtx>({
      router: config.router,
      logger: log,
      cookieConfig: config.cookieConfig,
      request: {
        pathname: url.pathname,
        readJson: () => request.json(),
        getQuery: (name) => url.searchParams.get(name) ?? undefined,
        cookieHeader: request.headers.get('cookie') ?? undefined,
        createContext: () => resolveContext<TCtx, APIContext>(config, context),
      },
    });
  };
}
