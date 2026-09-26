import { type AnyContext } from '@edgestore/shared';
import Logger, { type LogLevel } from '../../libs/logger';
import { resolveHandlerConfig, type HandlerConfig } from '../config';
import {
  dispatchEdgeStoreRequest,
  resolveContext,
  type CreateContextConfig,
} from '../dispatcher';
import type { CookieConfig } from '../shared';

export type CreateContextOptions = {
  req: Request;
};

export type Config<TCtx extends AnyContext> = {
  logLevel?: LogLevel;
  cookieConfig?: CookieConfig;
} & HandlerConfig<TCtx> &
  CreateContextConfig<TCtx, CreateContextOptions>;

export function createEdgeStoreRemixHandler<TCtx extends AnyContext>(
  config: Config<TCtx>,
) {
  const edgestore = resolveHandlerConfig<TCtx>(config);
  const log = new Logger(config.logLevel);
  log.debug('Creating EdgeStore Remix handler');

  return async ({ request: req }: { request: Request }) => {
    const url = new URL(req.url);
    return await dispatchEdgeStoreRequest<TCtx>({
      edgestore,
      logger: log,
      cookieConfig: config.cookieConfig,
      request: {
        pathname: url.pathname,
        readJson: () => req.json(),
        getQuery: (name) => url.searchParams.get(name) ?? undefined,
        cookieHeader: req.headers.get('cookie') ?? undefined,
        createContext: () =>
          resolveContext<TCtx, CreateContextOptions>(config, {
            req,
          }),
      },
    });
  };
}
