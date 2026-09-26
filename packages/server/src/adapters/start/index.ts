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

export function createEdgeStoreStartHandler<TCtx extends AnyContext>(
  config: Config<TCtx>,
) {
  const edgestore = resolveHandlerConfig<TCtx>(config);
  const log = new Logger(config.logLevel);
  log.debug('Creating EdgeStore TanStack Start handler');

  return async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    return await dispatchEdgeStoreRequest<TCtx>({
      edgestore,
      logger: log,
      cookieConfig: config.cookieConfig,
      request: {
        pathname: url.pathname,
        readJson: () => request.json(),
        getQuery: (name) => url.searchParams.get(name) ?? undefined,
        cookieHeader: request.headers.get('cookie') ?? undefined,
        createContext: () =>
          resolveContext<TCtx, CreateContextOptions>(config, {
            req: request,
          }),
      },
    });
  };
}
